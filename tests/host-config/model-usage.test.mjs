import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../host-config/agents/scripts/model-usage.mjs', import.meta.url))
const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString()
const fresh = () => new Date().toISOString()

// Runs the script with stub `codexbar` and `claude-swap` commands that print the given output.
// A stub set to null is not installed.
const run = ({ codexbar = {}, claudeSwap = null }) => {
  const bin = mkdtempSync(join(tmpdir(), 'model-usage-bin-'))
  const stub = (name, outputs) => {
    const data = join(bin, `${name}.json`)
    writeFileSync(data, JSON.stringify(outputs))
    const path = join(bin, name)
    // The stub picks its output by the --provider value, or `list` for claude-swap.
    writeFileSync(path, `#!${process.execPath}
const outputs = JSON.parse(require('node:fs').readFileSync(${JSON.stringify(data)}, 'utf8'))
const args = process.argv.slice(2)
const key = args.includes('--provider') ? args[args.indexOf('--provider') + 1] : args[0]
if (outputs[key] === undefined) { console.error('stub: no output for ' + key); process.exit(1) }
process.stdout.write(JSON.stringify(outputs[key]))
// Like CodexBar, exit non-zero after printing a JSON error result.
if (JSON.stringify(outputs[key]).includes('"error"')) process.exitCode = 1
`)
    chmodSync(path, 0o755)
  }
  if (codexbar) stub('codexbar', codexbar)
  if (claudeSwap) stub('claude-swap', claudeSwap)
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { PATH: `${bin}:/usr/bin:/bin` } })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout).providers
}

const codexbarEntry = ({ provider, usedPercent, expectedUsedPercent = 15, willLastToReset, updatedAt = fresh() }) => [{
  provider,
  rateWindowLabels: { secondary: 'Weekly' },
  usage: { updatedAt, primary: null, secondary: { usedPercent, resetsAt: inDays(5), windowMinutes: 10080 } },
  pace: { secondary: { willLastToReset, expectedUsedPercent } },
}]

const swapAccount = (usage) => ({
  schemaVersion: 1,
  accounts: [
    { number: 1, active: false, usage: { spend: { used: 10, limit: 400, currency: 'USD' } }, usageFetchedAt: fresh() },
    { number: 2, active: true, usage, usageFetchedAt: fresh() },
  ],
})

const hasCodex = !spawnSync('codex', ['--version'], { encoding: 'utf8' }).error

test('the installed Codex rule runs only the usage reader outside the sandbox', { skip: !hasCodex && 'codex is not installed' }, () => {
  const home = mkdtempSync(join(tmpdir(), 'model-usage-home-'))
  const rules = join(home, 'filip-stack.rules')
  const source = readFileSync(fileURLToPath(new URL('../../host-config/codex/rules/filip-stack.rules', import.meta.url)), 'utf8')
  writeFileSync(rules, source.replaceAll('{{HOME}}', home))
  const decision = (...argv) => {
    const result = spawnSync('codex', ['execpolicy', 'check', '--rules', rules, '--', ...argv], { encoding: 'utf8', timeout: 10000 })
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout).decision
  }
  assert.equal(decision('node', join(home, '.agents/scripts/model-usage.mjs')), 'allow')
  assert.notEqual(decision('node', join(home, '.agents/scripts/other.mjs')), 'allow')
  assert.notEqual(decision('node', '-e', 'process.exit()'), 'allow')
})

test('reads Codex from codexbar and marks a window well ahead of pace as short', () => {
  const { codex } = run({ codexbar: { codex: codexbarEntry({ provider: 'codex', usedPercent: 45, expectedUsedPercent: 15, willLastToReset: false }), claude: [] } })
  assert.equal(codex.status, 'short')
  assert.equal(codex.source, 'codexbar')
  assert.deepEqual(codex.windows.map(({ name, usedPercent }) => [name, usedPercent]), [['Weekly', 45]])
})

test('does not mark a window short when it is only slightly ahead of pace', () => {
  const { codex } = run({ codexbar: { codex: codexbarEntry({ provider: 'codex', usedPercent: 33, expectedUsedPercent: 29, willLastToReset: false }), claude: [] } })
  assert.equal(codex.status, 'ok')
})

test('marks a window at 90% used as short even when pace says it lasts', () => {
  const { codex } = run({ codexbar: { codex: codexbarEntry({ provider: 'codex', usedPercent: 90, willLastToReset: true }), claude: [] } })
  assert.equal(codex.status, 'short')
})

test('reads the active claude-swap account, with per-model windows, before codexbar', () => {
  const { claude } = run({
    codexbar: { codex: [], claude: codexbarEntry({ provider: 'claude', usedPercent: 99, willLastToReset: false }) },
    claudeSwap: { list: swapAccount({
      sevenDay: { pct: 33, expectedPct: 29, resetsAt: inDays(5), willLastToReset: false },
      scoped: [{ name: 'Fable', pct: 95, resetsAt: inDays(5), willLastToReset: true }],
    }) },
  })
  assert.equal(claude.source, 'claude-swap')
  assert.equal(claude.status, 'ok')
  assert.equal(claude.models.Fable.status, 'short')
})

test('falls back to codexbar for Claude when claude-swap is missing, fails, or has no active account', () => {
  const codexbar = { codex: [], claude: codexbarEntry({ provider: 'claude', usedPercent: 20, willLastToReset: true }) }
  assert.equal(run({ codexbar }).claude.source, 'codexbar')
  assert.equal(run({ codexbar, claudeSwap: { other: {} } }).claude.source, 'codexbar')
  assert.equal(run({ codexbar, claudeSwap: { list: { schemaVersion: 1, accounts: [] } } }).claude.source, 'codexbar')
})

test('reads per-model windows from codexbar, such as the Fable-only window', () => {
  const entry = codexbarEntry({ provider: 'claude', usedPercent: 43, willLastToReset: true })
  // Shape captured from CodexBar 0.84.0; the scoped window has no pace entry.
  entry[0].usage.extraRateWindows = [{
    id: 'claude-weekly-scoped-fable',
    title: 'Fable only',
    window: { windowMinutes: 10080, usedPercent: 92, resetsAt: inDays(5), resetDescription: 'Nov 15 at 8:00AM' },
  }]
  const { claude } = run({ codexbar: { codex: [], claude: entry } })
  assert.equal(claude.source, 'codexbar')
  assert.equal(claude.status, 'ok')
  assert.equal(claude.models.Fable.usedPercent, 92)
  assert.equal(claude.models.Fable.status, 'short')
})

test('reports no signal for a spend-only account, a provider error, a stale reading, or a missing codexbar', () => {
  const spendOnly = run({ codexbar: { codex: [] }, claudeSwap: { list: { accounts: [{ active: true, usage: { spend: { used: 1, limit: 2, currency: 'USD' } } }] } } })
  assert.equal(spendOnly.claude.status, 'no signal')
  assert.match(spendOnly.claude.reason, /spend/)

  const failed = run({ codexbar: { codex: [{ provider: 'codex', error: { message: 'Network error' } }], claude: [] } })
  assert.deepEqual([failed.codex.status, failed.codex.reason], ['no signal', 'Network error'])

  const stale = run({ codexbar: { codex: codexbarEntry({ provider: 'codex', usedPercent: 10, willLastToReset: true, updatedAt: inDays(-1) }), claude: [] } })
  assert.equal(stale.codex.status, 'no signal')
  const undated = run({ codexbar: { codex: codexbarEntry({ provider: 'codex', usedPercent: 10, willLastToReset: true, updatedAt: 'not a date' }), claude: [] } })
  assert.equal(undated.codex.status, 'no signal')

  const noUsage = run({ codexbar: { codex: [] }, claudeSwap: { list: { accounts: [{ active: true, usage: null, usageFetchedAt: fresh() }] } } })
  assert.equal(noUsage.claude.status, 'no signal')

  const unexpected = run({ codexbar: { codex: { provider: 'codex' }, claude: [] } })
  assert.deepEqual([unexpected.codex.status, unexpected.codex.source], ['no signal', 'codexbar'])
  assert.match(unexpected.codex.reason, /unexpected output/)

  const missing = run({ codexbar: null })
  assert.deepEqual([missing.codex.status, missing.claude.status], ['no signal', 'no signal'])
  assert.match(missing.codex.reason, /codexbar is not installed/)
})
