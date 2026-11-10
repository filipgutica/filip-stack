#!/usr/bin/env node
// Prints remaining Codex and Claude usage as JSON, for choosing delegation targets.
// Codex comes from the CodexBar CLI. Claude comes from claude-swap when it manages an
// active account, otherwise from CodexBar. A provider without a usable reading reports
// `no signal`, which means: use the role table as written.
import { execFile } from 'node:child_process'

const shortPercent = 90
// Pace marks a window short only when usage runs this many points ahead of the
// expected linear pace. Both tools call any amount ahead "will not last".
const paceMarginPercent = 10
const staleMs = 6 * 60 * 60 * 1000
const timeoutMs = 15_000

// Resolves to the parsed stdout. Some tools print a JSON error result and exit non-zero.
const runJson = ({ command, args }) => new Promise((resolve) => {
  execFile(command, args, { encoding: 'utf8', timeout: timeoutMs }, (error, stdout, stderr) => {
    if (error?.code === 'ENOENT') return resolve({ missing: true })
    try {
      return resolve({ value: JSON.parse(stdout) })
    } catch {
      const detail = error?.killed ? `timed out after ${timeoutMs / 1000}s` : stderr.trim().split('\n').at(-1) || error?.message || 'no JSON output'
      return resolve({ error: `${command} failed: ${detail}` })
    }
  })
})

const noSignal = ({ source, reason }) => ({ status: 'no signal', source, reason })
const isShort = ({ usedPercent, expectedPercent, willLastToReset }) => usedPercent >= shortPercent
  || (willLastToReset === false && usedPercent - expectedPercent >= paceMarginPercent)
const withStatus = (window) => ({ status: isShort(window) ? 'short' : 'ok', ...window })

const reading = ({ source, fetchedAt, windows, models = {} }) => {
  const age = Date.now() - Date.parse(fetchedAt)
  if (!(age <= staleMs)) return noSignal({ source, reason: `reading from ${fetchedAt} is missing, unreadable, or older than 6 hours` })
  if (windows.length === 0) return noSignal({ source, reason: 'no usage windows reported' })
  return {
    status: windows.some(isShort) ? 'short' : 'ok',
    source,
    fetchedAt,
    windows: windows.map(withStatus),
    models: Object.fromEntries(Object.entries(models).map(([name, window]) => [name, withStatus(window)])),
  }
}

const fromCodexbar = async (provider) => {
  const { value, error, missing } = await runJson({ command: 'codexbar', args: ['usage', '--provider', provider, '--format', 'json', '--no-color'] })
  if (missing) return noSignal({ source: 'codexbar', reason: 'codexbar is not installed' })
  if (error) return noSignal({ source: 'codexbar', reason: error })
  const entry = value.find((item) => item.provider === provider)
  if (!entry) return noSignal({ source: 'codexbar', reason: `codexbar reported nothing for ${provider}` })
  if (entry.error) return noSignal({ source: 'codexbar', reason: entry.error.message })
  const usage = entry.usage ?? {}
  const windows = ['primary', 'secondary', 'tertiary'].filter((key) => usage[key]).map((key) => ({
    name: entry.rateWindowLabels?.[key] ?? key,
    usedPercent: usage[key].usedPercent,
    expectedPercent: entry.pace?.[key]?.expectedUsedPercent,
    resetsAt: usage[key].resetsAt,
    willLastToReset: entry.pace?.[key]?.willLastToReset,
  }))
  // Model-scoped windows, such as Claude's "Fable only". CodexBar gives them no pace data.
  const models = Object.fromEntries((usage.extraRateWindows ?? []).map(({ title, window }) => [
    title.replace(/ only$/, ''),
    { usedPercent: window.usedPercent, resetsAt: window.resetsAt },
  ]))
  return reading({ source: 'codexbar', fetchedAt: usage.updatedAt, windows, models })
}

const swapWindow = ({ pct, expectedPct, resetsAt, willLastToReset }) => ({ usedPercent: pct, expectedPercent: expectedPct, resetsAt, willLastToReset })

// Returns null when claude-swap is absent, fails, or manages no active account.
const fromClaudeSwap = async () => {
  const { value } = await runJson({ command: 'claude-swap', args: ['list', '--json'] })
  const account = value?.accounts?.find((item) => item.active)
  if (!account) return null
  const { scoped, spend, ...rest } = account.usage ?? {}
  const windows = Object.entries(rest)
    .filter(([, window]) => typeof window?.pct === 'number')
    .map(([name, window]) => ({ name, ...swapWindow(window) }))
  if (windows.length === 0 && spend) {
    return noSignal({ source: 'claude-swap', reason: `spend-only account: ${spend.used} of ${spend.limit} ${spend.currency} used` })
  }
  const models = Object.fromEntries((scoped ?? []).map((window) => [window.name, swapWindow(window)]))
  return reading({ source: 'claude-swap', fetchedAt: account.usageFetchedAt, windows, models })
}

// An output shape this script does not expect gives no signal instead of a crash.
const safely = async ({ source, read }) => {
  try {
    return await read()
  } catch (error) {
    return noSignal({ source, reason: `unexpected output: ${error.message}` })
  }
}

const [codex, claude] = await Promise.all([
  safely({ source: 'codexbar', read: () => fromCodexbar('codex') }),
  safely({ source: 'claude-swap', read: async () => (await fromClaudeSwap()) ?? fromCodexbar('claude') }),
])
const output = {
  generatedAt: new Date().toISOString(),
  shortWhen: `at least ${shortPercent}% used, or projected to run out before the reset while ${paceMarginPercent} or more points ahead of the expected pace`,
  providers: { codex, claude },
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
