// Reads root interactive sessions from Claude Code and Codex transcripts in place, for the
// nightly session review. It keeps only the user's typed turns, each with a short lead-in from
// the assistant turn before it, and removes quoted, pasted, injected, and code text before the
// redaction of home paths, URL queries, and credential-like strings. It writes nothing.
import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { createRequire } from 'node:module'

const maxTurnBytes = 2048
const maxLeadInBytes = 320

export const sourceRoots = (env) => ({
  claude: join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects'),
  codex: join(env.CODEX_HOME || join(homedir(), '.codex'), 'sessions'),
  t3State: join(env.T3CODE_HOME || join(homedir(), '.t3'), 'userdata', 'statev2.sqlite'),
})

const jsonlFiles = (directory) => (existsSync(directory)
  ? readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl')).map(({ name }) => join(directory, name))
  : [])

const subdirectories = (directory) => (existsSync(directory)
  ? readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map(({ name }) => join(directory, name))
  : [])

const describe = ({ client, file }) => {
  const { size, mtimeMs } = statSync(file)
  return { client, file, key: `${client}:${basename(file, '.jsonl')}`, size, mtimeMs }
}

/**
 * Lists transcript files. A Claude session is a JSONL file directly inside a project directory,
 * so `subagents/` transcripts below a session directory are never listed. Codex sessions sit in
 * `sessions/<year>/<month>/<day>/`.
 */
export const discoverSessions = ({ roots }) => [
  ...subdirectories(roots.claude).flatMap(jsonlFiles).map((file) => describe({ client: 'claude', file })),
  ...subdirectories(roots.codex).flatMap(subdirectories).flatMap(subdirectories).flatMap(jsonlFiles)
    .map((file) => describe({ client: 'codex', file })),
].sort((left, right) => left.mtimeMs - right.mtimeMs || left.key.localeCompare(right.key))

const readBytes = ({ file, start, end }) => {
  const buffer = Buffer.alloc(Math.max(0, end - start))
  const handle = openSync(file, 'r')
  try {
    readSync(handle, buffer, 0, buffer.length, start)
  } finally {
    closeSync(handle)
  }
  return buffer
}

/**
 * Returns the complete lines from `offset` to the end of the file, each with the byte offset
 * just past it. A trailing line without a newline is still being written and is left for later.
 */
const readLines = ({ file, offset, size }) => {
  const buffer = readBytes({ file, start: offset, end: size })
  const lines = []
  let start = 0
  for (let index = buffer.indexOf(10); index !== -1; index = buffer.indexOf(10, start)) {
    lines.push({ text: buffer.subarray(start, index).toString('utf8'), end: offset + index + 1 })
    start = index + 1
  }
  return lines
}

const parse = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    // A line that does not parse holds no turn the review can use.
    return null
  }
}

const firstLine = (file) => {
  const { size } = statSync(file)
  return readLines({ file, offset: 0, size: Math.min(size, 1024 * 1024) })[0]?.text ?? ''
}

// T3 Code quotes an assistant message as a citation link whose `comment` parameter holds the
// user's own words; the quoted assistant text is dropped.
const citationPattern = /\[[^\]\n]*\]\(t3-citation:\/\/[^)\s]*\)/gu
const citationComment = (link) => {
  const query = link.slice(link.indexOf('?') + 1, -1)
  return new URLSearchParams(query).get('comment') ?? ''
}

// Harness blocks that wrap injected, pasted, or command text inside a user turn.
const harnessBlocks = [
  'system-reminder', 'pasted_content', 'command-name', 'command-message', 'command-args',
  'local-command-stdout', 'local-command-stderr', 'local-command-caveat', 'task-notification', 'user-prompt-submit-hook',
]
const harnessBlockPattern = new RegExp(`<(${harnessBlocks.join('|')})\\b[^>]*>[\\s\\S]*?(?:<\\/\\1\\b[^>]*>|$)`, 'gu')

const redactions = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/gu, '[redacted]'],
  [/\b(?:github_pat_|gh[pousr]_|AKIA|xox[abpr]-|glpat-)[A-Za-z0-9_-]{8,}/gu, '[redacted]'],
  [/\bsk-[A-Za-z0-9_-]{16,}/gu, '[redacted]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/gu, '[redacted]'],
  [/\b((?:password|passwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret)\s*[:=]\s*)\S+/giu, '$1[redacted]'],
  [/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/giu, '$1'],
  [/(?:\/(?:Users|home)\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)(?=[/\\\s]|$)/gu, '~'],
  // A long run of letters and digits, such as a key, a hash, or an ID.
  [/\b(?=[A-Za-z0-9+_-]*\d)(?=[A-Za-z0-9+_-]*[A-Za-z])[A-Za-z0-9+_-]{32,}={0,2}/gu, '[redacted]'],
]

/** Removes home paths, URL queries and fragments, and credential-like strings. */
const redact = (text) => redactions.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text)

const truncate = ({ text, maxBytes, keepEnd = false }) => {
  const bytes = Buffer.from(text, 'utf8')
  if (bytes.length <= maxBytes) return text
  // Decoding may split a character; the replacement character it leaves is harmless.
  return keepEnd ? `…${bytes.subarray(bytes.length - maxBytes).toString('utf8')}` : `${bytes.subarray(0, maxBytes).toString('utf8')}…`
}

const prose = (text) => redact(text
  .replace(/^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1\2[ \t]*$|(?![\s\S]))/gmu, ' ')
  .replace(/^[ \t]*>.*$/gmu, ' '))
  .replace(/\s+/gu, ' ')
  .trim()

/**
 * Returns what the user typed in one turn: T3 Code citation comments without the quoted text,
 * and prose without harness blocks, code blocks, or quoted lines, redacted and bounded.
 */
const userStatement = (text) => {
  const comments = (text.match(citationPattern) ?? []).map(citationComment)
  const own = text.replace(citationPattern, ' ').replace(harnessBlockPattern, ' ')
  return truncate({ text: prose([...comments, own].join('\n')), maxBytes: maxTurnBytes })
}

/** Returns the end of an assistant message, redacted, as context for the next user turn. */
const leadIn = (text) => truncate({ text: prose(text.replace(harnessBlockPattern, ' ')), maxBytes: maxLeadInBytes, keepEnd: true })

// Claude and Codex user blocks are `text`; Codex agent message blocks are `Text`.
const textBlocks = (content) => (typeof content === 'string'
  ? [content]
  : (Array.isArray(content) ? content.filter((block) => ['text', 'Text'].includes(block?.type) && typeof block.text === 'string').map(({ text }) => text) : []))

// Claude Code: the terminal (`cli`) and T3 Code start interactive sessions; `claude -p` runs
// report `sdk-cli` and other entry points are unknown, so they are excluded.
const claudeInteractive = new Set(['cli', 't3-code'])

// A typed user turn: not a sidechain, meta, compaction, peer, or notification entry, and not a
// tool result. Any `origin` is excluded, even a human one, so an unknown kind never counts.
const typedClaudeTurn = (entry) => entry.type === 'user'
  && entry.isSidechain !== true && entry.isMeta !== true && entry.isCompactSummary !== true && entry.isVisibleInTranscriptOnly !== true
  && entry.origin === undefined
  && !(Array.isArray(entry.message?.content) && entry.message.content.some((block) => block?.type === 'tool_result'))

const noteClaudeEntry = ({ session, entry }) => {
  if (entry.entrypoint) {
    session.t3 ||= entry.entrypoint === 't3-code'
    if (!claudeInteractive.has(entry.entrypoint)) session.excluded = 'not-interactive'
  }
  if (typeof entry.cwd === 'string') session.cwd = entry.cwd
}

// Collects typed user turns, each with the end of the assistant message before it.
const collectTurns = ({ lines, turnOf }) => {
  const turns = []
  let assistant = ''
  for (const { text, end } of lines) {
    const { assistantText, turn } = turnOf(parse(text)) ?? {}
    if (assistantText !== undefined) assistant = assistantText
    if (!turn) continue
    turns.push({ id: typeof turn.id === 'string' ? turn.id : null, text: userStatement(textBlocks(turn.content).join('\n')), leadIn: leadIn(assistant), end })
    assistant = ''
  }
  return turns
}

const claudeSession = ({ source, lines }) => {
  const session = { sessionId: basename(source.file, '.jsonl'), cwd: null, t3: false, excluded: null }
  const turns = collectTurns({
    lines,
    turnOf: (entry) => {
      if (!entry || entry.isSidechain === true) return null
      noteClaudeEntry({ session, entry })
      if (entry.type === 'assistant') return { assistantText: textBlocks(entry.message?.content).join('\n') }
      return typedClaudeTurn(entry) ? { turn: { id: entry.uuid, content: entry.message?.content } } : null
    },
  })
  return { ...session, turns }
}

// Codex: the terminal (`cli`) and editor clients, T3 Code among them, report these sources.
// `codex exec` reports `exec`, and a subagent or guardian review reports an object.
const codexInteractive = new Set(['cli', 'vscode'])

const codexMeta = (source) => {
  const meta = parse(firstLine(source.file))
  if (meta?.type !== 'session_meta') return null
  return meta.payload
}

const codexExclusion = (meta) => {
  if (!meta || typeof meta.id !== 'string') return 'unreadable'
  if (codexInteractive.has(meta.source)) return null
  return typeof meta.source === 'object' ? 'subagent' : 'not-interactive'
}

const codexTurn = (entry) => {
  const item = entry?.type === 'event_msg' && entry.payload?.type === 'item_completed' ? entry.payload.item : null
  if (item?.type === 'AgentMessage') return { assistantText: textBlocks(item.content).join('\n') }
  return item?.type === 'UserMessage' ? { turn: { id: item.id, content: item.content } } : null
}

const codexSession = ({ source, lines }) => {
  const meta = codexMeta(source)
  return {
    sessionId: meta?.id ?? null,
    cwd: meta?.cwd ?? null,
    t3: meta?.originator === 'T3 Code',
    excluded: codexExclusion(meta),
    turns: collectTurns({ lines, turnOf: codexTurn }),
  }
}

/** Reads one transcript from `offset`. Returns its session ID, working directory, exclusion, and turns. */
export const readSession = ({ source, offset }) => {
  const lines = readLines({ file: source.file, offset, size: source.size })
  const session = (source.client === 'claude' ? claudeSession : codexSession)({ source, lines })
  return { ...session, end: lines.at(-1)?.end ?? offset }
}

// A person starts a T3 Code thread from the web or mobile client; every other source, such as
// MCP, a provider subagent, or a schedule, is an agent's.
const humanThreadSources = new Set(['web', 'mobile'])

const t3ThreadsQuery = `
  SELECT json_extract(p.payload_json, '$.nativeThreadRef.nativeId') AS nativeId, t.thread_id AS threadId,
    json_extract(t.payload_json, '$.createdBy') AS createdBy,
    json_extract(t.payload_json, '$.creationSource') AS creationSource,
    json_extract(t.payload_json, '$.lineage.parentThreadId') AS parentThreadId,
    EXISTS (SELECT 1 FROM scheduled_tasks s WHERE s.thread_id = t.thread_id) AS scheduled
  FROM orchestration_v2_projection_provider_threads p
  JOIN orchestration_v2_projection_threads t ON t.thread_id = p.thread_id`

const isRootThread = ({ createdBy, creationSource, parentThreadId, scheduled }) => (
  createdBy === 'user' && humanThreadSources.has(creationSource) && parentThreadId === null && scheduled === 0
)

/**
 * Reads, from T3 Code's state database, the T3 thread each provider session belongs to and
 * whether a person started it. Returns null when the database is missing or unreadable, has an
 * unexpected schema, or this Node has no `node:sqlite`; T3 sessions are then excluded, never
 * included unverified.
 */
export const readT3Threads = ({ statePath }) => {
  if (!existsSync(statePath)) return null
  let database
  try {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')
    database = new DatabaseSync(statePath, { readOnly: true })
    return new Map(database.prepare(t3ThreadsQuery).all()
      .filter(({ nativeId }) => typeof nativeId === 'string')
      .map((row) => [row.nativeId, { threadId: row.threadId, root: isRootThread(row) }]))
  } catch {
    // Fail closed: without the state, no T3 session counts as a root interactive session.
    return null
  } finally {
    database?.close()
  }
}

/**
 * Names the thread a session's evidence belongs to, or why the session is excluded. A session
 * that T3 Code ran belongs to its T3 thread, so a thread that spans several provider sessions
 * counts once; a live capture in T3 Code names the same thread through `T3CODE_THREAD_ID`.
 */
export const threadFor = ({ client, session, t3Threads }) => {
  const binding = t3Threads?.get(session.sessionId)
  if (binding) return binding.root ? { client: 't3-code', threadId: binding.threadId } : { excluded: 't3-agent-thread' }
  if (session.t3) return { excluded: t3Threads ? 't3-unbound' : 't3-state-unavailable' }
  return { client: client === 'claude' ? 'claude-code' : 'codex', threadId: session.sessionId }
}
