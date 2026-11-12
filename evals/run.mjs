#!/usr/bin/env node
// Entry point for `pnpm eval:<name>`. Runs evals/<name>.yaml with promptfoo, which
// compares the guidance at a base ref (the `base` prompt) with the working tree
// (the `working tree` prompt) through the local CLIProxyAPI, then applies the
// base-versus-working-tree gate to promptfoo's results. With --no-base, it runs only
// the working tree and every attempt must pass, which checks guidance on a new model.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { formatTables, gate } from './gate.mjs'
import { autonomyTests, delegationTests, renderGuidance } from './host-guidance.mjs'
import { routingChanges, routingSkills, routingTests } from './routing.mjs'
import { hillClimbTests, prepareHillClimb } from './hill-climb.mjs'
import { prepareRetrieval, retrievalTests } from './retrieval.mjs'
import { skillRulesTests } from './rules.mjs'
import { readSkillScenarios } from './skill-scenarios.mjs'
import { prepareRules, workflowRulesTests } from './workflow-rules.mjs'

const evalsDir = new URL('./', import.meta.url).pathname
const promptfoo = new URL('../node_modules/.bin/promptfoo', import.meta.url).pathname

// Renders the guidance it will send, so a bad base ref fails before any model call.
const prepareHostGuidance = ({ noBase }) => {
  if (!noBase) renderGuidance('base')
  renderGuidance('head')
}
const prepareRouting = ({ noBase }) => {
  if (noBase) return
  const { catalog, bodies } = routingChanges()
  console.log(`Against ${process.env.EVAL_BASE_REF}: skill catalog ${catalog ? 'changed' : 'unchanged'}; skill bodies changed: ${bodies.join(', ') || 'none'}`)
}
const hostGuidanceTitle = ({ id, label }) => `${label} guidance, ${id.replace('openai:chat:', '')}`
const modelTitle = ({ id }) => id.replace('openai:chat:', '')

// `skills` lists the names --skill accepts, for the tests that have per-skill scenarios.
const evals = {
  routing: { tests: routingTests, prepare: prepareRouting, title: modelTitle, skills: routingSkills },
  delegation: { tests: delegationTests, prepare: prepareHostGuidance, title: hostGuidanceTitle },
  autonomy: { tests: autonomyTests, prepare: prepareHostGuidance, title: hostGuidanceTitle },
  'workflow-rules': { tests: workflowRulesTests, prepare: prepareRules, title: modelTitle },
  'skill-rules': {
    tests: skillRulesTests,
    prepare: prepareRules,
    title: modelTitle,
    skills: () => new Set(readSkillScenarios().filter(({ rules }) => rules.length > 0).map(({ skill }) => skill)),
  },
  'hill-climb': { tests: hillClimbTests, prepare: prepareHillClimb, title: modelTitle },
  retrieval: { tests: retrievalTests, prepare: prepareRetrieval, title: modelTitle },
}

const name = process.argv[2]
const usage = `Usage: pnpm eval:${name ?? '<name>'} [--base <ref> | --no-base] [--skill <name>] [--attempts <n>] [--model <id>]... [--api-key-file <path>] [--dry-run]`
const definition = evals[name]
if (!definition) throw new Error(`Unknown eval ${JSON.stringify(name)}; expected one of ${Object.keys(evals).join(', ')}`)
const { values: options } = parseArgs({
  args: process.argv.slice(3),
  options: {
    base: { type: 'string', default: 'origin/main' },
    attempts: { type: 'string', default: '3' },
    model: { type: 'string', multiple: true, default: [] },
    'api-key-file': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'no-base': { type: 'boolean', default: false },
    skill: { type: 'string' },
  },
})
const attempts = Number(options.attempts)
if (!Number.isInteger(attempts) || attempts < 1) throw new Error(`--attempts must be a positive integer\n${usage}`)

if (options.skill && !definition.skills) throw new Error(`--skill applies to ${Object.keys(evals).filter((key) => evals[key].skills).join(' and ')}\n${usage}`)
if (options.skill && !definition.skills().has(options.skill)) throw new Error(`No ${name} scenarios for skill ${JSON.stringify(options.skill)}`)
// One skill's scenarios are its unit tests: they run without a base.
const noBase = options['no-base'] || Boolean(options.skill)

const config = join(evalsDir, `${name}.yaml`)
// The prompt functions and test generators read these, in this process and in promptfoo's.
process.env.EVAL_BASE_REF = options.base
process.env.EVAL_NO_BASE = noBase ? '1' : ''
process.env.EVAL_SKILL = options.skill ?? ''
const env = { ...process.env, PROMPTFOO_DISABLE_TELEMETRY: '1', PROMPTFOO_DISABLE_UPDATE: '1' }
const run = (args, extraEnv = {}) => {
  const result = spawnSync(promptfoo, args, { stdio: 'inherit', env: { ...env, ...extraEnv } })
  if (result.error) throw result.error
  return result.status
}

if (run(['validate', '-c', config]) !== 0) process.exit(1)
// Routing and rules read a missing file at the base ref as empty, so check the ref first.
if (!noBase) execFileSync('git', ['rev-parse', '--verify', '--quiet', `${options.base}^{commit}`], { stdio: 'ignore' })
const tests = definition.tests()
definition.prepare({ tests, noBase })

// --model narrows the providers in evals/providers.yaml; a model must be listed there.
const providers = readFileSync(join(evalsDir, 'providers.yaml'), 'utf8').match(/^- id: openai:chat:\S+$/gmu).map((line) => line.slice('- id: openai:chat:'.length))
const unknown = options.model.filter((model) => !providers.includes(model))
if (unknown.length > 0) throw new Error(`Add ${unknown.join(', ')} to evals/providers.yaml to evaluate it\n${usage}`)
const models = options.model.length > 0 ? options.model : providers

const versions = noBase ? 1 : 2
console.log(`${noBase ? 'No base' : `Base: ${options.base}`}; tests: ${tests.length}; attempts: ${attempts}; models: ${models.join(', ')}`)
console.log(`Model calls: ${tests.length * attempts * versions} per model`)
if (tests.length === 0) {
  console.log('No tests selected; nothing to run.')
  process.exit(0)
}
if (options['dry-run']) process.exit(0)

if (options['api-key-file']) env.CLIPROXY_API_KEY = (await readFile(options['api-key-file'], 'utf8')).trim()
if (!env.CLIPROXY_API_KEY) throw new Error('Set CLIPROXY_API_KEY or pass --api-key-file with one of the client api-keys in the CLIProxyAPI config')

const outputDir = mkdtempSync(join(tmpdir(), `eval-${name}-`))
const output = join(outputDir, 'results.json')
const status = run([
  'eval', '-c', config, '--repeat', String(attempts), '--max-concurrency', '4',
  '--filter-providers', `^openai:chat:(${models.map((model) => model.replaceAll('.', '\\.')).join('|')})$`,
  '--no-cache', '--no-share', '--no-table', '--no-progress-bar', '--output', output,
  ...noBase ? ['--filter-prompts', '^working tree$'] : [],
  '--description', noBase ? `${name}: working tree${options.skill ? `, ${options.skill}` : ''}` : `${name}: ${options.base} vs working tree`,
], { PROMPTFOO_FAILED_TEST_EXIT_CODE: '0' })
if (status !== 0) process.exit(status ?? 1)

// promptfoo fails a run when any output fails; base failures are expected, so the gate decides.
// The export repeats what promptfoo saved in its results store, so remove it once read.
const { evalId, results } = JSON.parse(await readFile(output, 'utf8'))
rmSync(outputDir, { recursive: true })
const { tables, regressions } = gate({ results: results.results, attempts, noBase })
console.log(`\n${formatTables({ tables, attempts, title: definition.title })}`)
console.log(`\nSaved as promptfoo eval ${evalId}. Open it with: pnpm eval:view`)
if (regressions > 0) {
  console.log(noBase
    ? `\n${regressions} scenario result(s) missed an attempt in the working tree.`
    : `\n${regressions} scenario result(s) regressed against ${options.base}, or did not gain where the new guidance should.`)
  process.exitCode = 1
}
