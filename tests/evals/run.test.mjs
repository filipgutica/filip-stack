// Runs `pnpm eval:<name>` through promptfoo without paid model calls: dry runs for
// every eval, and the autonomy eval end to end against a local OpenAI-compatible
// stub, so a promptfoo upgrade that changes its results shape fails here.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
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

for (const name of ['routing', 'delegation', 'autonomy', 'workflow-rules']) {
  test(`the ${name} eval config validates in a dry run`, async () => {
    const { status, output } = await runEval({ args: [name, '--dry-run', '--base', 'HEAD'] })
    assert.equal(status, 0, output)
    assert.match(output, /Configuration is valid/u)
  })
}

test('the autonomy eval compares both guidance versions and applies the gate', async (t) => {
  const requests = []
  const server = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      requests.push(JSON.parse(body))
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '{"action": "ask user"}' } }] }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())

  // --base HEAD makes both versions identical, so only needsNewGuidance scenarios that
  // do not accept "ask user" can fail the gate.
  const { status, output } = await runEval({
    args: ['autonomy', '--base', 'HEAD', '--attempts', '1', '--model', 'gpt-6.1-sol'],
    env: { CLIPROXY_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`, CLIPROXY_API_KEY: 'test-key' },
  })

  assert.equal(requests.length, 18, output)
  assert.deepEqual(Object.keys(requests[0]).sort(), ['messages', 'model'])
  assert.equal(requests[0].model, 'gpt-6.1-sol')
  assert.match(output, /^## codex guidance, gpt-6\.1-sol$/mu)
  assert.match(output, /^\| archive-intent \| ask user \| 1\/1 \| 1\/1 \| ask user \|$/mu)
  assert.match(output, /^\| helper-name \| decide \| 0\/1 \| 0\/1 \| ask user \|$/mu)
  assert.match(output, /^3 scenario result\(s\) regressed against HEAD/mu)
  assert.equal(status, 1)
})
