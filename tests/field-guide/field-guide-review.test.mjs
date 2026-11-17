import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { classifierCommand } from '../../plugins/field-guide/skills/field-guide/scripts/field-guide-review.mjs'
import { fieldGuideSkillRoot } from './plugin-paths.mjs'
import { createRepo } from './repositories.mjs'

const script = fileURLToPath(new URL('scripts/field-guide.mjs', fieldGuideSkillRoot))
const reviewScript = fileURLToPath(new URL('scripts/field-guide-review.mjs', fieldGuideSkillRoot))
const { confirmFromPrompt } = await import(new URL('scripts/field-guide.mjs', fieldGuideSkillRoot))

// A stand-in for both headless CLIs. It answers like the real ones, from the packet on stdin:
// each user turn that starts with a directive becomes one observation. It never writes the
// packet; with STUB_LOG it records its arguments, its working directory, and the user turns it
// received, so a test can check what reached the classifier.
const stubSource = String.raw`#!/usr/bin/env node
const { appendFileSync, readdirSync } = require('node:fs')
const provider = require('node:path').basename(process.argv[1])
let input = ''
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
  const packet = JSON.parse(input.slice(input.lastIndexOf('\n{"sessions"') + 1))
  const turns = packet.sessions.flatMap(({ turns }) => turns)
  if (process.env.STUB_LOG) appendFileSync(process.env.STUB_LOG, JSON.stringify({ provider, args: process.argv.slice(2), cwdEntries: readdirSync(process.cwd()), turns }) + '\n')
  if (process.env.STUB_MODE === 'fail') process.exit(3)
  const observations = []
  for (const turn of turns) {
    if (process.env.STUB_MODE === 'cite-context' && turn.role === 'context') observations.push({ ref: turn.ref, scope: 'project', subjectKey: 'testing', learning: 'Run the tests before a commit.', summary: 'Assistant text.' })
    const match = turn.role === 'user' && turn.text.match(/^(PREF|SHARED|REINFORCE|CONTRADICT) ([a-z0-9-]+): (.+)$/)
    if (!match) continue
    const [, kind, subject, learning] = match
    if (process.env.STUB_MODE === 'leak') observations.push({ ref: turn.ref, scope: 'project', subjectKey: subject, learning: 'Read the notes in /home/someone/notes first.', summary: 'Leaks a path.' })
    const target = packet.records.find(({ id }) => id.startsWith('guidance:v1:' + subject))
    observations.push({
      ref: turn.ref,
      scope: kind === 'SHARED' ? 'shared' : 'project',
      subjectKey: target ? 'ignored' : subject,
      learning,
      summary: 'The user stated a durable preference.',
      ...(kind === 'SHARED' ? { generic: true } : {}),
      ...(target ? { relationship: { kind: kind === 'REINFORCE' ? 'reinforces' : 'contradicts', targetId: target.id } } : {}),
    })
  }
  const text = JSON.stringify({ observations })
  const usage = { input: Number(process.env.STUB_INPUT_TOKENS ?? 1000), cost: Number(process.env.STUB_COST_USD ?? 0.01) }
  if (provider === 'claude') {
    // The top-level usage covers only the last request; modelUsage covers the run.
    const modelUsage = { 'claude-haiku-5-5': { inputTokens: 2, cacheCreationInputTokens: usage.input, cacheReadInputTokens: 10, outputTokens: 40, costUSD: usage.cost } }
    process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text, total_cost_usd: usage.cost, usage: { input_tokens: 1, output_tokens: 1 }, modelUsage }))
  } else {
    process.stdout.write([
      { type: 'thread.started', thread_id: 'stub' },
      { type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text } },
      { type: 'turn.completed', usage: { input_tokens: usage.input, cached_input_tokens: 5, output_tokens: 30 } },
    ].map((event) => JSON.stringify(event)).join('\n') + '\n')
  }
})
`

const jsonl = (entries) => entries.map((entry) => `${JSON.stringify(entry)}\n`).join('')

// One machine with its own HOME, Claude and Codex homes, T3 Code state, guide, and stub CLIs.
const machine = () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-review-test-'))
  const home = join(root, 'home')
  const bin = join(root, 'bin')
  const guideRoot = join(root, 'guide')
  const repoRoot = createRepo({ parent: root, name: 'alpha' })
  const otherRepo = createRepo({ parent: root, name: 'beta' })
  const claudeHome = join(home, '.claude')
  const codexHome = join(home, '.codex')
  const t3Home = join(home, '.t3')
  for (const directory of [bin, join(claudeHome, 'projects'), join(codexHome, 'sessions'), join(t3Home, 'userdata')]) mkdirSync(directory, { recursive: true })
  for (const name of ['claude', 'codex']) {
    writeFileSync(join(bin, name), stubSource)
    chmodSync(join(bin, name), 0o755)
  }
  const stubLog = join(root, 'stub.log')
  const env = {
    ...process.env,
    HOME: home,
    CLAUDE_CONFIG_DIR: claudeHome,
    CODEX_HOME: codexHome,
    T3CODE_HOME: t3Home,
    T3CODE_THREAD_ID: undefined,
    PATH: `${bin}:${process.env.PATH}`,
    TMPDIR: join(root, 'tmp'),
  }
  mkdirSync(env.TMPDIR)
  execFileSync(process.execPath, [script, 'init', '--repo-root', repoRoot, '--guide-root', guideRoot], { env })
  let sequence = 0
  const self = {
    root, home, guideRoot, repoRoot, otherRepo, stubLog, claudeHome, codexHome,
    t3State: join(t3Home, 'userdata', 'statev2.sqlite'),
    review: ({ args = [], stubEnv = {}, expectFailure = false, raw = false } = {}) => {
      const result = spawnSync(process.execPath, [reviewScript, 'run', '--guide-root', guideRoot, ...args], { encoding: 'utf8', env: { ...env, ...stubEnv } })
      if (raw) return result
      if (expectFailure) {
        assert.notEqual(result.status, 0, result.stdout)
        return result
      }
      assert.equal(result.status, 0, result.stderr)
      return JSON.parse(result.stdout)
    },
    enable: () => execFileSync(process.execPath, [reviewScript, 'enable', '--guide-root', guideRoot], { env }),
    cli: (command, args) => JSON.parse(execFileSync(process.execPath, [script, command, '--repo-root', repoRoot, '--guide-root', guideRoot, ...args], { env, encoding: 'utf8' })),
    submitLive: (submission) => {
      const path = join(root, `live-${(sequence += 1)}.json`)
      writeFileSync(path, JSON.stringify(submission))
      return self.cli('submit', ['--input', path]).result
    },
    stubCalls: () => (existsSync(stubLog) ? readFileSync(stubLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : []),
    userTurns: () => self.stubCalls().flatMap(({ turns }) => turns.filter(({ role }) => role === 'user').map(({ text }) => text)),
    memory: () => JSON.parse(readFileSync(join(guideRoot, 'memory.json'), 'utf8')),
    record: (learning) => self.memory().guidance.find((guidance) => guidance.learning === learning),
    evidenceOf: (record) => record.evidenceIds.map((id) => self.memory().evidence.find((evidence) => evidence.id === id)),
    journal: () => (existsSync(join(guideRoot, 'operations.jsonl'))
      ? readFileSync(join(guideRoot, 'operations.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
      : []),
    undo: (operationId) => self.cli('undo-operation', ['--id', operationId]).result,
    undoFailure: (operationId) => spawnSync(process.execPath, [script, 'undo-operation', '--id', operationId, '--repo-root', repoRoot, '--guide-root', guideRoot], { env, encoding: 'utf8' }),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
  return self
}

let uuidSequence = 0
const uuid = () => `00000000-0000-4000-8000-${String((uuidSequence += 1)).padStart(12, '0')}`

// A Claude Code transcript: user turns are strings or entries; an assistant turn is { assistant }.
const claudeTranscript = ({ fleet, sessionId = uuid(), cwd = fleet.repoRoot, entrypoint = 'cli', turns, directory = 'project-a', append = false }) => {
  const folder = join(fleet.claudeHome, 'projects', directory)
  mkdirSync(folder, { recursive: true })
  const file = join(folder, `${sessionId}.jsonl`)
  const entries = turns.map((turn) => {
    const base = { sessionId, cwd, entrypoint, isSidechain: false, timestamp: new Date().toISOString() }
    if (turn.assistant) return { ...base, type: 'assistant', uuid: uuid(), message: { role: 'assistant', content: [{ type: 'text', text: turn.assistant }] } }
    if (typeof turn === 'string') return { ...base, type: 'user', uuid: uuid(), message: { role: 'user', content: turn } }
    return { ...base, type: 'user', uuid: uuid(), ...turn }
  })
  writeFileSync(file, jsonl(entries), { flag: append ? 'a' : 'w' })
  return { sessionId, file }
}

const codexTranscript = ({ fleet, sessionId = uuid(), cwd = fleet.repoRoot, source = 'cli', originator = 'codex-tui', turns }) => {
  const folder = join(fleet.codexHome, 'sessions', '2026', '11', '17')
  mkdirSync(folder, { recursive: true })
  const file = join(folder, `rollout-2026-11-17T01-00-00-${sessionId}.jsonl`)
  // As Codex writes them: user blocks are `text`, agent message blocks are `Text`.
  const item = (type, text) => ({ type: 'event_msg', payload: { type: 'item_completed', thread_id: sessionId, turn_id: uuid(), item: { type, id: uuid(), content: [{ type: type === 'AgentMessage' ? 'Text' : 'text', text }] } } })
  writeFileSync(file, jsonl([
    { type: 'session_meta', payload: { id: sessionId, cwd, originator, source } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '# AGENTS.md instructions PREF agents-file: Never read this.' }] } },
    ...turns.map((turn) => (turn.assistant ? item('AgentMessage', turn.assistant) : item('UserMessage', turn))),
  ]))
  return { sessionId, file }
}

// T3 Code state with the two tables the review reads.
const t3Threads = ({ fleet, threads }) => {
  const database = new DatabaseSync(fleet.t3State)
  database.exec(`CREATE TABLE IF NOT EXISTS orchestration_v2_projection_threads (thread_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orchestration_v2_projection_provider_threads (provider_thread_id TEXT PRIMARY KEY, thread_id TEXT, payload_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS scheduled_tasks (task_id TEXT PRIMARY KEY, thread_id TEXT);`)
  for (const { threadId, createdBy, creationSource = 'web', parentThreadId, scheduled, nativeIds } of threads) {
    database.prepare('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?)').run(threadId, JSON.stringify({ createdBy, creationSource, lineage: parentThreadId ? { parentThreadId, relationshipToParent: 'subagent' } : {} }))
    if (scheduled) database.prepare('INSERT INTO scheduled_tasks VALUES (?, ?)').run(`task-${threadId}`, threadId)
    for (const nativeId of nativeIds) {
      database.prepare('INSERT INTO orchestration_v2_projection_provider_threads VALUES (?, ?, ?)').run(`provider-thread:${nativeId}`, threadId, JSON.stringify({ nativeThreadRef: { nativeId } }))
    }
  }
  database.close()
}

const withMachine = (body) => async () => {
  const fleet = machine()
  try {
    await body(fleet)
  } finally {
    fleet.cleanup()
  }
}

const filesBelow = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? filesBelow(join(directory, entry.name)) : [join(directory, entry.name)]
))

test('the classifier commands use the exact headless, hook-free arguments', () => {
  assert.deepEqual(classifierCommand({ provider: 'claude', budgetUsd: 1.5 }), {
    command: 'claude',
    args: ['-p', '--model', 'claude-haiku-5-5', '--tools', '', '--disable-slash-commands', '--strict-mcp-config', '--no-session-persistence', '--output-format', 'json', '--max-budget-usd', '1.50', '--settings', '{"disableAllHooks":true}'],
  })
  assert.deepEqual(classifierCommand({ provider: 'codex', budgetUsd: 1.5 }), {
    command: 'codex',
    args: ['exec', '--ephemeral', '--json', '-s', 'read-only', '-m', 'gpt-6-luna', '-c', 'model_reasoning_effort="low"', '--skip-git-repo-check', '--disable', 'hooks', '-'],
  })
})

test('session review is off until enabled and then calls each provider from an empty directory', withMachine((fleet) => {
  claudeTranscript({ fleet, turns: ['PREF testing: Run the unit tests before every commit.'] })
  codexTranscript({ fleet, turns: ['PREF linting: Run the linter before every push.'] })
  assert.equal(fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } }).outcome, 'not-enabled')
  assert.deepEqual(fleet.stubCalls(), [])

  fleet.enable()
  const report = fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } })
  assert.equal(report.outcome, 'reviewed')
  const calls = fleet.stubCalls()
  assert.deepEqual(calls.map(({ provider }) => provider), ['claude', 'codex'])
  assert.deepEqual(calls[0].args.slice(-2), ['--settings', '{"disableAllHooks":true}'])
  assert.deepEqual(calls[1].args.slice(0, 2), ['exec', '--ephemeral'])
  for (const call of calls) assert.deepEqual(call.cwdEntries, [])
  assert.deepEqual(report.sessions.reviewed, { 'claude-code': 1, codex: 1 })
  // Claude tokens come from modelUsage, which matches total_cost_usd.
  assert.deepEqual(report.calls.map(({ provider, outcome, usage }) => [provider, outcome, usage.inputTokens]), [['claude', 'classified', 2], ['codex', 'classified', 1000]])
  assert.equal(report.calls[0].usage.cacheCreationInputTokens, 1000)
  assert.equal(report.calls[0].usage.costUsd, 0.01)
  // Codex reports tokens only.
  assert.deepEqual(report.usage, { inputTokens: 2012, outputTokens: 70, costUsd: 0.01 })
  assert.equal(typeof report.durationMs, 'number')
  assert.equal(fleet.record('Run the unit tests before every commit.').status, 'candidate')
  assert.equal(fleet.record('Run the linter before every push.').status, 'candidate')
}))

test('only root interactive sessions and typed user turns reach the classifier', withMachine((fleet) => {
  fleet.enable()
  const kept = 'PREF kept: Keep this typed turn.'
  // Claude: one interactive session with every kind of non-typed entry.
  claudeTranscript({
    fleet,
    turns: [
      kept,
      { isSidechain: true, message: { role: 'user', content: 'PREF sidechain: Excluded.' } },
      { isMeta: true, message: { role: 'user', content: 'PREF meta: Excluded.' } },
      { origin: { kind: 'peer' }, message: { role: 'user', content: 'PREF peer: Excluded.' } },
      { origin: { kind: 'task-notification' }, message: { role: 'user', content: 'PREF notification: Excluded.' } },
      { origin: { kind: 'human' }, message: { role: 'user', content: 'PREF human: Excluded, since any origin is.' } },
      { isCompactSummary: true, isVisibleInTranscriptOnly: true, message: { role: 'user', content: 'PREF compaction: Excluded.' } },
      { message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'PREF tool: Excluded.' }] } },
      '<system-reminder>PREF hook: Excluded.</system-reminder>',
      '<command-name>/foo</command-name><command-message>PREF command: Excluded.</command-message>',
      { assistant: 'PREF assistant: An assistant claim is never a user statement.' },
    ],
  })
  const { sessionId: parent } = claudeTranscript({ fleet, turns: ['PREF parent: Kept.'] })
  // A subagent transcript sits below its parent session directory.
  mkdirSync(join(fleet.claudeHome, 'projects', 'project-a', parent, 'subagents'), { recursive: true })
  writeFileSync(join(fleet.claudeHome, 'projects', 'project-a', parent, 'subagents', 'agent-1.jsonl'), jsonl([{ type: 'user', uuid: uuid(), sessionId: parent, cwd: fleet.repoRoot, entrypoint: 'cli', message: { role: 'user', content: 'PREF subagent: Excluded.' } }]))
  claudeTranscript({ fleet, entrypoint: 'sdk-cli', turns: ['PREF headless: A claude -p run, such as the review itself, is excluded.'] })
  // A removed worktree, and a repository whose remote is a local path.
  claudeTranscript({ fleet, cwd: join(fleet.root, 'removed-worktree'), turns: ['PREF removed: Excluded.'] })
  const localRemote = createRepo({ parent: fleet.root, name: 'local-remote' })
  execFileSync('git', ['-C', localRemote, 'remote', 'set-url', 'origin', join(fleet.home, 'bare.git')])
  claudeTranscript({ fleet, cwd: localRemote, turns: ['PREF local-remote: Excluded.'] })
  codexTranscript({ fleet, source: 'exec', turns: ['PREF exec: Excluded.'] })
  codexTranscript({ fleet, source: { subagent: { other: 'guardian' } }, turns: ['PREF codex-subagent: Excluded.'] })
  // T3 Code: a user thread run by Claude and then Codex counts as one thread; delegate,
  // scheduled, and unbound sessions are excluded.
  const t3Claude = claudeTranscript({ fleet, entrypoint: 't3-code', turns: ['PREF t3-claude: Kept.'] })
  const t3Codex = codexTranscript({ fleet, source: 'vscode', originator: 'T3 Code', turns: ['PREF t3-codex: Kept.'] })
  const delegate = claudeTranscript({ fleet, entrypoint: 't3-code', turns: ['PREF delegate: Excluded.'] })
  const scheduled = codexTranscript({ fleet, source: 'vscode', originator: 'T3 Code', turns: ['PREF scheduled: Excluded.'] })
  const launched = claudeTranscript({ fleet, entrypoint: 't3-code', turns: ['PREF launched: Excluded.'] })
  claudeTranscript({ fleet, entrypoint: 't3-code', turns: ['PREF unbound: Excluded.'] })
  t3Threads({
    fleet,
    threads: [
      { threadId: '11111111-1111-4111-8111-111111111111', createdBy: 'user', nativeIds: [t3Claude.sessionId, t3Codex.sessionId] },
      { threadId: 'thread:delegated-task:x', createdBy: 'agent', creationSource: 'mcp', parentThreadId: 'p', nativeIds: [delegate.sessionId] },
      // A scheduled task's thread, even one that looks user-created, and an MCP-launched thread.
      { threadId: '22222222-2222-4222-8222-222222222222', createdBy: 'user', scheduled: true, nativeIds: [scheduled.sessionId] },
      { threadId: 'mcp:launch:y', createdBy: 'user', creationSource: 'mcp', nativeIds: [launched.sessionId] },
    ],
  })

  const report = fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } })
  assert.deepEqual(fleet.userTurns().sort(), [kept, 'PREF parent: Kept.', 'PREF t3-claude: Kept.', 'PREF t3-codex: Kept.'].sort())
  assert.deepEqual(report.sessions.reviewed, { 'claude-code': 2, 't3-code': 1 })
  assert.deepEqual(report.sessions.excluded, { 'not-interactive': 2, subagent: 1, 't3-agent-thread': 3, 't3-unbound': 1, 'unresolved-repository': 2 })
  const t3Pointers = fleet.memory().evidence.flatMap(({ pointers }) => pointers).filter(({ client }) => client === 't3-code')
  assert.deepEqual([...new Set(t3Pointers.map(({ threadId }) => threadId))], ['11111111-1111-4111-8111-111111111111'])
}))

test('T3 Code sessions are excluded when the T3 state cannot be read', withMachine((fleet) => {
  fleet.enable()
  claudeTranscript({ fleet, entrypoint: 't3-code', turns: ['PREF t3: Excluded without state.'] })
  const report = fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } })
  assert.deepEqual(report.sessions.excluded, { 't3-state-unavailable': 1 })
  assert.deepEqual(fleet.stubCalls(), [])
  // The session was not dismissed: it is read again once the state is readable.
  const second = fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } })
  assert.deepEqual(second.sessions.excluded, { 't3-state-unavailable': 1 })
}))

test('quoted, pasted, and code text and context turns are never cited as the user statement', withMachine((fleet) => {
  fleet.enable()
  const citation = '[Assistant quote](t3-citation://v1/a/b/c?text=PREF+quoted%3A+Assistant+text.&comment=Sounds+good)'
  claudeTranscript({
    fleet,
    turns: [
      { assistant: 'Should I always rebase before pushing?' },
      `Sounds right.\n> PREF quoted: A quoted line.\n\`\`\`text\nPREF code: Code block.\n\`\`\`\n<pasted_content id=1>PREF pasted: Pasted text.</pasted_content id=1>\n${citation}`,
    ],
  })
  codexTranscript({ fleet, turns: [{ assistant: 'Should I squash the commits first?' }, 'Yes, please.'] })
  const report = fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog, STUB_MODE: 'cite-context' } })
  const [claudeCall, codexCall] = fleet.stubCalls()
  assert.deepEqual(claudeCall.turns.map(({ role, text }) => [role, text]), [
    ['context', 'Should I always rebase before pushing?'],
    ['user', 'Sounds good Sounds right.'],
  ])
  assert.deepEqual(codexCall.turns.map(({ role, text }) => [role, text]), [['context', 'Should I squash the commits first?'], ['user', 'Yes, please.']])
  assert.deepEqual(report.rejected, [{ reason: 'observation cites no user turn' }, { reason: 'observation cites no user turn' }])
  assert.deepEqual(report.changes, [])
  assert.deepEqual(fleet.memory().guidance, [])
}))

test('redaction removes home paths, URL queries, credentials, and code before the classifier', withMachine((fleet) => {
  fleet.enable()
  claudeTranscript({
    fleet,
    turns: [[
      'Use the config in /home/someone/work/app.json and /Users/someone/x.',
      'See https://example.com/docs/page?token=abc123#part for details.',
      'password=hunter2 and ghp_abcdefghijklmnopqrstuvwxyz0123 and sk-abcdefghijklmnopqrstuvwxyz.',
      '```js',
      'const internal = proprietary()',
      '```',
    ].join('\n')],
  })
  fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } })
  assert.deepEqual(fleet.userTurns(), ['Use the config in ~/work/app.json and ~/x. See https://example.com/docs/page for details. password=[redacted] and [redacted] and [redacted].'])
}))

test('one thread counts once across nights and against a live capture', withMachine((fleet) => {
  fleet.enable()
  const rule = 'Run the unit tests before every commit.'
  const first = claudeTranscript({ fleet, turns: [`PREF testing: ${rule}`] })
  fleet.review()
  assert.equal(fleet.record(rule).independentEvidenceCount, 1)

  // The same thread says it again the next night: no second count, no change.
  claudeTranscript({ fleet, sessionId: first.sessionId, append: true, turns: [`PREF testing: ${rule}`] })
  const revision = fleet.memory().revision
  const repeat = fleet.review()
  assert.deepEqual(repeat.skipped, { 'thread-already-counted': 1 })
  assert.equal(fleet.memory().revision, revision)

  // A live capture in another thread counts, and that thread's nightly statement does not.
  const live = 'Prefer small focused commits.'
  const liveThread = uuid()
  fleet.submitLive({ schemaVersion: 1, decision: 'capture', confidence: 'medium', scope: 'project', subjectKey: 'commits', learning: live, evidence: { summary: 'The user stated it.', pointers: [{ kind: 'conversation', client: 'claude-code', threadId: liveThread, messageId: uuid() }] } })
  claudeTranscript({ fleet, sessionId: liveThread, turns: [`PREF commits: ${live}`] })
  assert.deepEqual(fleet.review().skipped, { 'thread-already-counted': 1 })
  assert.equal(fleet.record(live).independentEvidenceCount, 1)
  assert.equal(fleet.record(live).status, 'candidate')

  // A second thread is independent evidence and promotes the project record.
  claudeTranscript({ fleet, turns: [`PREF testing: ${rule}`] })
  const promoted = fleet.review()
  assert.equal(promoted.changes[0].outcome, 'promoted')
  assert.equal(fleet.record(rule).status, 'active')
}))

test('a statement without an occurrence ID never counts toward promotion', withMachine((fleet) => {
  fleet.enable()
  const rule = 'Write a failing test before a fix.'
  for (let night = 0; night < 2; night += 1) {
    claudeTranscript({ fleet, turns: [{ uuid: undefined, message: { role: 'user', content: `PREF testing: ${rule}` } }] })
    fleet.review()
  }
  const record = fleet.record(rule)
  assert.equal(record.status, 'candidate')
  assert.equal(record.independentEvidenceCount, 0)
  assert.ok(fleet.evidenceOf(record).every(({ countsForPromotion, pointers }) => !countsForPromotion && !pointers[0].messageId))
}))

test('each nightly change is journaled with an inverse that undo-operation applies', withMachine((fleet) => {
  fleet.enable()
  const rule = 'Run the unit tests before every commit.'
  const target = fleet.submitLive({ schemaVersion: 1, decision: 'capture', confidence: 'high', scope: 'project', subjectKey: 'style', learning: 'Use tabs for indentation.', explicitPreference: true, evidence: { summary: 'The user stated it.', pointers: [{ kind: 'manual', sourceLabel: 'Direct request' }] } }).targetId
  claudeTranscript({ fleet, turns: [`PREF testing: ${rule}`] })
  claudeTranscript({ fleet, turns: [`PREF testing: ${rule}`, `CONTRADICT ${target.slice(12, 20)}: Use spaces for indentation.`] })
  const report = fleet.review()
  assert.deepEqual(report.changes.map(({ outcome }) => outcome), ['created', 'promoted', 'created'])
  const contradiction = report.changes[2]
  assert.deepEqual(contradiction.relationship, { kind: 'contradicts', targetId: target })
  assert.equal(fleet.record('Use spaces for indentation.').status, 'candidate')

  const pending = fleet.journal().filter(({ type, action }) => type === 'pending' && action === 'session-submit')
  assert.equal(pending.length, 3)
  for (const entry of pending) assert.equal(entry.inverse, `undo-operation --id ${entry.operationId}`)
  assert.equal(fleet.journal().filter(({ type }) => type === 'commit').length, 3)

  // Undo the promotion: the evidence is unlinked and the record returns to candidate.
  assert.equal(fleet.undo(report.changes[1].operationId).reverted, true)
  assert.equal(fleet.record(rule).status, 'candidate')
  assert.equal(fleet.record(rule).evidenceIds.length, 1)
  // Undo the creation and the contradiction: each record is withdrawn.
  assert.equal(fleet.undo(report.changes[0].operationId).withdrawn, true)
  assert.equal(fleet.record(rule).status, 'withdrawn')
  fleet.undo(contradiction.operationId)
  assert.equal(fleet.record('Use spaces for indentation.').status, 'withdrawn')
  assert.equal(fleet.record('Use tabs for indentation.').status, 'active')
  assert.equal(fleet.undo(contradiction.operationId).outcome, 'already-undone')
}))

test('undoing a nightly promotion refuses while an installed plugin copy cannot read a demotion', withMachine((fleet) => {
  fleet.enable()
  const rule = 'Run the unit tests before every commit.'
  claudeTranscript({ fleet, turns: [`PREF testing: ${rule}`] })
  claudeTranscript({ fleet, turns: [`PREF testing: ${rule}`] })
  const [created, promoted] = fleet.review().changes
  // A Codex copy that reads memory version 2 but predates the session review.
  const copy = join(fleet.codexHome, 'plugins', 'cache', 'filip-stack', 'field-guide', '6.12.0', 'skills', 'field-guide', 'schemas')
  mkdirSync(copy, { recursive: true })
  writeFileSync(join(copy, 'memory-v2.schema.json'), '{}')
  const refused = fleet.undoFailure(promoted.operationId)
  assert.notEqual(refused.status, 0)
  assert.match(refused.stderr, /Codex .*older/u)
  assert.equal(fleet.record(rule).status, 'active')
  // The demotion is the only change that needs the newer reader.
  mkdirSync(join(copy, '..', 'scripts'))
  writeFileSync(join(copy, '..', 'scripts', 'field-guide-review.mjs'), '')
  assert.equal(fleet.undo(promoted.operationId).reverted, true)
  assert.equal(fleet.record(rule).status, 'candidate')
  assert.equal(created.outcome, 'created')
}))

test('a contradiction of confirmed guidance is queued for the user', withMachine((fleet) => {
  fleet.enable()
  const target = fleet.submitLive({ schemaVersion: 1, decision: 'capture', confidence: 'high', scope: 'project', subjectKey: 'style', learning: 'Use tabs for indentation.', explicitPreference: true, evidence: { summary: 'The user stated it.', pointers: [{ kind: 'manual', sourceLabel: 'Direct request' }] } }).targetId
  confirmFromPrompt({ guideRoot: fleet.guideRoot, prompt: `confirm fg:${target.slice(12, 24)}`, mainThread: true, host: 'claude' })
  claudeTranscript({ fleet, turns: [`CONTRADICT ${target.slice(12, 20)}: Use spaces for indentation.`] })
  const report = fleet.review()
  assert.deepEqual(report.queued, [{ kind: 'contradiction', targetId: target, candidateId: fleet.record('Use spaces for indentation.').id }])
  assert.equal(fleet.record('Use tabs for indentation.').status, 'active')
}))

test('a shared promotion is proposed, not applied', withMachine((fleet) => {
  fleet.enable()
  const rule = 'Prefer named constants for thresholds.'
  claudeTranscript({ fleet, turns: [`SHARED naming: ${rule}`] })
  claudeTranscript({ fleet, cwd: fleet.otherRepo, directory: 'project-b', turns: [`SHARED naming: ${rule}`] })
  const report = fleet.review()
  const record = fleet.record(rule)
  assert.equal(record.status, 'candidate')
  assert.equal(record.independentEvidenceCount, 2)
  assert.deepEqual(report.proposals, [{ kind: 'shared-promotion', targetId: record.id, learning: rule }])
}))

test('a rerun reviews nothing new and changes nothing', withMachine((fleet) => {
  fleet.enable()
  claudeTranscript({ fleet, turns: ['PREF testing: Run the unit tests before every commit.'] })
  fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } })
  const [revision, journal, calls] = [fleet.memory().revision, fleet.journal().length, fleet.stubCalls().length]
  const rerun = fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } })
  assert.deepEqual([rerun.calls, rerun.changes], [[], []])
  assert.deepEqual([fleet.memory().revision, fleet.journal().length, fleet.stubCalls().length], [revision, journal, calls])
}))

test('a crash after classification replays the pending observations without a second call', withMachine((fleet) => {
  fleet.enable()
  const rule = 'Run the unit tests before every commit.'
  claudeTranscript({ fleet, turns: [`PREF testing: ${rule}`] })
  // Another writer holds the memory lock, so the commit fails after classification.
  writeFileSync(join(fleet.guideRoot, 'memory.lock'), JSON.stringify({ pid: process.pid, pidNamespace: null }))
  const stopped = fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } })
  assert.deepEqual([stopped.outcome, stopped.stoppedBy], ['stopped', 'commit-failed'])
  assert.equal(stopped.calls.length, 1)
  assert.ok(stopped.usage.costUsd > 0)
  assert.ok(existsSync(join(fleet.guideRoot, 'session-review', 'pending.json')))
  assert.equal(fleet.record(rule), undefined)
  rmSync(join(fleet.guideRoot, 'memory.lock'))

  const recovered = fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } })
  assert.equal(recovered.recovered, 1)
  assert.equal(fleet.stubCalls().length, 1)
  assert.equal(fleet.record(rule).status, 'candidate')
  assert.ok(!existsSync(join(fleet.guideRoot, 'session-review', 'pending.json')))
  assert.deepEqual(fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } }).changes, [])
}))

test('the privacy guard rejects an observation before pending.json or a dry-run report', withMachine((fleet) => {
  fleet.enable()
  claudeTranscript({ fleet, turns: ['PREF testing: Run the unit tests before every commit.'] })
  const dryRun = fleet.review({ args: ['--dry-run'], stubEnv: { STUB_MODE: 'leak' } })
  assert.deepEqual(dryRun.observations.map(({ learning }) => learning), ['Run the unit tests before every commit.'])
  assert.deepEqual(dryRun.rejected, [{ reason: 'submission learning contains a forbidden absolute home-directory path' }])
  writeFileSync(join(fleet.guideRoot, 'memory.lock'), JSON.stringify({ pid: process.pid, pidNamespace: null }))
  assert.equal(fleet.review({ stubEnv: { STUB_MODE: 'leak' } }).outcome, 'stopped')
  const pending = readFileSync(join(fleet.guideRoot, 'session-review', 'pending.json'), 'utf8')
  assert.match(pending, /Run the unit tests before every commit/u)
  assert.doesNotMatch(pending, /someone/u)
}))

test('a nightly reinforcement that landed without its commit entry is recovered and undone', withMachine((fleet) => {
  fleet.enable()
  const rule = 'Run the unit tests before every commit.'
  claudeTranscript({ fleet, turns: [`PREF testing: ${rule}`] })
  fleet.review()
  claudeTranscript({ fleet, turns: [`PREF testing: ${rule}`] })
  claudeTranscript({ fleet, turns: [`PREF testing: ${rule}`] })
  const report = fleet.review()
  const reinforcement = report.changes.find(({ outcome }) => outcome === 'reinforced')
  // Drop its commit entry, as a crash between the memory write and the commit would.
  const journalFile = join(fleet.guideRoot, 'operations.jsonl')
  const lines = readFileSync(journalFile, 'utf8').trim().split('\n').filter((line) => {
    const entry = JSON.parse(line)
    return !(entry.type === 'commit' && entry.operationId === reinforcement.operationId)
  })
  writeFileSync(journalFile, `${lines.join('\n')}\n`)
  assert.equal(fleet.undo(reinforcement.operationId).outcome, 'undone')
  assert.ok(fleet.journal().some(({ type, operationId, recovered }) => type === 'commit' && operationId === reinforcement.operationId && recovered))
  assert.equal(fleet.record(rule).evidenceIds.length, 2)
}))

test('a budget stop leaves the rest as backlog for the next night', withMachine((fleet) => {
  fleet.enable()
  claudeTranscript({ fleet, turns: ['PREF testing: Run the unit tests before every commit.'] })
  codexTranscript({ fleet, turns: ['PREF linting: Run the linter before every push.'] })
  const stopped = fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog, STUB_COST_USD: '5' } })
  assert.equal(stopped.stoppedBy, 'budget')
  assert.deepEqual(stopped.sessions.reviewed, { 'claude-code': 1 })
  assert.equal(stopped.sessions.backlog.sessions, 1)
  assert.ok(stopped.sessions.backlog.bytes > 0)
  assert.deepEqual(fleet.stubCalls().map(({ provider }) => provider), ['claude'])

  const next = fleet.review({ stubEnv: { STUB_LOG: fleet.stubLog } })
  assert.deepEqual(next.sessions.reviewed, { codex: 1 })
  assert.equal(fleet.record('Run the linter before every push.').status, 'candidate')
}))

test('a long session is reviewed in parts under the per-session cap', withMachine((fleet) => {
  fleet.enable()
  const turns = Array.from({ length: 12 }, (_, index) => `PREF part-${index}: ${'Keep this rule in mind for later work. '.repeat(40)}${index}`)
  claudeTranscript({ fleet, turns })
  const first = fleet.review()
  assert.equal(first.sessions.backlog.sessions, 1)
  const reviewed = first.changes.length
  assert.ok(reviewed > 0 && reviewed < 12)
  const second = fleet.review()
  assert.equal(second.changes.length, 12 - reviewed)
  assert.equal(second.sessions.backlog.sessions, 0)
}))

test('no packet, transcript text, or home path is written anywhere', withMachine((fleet) => {
  fleet.enable()
  const canary = 'zebracanary'
  claudeTranscript({ fleet, turns: ['PREF testing: Run the unit tests before every commit.', `The ${canary} notes are private.`] })
  codexTranscript({ fleet, turns: [`Mention ${canary} once more.`] })
  const result = fleet.review({ raw: true })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).changes.length, 1)
  assert.doesNotMatch(result.stdout, new RegExp(canary, 'u'))
  assert.ok(!result.stdout.includes(fleet.root))
  const transcripts = new Set([...filesBelow(fleet.claudeHome), ...filesBelow(fleet.codexHome)])
  const written = filesBelow(fleet.root).filter((path) => !transcripts.has(path) && !path.includes(`${join(fleet.root, 'alpha')}`) && !path.includes(`${join(fleet.root, 'beta')}`) && !path.startsWith(join(fleet.root, 'bin')))
  for (const path of written) assert.doesNotMatch(readFileSync(path, 'utf8'), new RegExp(canary, 'u'), path)
  assert.deepEqual(readdirSync(join(fleet.root, 'tmp')), [])
  for (const path of filesBelow(join(fleet.guideRoot, 'session-review'))) assert.doesNotMatch(readFileSync(path, 'utf8'), /\/home\/|\/Users\//u, path)
  assert.ok(statSync(join(fleet.guideRoot, 'session-review', 'cursors.json')).isFile())
}))
