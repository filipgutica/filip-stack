#!/usr/bin/env node
// Entry point for `pnpm eval:<name>`. Runs evals/<name>.yaml with promptfoo, which
// compares the guidance at a base ref (the `base` prompt) with the working tree
// (the `working tree` prompt) through the local CLIProxyAPI, then applies the
// base-versus-working-tree gate to promptfoo's results.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { formatTables, gate } from './gate.mjs'
import { autonomyTests, delegationTests, renderGuidance } from './host-guidance.mjs'
import { changedSkills, routingTests } from './routing.mjs'
import { hillClimbTests, prepareHillClimb } from './hill-climb.mjs'
import { prepareRetrieval, retrievalTests } from './retrieval.mjs'
import { prepareRules, workflowRulesTests } from './workflow-rules.mjs'

const evalsDir = new URL('./', import.meta.url).pathname
const promptfoo = new URL('../node_modules/.bin/promptfoo', import.meta.url).pathname

// Renders both guidance versions, so a bad base ref fails before any model call.
const prepareHostGuidance = () => {
  renderGuidance('base')
  renderGuidance('head')
  return true
}
const hostGuidanceTitle = ({ id, label }) => `${label} guidance, ${id.replace('openai:chat:', '')}`

const evals = {
  routing: {
    tests: routingTests,
    // Routing compares only when a Workflow SKILL.md changed.
    prepare: () => {
      const changed = changedSkills()
      if (changed.length === 0) {
        console.log(`No Workflow SKILL.md changes against ${process.env.EVAL_BASE_REF}; nothing to compare.`)
        return false
      }
      console.log(`Changed against ${process.env.EVAL_BASE_REF}: ${changed.join(', ')}`)
      return true
    },
    title: ({ id }) => id.replace('openai:chat:', ''),
  },
  delegation: { tests: delegationTests, prepare: prepareHostGuidance, title: hostGuidanceTitle },
  autonomy: { tests: autonomyTests, prepare: prepareHostGuidance, title: hostGuidanceTitle },
  'workflow-rules': { tests: workflowRulesTests, prepare: prepareRules, title: ({ id }) => id.replace('openai:chat:', '') },
  'hill-climb': { tests: hillClimbTests, prepare: prepareHillClimb, title: ({ id }) => id.replace('openai:chat:', '') },
  retrieval: { tests: retrievalTests, prepare: prepareRetrieval, title: ({ id }) => id.replace('openai:chat:', '') },
}

const name = process.argv[2]
const usage = `Usage: pnpm eval:${name ?? '<name>'} [--base <ref>] [--attempts <n>] [--model <id>]... [--api-key-file <path>] [--dry-run]`
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
  },
})
const attempts = Number(options.attempts)
if (!Number.isInteger(attempts) || attempts < 1) throw new Error(`--attempts must be a positive integer\n${usage}`)

const config = join(evalsDir, `${name}.yaml`)
// The prompt functions read the base ref from the environment, in this process and in promptfoo's.
process.env.EVAL_BASE_REF = options.base
const env = { ...process.env, PROMPTFOO_DISABLE_TELEMETRY: '1', PROMPTFOO_DISABLE_UPDATE: '1' }
const run = (args, extraEnv = {}) => {
  const result = spawnSync(promptfoo, args, { stdio: 'inherit', env: { ...env, ...extraEnv } })
  if (result.error) throw result.error
  return result.status
}

if (run(['validate', '-c', config]) !== 0) process.exit(1)
if (!definition.prepare()) process.exit(0)

// --model narrows the providers in evals/providers.yaml; a model must be listed there.
const providers = readFileSync(join(evalsDir, 'providers.yaml'), 'utf8').match(/^- id: openai:chat:\S+$/gmu).map((line) => line.slice('- id: openai:chat:'.length))
const unknown = options.model.filter((model) => !providers.includes(model))
if (unknown.length > 0) throw new Error(`Add ${unknown.join(', ')} to evals/providers.yaml to evaluate it\n${usage}`)
const models = options.model.length > 0 ? options.model : providers

const tests = definition.tests()
console.log(`Base: ${options.base}; tests: ${tests.length}; attempts: ${attempts}; models: ${models.join(', ')}`)
console.log(`Model calls: ${tests.length * attempts * 2} per model`)
if (options['dry-run']) process.exit(0)

if (options['api-key-file']) env.CLIPROXY_API_KEY = (await readFile(options['api-key-file'], 'utf8')).trim()
if (!env.CLIPROXY_API_KEY) throw new Error('Set CLIPROXY_API_KEY or pass --api-key-file with one of the client api-keys in the CLIProxyAPI config')

const outputDir = mkdtempSync(join(tmpdir(), `eval-${name}-`))
const output = join(outputDir, 'results.json')
const status = run([
  'eval', '-c', config, '--repeat', String(attempts), '--max-concurrency', '4',
  '--filter-providers', `^openai:chat:(${models.map((model) => model.replaceAll('.', '\\.')).join('|')})$`,
  '--no-cache', '--no-share', '--no-table', '--no-progress-bar', '--output', output,
  '--description', `${name}: ${options.base} vs working tree`,
], { PROMPTFOO_FAILED_TEST_EXIT_CODE: '0' })
if (status !== 0) process.exit(status ?? 1)

// promptfoo fails a run when any output fails; base failures are expected, so the gate decides.
// The export repeats what promptfoo saved in its results store, so remove it once read.
const { evalId, results } = JSON.parse(await readFile(output, 'utf8'))
rmSync(outputDir, { recursive: true })
const { tables, regressions } = gate({ results: results.results, attempts })
console.log(`\n${formatTables({ tables, attempts, title: definition.title })}`)
console.log(`\nSaved as promptfoo eval ${evalId}. Open it with: pnpm eval:view`)
if (regressions > 0) {
  console.log(`\n${regressions} scenario result(s) regressed against ${options.base}, or did not gain where the new guidance should.`)
  process.exitCode = 1
}
