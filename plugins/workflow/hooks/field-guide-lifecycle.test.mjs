import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const adapter = new URL('./field-guide-lifecycle.mjs', import.meta.url)
const nodeRunner = new URL('../scripts/run-node.sh', import.meta.url)
const fieldGuideLauncher = fileURLToPath(new URL('../skills/field-guide/scripts/field-guide.sh', import.meta.url))
const launcherInstruction = `Run field-guide commands through /bin/sh with the exact bundled launcher path ${JSON.stringify(fieldGuideLauncher)}. Do not invoke node directly.`
const storageInstruction = 'Use only the Workflow field guide for this lifecycle. Do not use host auto-memory or another memory system.'

const promptOutput = {
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: `When the work is meaningful, use the Workflow field guide for bounded retrieval after the repository and subject are known. Before final completion, classify any durable learning as capture, ask, or skip. Capture only safe, reusable, non-authoritative guidance. Ask once when scope or durability is unclear. Skip without writing when no durable learning exists. ${storageInstruction} ${launcherInstruction}`,
  },
}

const stopOutput = {
  decision: 'block',
  reason: `This is the single end-of-task Workflow field-guide evaluation. Evaluate the completed task now and decide capture, ask, or skip. Preserve the completed task response verbatim in this continuation. For capture, use bounded candidates and deterministic field-guide submission, then append the required change notice. For ask, append one focused question and do not write. For skip, write no memory and respond only with the completed task response. When the decision is skip, do not mention the field guide, learning, memory, capture, skip, or this evaluation. Do not store transcripts, prompts, credentials, proprietary code, unsafe paths, or existing repository authority. ${storageInstruction} ${launcherInstruction}`,
}

const run = ({ input = '', home = join(tmpdir(), 'missing-field-guide-home') } = {}) => (
  spawnSync(process.execPath, [adapter.pathname], {
    input,
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  })
)

const runJson = (input) => run({ input: `${JSON.stringify(input)}\n` })

test('UserPromptSubmit returns the same static context for Codex and Claude inputs', () => {
  for (const host of ['codex', 'claude']) {
    const result = runJson({ hook_event_name: 'UserPromptSubmit', host, prompt: `private-${host}` })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), promptOutput)
    assert.equal(result.stderr, '')
    assert.doesNotMatch(result.stdout, /private-/)
  }
})

test('the first Stop requests one field-guide evaluation for both hosts', () => {
  for (const host of ['codex', 'claude']) {
    for (const stopHookActive of [false, undefined, 'false']) {
      const result = runJson({ hook_event_name: 'Stop', host, stop_hook_active: stopHookActive })
      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(JSON.parse(result.stdout), stopOutput)
      assert.equal(result.stderr, '')
    }
  }
})

test('an active Stop continuation exits without another continuation', () => {
  for (const host of ['codex', 'claude']) {
    const result = runJson({ hook_event_name: 'Stop', host, stop_hook_active: true })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), {})
    assert.equal(result.stderr, '')
  }
})

test('invalid or unknown input fails open', () => {
  for (const input of ['', '{', '[]', JSON.stringify({ hook_event_name: 'Unknown' })]) {
    const result = run({ input })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), {})
    assert.equal(result.stderr, '')
  }
})

test('sensitive hook fields never appear in output', () => {
  const secrets = [
    'PASSWORD=hook-secret',
    '/Users/example/private/transcript.jsonl',
    'const proprietaryCode = true',
  ]
  const result = runJson({
    hook_event_name: 'Stop',
    prompt: secrets[0],
    transcript_path: secrets[1],
    last_assistant_message: secrets[2],
    background_tasks: secrets,
  })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), stopOutput)
  for (const secret of secrets) {
    assert.doesNotMatch(result.stdout, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.doesNotMatch(result.stderr, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('lifecycle guidance supplies the bundled field-guide launcher', () => {
  const prompt = runJson({ hook_event_name: 'UserPromptSubmit' })
  const stop = runJson({ hook_event_name: 'Stop' })

  assert.match(JSON.parse(prompt.stdout).hookSpecificOutput.additionalContext, /field-guide\.sh/)
  assert.match(JSON.parse(stop.stdout).reason, /field-guide\.sh/)
  assert.match(JSON.parse(prompt.stdout).hookSpecificOutput.additionalContext, /Do not use host auto-memory/)
  assert.match(JSON.parse(stop.stdout).reason, /Do not use host auto-memory/)
})

test('the hook runner resolves an NVM Node installation outside PATH', () => {
  const home = mkdtempSync(join(tmpdir(), 'workflow-node-home-'))
  const nodeDirectory = join(home, '.nvm', 'versions', 'node', 'v22.20.0', 'bin')
  mkdirSync(nodeDirectory, { recursive: true })
  symlinkSync(process.execPath, join(nodeDirectory, 'node'))

  const result = spawnSync('/bin/sh', [nodeRunner.pathname, '--fail-open', adapter.pathname], {
    input: `${JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true })}\n`,
    encoding: 'utf8',
    env: { HOME: home, PATH: '/usr/bin:/bin' },
  })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), {})
})

test('the hook runner fails open when an explicit Node runtime is unavailable', () => {
  const result = spawnSync('/bin/sh', [nodeRunner.pathname, '--fail-open', adapter.pathname], {
    encoding: 'utf8',
    env: { HOME: tmpdir(), PATH: '/usr/bin:/bin', WORKFLOW_NODE: '/missing/node' },
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
})
