#!/usr/bin/env node

// Nightly session review for the field guide. It is opt-in per machine. It reads root
// interactive Claude Code and Codex sessions in place since its cursors, sends their typed user
// turns on stdin to a headless classifier from the same provider, and submits the sanitized
// paraphrases that come back through the journal, one reversible operation each.
// - The packet never touches disk. The classifier runs in an empty directory with hooks off.
// - Cursors advance only after the observations they cover are committed. Classifier output
//   waits in pending.json, as sanitized paraphrases and pointers, until then, so a crash
//   replays the same observations and a rerun reviews nothing new.
// - Caps bound the bytes per session and per night, the budget, and the tokens; what a cap
//   stops is reported as backlog.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scrubPaths } from './field-guide-dream.mjs'
import { applySessionObservations, guidePathsFor, resolvePaths, runIfEntryPoint, sessionObservationProblem, sessionReviewRecords } from './field-guide.mjs'
import { discoverSessions, readSession, readT3Threads, sourceRoots, threadFor } from './field-guide-sessions.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const fail = (message) => {
  throw new Error(message)
}

const dayMs = 24 * 60 * 60 * 1000
const defaultCaps = {
  maxSessionBytes: 16 * 1024,
  maxNightBytes: 256 * 1024,
  maxBatchBytes: 64 * 1024,
  maxRecordBytes: 24 * 1024,
  maxObservationsPerCall: 40,
  budgetUsd: 2,
  maxInputTokens: 200_000,
  maxOutputTokens: 30_000,
  lookbackDays: 7,
  timeoutMs: 5 * 60 * 1000,
}

const classifierModels = { claude: 'claude-haiku-5-5', codex: 'gpt-6-luna' }

/**
 * The headless classifier command for one provider. Claude runs without tools, slash commands,
 * MCP servers, session files, or hooks, under the night's remaining budget. Codex runs
 * ephemeral and read-only with hooks off. Both read the prompt from stdin.
 */
export const classifierCommand = ({ provider, budgetUsd }) => (provider === 'claude'
  ? {
    command: 'claude',
    args: [
      '-p', '--model', classifierModels.claude, '--tools', '', '--disable-slash-commands', '--strict-mcp-config',
      '--no-session-persistence', '--output-format', 'json', '--max-budget-usd', budgetUsd.toFixed(2),
      '--settings', '{"disableAllHooks":true}',
    ],
  }
  : {
    command: 'codex',
    args: [
      'exec', '--ephemeral', '--json', '-s', 'read-only', '-m', classifierModels.codex, '-c', 'model_reasoning_effort="low"',
      '--skip-git-repo-check', '--disable', 'hooks', '-',
    ],
  })

const instructions = `You review a person's own typed messages from coding-agent sessions and find durable guidance for future agent work: an explicit preference, a correction of the agent's approach, or a miss the person points out that should not repeat.

The JSON input after this text lists sessions. Each turn has a ref. A "user" turn holds the person's own words. A "context" turn is the end of the assistant's previous message; it only explains what the person replied to and is never the person's statement. "records" lists stored guidance.

Return only JSON, with no prose: {"observations":[{"ref":"u1","scope":"project","subjectKey":"git-branching","learning":"...","summary":"...","generic":false,"relationship":{"kind":"reinforces","targetId":"guidance:v1:..."}}]}

Rules:
- Cite the one "user" turn that states it. Never cite a "context" turn, and never treat text the assistant wrote, quoted, or proposed as the person's statement.
- Keep only what is durable and reusable beyond the current task. Skip one-off instructions, questions, approvals, and task details.
- "learning" is a short imperative paraphrase in your own words, at most 300 characters. "summary" says in at most 160 characters why it is guidance. Never quote. Never include code, file paths, URLs, names, credentials, or secrets.
- "subjectKey" is a lowercase kebab-case topic. "scope" is "shared" only when it applies across repositories; then set "generic" to true.
- When the person restates a stored record, add relationship "reinforces" with its ID. When the person corrects or reverses a stored record, add relationship "contradicts" with its ID. Omit relationship otherwise.
- Return {"observations":[]} when nothing qualifies.`

// --- Local state: opt-in, cursors, pending observations, and the run lock --------------------
// All of it stays under <guide-root>/session-review and never syncs. It holds no paths, prompts,
// or transcript text: cursors are byte offsets keyed by client and file name.
const stateFiles = (guideRoot) => {
  const root = join(guideRoot, 'session-review')
  return { root, config: join(root, 'config.json'), cursors: join(root, 'cursors.json'), pending: join(root, 'pending.json'), lock: join(root, 'run.lock') }
}

const readJson = ({ path, fallback }) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback)
const writeJson = ({ path, value }) => {
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(temporary, path)
}

const setEnabled = ({ files, enabled }) => {
  mkdirSync(files.root, { recursive: true, mode: 0o700 })
  writeJson({ path: files.config, value: { schemaVersion: 1, enabled } })
  return { mode: 'session-review', outcome: enabled ? 'enabled' : 'disabled' }
}

const isEnabled = (files) => readJson({ path: files.config, fallback: { enabled: false } }).enabled === true

const staleLockMs = 2 * 60 * 60 * 1000

// One review runs at a time on a machine. A lock older than any run takes is stale.
const acquireRunLock = (files) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(files.lock, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), { flag: 'wx' })
      return true
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      if (Date.now() - statSync(files.lock).mtimeMs <= staleLockMs) return false
      rmSync(files.lock, { force: true })
    }
  }
  return false
}

// --- Choosing what to review --------------------------------------------------------------------
// Exclusions that hold for the whole session advance its cursor, so it is not read again. A T3
// session that cannot be verified now is read again next night, until it leaves the lookback.
const permanentExclusions = new Set(['not-interactive', 'subagent', 't3-agent-thread', 'unresolved-repository', 'unreadable'])

const repositoryIdentity = ({ cwd, guideRoot, cache }) => {
  if (!cache.has(cwd)) {
    let identity = null
    try {
      identity = resolvePaths({ repoRoot: cwd, guideRoot }).identity
    } catch {
      // The directory is gone or is not a repository, such as a removed worktree.
    }
    // A repository without a hosted remote is identified by a local path, which no output may hold.
    cache.set(cwd, /^remote:[a-z0-9.-]+\//u.test(identity ?? '') ? identity : null)
  }
  return cache.get(cwd)
}

// Takes whole turns up to the per-session cap. The cursor moves past the last turn taken, or to
// the end of the read when every turn fits.
const boundTurns = ({ session, maxBytes }) => {
  const turns = []
  let bytes = 0
  for (const turn of session.turns.filter(({ text }) => text.length > 0)) {
    const size = Buffer.byteLength(turn.text) + Buffer.byteLength(turn.leadIn)
    if (turns.length > 0 && bytes + size > maxBytes) return { turns, bytes, end: turns.at(-1).end, partial: true }
    turns.push(turn)
    bytes += size
  }
  return { turns, bytes, end: session.end, partial: false }
}

const examine = ({ source, offset, context }) => {
  const session = readSession({ source, offset })
  if (session.excluded) return { excluded: session.excluded, end: session.end }
  const thread = threadFor({ client: source.client, session, t3Threads: context.t3Threads })
  if (thread.excluded) return { excluded: thread.excluded, end: session.end }
  const bounded = boundTurns({ session, maxBytes: context.caps.maxSessionBytes })
  if (bounded.turns.length === 0) return { empty: true, end: session.end }
  const identity = session.cwd ? repositoryIdentity({ cwd: session.cwd, guideRoot: context.guideRoot, cache: context.identities }) : null
  if (!identity) return { excluded: 'unresolved-repository', end: session.end }
  return { review: { key: source.key, provider: source.client, thread, repositoryIdentity: identity, ...bounded } }
}

const count = (counts, key) => {
  counts[key] = (counts[key] ?? 0) + 1
}

// The offset to read from: the cursor, or the start of a session first seen within the
// lookback. Returns null when there is nothing to read.
const startOffset = ({ source, cursors, context }) => {
  const offset = cursors[source.key]
  if (offset === undefined) return context.nowMs - source.mtimeMs > context.caps.lookbackDays * dayMs ? null : 0
  return source.size > offset ? offset : null
}

const addBacklog = ({ backlog, sessions = 1, bytes }) => {
  backlog.sessions += sessions
  backlog.bytes += bytes
}

// Reads every session with new content since its cursor, oldest first, within the night's byte
// cap. A session without a cursor counts only when it changed within the lookback.
const selectSessions = ({ cursors, context }) => {
  const selection = { reviews: [], excluded: {}, advance: {}, backlog: { sessions: 0, bytes: 0 } }
  let bytes = 0
  for (const source of discoverSessions({ roots: context.roots })) {
    const offset = startOffset({ source, cursors, context })
    if (offset === null) continue
    if (bytes >= context.caps.maxNightBytes) {
      addBacklog({ backlog: selection.backlog, bytes: source.size - offset })
      continue
    }
    const result = examine({ source, offset, context })
    if (result.excluded) count(selection.excluded, result.excluded)
    if (result.empty || permanentExclusions.has(result.excluded)) selection.advance[source.key] = result.end
    if (!result.review) continue
    selection.reviews.push(result.review)
    bytes += result.review.bytes
    if (result.review.partial) addBacklog({ backlog: selection.backlog, bytes: 0 })
  }
  return selection
}

// Groups sessions by provider, each batch within the batch byte cap.
const batchesOf = ({ reviews, maxBytes }) => {
  const batches = []
  for (const provider of ['claude', 'codex']) {
    let current = null
    for (const review of reviews.filter((each) => each.provider === provider)) {
      if (!current || current.bytes + review.bytes > maxBytes) {
        current = { provider, reviews: [], bytes: 0 }
        batches.push(current)
      }
      current.reviews.push(review)
      current.bytes += review.bytes
    }
  }
  return batches
}

// --- Classification -----------------------------------------------------------------------------
// The packet names turns by opaque refs. Only a ref to a user turn maps back to a session, a
// thread, and a message ID; a ref to a context turn or an unknown ref is rejected.
const packetFor = ({ batch, records }) => {
  const refs = new Map()
  const sessions = batch.reviews.map((review, index) => ({
    session: `s${index + 1}`,
    turns: review.turns.flatMap((turn) => {
      const ref = `u${refs.size + 1}`
      refs.set(ref, { review, turn })
      return [...(turn.leadIn ? [{ ref: `c${refs.size}`, role: 'context', text: turn.leadIn }] : []), { ref, role: 'user', text: turn.text }]
    }),
  }))
  return { prompt: `${instructions}\n\n${JSON.stringify({ sessions, records })}\n`, refs }
}

const parseModelJson = (text) => JSON.parse(String(text).trim().replace(/^```(?:json)?\s*|\s*```$/gu, ''))

// `modelUsage` covers every request of the run and matches `total_cost_usd`; the top-level
// `usage` covers only the last one. Older output without `modelUsage` falls back to it.
const claudeUsage = (output) => {
  const models = Object.values(output.modelUsage ?? {})
  const sum = (field) => models.reduce((total, model) => total + (model[field] ?? 0), 0)
  const usage = output.usage ?? {}
  return models.length > 0
    ? { inputTokens: sum('inputTokens'), cacheCreationInputTokens: sum('cacheCreationInputTokens'), cacheReadInputTokens: sum('cacheReadInputTokens'), outputTokens: sum('outputTokens') }
    : { inputTokens: usage.input_tokens ?? 0, cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0, cacheReadInputTokens: usage.cache_read_input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 }
}

const claudeResult = (stdout) => {
  const output = JSON.parse(stdout)
  return { failed: output.is_error === true, text: output.result, usage: { ...claudeUsage(output), costUsd: output.total_cost_usd ?? 0 } }
}

const codexResult = (stdout) => {
  const events = stdout.split('\n').filter((line) => line.trim().startsWith('{')).map((line) => JSON.parse(line))
  const message = events.filter(({ type, item }) => type === 'item.completed' && item?.type === 'agent_message').at(-1)
  const usage = events.filter(({ type }) => type === 'turn.completed').reduce((total, { usage: each = {} }) => ({
    inputTokens: total.inputTokens + (each.input_tokens ?? 0),
    cachedInputTokens: total.cachedInputTokens + (each.cached_input_tokens ?? 0),
    outputTokens: total.outputTokens + (each.output_tokens ?? 0),
  }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 })
  return { failed: events.some(({ type }) => type === 'turn.failed' || type === 'error'), text: message?.item.text, usage }
}

// Output that does not parse is a failed call; its text is never reported, since it could echo
// the packet.
const parseOutput = ({ provider, stdout }) => {
  try {
    const parsed = (provider === 'claude' ? claudeResult : codexResult)(stdout)
    return { ...parsed, observations: parsed.failed ? undefined : parseModelJson(parsed.text).observations }
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) return null
    throw error
  }
}

// Runs one classifier call from a new empty directory and removes it afterwards. The prompt goes
// on stdin only. Returns the parsed observations and measured usage, or a failure.
const classify = ({ provider, prompt, budgetUsd, timeoutMs }) => {
  const { command, args } = classifierCommand({ provider, budgetUsd })
  const cwd = mkdtempSync(join(tmpdir(), 'field-guide-review-'))
  const started = Date.now()
  try {
    const result = spawnSync(command, args, { cwd, input: prompt, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 })
    const durationMs = Date.now() - started
    if (result.error || result.status !== 0) return { outcome: 'failed', reason: result.error?.code ?? `exit ${result.status}`, durationMs }
    const parsed = parseOutput({ provider, stdout: result.stdout })
    if (!parsed) return { outcome: 'failed', reason: 'classifier output is not valid JSON', durationMs }
    if (parsed.failed) return { outcome: 'failed', reason: 'classifier reported an error', durationMs, usage: parsed.usage }
    if (!Array.isArray(parsed.observations)) return { outcome: 'failed', reason: 'classifier output has no observations', durationMs, usage: parsed.usage }
    return { outcome: 'classified', observations: parsed.observations, durationMs, usage: parsed.usage }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

const observationFields = new Set(['ref', 'scope', 'subjectKey', 'learning', 'summary', 'generic', 'relationship'])
const rejectedObservation = (reason) => ({ rejected: reason })

// Turns one classifier observation into a submission with one conversation pointer. A
// relationship takes its target's scope and subject; submit checks the rest at the boundary.
const itemFor = ({ observation, refs, records }) => {
  if (!observation || typeof observation !== 'object' || Object.keys(observation).some((key) => !observationFields.has(key))) return rejectedObservation('observation has unexpected fields')
  const cited = refs.get(observation.ref)
  if (!cited) return rejectedObservation('observation cites no user turn')
  const target = observation.relationship && records.find(({ id }) => id === observation.relationship.targetId)
  if (observation.relationship && (!target || !['reinforces', 'contradicts'].includes(observation.relationship.kind))) return rejectedObservation('observation names an unknown relationship')
  const { review, turn } = cited
  const scope = target?.scope ?? observation.scope
  return {
    repositoryIdentity: review.repositoryIdentity,
    submission: {
      schemaVersion: 1,
      decision: 'capture',
      confidence: 'medium',
      scope,
      subjectKey: target?.subjectKey ?? observation.subjectKey,
      learning: observation.learning,
      ...(scope === 'shared' && observation.generic === true ? { generic: true } : {}),
      ...(target ? { relationship: { kind: observation.relationship.kind, targetId: target.id } } : {}),
      evidence: {
        summary: observation.summary,
        pointers: [{ kind: 'conversation', client: review.thread.client, threadId: review.thread.threadId, ...(turn.id ? { messageId: turn.id } : {}) }],
      },
    },
  }
}

// --- Applying -----------------------------------------------------------------------------------
const commitPending = ({ files, guidePaths, pending, cursors }) => {
  const results = pending.items.length > 0 ? applySessionObservations({ guidePaths, items: pending.items, runId: pending.runId }) : []
  Object.assign(cursors, pending.cursors)
  writeJson({ path: files.cursors, value: { schemaVersion: 1, cursors } })
  rmSync(files.pending, { force: true })
  return results
}

const summarize = ({ report, results }) => {
  for (const result of results) {
    if (result.operationId) report.changes.push(result)
    if (result.proposedPromotion) report.proposals.push({ kind: 'shared-promotion', targetId: result.targetId, learning: result.learning })
    if (result.queued) report.queued.push({ kind: 'contradiction', targetId: result.relationship.targetId, candidateId: result.targetId })
    if (result.outcome === 'thread-already-counted') count(report.skipped, 'thread-already-counted')
    if (result.outcome === 'rejected') report.rejected.push({ reason: result.reason })
  }
}

const remaining = ({ spent, caps }) => ({
  budgetUsd: caps.budgetUsd - spent.costUsd,
  inputTokens: caps.maxInputTokens - spent.inputTokens,
  outputTokens: caps.maxOutputTokens - spent.outputTokens,
})

// Packet bytes over three, plus the instructions each headless call loads before the packet,
// as measured: about 14k tokens for Claude and 22k for Codex.
const callOverheadTokens = { claude: 14_000, codex: 22_000 }
const estimatedInputTokens = ({ provider, prompt }) => Math.ceil(Buffer.byteLength(prompt) / 3) + callOverheadTokens[provider]

const capStop = ({ spent, caps, provider, prompt }) => {
  const left = remaining({ spent, caps })
  if (left.budgetUsd < 0.01) return 'budget'
  if (left.inputTokens < estimatedInputTokens({ provider, prompt }) || left.outputTokens <= 0) return 'tokens'
  return null
}

const addUsage = ({ spent, usage = {} }) => {
  spent.inputTokens += (usage.inputTokens ?? 0) + (usage.cacheCreationInputTokens ?? 0) + (usage.cacheReadInputTokens ?? 0)
  spent.outputTokens += usage.outputTokens ?? 0
  spent.costUsd += usage.costUsd ?? 0
}

const reviewBatch = ({ batch, run }) => {
  const { prompt, refs } = packetFor({ batch, records: run.records })
  const stop = capStop({ spent: run.spent, caps: run.caps, provider: batch.provider, prompt })
  if (stop) return { stop }
  const call = classify({ provider: batch.provider, prompt, budgetUsd: remaining(run).budgetUsd, timeoutMs: run.caps.timeoutMs })
  addUsage({ spent: run.spent, usage: call.usage })
  run.report.calls.push({ provider: batch.provider, model: classifierModels[batch.provider], sessions: batch.reviews.length, packetBytes: Buffer.byteLength(prompt), ...call, observations: call.observations?.length ?? 0 })
  if (call.outcome !== 'classified') return { failed: true }
  // The privacy guard runs before an observation reaches pending.json or a dry-run report.
  const items = call.observations.slice(0, run.caps.maxObservationsPerCall)
    .map((observation) => itemFor({ observation, refs, records: run.records }))
    .map((item) => (item.rejected ? item : { ...item, rejected: sessionObservationProblem({ guidePaths: run.guidePaths, item }) }))
  items.filter(({ rejected }) => rejected).forEach(({ rejected }) => run.report.rejected.push({ reason: rejected }))
  return { items: items.filter(({ rejected }) => !rejected).map(({ repositoryIdentity, submission }) => ({ repositoryIdentity, submission })) }
}

const recordBatch = ({ batch, outcome, run }) => {
  if (outcome.stop || outcome.failed) {
    addBacklog({ backlog: run.report.sessions.backlog, sessions: batch.reviews.length, bytes: batch.bytes })
    return
  }
  for (const { thread } of batch.reviews) run.threads.add(`${thread.client}\u0000${thread.threadId}`)
  if (run.dryRun) {
    run.report.observations.push(...outcome.items.map(({ submission }) => ({ scope: submission.scope, subjectKey: submission.subjectKey, learning: submission.learning })))
    return
  }
  const pending = { schemaVersion: 1, runId: run.runId, items: outcome.items, cursors: Object.fromEntries(batch.reviews.map(({ key, end }) => [key, end])) }
  writeJson({ path: run.files.pending, value: pending })
  commitOrStop({ run, pending })
}

// A commit that fails, such as on a held memory lock or an older installed plugin, keeps its
// observations pending for the next run and stops this one; the report still lists the calls.
const commitOrStop = ({ run, pending }) => {
  try {
    const results = commitPending({ ...run, pending })
    summarize({ report: run.report, results })
    return results
  } catch (error) {
    Object.assign(run.report, { outcome: 'stopped', stoppedBy: 'commit-failed', error: error.message })
    return null
  }
}

const newReport = ({ runId, dryRun, caps }) => ({
  mode: 'session-review',
  outcome: 'reviewed',
  runId,
  ...(dryRun ? { dryRun: true } : {}),
  classifiers: classifierModels,
  sessions: { reviewed: {}, excluded: {}, backlog: { sessions: 0, bytes: 0 } },
  calls: [],
  usage: null,
  caps,
  changes: [],
  proposals: [],
  queued: [],
  skipped: {},
  rejected: [],
  ...(dryRun ? { observations: [] } : {}),
})

const reviewUnlocked = ({ files, guideRoot, env, caps, dryRun }) => {
  const guidePaths = guidePathsFor(guideRoot)
  const cursors = readJson({ path: files.cursors, fallback: { cursors: {} } }).cursors
  const run = {
    files, guidePaths, cursors, caps, dryRun,
    runId: `run:v1:${randomBytes(32).toString('hex')}`,
    spent: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    threads: new Set(),
    records: sessionReviewRecords({ paths: guidePaths, maxBytes: caps.maxRecordBytes }).records,
  }
  run.report = newReport(run)
  // A run that stopped after classification left its observations pending; they apply first.
  if (existsSync(files.pending) && !dryRun) {
    const results = commitOrStop({ run, pending: readJson({ path: files.pending }) })
    if (!results) return finish(run)
    run.report.recovered = results.length
  }
  const roots = sourceRoots(env)
  const selection = selectSessions({ cursors, context: { roots, caps, guideRoot: guidePaths.guideRoot, nowMs: Date.now(), identities: new Map(), t3Threads: readT3Threads({ statePath: roots.t3State }) } })
  Object.assign(run.report.sessions, { excluded: selection.excluded, backlog: selection.backlog })
  if (!dryRun && Object.keys(selection.advance).length > 0) {
    Object.assign(cursors, selection.advance)
    writeJson({ path: files.cursors, value: { schemaVersion: 1, cursors } })
  }
  for (const batch of batchesOf({ reviews: selection.reviews, maxBytes: caps.maxBatchBytes })) {
    const outcome = run.report.stoppedBy ? { stop: run.report.stoppedBy } : reviewBatch({ batch, run })
    if (outcome.stop) run.report.stoppedBy = outcome.stop
    recordBatch({ batch, outcome, run })
  }
  return finish(run)
}

const finish = (run) => {
  run.report.usage = run.spent
  // Threads, not provider sessions: a T3 Code thread counts once, whichever providers ran it.
  for (const key of run.threads) count(run.report.sessions.reviewed, key.split('\u0000')[0])
  return run.report
}

/** Runs one session review. Returns its report; a disabled machine or a held lock does nothing. */
const reviewSessions = ({ guideRoot, env = process.env, caps = defaultCaps, dryRun = false }) => {
  const started = Date.now()
  const files = stateFiles(guidePathsFor(guideRoot).guideRoot)
  if (!isEnabled(files)) return { mode: 'session-review', outcome: 'not-enabled' }
  if (!acquireRunLock(files)) return { mode: 'session-review', outcome: 'already-running' }
  try {
    return { ...reviewUnlocked({ files, guideRoot, env, caps, dryRun }), durationMs: Date.now() - started }
  } finally {
    rmSync(files.lock, { force: true })
  }
}

const usage = 'Usage: field-guide-review.mjs <enable|disable|run> [--guide-root <path>] [--dry-run]'

const parseArgs = (argv) => {
  const [command, ...rest] = argv
  if (!['enable', 'disable', 'run'].includes(command)) fail(usage)
  const options = { dryRun: false }
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === '--dry-run' && command === 'run') options.dryRun = true
    else if (rest[index] === '--guide-root' && rest[index + 1] && !options.guideRoot) options.guideRoot = rest[(index += 1)]
    else fail(usage)
  }
  return { command, options }
}

const main = () => {
  const { command, options } = parseArgs(process.argv.slice(2))
  const guideRoot = guidePathsFor(options.guideRoot).guideRoot
  const result = command === 'run'
    ? reviewSessions({ guideRoot, dryRun: options.dryRun })
    : setEnabled({ files: stateFiles(guideRoot), enabled: command === 'enable' })
  process.stdout.write(`${scrubPaths({ text: JSON.stringify(result, null, 2), guideRoot })}\n`)
}

runIfEntryPoint({ path: scriptPath, main })
