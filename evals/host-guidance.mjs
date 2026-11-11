// Prompt functions, test generators, and assertions for the host-guidance evals
// (delegation and autonomy). Each eval has two prompts, `baseGuidance` and
// `headGuidance`, which render the global guidance at EVAL_BASE_REF and in the
// working tree. The provider label (`claude` or `codex`) picks which host's
// rendered guidance the model sees.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseReply } from './reply.mjs'

const repoRoot = new URL('../', import.meta.url).pathname
const guidanceFiles = { claude: '.claude/CLAUDE.md', codex: '.codex/AGENTS.md' }

// Applies host config from `root` into a fresh home and returns each host's guidance.
const applyHostConfig = (root) => {
  const home = mkdtempSync(join(tmpdir(), 'eval-guidance-home-'))
  const env = { ...process.env, XDG_CACHE_HOME: process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), XDG_CONFIG_HOME: join(home, '.config') }
  const result = spawnSync(process.execPath, [join(root, 'scripts/host-config.mjs'), 'apply', '--home', home], { encoding: 'utf8', env })
  if (result.status !== 0) throw new Error(`host-config apply failed in ${root}: ${result.stderr}`)
  return Object.fromEntries(Object.entries(guidanceFiles).map(([host, file]) => [host, readFileSync(join(home, file), 'utf8')]))
}

// Renders lazily and once per version, so loading this module runs no git command.
const rendered = new Map()
export const renderGuidance = (version) => {
  if (!rendered.has(version)) {
    if (version === 'head') {
      rendered.set(version, applyHostConfig(repoRoot))
    } else {
      const ref = process.env.EVAL_BASE_REF ?? 'origin/main'
      const baseRoot = mkdtempSync(join(tmpdir(), 'eval-guidance-base-'))
      execFileSync('sh', ['-c', `git -C "${repoRoot}" archive "${ref}" host-config scripts/host-config.mjs plugins/field-guide | tar -x -C "${baseRoot}" && git init -q "${baseRoot}"`])
      rendered.set(version, applyHostConfig(baseRoot))
    }
  }
  return rendered.get(version)
}

const messages = ({ version, vars, provider }) => [
  { role: 'system', content: `${renderGuidance(version)[provider.label]}\n\n${vars.role}` },
  { role: 'user', content: vars.question },
]
export const baseGuidance = ({ vars, provider }) => messages({ version: 'base', vars, provider })
export const headGuidance = ({ vars, provider }) => messages({ version: 'head', vars, provider })

// Accepted choices sit in metadata, because promptfoo expands array vars into
// separate tests. `accept` is one list, or a list per host.
export const scenarioTests = ({ file, role, question }) => JSON.parse(readFileSync(join(repoRoot, file), 'utf8')).scenarios
  .map(({ id, accept, needsNewGuidance = false, ...scenario }) => ({
    description: id,
    vars: { role, question: question(scenario) },
    metadata: {
      scenario: id,
      accept,
      expects: Array.isArray(accept) ? accept.join(', ') : Object.fromEntries(Object.entries(accept).map(([host, list]) => [host, list.join(', ')])),
      needsNewGuidance,
    },
  }))

// Passes when the classified choice is one the scenario accepts for this host. The
// reason is the choice, which the gate prints.
export const scoreChoice = ({ choice, context }) => {
  const { accept } = context.test.metadata
  const accepts = Array.isArray(accept) ? accept : accept[context.provider.label]
  const pass = accepts.includes(choice)
  return { pass, score: pass ? 1 : 0, reason: choice }
}

// Delegation: where should the work run? Scored by provider and tier.
const okUsage = {
  codex: { status: 'ok', source: 'codexbar', windows: [{ name: 'Weekly', usedPercent: 20, status: 'ok', willLastToReset: true }] },
  claude: { status: 'ok', source: 'claude-swap', windows: [{ name: 'sevenDay', usedPercent: 20, status: 'ok', willLastToReset: true }] },
}

export const delegationTests = () => scenarioTests({
  file: 'tests/host-config/delegation-scenarios.json',
  role: 'You are the main thread in T3 Code. You can call delegate_task with any provider and model the guidance names, or use the native subagent profiles it names.',
  question: (scenario) => [
    scenario.task,
    `Current provider usage, from the usage reader:\n${JSON.stringify({ providers: scenario.usage ?? okUsage })}`,
    'Decide where this work runs. Do not do the work. Reply with only JSON: {"where": "this thread"} or {"where": "delegate", "model": "<the model ID the delegated work runs on; for a native profile, the model ID that profile runs on>"}.',
  ].join('\n\n'),
})

// Maps a reply's model name to provider.tier through the first word of each roster label.
const roster = JSON.parse(readFileSync(join(repoRoot, 'host-config/models.json'), 'utf8'))
const families = Object.entries(roster).flatMap(([provider, tiers]) => Object.entries(tiers).map(([tier, { label }]) => [label.split(' ')[0].toLowerCase(), `${provider}.${tier}`]))
const classifyDelegation = (reply) => {
  if (reply.invalid !== undefined) return `invalid reply "${reply.invalid}"`
  if (reply.where === 'this thread') return 'self'
  const name = String(reply.model ?? '').toLowerCase()
  return families.find(([family]) => new RegExp(`\\b${family}\\b`).test(name))?.[1] ?? `unknown model ${JSON.stringify(reply.model)}`
}
export const scoreDelegation = (output, context) => scoreChoice({ choice: classifyDelegation(parseReply(output)), context })

// Autonomy: who settles an open decision?
const actions = ['decide', 'advisor', 'council', 'ask user']

export const autonomyTests = () => scenarioTests({
  file: 'tests/host-config/autonomy-scenarios.json',
  role: 'You are the main thread in T3 Code, partway through a long task the user authorized. You have an advisor tool, can delegate to the models the guidance names, and can use the council skill.',
  question: (scenario) => [
    scenario.task,
    'Choose how this open decision gets settled. Do not settle it. Reply with only JSON: {"action": "<one of: decide (make the call yourself and continue), advisor (ask an advisor model and adopt its answer), council (convene a multi-model council), ask user (stop and ask the user)>"}.',
  ].join('\n\n'),
})

const classifyAutonomy = (reply) => {
  if (reply.invalid !== undefined) return `invalid reply "${reply.invalid}"`
  // Models sometimes echo the option's description, such as "decide (make the call yourself ...)".
  return actions.find((action) => String(reply.action ?? '').startsWith(action)) ?? `unknown action ${JSON.stringify(reply.action)}`
}
export const scoreAutonomy = (output, context) => scoreChoice({ choice: classifyAutonomy(parseReply(output)), context })
