#!/usr/bin/env node
// Local pre-push check for Workflow skill edits. Sends the contract scenarios to
// models through a local CLIProxyAPI OpenAI-compatible endpoint, once with the
// SKILL.md files at a base ref and once with the working tree, and reports
// scenarios whose skill or reference routing changed.

import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

const repoRoot = new URL('../', import.meta.url)
const skillsPath = 'plugins/workflow/skills'
const usage = 'Usage: pnpm eval:routing --model <id> [--model <id>] [--base <ref>] [--attempts <n>] [--api-key-file <path>] [--dry-run]'
const concurrency = 4

const { values: options } = parseArgs({
  options: {
    model: { type: 'string', multiple: true, default: [] },
    base: { type: 'string', default: 'origin/main' },
    attempts: { type: 'string', default: '3' },
    'api-key-file': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
})
const attempts = Number(options.attempts)
if (!Number.isInteger(attempts) || attempts < 1) throw new Error(`--attempts must be a positive integer\n${usage}`)

const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })

const parseSkill = (text) => {
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? ''
  return {
    name: frontmatter.match(/^name:\s*(.+)$/mu)?.[1].trim(),
    description: frontmatter.match(/^description:\s*(.+)$/mu)?.[1].trim().replace(/^"(.*)"$/u, '$1'),
    manual: /^disable-model-invocation:\s*true$/mu.test(frontmatter),
    body: text.replace(/^---\n[\s\S]*?\n---\n?/u, ''),
    text,
  }
}

const readBaseSkills = (ref) => git(['ls-tree', '--name-only', `${ref}:${skillsPath}`])
  .split('\n')
  .filter(Boolean)
  .map((name) => parseSkill(git(['show', `${ref}:${skillsPath}/${name}/SKILL.md`])))

const readWorkingSkills = async () => {
  const entries = await readdir(new URL(`${skillsPath}/`, repoRoot), { withFileTypes: true })
  const names = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name)
  return Promise.all(names.map(async (name) => parseSkill(await readFile(new URL(`${skillsPath}/${name}/SKILL.md`, repoRoot), 'utf8'))))
}

const versions = { base: readBaseSkills(options.base), head: await readWorkingSkills() }
const baseText = new Map(versions.base.map((skill) => [skill.name, skill.text]))
const headText = new Map(versions.head.map((skill) => [skill.name, skill.text]))
const changedSkills = [...new Set([...baseText.keys(), ...headText.keys()])]
  .filter((name) => baseText.get(name) !== headText.get(name))
  .sort()

if (changedSkills.length === 0) {
  console.log(`No Workflow SKILL.md changes against ${options.base}; nothing to compare.`)
  process.exit(0)
}

// Explicit scenarios load their skill by name, so only their reference choice depends on the skill text.
const { scenarios: allScenarios } = JSON.parse(await readFile(new URL('tests/workflow/contract-scenarios.json', repoRoot), 'utf8'))
const scenarios = allScenarios.filter(({ activation, expectedReference }) => activation !== 'explicit' || expectedReference)
const callsPerRound = scenarios.reduce((sum, { activation, expectedReference }) =>
  sum + (activation === 'explicit' ? 0 : 1) + (expectedReference ? 1 : 0), 0)

console.log(`Changed against ${options.base}: ${changedSkills.join(', ')}`)
console.log(`Scenarios: ${scenarios.length} of ${allScenarios.length}; attempts: ${attempts}; models: ${options.model.join(', ') || 'none'}`)
console.log(`Model calls: at most ${callsPerRound * attempts * 2} per model`)
if (options['dry-run']) process.exit(0)

if (options.model.length === 0) throw new Error(`Pass at least one --model\n${usage}`)
const baseUrl = process.env.CLIPROXY_BASE_URL ?? 'http://127.0.0.1:8317/v1'
const apiKey = options['api-key-file'] ? (await readFile(options['api-key-file'], 'utf8')).trim() : process.env.CLIPROXY_API_KEY
if (!apiKey) throw new Error('Set CLIPROXY_API_KEY or pass --api-key-file with one of the client api-keys in the CLIProxyAPI config')

const askJson = async ({ model, system, user }) => {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!response.ok) throw new Error(`${model}: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`)
  const content = (await response.json()).choices?.[0]?.message?.content ?? ''
  try {
    return JSON.parse(content.match(/\{[\s\S]*\}/u)?.[0] ?? '')
  } catch {
    // A reply without valid JSON counts as a failed attempt, not a run failure.
    return { invalid: content.slice(0, 80) }
  }
}

const pickSkill = async ({ model, skills, scenario }) => {
  const catalog = skills.filter((skill) => !skill.manual).map((skill) => `- ${skill.name}: ${skill.description}`).join('\n')
  const reply = await askJson({
    model,
    system: `You are the skill router of a coding agent. Available skills:\n${catalog}\n\nA skill applies when its description matches the user's request. Reply with only JSON: {"skill": "<name>"} for the one skill to load, or {"skill": null} when no skill applies.`,
    user: scenario.prompt,
  })
  return reply.invalid === undefined ? reply.skill ?? null : `invalid reply "${reply.invalid}"`
}

const pickReferences = async ({ model, skill, scenario }) => {
  const reply = await askJson({
    model,
    system: `You follow the skill instructions below. Its linked reference files are not loaded yet.\n\n${skill.body}\n\nList the linked reference files you would read before acting on the user's request. Reply with only JSON: {"references": ["<file name>"]}, or {"references": []} when none are needed.`,
    user: scenario.prompt,
  })
  return Array.isArray(reply.references) ? reply.references.map((path) => String(path).split('/').at(-1)) : []
}

const runAttempt = async ({ model, skills, scenario }) => {
  const skillName = scenario.activation === 'explicit' ? scenario.expectedSkill : await pickSkill({ model, skills, scenario })
  if (skillName !== scenario.expectedSkill) return `skill ${skillName}`
  if (!scenario.expectedReference) return null
  const skill = skills.find(({ name }) => name === skillName)
  if (!skill) return `skill ${skillName} missing`
  const references = await pickReferences({ model, skill, scenario })
  return references.includes(scenario.expectedReference) ? null : `references ${references.join(', ') || 'none'}`
}

const runPool = async (tasks) => {
  const results = []
  let next = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < tasks.length) {
      const index = next++
      results[index] = await tasks[index]()
    }
  }))
  return results
}

let regressions = 0
for (const model of options.model) {
  const tasks = scenarios.flatMap((scenario) => ['base', 'head'].flatMap((version) =>
    Array.from({ length: attempts }, () => async () => ({
      id: scenario.id,
      version,
      failure: await runAttempt({ model, skills: versions[version], scenario }),
    }))))
  const results = await runPool(tasks)

  const rows = scenarios.map(({ id }) => {
    const attemptsFor = (version) => results.filter((result) => result.id === id && result.version === version)
    const passes = (version) => attemptsFor(version).filter(({ failure }) => failure === null).length
    const base = passes('base')
    const head = passes('head')
    const failures = [...new Set(attemptsFor('head').map(({ failure }) => failure).filter(Boolean))]
    const status = head < base ? 'regressed' : head > base ? 'improved' : base === attempts ? 'same' : base === 0 ? 'fails on both' : 'unstable'
    return { id, base, head, status, failures }
  })
  regressions += rows.filter(({ status }) => status === 'regressed').length

  console.log(`\n## ${model}`)
  console.log(`Base passes: ${rows.reduce((sum, row) => sum + row.base, 0)}/${scenarios.length * attempts}; working tree passes: ${rows.reduce((sum, row) => sum + row.head, 0)}/${scenarios.length * attempts}`)
  const statusOrder = ['regressed', 'improved', 'unstable', 'fails on both']
  const notable = rows
    .filter(({ status }) => status !== 'same')
    .sort((left, right) => statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status))
  if (notable.length === 0) {
    console.log('Every scenario passed every attempt on both versions.')
    continue
  }
  console.log('| Scenario | Base | Working tree | Status | Working tree failures |')
  console.log('| --- | --- | --- | --- | --- |')
  for (const row of notable) {
    console.log(`| ${row.id} | ${row.base}/${attempts} | ${row.head}/${attempts} | ${row.status} | ${row.failures.join('; ')} |`)
  }
}

if (regressions > 0) {
  console.log(`\n${regressions} scenario result(s) regressed against ${options.base}.`)
  process.exitCode = 1
}
