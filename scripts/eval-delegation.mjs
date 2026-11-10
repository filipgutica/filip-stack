#!/usr/bin/env node
// Local check for host-config delegation guidance. Renders the global guidance at a
// base ref and in the working tree, asks each host's main-thread model where a task
// should run, and scores the answer by provider and tier.

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { abTasks, createClient, parseEvalArgs, runPool } from './eval-shared.mjs'

const repoRoot = new URL('../', import.meta.url).pathname
const usage = 'Usage: pnpm eval:delegation [--base <ref>] [--attempts <n>] [--api-key-file <path>] [--dry-run]'
const concurrency = 4
// The main-thread model for each host's guidance.
const hosts = { claude: { model: 'claude-opus-5-5', guidance: '.claude/CLAUDE.md' }, codex: { model: 'gpt-6.1-sol', guidance: '.codex/AGENTS.md' } }

const { options, attempts } = parseEvalArgs({ usage })

// Applies host config from `root` into a fresh home and returns each host's guidance.
const render = (root) => {
  const home = mkdtempSync(join(tmpdir(), 'eval-delegation-home-'))
  const env = { ...process.env, XDG_CACHE_HOME: process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), XDG_CONFIG_HOME: join(home, '.config') }
  const result = spawnSync(process.execPath, [join(root, 'scripts/host-config.mjs'), 'apply', '--home', home], { encoding: 'utf8', env })
  if (result.status !== 0) throw new Error(`host-config apply failed in ${root}: ${result.stderr}`)
  return Object.fromEntries(Object.entries(hosts).map(([host, { guidance }]) => [host, readFileSync(join(home, guidance), 'utf8')]))
}

const baseRoot = mkdtempSync(join(tmpdir(), 'eval-delegation-base-'))
execFileSync('sh', ['-c', `git -C "${repoRoot}" archive "${options.base}" host-config scripts/host-config.mjs plugins/field-guide | tar -x -C "${baseRoot}" && git init -q "${baseRoot}"`])
const guidance = { base: render(baseRoot), head: render(repoRoot) }

const { scenarios } = JSON.parse(readFileSync(join(repoRoot, 'tests/host-config/delegation-scenarios.json'), 'utf8'))
const callsPerModel = scenarios.length * attempts * 2
console.log(`Base: ${options.base}; scenarios: ${scenarios.length}; attempts: ${attempts}`)
console.log(`Model calls: ${callsPerModel} each for ${Object.values(hosts).map(({ model }) => model).join(' and ')}`)
if (options['dry-run']) process.exit(0)

// Maps a reply's model name to provider.tier through the first word of each roster label.
const roster = JSON.parse(readFileSync(join(repoRoot, 'host-config/models.json'), 'utf8'))
const families = Object.entries(roster).flatMap(([provider, tiers]) => Object.entries(tiers).map(([tier, { label }]) => [label.split(' ')[0].toLowerCase(), `${provider}.${tier}`]))
const classify = (reply) => {
  if (reply.invalid !== undefined) return `invalid reply "${reply.invalid}"`
  if (reply.where === 'this thread') return 'self'
  const name = String(reply.model ?? '').toLowerCase()
  return families.find(([family]) => new RegExp(`\\b${family}\\b`).test(name))?.[1] ?? `unknown model ${JSON.stringify(reply.model)}`
}

const okUsage = {
  codex: { status: 'ok', source: 'codexbar', windows: [{ name: 'Weekly', usedPercent: 20, status: 'ok', willLastToReset: true }] },
  claude: { status: 'ok', source: 'claude-swap', windows: [{ name: 'sevenDay', usedPercent: 20, status: 'ok', willLastToReset: true }] },
}

const { askJson } = await createClient({ apiKeyFile: options['api-key-file'] })
const ask = ({ host, version, scenario }) => askJson({
  model: hosts[host].model,
  system: `${guidance[version][host]}\n\nYou are the main thread in T3 Code. You can call delegate_task with any provider and model the guidance names, or use the native subagent profiles it names.`,
  user: [
    scenario.task,
    `Current provider usage, from the usage reader:\n${JSON.stringify({ providers: scenario.usage ?? okUsage })}`,
    'Decide where this work runs. Do not do the work. Reply with only JSON: {"where": "this thread"} or {"where": "delegate", "model": "<model ID or name the delegated work runs on>"}.',
  ].join('\n\n'),
})

let regressions = 0
for (const host of Object.keys(hosts)) {
  const tasks = abTasks({ scenarios, attempts, run: async ({ scenario, version }) => ({ choice: classify(await ask({ host, version, scenario })) }) })
  const results = await runPool({ tasks, concurrency })

  console.log(`\n## ${host} guidance, ${hosts[host].model}`)
  console.log('| Scenario | Accepts | Base | Working tree | Working tree choices |')
  console.log('| --- | --- | --- | --- | --- |')
  let totals = { base: 0, head: 0 }
  for (const scenario of scenarios) {
    const accepted = scenario.accept[host]
    const passes = (version) => results.filter((result) => result.id === scenario.id && result.version === version && accepted.includes(result.choice)).length
    const [base, head] = [passes('base'), passes('head')]
    totals = { base: totals.base + base, head: totals.head + head }
    if (head < base) regressions++
    const choices = results.filter((result) => result.id === scenario.id && result.version === 'head').map(({ choice }) => choice)
    console.log(`| ${scenario.id} | ${accepted.join(', ')} | ${base}/${attempts} | ${head}/${attempts} | ${choices.join(', ')} |`)
  }
  console.log(`Total: base ${totals.base}/${scenarios.length * attempts}, working tree ${totals.head}/${scenarios.length * attempts}`)
}

if (regressions > 0) {
  console.log(`\n${regressions} scenario result(s) regressed against ${options.base}.`)
  process.exitCode = 1
}
