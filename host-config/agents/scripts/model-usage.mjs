#!/usr/bin/env node
// Prints remaining Codex and Claude usage as JSON, for choosing delegation targets.
// Codex comes from the CodexBar CLI. Claude comes from claude-swap when it manages an
// active account, otherwise from CodexBar. A provider without a usable reading reports
// `no signal`, which means: use the role table as written.
import { spawnSync } from 'node:child_process'

const shortPercent = 90
const staleMs = 6 * 60 * 60 * 1000

const runJson = ({ command, args }) => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60_000 })
  if (result.error?.code === 'ENOENT') return { missing: true }
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr.trim().split('\n').at(-1) || `exit ${result.status}`
    return { error: `${command} failed: ${detail}` }
  }
  try {
    return { value: JSON.parse(result.stdout) }
  } catch {
    return { error: `${command} did not print JSON` }
  }
}

const noSignal = ({ source, reason }) => ({ status: 'no signal', source, reason })
const isShort = ({ usedPercent, willLastToReset }) => usedPercent >= shortPercent || willLastToReset === false
const withStatus = (window) => ({ status: isShort(window) ? 'short' : 'ok', ...window })

const reading = ({ source, fetchedAt, windows, models = {} }) => {
  if (fetchedAt && Date.now() - Date.parse(fetchedAt) > staleMs) return noSignal({ source, reason: `reading from ${fetchedAt} is older than 6 hours` })
  if (windows.length === 0) return noSignal({ source, reason: 'no usage windows reported' })
  return {
    status: windows.some(isShort) ? 'short' : 'ok',
    source,
    fetchedAt,
    windows: windows.map(withStatus),
    models: Object.fromEntries(Object.entries(models).map(([name, window]) => [name, withStatus(window)])),
  }
}

const fromCodexbar = (provider) => {
  const { value, error, missing } = runJson({ command: 'codexbar', args: ['usage', '--provider', provider, '--format', 'json', '--no-color'] })
  if (missing) return noSignal({ source: 'codexbar', reason: 'codexbar is not installed' })
  if (error) return noSignal({ source: 'codexbar', reason: error })
  const entry = value.find((item) => item.provider === provider)
  if (!entry) return noSignal({ source: 'codexbar', reason: `codexbar reported nothing for ${provider}` })
  if (entry.error) return noSignal({ source: 'codexbar', reason: entry.error.message })
  const usage = entry.usage ?? {}
  const windows = ['primary', 'secondary', 'tertiary'].filter((key) => usage[key]).map((key) => ({
    name: entry.rateWindowLabels?.[key] ?? key,
    usedPercent: usage[key].usedPercent,
    resetsAt: usage[key].resetsAt,
    willLastToReset: entry.pace?.[key]?.willLastToReset,
  }))
  // Per-model windows, such as "Fable only", when CodexBar reports them.
  const models = Object.fromEntries((usage.extraRateWindows ?? []).map(({ title, window }) => [
    title.replace(/ only$/, ''),
    { usedPercent: window.usedPercent, resetsAt: window.resetsAt },
  ]))
  return reading({ source: 'codexbar', fetchedAt: usage.updatedAt, windows, models })
}

const swapWindow = ({ pct, resetsAt, willLastToReset }) => ({ usedPercent: pct, resetsAt, willLastToReset })

// Returns null when claude-swap is absent, fails, or manages no active account.
const fromClaudeSwap = () => {
  const { value } = runJson({ command: 'claude-swap', args: ['list', '--json'] })
  const account = value?.accounts?.find((item) => item.active)
  if (!account) return null
  const { scoped = [], spend, ...rest } = account.usage ?? {}
  const windows = Object.entries(rest)
    .filter(([, window]) => typeof window?.pct === 'number')
    .map(([name, window]) => ({ name, ...swapWindow(window) }))
  if (windows.length === 0 && spend) {
    return noSignal({ source: 'claude-swap', reason: `spend-only account: ${spend.used} of ${spend.limit} ${spend.currency} used` })
  }
  const models = Object.fromEntries(scoped.map((window) => [window.name, swapWindow(window)]))
  return reading({ source: 'claude-swap', fetchedAt: account.usageFetchedAt, windows, models })
}

const output = {
  generatedAt: new Date().toISOString(),
  shortWhen: `at least ${shortPercent}% used, or projected to run out before the reset`,
  providers: { codex: fromCodexbar('codex'), claude: fromClaudeSwap() ?? fromCodexbar('claude') },
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
