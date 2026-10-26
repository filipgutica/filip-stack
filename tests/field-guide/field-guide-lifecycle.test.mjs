import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { fieldGuidePluginRoot, fieldGuideSkillRoot } from './plugin-paths.mjs'

const adapter = new URL('hooks/field-guide-lifecycle.mjs', fieldGuidePluginRoot)
const nodeRunner = new URL('scripts/run-node.sh', fieldGuidePluginRoot)
const pluginRoot = fileURLToPath(fieldGuidePluginRoot)
const hooksConfig = JSON.parse(readFileSync(new URL('hooks/hooks.json', fieldGuidePluginRoot), 'utf8'))
const hookCommand = hooksConfig.hooks.UserPromptSubmit[0].hooks[0].command
const fieldGuideScript = fileURLToPath(new URL('scripts/field-guide.mjs', fieldGuideSkillRoot))
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

test('opted-in hook analytics records only invocation metadata', () => {
  const home = mkdtempSync(join(tmpdir(), 'field-guide-hook-analytics-'))
  const analyticsRoot = join(home, '.field-guide', 'analytics')
  mkdirSync(analyticsRoot, { recursive: true })
  writeFileSync(join(analyticsRoot, 'config.json'), `${JSON.stringify({ schemaVersion: 1, enabled: true })}\n`)

  const prompt = run({
    home,
    input: `${JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'PASSWORD=private-value' })}\n`,
    env: hostEnvironment.codex,
  })
  assert.equal(prompt.status, 0, prompt.stderr)
  assert.deepEqual(JSON.parse(prompt.stdout), promptOutput)
  assert.equal(prompt.stderr, '')

  const eventsFile = join(analyticsRoot, 'events.jsonl')
  const eventsText = readFileSync(eventsFile, 'utf8')
  const [event] = eventsText.trim().split('\n').map((line) => JSON.parse(line))
  assert.equal(event.type, 'hook_invoked')
  assert.equal(event.host, 'codex')
  assert.doesNotMatch(eventsText, /PASSWORD=private-value|prompt/)

  const stop = run({ home, input: `${JSON.stringify({ hook_event_name: 'Stop' })}\n`, env: hostEnvironment.codex })
  assert.deepEqual(JSON.parse(stop.stdout), {})
  assert.equal(readFileSync(eventsFile, 'utf8'), eventsText)
})

test('hook analytics write failure preserves lifecycle output', () => {
  const home = mkdtempSync(join(tmpdir(), 'field-guide-hook-analytics-failure-'))
  const analyticsRoot = join(home, '.field-guide', 'analytics')
  mkdirSync(analyticsRoot, { recursive: true })
  writeFileSync(join(analyticsRoot, 'config.json'), `${JSON.stringify({ schemaVersion: 1, enabled: true })}\n`)
  mkdirSync(join(analyticsRoot, 'events.jsonl'))

  const result = run({ home, input: `${JSON.stringify({ hook_event_name: 'UserPromptSubmit' })}\n`, env: hostEnvironment.claude })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), promptOutput)
  assert.equal(result.stderr, '')
})

test('hook analytics does not block on a non-regular event log', { skip: process.platform === 'win32' }, () => {
  const home = mkdtempSync(join(tmpdir(), 'field-guide-hook-analytics-fifo-'))
  const analyticsRoot = join(home, '.field-guide', 'analytics')
  mkdirSync(analyticsRoot, { recursive: true })
  writeFileSync(join(analyticsRoot, 'config.json'), '{"schemaVersion":1,"enabled":true}\n')
  execFileSync('mkfifo', [join(analyticsRoot, 'events.jsonl')])

  const result = spawnSync(process.execPath, [adapter.pathname], {
    input: '{"hook_event_name":"UserPromptSubmit"}\n',
    encoding: 'utf8',
    timeout: 2000,
    env: { ...process.env, HOME: home, PLUGIN_ROOT: '/plugins/field-guide', CLAUDE_PLUGIN_ROOT: undefined },
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), promptOutput)
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

const seedGuide = () => {
  const home = mkdtempSync(join(tmpdir(), 'field-guide-hook-injection-'))
  const repoRoot = join(home, 'repo')
  execFileSync('git', ['init', repoRoot], { stdio: 'ignore' })
  execFileSync('git', ['-C', repoRoot, 'remote', 'add', 'origin', 'git@github.com:example/injection.git'])
  const guideRoot = join(home, '.field-guide')
  const fieldGuide = (...args) => execFileSync(
    process.execPath,
    [fieldGuideScript, ...args, '--repo-root', repoRoot, '--guide-root', guideRoot],
    { encoding: 'utf8' },
  )
  fieldGuide('init')
  const capture = ({ scope, subjectKey, learning, turnId }) => fieldGuide('submit', '--input-json', JSON.stringify({
    schemaVersion: 1,
    decision: 'capture',
    confidence: 'high',
    scope,
    subjectKey,
    learning,
    explicitPreference: true,
    evidence: {
      summary: 'The user stated a durable preference.',
      pointers: [{ kind: 'conversation', client: 'codex', threadId: 'thread-1', turnId }],
    },
  }))
  capture({ scope: 'project', subjectKey: 'release-process', learning: 'Run the packaging check before tagging a release.', turnId: 'turn-1' })
  capture({ scope: 'shared', subjectKey: 'vue-reactivity', learning: 'Use default watcher flush timing unless a failing test proves otherwise.', turnId: 'turn-2' })
  capture({ scope: 'shared', subjectKey: 'stacked-prs', learning: 'Link dependent pull requests as a native stack.', turnId: 'turn-3' })
  mkdirSync(join(guideRoot, 'analytics'), { recursive: true })
  writeFileSync(join(guideRoot, 'analytics', 'config.json'), '{"schemaVersion":1,"enabled":true}\n')
  return { home, repoRoot, guideRoot, capture }
}

const contextFor = (result) => {
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  return JSON.parse(result.stdout).hookSpecificOutput?.additionalContext ?? null
}

test('session start injects project guidance and a subject index, then the first prompt adds matching guidance once', () => {
  const { home, repoRoot, guideRoot } = seedGuide()
  const send = (input) => contextFor(run({ home, input: `${JSON.stringify({ session_id: 'session-1', cwd: repoRoot, ...input })}\n`, env: hostEnvironment.claude }))
  const prompt = 'Fix the Vue watcher flush timing and run the release packaging check PASSWORD=private-value'

  const start = send({ hook_event_name: 'SessionStart', source: 'startup' })
  assert.match(start, /- \[release-process\] Run the packaging check before tagging a release\./)
  assert.match(start, /Other stored Field Guide subjects: stacked-prs, vue-reactivity\./)
  assert.doesNotMatch(start, /watcher flush timing unless/)

  const first = send({ hook_event_name: 'UserPromptSubmit', prompt })
  assert.match(first, /- \[vue-reactivity\] Use default watcher flush timing/)
  assert.doesNotMatch(first, /release-process|stacked-prs|PASSWORD/)
  assert.ok(first.endsWith(promptOutput.hookSpecificOutput.additionalContext))

  assert.equal(send({ hook_event_name: 'UserPromptSubmit', prompt: 'Stack these pull requests.' }), promptOutput.hookSpecificOutput.additionalContext)

  const compacted = send({ hook_event_name: 'SessionStart', source: 'compact' })
  assert.match(compacted, /release-process/)
  assert.match(send({ hook_event_name: 'UserPromptSubmit', prompt }), /- \[vue-reactivity\]/)

  const stateDirectory = join(guideRoot, 'sessions')
  const stateText = readdirSync(stateDirectory).map((name) => readFileSync(join(stateDirectory, name), 'utf8')).join('')
  const eventsText = readFileSync(join(guideRoot, 'analytics', 'events.jsonl'), 'utf8')
  const injections = eventsText.trim().split('\n').map((line) => JSON.parse(line)).filter(({ type }) => type === 'injection')
  assert.deepEqual(injections.map(({ trigger, guidanceIds }) => [trigger, guidanceIds.length]), [
    ['session-start', 1], ['prompt', 1], ['session-start', 1], ['prompt', 1],
  ])
  for (const text of [stateText, eventsText]) assert.doesNotMatch(text, /PASSWORD|watcher|session-1/)
})

test('a startup that reuses a session ID keeps the parent session state', () => {
  const { home, repoRoot, guideRoot } = seedGuide()
  const send = (input) => contextFor(run({ home, input: `${JSON.stringify({ session_id: 'session-parent', cwd: repoRoot, ...input })}\n`, env: hostEnvironment.codex }))
  send({ hook_event_name: 'SessionStart', source: 'startup' })
  send({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix the Vue watcher flush timing' })
  const stateDirectory = join(guideRoot, 'sessions')
  const stateText = () => readdirSync(stateDirectory).map((name) => readFileSync(join(stateDirectory, name), 'utf8')).join('')
  const parentState = stateText()

  assert.equal(send({ hook_event_name: 'SessionStart', source: 'startup' }), null)
  assert.equal(stateText(), parentState)
  assert.equal(send({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix the Vue watcher flush timing' }), promptOutput.hookSpecificOutput.additionalContext)
})

test('the first prompt matches its whole text when session start did not run', () => {
  const { home, repoRoot } = seedGuide()
  const prompt = `${'Lorem ipsum dolor sit amet. '.repeat(100)}Stack these pull requests.`
  const context = contextFor(run({
    home,
    input: `${JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'session-2', cwd: repoRoot, prompt })}\n`,
    env: hostEnvironment.codex,
  }))
  assert.match(context, /- \[stacked-prs\] Link dependent pull requests as a native stack\./)
})

test('a first prompt outside Git consumes pending guidance without retrying on later prompts', () => {
  const { home, repoRoot } = seedGuide()
  const send = (cwd) => contextFor(run({
    home,
    input: `${JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'session-non-git-prompt', cwd, prompt: 'Fix the Vue watcher flush timing' })}\n`,
    env: hostEnvironment.codex,
  }))

  assert.equal(send(home), promptOutput.hookSpecificOutput.additionalContext)
  assert.equal(send(repoRoot), promptOutput.hookSpecificOutput.additionalContext)
})

test('session start injects nothing without a guide or a supported host', () => {
  const { home, repoRoot } = seedGuide()
  const input = `${JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'session-3', cwd: repoRoot, source: 'startup' })}\n`
  assert.equal(contextFor(run({ input, env: hostEnvironment.claude })), null)
  assert.equal(contextFor(run({ home, input })), null)
})

test('the session start hook matches only startup, clear, and compaction', () => {
  assert.equal(hooksConfig.hooks.SessionStart[0].matcher, 'startup|clear|compact')
  assert.equal(hooksConfig.hooks.SessionStart[0].hooks[0].command, hookCommand)
})

test('the session start subject index stays within one kilobyte', () => {
  const { home, repoRoot, capture } = seedGuide()
  for (let index = 0; index < 12; index += 1) {
    capture({ scope: 'shared', subjectKey: `subject-${index}-${'x'.repeat(100)}`, learning: `Apply rule ${index}.`, turnId: `turn-index-${index}` })
  }
  const context = contextFor(run({
    home,
    input: `${JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'session-4', cwd: repoRoot, source: 'startup' })}\n`,
    env: hostEnvironment.codex,
  }))
  const indexLine = context.split('\n').find((line) => line.startsWith('Other stored Field Guide subjects: '))
  assert.match(indexLine, / and \d+ more\. /)
  assert.ok(Buffer.byteLength(indexLine) <= 1024, `${Buffer.byteLength(indexLine)} bytes`)
})

test('prompt guidance stays within two kilobytes', () => {
  const { home, repoRoot, capture } = seedGuide()
  const learning = `Write release notes for every user-facing change. ${'Keep each entry specific. '.repeat(70)}`.trim()
  capture({ scope: 'shared', subjectKey: 'release-notes', learning, turnId: 'turn-long' })
  capture({ scope: 'shared', subjectKey: 'release-notes-format', learning: 'Group release notes by feature.', turnId: 'turn-short' })
  const context = contextFor(run({
    home,
    input: `${JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'session-5', cwd: repoRoot, prompt: 'Draft the release notes' })}\n`,
    env: hostEnvironment.claude,
  }))
  const guidance = context.slice(0, -`\n\n${promptOutput.hookSpecificOutput.additionalContext}`.length)
  assert.match(guidance, /release-notes/)
  assert.ok(Buffer.byteLength(guidance) <= 2048, `${Buffer.byteLength(guidance)} bytes`)
})

test('session state replaces a planted symlink without writing through it', () => {
  const { home, repoRoot, guideRoot } = seedGuide()
  const target = join(home, 'outside.txt')
  writeFileSync(target, 'unchanged\n')
  const stateDirectory = join(guideRoot, 'sessions')
  mkdirSync(stateDirectory, { recursive: true })
  const statePath = join(stateDirectory, `${createHash('sha256').update('session-6').digest('hex')}.json`)
  symlinkSync(target, statePath)

  const input = `${JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'session-6', cwd: repoRoot, source: 'clear' })}\n`
  assert.match(contextFor(run({ home, input, env: hostEnvironment.claude })), /release-process/)
  assert.equal(readFileSync(target, 'utf8'), 'unchanged\n')
  assert.deepEqual(JSON.parse(readFileSync(statePath, 'utf8')).promptPending, true)
})

test('session start prunes old session state and writes none without a guide', () => {
  const { home, repoRoot, guideRoot } = seedGuide()
  const stateDirectory = join(guideRoot, 'sessions')
  mkdirSync(stateDirectory, { recursive: true })
  const oldState = join(stateDirectory, 'old.json')
  writeFileSync(oldState, '{}\n')
  const eightDaysAgo = (Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000
  utimesSync(oldState, eightDaysAgo, eightDaysAgo)

  const input = (sessionId) => `${JSON.stringify({ hook_event_name: 'SessionStart', session_id: sessionId, cwd: repoRoot, source: 'startup' })}\n`
  contextFor(run({ home, input: input('session-7'), env: hostEnvironment.claude }))
  assert.equal(existsSync(oldState), false)
  assert.equal(readdirSync(stateDirectory).length, 1)

  const emptyHome = mkdtempSync(join(tmpdir(), 'field-guide-hook-no-guide-'))
  contextFor(run({ home: emptyHome, input: input('session-8'), env: hostEnvironment.claude }))
  assert.equal(existsSync(join(emptyHome, '.field-guide')), false)
})

test('session start outside Git writes pending state and prunes old state', () => {
  const { home, guideRoot } = seedGuide()
  const stateDirectory = join(guideRoot, 'sessions')
  mkdirSync(stateDirectory, { recursive: true })
  const oldState = join(stateDirectory, 'old.json')
  writeFileSync(oldState, '{}\n')
  const eightDaysAgo = (Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000
  utimesSync(oldState, eightDaysAgo, eightDaysAgo)
  const sessionId = 'session-non-git-start'

  assert.equal(contextFor(run({
    home,
    input: `${JSON.stringify({ hook_event_name: 'SessionStart', session_id: sessionId, cwd: home, source: 'startup' })}\n`,
    env: hostEnvironment.claude,
  })), null)
  const statePath = join(stateDirectory, `${createHash('sha256').update(sessionId).digest('hex')}.json`)
  assert.deepEqual(JSON.parse(readFileSync(statePath, 'utf8')), { injectedIds: [], promptPending: true })
  assert.equal(existsSync(oldState), false)
})
