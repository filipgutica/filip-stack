// Shared parts of the local evaluation scripts, which compare a base ref with the
// working tree through a local CLIProxyAPI OpenAI-compatible endpoint.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
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

// Applies host config at `base` and in the working tree into fresh homes, and
// returns each host's rendered guidance as { base: { host: text }, head: { ... } }.
const renderHostGuidance = ({ repoRoot, base, hosts }) => {
  const render = (root) => {
    const home = mkdtempSync(join(tmpdir(), 'eval-guidance-home-'))
    const env = { ...process.env, XDG_CACHE_HOME: process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), XDG_CONFIG_HOME: join(home, '.config') }
    const result = spawnSync(process.execPath, [join(root, 'scripts/host-config.mjs'), 'apply', '--home', home], { encoding: 'utf8', env })
    if (result.status !== 0) throw new Error(`host-config apply failed in ${root}: ${result.stderr}`)
    return Object.fromEntries(Object.entries(hosts).map(([host, { guidance }]) => [host, readFileSync(join(home, guidance), 'utf8')]))
  }
  const baseRoot = mkdtempSync(join(tmpdir(), 'eval-guidance-base-'))
  execFileSync('sh', ['-c', `git -C "${repoRoot}" archive "${base}" host-config scripts/host-config.mjs plugins/field-guide | tar -x -C "${baseRoot}" && git init -q "${baseRoot}"`])
  return { base: render(baseRoot), head: render(repoRoot) }
}

// Prints one A/B table of accepted choices per scenario and returns how many
// scenarios regressed. A scenario marked `needsNewGuidance` must gain over the
// base unless it already passes every attempt.
const reportScenarios = ({ title, scenarios, results, attempts, accepted }) => {
  console.log(`\n## ${title}`)
  console.log('| Scenario | Accepts | Base | Working tree | Working tree choices |')
  console.log('| --- | --- | --- | --- | --- |')
  let totals = { base: 0, head: 0 }
  let regressions = 0
  for (const scenario of scenarios) {
    const accepts = accepted(scenario)
    const passes = (version) => results.filter((result) => result.id === scenario.id && result.version === version && accepts.includes(result.choice)).length
    const [base, head] = [passes('base'), passes('head')]
    totals = { base: totals.base + base, head: totals.head + head }
    if (head < base || (scenario.needsNewGuidance && head <= base && head < attempts)) regressions++
    const choices = results.filter((result) => result.id === scenario.id && result.version === 'head').map(({ choice }) => choice)
    console.log(`| ${scenario.id} | ${accepts.join(', ')} | ${base}/${attempts} | ${head}/${attempts} | ${choices.join(', ')} |`)
  }
  console.log(`Total: base ${totals.base}/${scenarios.length * attempts}, working tree ${totals.head}/${scenarios.length * attempts}`)
  return regressions
}

// The main-thread model for each host's guidance.
const hosts = { claude: { model: 'claude-opus-5-5', guidance: '.claude/CLAUDE.md' }, codex: { model: 'gpt-6.1-sol', guidance: '.codex/AGENTS.md' } }

// Runs one host-guidance A/B evaluation: renders the guidance at the base ref and
// in the working tree, asks each host's main-thread model about every scenario in
// `scenarioFile`, and prints a table per host. `system(guidance)` and
// `user(scenario)` build the prompt, `classify(reply)` turns a reply into a
// choice, and `accepted(scenario, host)` lists the passing choices.
export const runHostGuidanceEval = async ({ name, scenarioFile, system, user, classify, accepted }) => {
  const repoRoot = new URL('../', import.meta.url).pathname
  const usage = `Usage: pnpm eval:${name} [--base <ref>] [--attempts <n>] [--api-key-file <path>] [--dry-run]`
  const { options, attempts } = parseEvalArgs({ usage })
  const guidance = renderHostGuidance({ repoRoot, base: options.base, hosts })
  const { scenarios } = JSON.parse(readFileSync(join(repoRoot, scenarioFile), 'utf8'))
  console.log(`Base: ${options.base}; scenarios: ${scenarios.length}; attempts: ${attempts}`)
  console.log(`Model calls: ${scenarios.length * attempts * 2} each for ${Object.values(hosts).map(({ model }) => model).join(' and ')}`)
  if (options['dry-run']) return

  const { askJson } = await createClient({ apiKeyFile: options['api-key-file'] })
  let regressions = 0
  for (const [host, { model }] of Object.entries(hosts)) {
    const ask = ({ scenario, version }) => askJson({ model, system: system(guidance[version][host]), user: user(scenario) })
    const tasks = abTasks({ scenarios, attempts, run: async (task) => ({ choice: classify(await ask(task)) }) })
    const results = await runPool({ tasks, concurrency: 4 })
    regressions += reportScenarios({ title: `${host} guidance, ${model}`, scenarios, results, attempts, accepted: (scenario) => accepted(scenario, host) })
  }
  if (regressions > 0) {
    console.log(`\n${regressions} scenario result(s) regressed against ${options.base}, or did not gain where the new guidance should.`)
    process.exitCode = 1
  }
}
