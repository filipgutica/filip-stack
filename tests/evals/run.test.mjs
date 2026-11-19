// Runs `pnpm eval:<name>` through promptfoo without paid model calls: dry runs for
// every eval, and the autonomy eval end to end against a local OpenAI-compatible
// stub, so a promptfoo upgrade that changes its results shape fails here.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const runner = new URL('../../evals/run.mjs', import.meta.url).pathname

const runEval = async ({ args, env = {} }) => {
  // A fresh promptfoo home keeps test runs out of the user's saved results.
  const child = spawn(process.execPath, [runner, ...args], { env: { ...process.env, PROMPTFOO_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'promptfoo-home-')), ...env } })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  const status = await new Promise((resolve) => child.on('close', resolve))
  return { status, output }
}

for (const name of ['routing', 'delegation', 'autonomy', 'handoff', 'host-rules', 'delegation-rules', 'workflow-rules', 'coding-standards', 'skill-rules', 'hill-climb', 'retrieval']) {
  test(`the ${name} eval config validates in a dry run`, async () => {
    const { status, output } = await runEval({ args: [name, '--dry-run', '--base', 'HEAD'] })
    assert.equal(status, 0, output)
    assert.match(output, /Configuration is valid/u)
  })
}

// Starts a local OpenAI-compatible stub that gives every request the same reply.
const startStub = async (t, content) => {
  const requests = []
  const authorizations = []
  const server = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      requests.push(JSON.parse(body))
      authorizations.push(request.headers.authorization)
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }] }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  return { requests, authorizations, env: { CLIPROXY_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`, CLIPROXY_API_KEY: 'test-key' } }
}

// A home whose secrets folder holds the given CLIProxyAPI key, or none.
const homeWithKey = (key) => {
  const home = mkdtempSync(join(tmpdir(), 'eval-home-'))
  if (key !== undefined) {
    mkdirSync(join(home, '.config', 'secrets'), { recursive: true })
    writeFileSync(join(home, '.config', 'secrets', 'cliproxy-client-key'), `${key}\n`)
  }
  return home
}

test('without CLIPROXY_API_KEY the runner reads the key from the secrets folder', async (t) => {
  const { requests, authorizations, env } = await startStub(t, '{"skill": "council"}')
  const { output } = await runEval({
    args: ['routing', '--skill', 'council', '--attempts', '1', '--model', 'gpt-6.2-sol'],
    env: { ...env, CLIPROXY_API_KEY: '', HOME: homeWithKey('file-key') },
  })
  assert.equal(requests.length, 6, output)
  assert.ok(authorizations.every((value) => value === 'Bearer file-key'), output)
})

test('with no key anywhere the runner names the secrets file and calls nothing', async (t) => {
  const { requests, env } = await startStub(t, '{"skill": "council"}')
  const { status, output } = await runEval({
    args: ['routing', '--skill', 'council', '--attempts', '1', '--model', 'gpt-6.2-sol'],
    env: { ...env, CLIPROXY_API_KEY: '', HOME: homeWithKey() },
  })
  assert.notEqual(status, 0)
  assert.equal(requests.length, 0)
  assert.match(output, /Put one of the CLIProxyAPI client api-keys in .*\.config\/secrets\/cliproxy-client-key/u)
})

test('the autonomy eval compares both guidance versions and applies the gate', async (t) => {
  const { requests, env } = await startStub(t, '{"action": "ask user"}')

  // The stub always answers "ask user", so only needsNewGuidance scenarios
  // that reject that answer can fail the gate, even when the guidance differs.
  const { status, output } = await runEval({
    args: ['autonomy', '--base', 'HEAD', '--attempts', '1', '--model', 'gpt-6.2-sol', '--model', 'gpt-6.2-astra'],
    env,
  })

  assert.equal(requests.length, 44, output)
  assert.deepEqual(Object.keys(requests[0]).sort(), ['messages', 'model'])
  assert.equal(requests.filter(({ model }) => model === 'gpt-6.2-sol').length, 22)
  assert.equal(requests.filter(({ model }) => model === 'gpt-6.2-astra').length, 22)
  assert.match(output, /^## codex guidance, gpt-6\.2-sol$/mu)
  assert.match(output, /^## codex guidance, gpt-6\.2-astra$/mu)
  assert.match(output, /^\| archive-intent \| ask user \| 1\/1 \| 1\/1 \| ask user \|$/mu)
  assert.match(output, /^\| helper-name \| decide \| 0\/1 \| 0\/1 \| ask user \|$/mu)
  assert.match(output, /^6 scenario result\(s\) regressed against HEAD/mu)
  assert.equal(status, 1)
})

test('routing for one skill runs without a base and must pass every attempt', async (t) => {
  const { requests, env } = await startStub(t, '{"skill": "council"}')
  const { status, output } = await runEval({ args: ['routing', '--skill', 'council', '--attempts', '1', '--model', 'gpt-6.2-sol'], env })

  // Six scenarios name council, all in its own file.
  assert.equal(requests.length, 6, output)
  assert.match(requests[0].messages[0].content, /^- council: /mu)
  assert.match(requests[0].messages[0].content, /^- jira-work-links: Use when creating, correcting/mu)
  assert.match(output, /^\| council-question \| council \| - \| 1\/1 \| skill "council" \|$/mu)
  assert.match(output, /^\| council-near-review \| review \| - \| 0\/1 \| skill "council" \|$/mu)
  assert.match(output, /^1 scenario result\(s\) missed an attempt in the working tree\./mu)
  assert.equal(status, 1)
})
