// Shared parts of the local evaluation scripts, which compare a base ref with the
// working tree through a local CLIProxyAPI OpenAI-compatible endpoint.
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

// Parses the options every evaluation script takes, plus its own `extra` options.
export const parseEvalArgs = ({ usage, extra = {} }) => {
  const { values: options } = parseArgs({
    options: {
      ...extra,
      base: { type: 'string', default: 'origin/main' },
      attempts: { type: 'string', default: '3' },
      'api-key-file': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  })
  const attempts = Number(options.attempts)
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error(`--attempts must be a positive integer\n${usage}`)
  return { options, attempts }
}

// One task per scenario, version (`base` or `head`), and attempt. Each result
// carries the scenario id and version beside what `run` returns.
export const abTasks = ({ scenarios, attempts, run }) => scenarios.flatMap((scenario) => ['base', 'head'].flatMap((version) =>
  Array.from({ length: attempts }, () => async () => ({ id: scenario.id, version, ...await run({ scenario, version }) }))))

export const createClient = async ({ apiKeyFile }) => {
  const baseUrl = process.env.CLIPROXY_BASE_URL ?? 'http://127.0.0.1:8317/v1'
  const apiKey = apiKeyFile ? (await readFile(apiKeyFile, 'utf8')).trim() : process.env.CLIPROXY_API_KEY
  if (!apiKey) throw new Error('Set CLIPROXY_API_KEY or pass --api-key-file with one of the client api-keys in the CLIProxyAPI config')

  const askJson = async ({ model, system, user }) => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    })
    // An error body can echo the request, so redact the key before printing server text.
    if (!response.ok) throw new Error(`${model}: HTTP ${response.status} ${(await response.text()).replaceAll(apiKey, '<redacted>').slice(0, 300)}`)
    const content = (await response.json()).choices?.[0]?.message?.content ?? ''
    try {
      return JSON.parse(content.match(/\{[\s\S]*\}/u)?.[0] ?? '')
    } catch {
      // A reply without valid JSON counts as a failed attempt, not a run failure.
      return { invalid: content.slice(0, 80) }
    }
  }
  return { askJson }
}

// Runs async tasks with a fixed number in flight and keeps their order.
export const runPool = async ({ tasks, concurrency }) => {
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
