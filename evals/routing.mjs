// Prompt functions, test generator, and assertion for the Workflow routing eval.
// The `baseSkills` and `headSkills` prompts read the Workflow SKILL.md files at EVAL_BASE_REF
// and in the working tree. Each contract scenario becomes up to two tests: a skill
// step, where the model picks a skill from the catalog, and a reference step, where
// it lists the reference files the expected skill's body points it to.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseReply } from './reply.mjs'

const repoRoot = new URL('../', import.meta.url).pathname
const skillsPath = 'plugins/workflow/skills'
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

const readSkills = {
  base: () => {
    const ref = process.env.EVAL_BASE_REF ?? 'origin/main'
    return git(['ls-tree', '--name-only', `${ref}:${skillsPath}`]).split('\n').filter(Boolean)
      .map((name) => parseSkill(git(['show', `${ref}:${skillsPath}/${name}/SKILL.md`])))
  },
  head: () => readdirSync(join(repoRoot, skillsPath), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => parseSkill(readFileSync(join(repoRoot, skillsPath, entry.name, 'SKILL.md'), 'utf8'))),
}

// Reads lazily and once per version, so loading this module runs no git command.
const loaded = new Map()
const skillsAt = (version) => {
  if (!loaded.has(version)) loaded.set(version, readSkills[version]())
  return loaded.get(version)
}

// Lists the Workflow skills whose SKILL.md differs between the base ref and the working tree.
export const changedSkills = () => {
  const [base, head] = ['base', 'head'].map((version) => new Map(skillsAt(version).map((skill) => [skill.name, skill.text])))
  return [...new Set([...base.keys(), ...head.keys()])].filter((name) => base.get(name) !== head.get(name)).sort()
}

const messages = ({ version, vars }) => {
  const skills = skillsAt(version)
  if (vars.step === 'skill') {
    const catalog = skills.filter((skill) => !skill.manual).map((skill) => `- ${skill.name}: ${skill.description}`).join('\n')
    return [
      { role: 'system', content: `You are the skill router of a coding agent. Available skills:\n${catalog}\n\nA skill applies when its description matches the user's request. Reply with only JSON: {"skill": "<name>"} for the one skill to load, or {"skill": null} when no skill applies.` },
      { role: 'user', content: vars.prompt },
    ]
  }
  // A skill missing at this version has no body, so the model has no references to name.
  const body = skills.find(({ name }) => name === vars.skill)?.body ?? ''
  return [
    { role: 'system', content: `You follow the skill instructions below. Its linked reference files are not loaded yet.\n\n${body}\n\nList the linked reference files you would read before acting on the user's request. Reply with only JSON: {"references": ["<file name>"]}, or {"references": []} when none are needed.` },
    { role: 'user', content: vars.prompt },
  ]
}
export const baseSkills = ({ vars }) => messages({ version: 'base', vars })
export const headSkills = ({ vars }) => messages({ version: 'head', vars })

// Explicit scenarios load their skill by name, so they test only the reference step.
export const routingTests = () => JSON.parse(readFileSync(join(repoRoot, 'tests/workflow/contract-scenarios.json'), 'utf8')).scenarios
  .flatMap(({ id, prompt, activation, expectedSkill, expectedReference }) => {
    const metadata = { scenario: id, expects: [expectedSkill ?? 'no skill', expectedReference].filter(Boolean).join(' / ') }
    return [
      ...activation === 'explicit' ? [] : [{ description: `${id} skill`, vars: { step: 'skill', prompt }, metadata: { ...metadata, expectedSkill } }],
      ...expectedReference ? [{ description: `${id} reference`, vars: { step: 'reference', prompt, skill: expectedSkill }, metadata: { ...metadata, expectedReference } }] : [],
    ]
  })

// The skill step passes on the expected skill; a missing field fails, because only
// an explicit null means no skill applies. The reference step passes when the
// listed references include the expected file.
export const scoreRouting = (output, context) => {
  const reply = parseReply(output)
  const { expectedSkill, expectedReference } = context.test.metadata
  if (reply.invalid !== undefined) return { pass: false, score: 0, reason: `invalid reply "${reply.invalid}"` }
  if (context.vars.step === 'skill') {
    const pass = reply.skill === expectedSkill
    return { pass, score: pass ? 1 : 0, reason: `skill ${JSON.stringify(reply.skill)}` }
  }
  const references = Array.isArray(reply.references) ? reply.references.map((path) => String(path).split('/').at(-1)) : []
  const pass = references.includes(expectedReference)
  return { pass, score: pass ? 1 : 0, reason: `references ${references.join(', ') || 'none'}` }
}
