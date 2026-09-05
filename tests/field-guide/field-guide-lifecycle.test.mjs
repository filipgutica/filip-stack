import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { fieldGuidePluginRoot } from './plugin-paths.mjs'

const adapter = new URL('hooks/field-guide-lifecycle.mjs', fieldGuidePluginRoot)
const nodeRunner = new URL('scripts/run-node.sh', fieldGuidePluginRoot)
const pluginRoot = fileURLToPath(fieldGuidePluginRoot)
const hookCommand = JSON.parse(
  readFileSync(new URL('hooks/hooks.json', fieldGuidePluginRoot), 'utf8'),
).hooks.UserPromptSubmit[0].hooks[0].command
const promptOutput = {
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: 'Before your final response, privately choose capture, ask, or skip for durable learning. Preserve the normal task response for every decision. Skip uses no tools, writes nothing, and adds nothing. If capture is warranted, follow $field-guide:field-guide and append only its concise change notice. If ask is warranted, append one focused learning question and write no memory while awaiting the answer. Learning must not delay or replace the task result. Add no other lifecycle or storage text. This evaluation is advisory.',
  },
}

const hostEnvironment = {
  claude: { CLAUDE_PLUGIN_ROOT: '/plugins/field-guide' },
  codex: { PLUGIN_ROOT: '/plugins/field-guide' },
}

const run = ({ input = '', home = join(tmpdir(), 'missing-field-guide-home'), env = {} } = {}) => (
  spawnSync(process.execPath, [adapter.pathname], {
    input,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      PLUGIN_ROOT: undefined,
      CLAUDE_PLUGIN_ROOT: undefined,
      ...env,
    },
  })
)

const runJson = (input, env) => run({ input: `${JSON.stringify(input)}\n`, env })

test('UserPromptSubmit emits context for Claude and Codex', () => {
  for (const host of ['claude', 'codex']) {
    const result = runJson(
      { hook_event_name: 'UserPromptSubmit', host: `spoofed-${host}`, prompt: `private-${host}` },
      hostEnvironment[host],
    )
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), promptOutput)
    assert.equal(result.stderr, '')
    assert.doesNotMatch(result.stdout, /private-/)
  }

  const codexCompatibilityEnvironment = runJson(
    { hook_event_name: 'UserPromptSubmit' },
    { ...hostEnvironment.claude, ...hostEnvironment.codex },
  )
  assert.equal(codexCompatibilityEnvironment.status, 0, codexCompatibilityEnvironment.stderr)
  assert.deepEqual(JSON.parse(codexCompatibilityEnvironment.stdout), promptOutput)
})

test('the default hook command resolves Claude and Codex plugin roots', () => {
  for (const env of [{ CLAUDE_PLUGIN_ROOT: pluginRoot }, { PLUGIN_ROOT: pluginRoot }]) {
    const result = spawnSync('/bin/sh', ['-c', hookCommand], {
      input: `${JSON.stringify({ hook_event_name: 'UserPromptSubmit' })}\n`,
      encoding: 'utf8',
      env: {
        ...process.env,
        PLUGIN_ROOT: undefined,
        CLAUDE_PLUGIN_ROOT: undefined,
        ...env,
      },
    })

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), promptOutput)
    assert.equal(result.stderr, '')
  }
})

test('UserPromptSubmit fails open for an unknown host', () => {
  const result = runJson({ hook_event_name: 'UserPromptSubmit' })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), {})
  assert.equal(result.stderr, '')
})

test('the first Stop is silent for both hosts', () => {
  for (const host of ['codex', 'claude']) {
    for (const stopHookActive of [false, undefined, 'false']) {
      const result = runJson({ hook_event_name: 'Stop', stop_hook_active: stopHookActive }, hostEnvironment[host])
      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(JSON.parse(result.stdout), {})
      assert.equal(result.stderr, '')
    }
  }

  const result = runJson({ hook_event_name: 'Stop' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), {})
  assert.equal(result.stderr, '')
})

test('a repeated Stop is also silent for both hosts', () => {
  for (const host of ['codex', 'claude']) {
    const result = runJson({ hook_event_name: 'Stop', stop_hook_active: true }, hostEnvironment[host])
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), {})
    assert.equal(result.stderr, '')
  }
})

test('UserPromptSubmit keeps capture, ask, and skip directions internal', () => {
  for (const host of ['claude', 'codex']) {
    const result = runJson({ hook_event_name: 'UserPromptSubmit' }, hostEnvironment[host])
    const context = JSON.parse(result.stdout).hookSpecificOutput.additionalContext

    assert.match(context, /capture, ask, or skip/)
    assert.match(context, /Preserve the normal task response for every decision\./)
    assert.match(context, /Skip uses no tools, writes nothing, and adds nothing\./)
    assert.match(context, /If capture is warranted, follow \$field-guide:field-guide and append only its concise change notice\./)
    assert.match(context, /If ask is warranted, append one focused learning question and write no memory while awaiting the answer\./)
    assert.match(context, /Add no other lifecycle or storage text\./)
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

test('sensitive hook fields never appear in output for either host', () => {
  const secrets = [
    'PASSWORD=hook-secret',
    '/Users/example/private/transcript.jsonl',
    'const proprietaryCode = true',
  ]
  for (const host of ['claude', 'codex']) {
    const result = runJson({
      hook_event_name: 'UserPromptSubmit',
      prompt: secrets[0],
      transcript_path: secrets[1],
      last_assistant_message: secrets[2],
      background_tasks: secrets,
    }, hostEnvironment[host])

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), promptOutput)
    for (const secret of secrets) {
      assert.doesNotMatch(result.stdout, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.doesNotMatch(result.stderr, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    }
  }
})

test('lifecycle guidance contains no launcher path or Stop reason', () => {
  const prompt = runJson({ hook_event_name: 'UserPromptSubmit' }, hostEnvironment.claude)
  const stop = runJson({ hook_event_name: 'Stop' }, hostEnvironment.claude)

  assert.doesNotMatch(JSON.parse(prompt.stdout).hookSpecificOutput.additionalContext, /field-guide\.sh|\/Users\//)
  assert.deepEqual(JSON.parse(stop.stdout), {})
})

test('the hook runner resolves an NVM Node installation outside PATH', () => {
  const home = mkdtempSync(join(tmpdir(), 'field-guide-node-home-'))
  const nodeDirectory = join(home, '.nvm', 'versions', 'node', 'v22.20.0', 'bin')
  mkdirSync(nodeDirectory, { recursive: true })
  symlinkSync(process.execPath, join(nodeDirectory, 'node'))

  for (const env of [hostEnvironment.claude, hostEnvironment.codex]) {
    const result = spawnSync('/bin/sh', [nodeRunner.pathname, '--fail-open', adapter.pathname], {
      input: `${JSON.stringify({ hook_event_name: 'UserPromptSubmit' })}\n`,
      encoding: 'utf8',
      env: { HOME: home, PATH: '/usr/bin:/bin', ...env },
    })

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), promptOutput)
  }
})

test('the hook runner fails open when an explicit Node runtime is unavailable', () => {
  const result = spawnSync('/bin/sh', [nodeRunner.pathname, '--fail-open', adapter.pathname], {
    encoding: 'utf8',
    env: { HOME: tmpdir(), PATH: '/usr/bin:/bin', FIELD_GUIDE_NODE: '/missing/node' },
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
})
