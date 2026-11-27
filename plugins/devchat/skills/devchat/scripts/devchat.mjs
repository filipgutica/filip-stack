#!/usr/bin/env node

// devchat client: the write router, the text guard, local todos, the board outbox and sync, setup,
// and checks. A write the router keeps on this machine goes to `local/` and makes no network
// request. A board write goes to `outbox/`, and `devchat sync` alone sends it, with plain `fetch`.
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { accessSync, chmodSync, constants, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

/** The commands the skill shows agents. The skill's command block must list exactly these. */
export const agentCommands = ['todo add']

const modes = ['off', 'read', 'readwrite']
const todoChannel = 'todos'
const maxTextLength = 10_000

class UsageError extends Error {}

// Paths. The config holds every personal value; the state directory holds everything this
// machine writes. Both follow the XDG base directories.
const configPath = (env) => join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'devchat', 'config.json')
/** Returns the state directory: `$XDG_STATE_HOME/devchat`, by default `~/.local/state/devchat`. */
const stateDir = (env = process.env) => join(env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'devchat')
const localDir = (env) => join(stateDir(env), 'local')
const pluginPathFile = (env) => join(stateDir(env), 'plugin-path')
const snapshotPath = (env) => join(stateDir(env), 'snapshot.json')
// `outbox/` holds queued board operations, one file each. Sync moves a sent file to `sent/`, and a
// file that fails the check at flush to `rejected/`.
const outboxDir = (env) => join(stateDir(env), 'outbox')
const sentDir = (env) => join(outboxDir(env), 'sent')
const rejectedDir = (env) => join(outboxDir(env), 'rejected')
const syncLockPath = (env) => join(outboxDir(env), 'sync.lock')
// A session key is a harness and that harness's session ID, so an ID one harness recorded never
// answers for another. It arrives from hook stdin and from the environment, so its file name is a hash.
const sessionPath = ({ key, env }) => {
  const digest = createHash('sha256').update(`${key.harness}\0${key.id}`).digest('hex').slice(0, 32)
  return join(stateDir(env), 'sessions', `${digest}.json`)
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const writeAtomic = (path, content) => {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  writeFileSync(temporary, content, { mode: 0o600 })
  renameSync(temporary, path)
}
const writeJsonAtomic = (path, value) => writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`)

/** Writes `path` complete and only if it does not exist yet; returns false when it already did. */
const writeExclusive = (path, content) => {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  writeFileSync(temporary, content, { mode: 0o600 })
  try {
    linkSync(temporary, path)
    return true
  } catch (error) {
    if (error.code === 'EEXIST') return false
    throw error
  } finally {
    unlinkSync(temporary)
  }
}

// Config

const validateConfig = (config) => {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return 'config must be a JSON object'
  if (config.mode !== undefined && !modes.includes(config.mode)) return `mode must be one of ${modes.join(', ')}`
  if (config.githubLogin !== undefined && typeof config.githubLogin !== 'string') return 'githubLogin must be a string'
  if (config.allowlist !== undefined && !(Array.isArray(config.allowlist) && config.allowlist.every((owner) => typeof owner === 'string'))) {
    return 'allowlist must be an array of GitHub owners'
  }
  if (config.machine !== undefined && typeof config.machine !== 'string') return 'machine must be a string'
  if (config.boardUrl !== undefined && !isHttpUrl(config.boardUrl)) return 'boardUrl must be an http or https URL'
  // Without a board URL, a mode that talks to the board has nowhere to go.
  if ((config.mode ?? 'off') !== 'off' && config.boardUrl === undefined) return `mode ${config.mode} needs boardUrl: run devchat setup`
  return null
}

const isHttpUrl = (value) => typeof value === 'string' && URL.canParse(value) && ['http:', 'https:'].includes(new URL(value).protocol)

/**
 * Reads `config.json`. A missing file gives the defaults: mode `off`, no allowlist. An unreadable
 * or invalid file is an error, so a typo never widens where writes go.
 */
const readConfig = (env = process.env) => {
  const path = configPath(env)
  if (!existsSync(path)) return { path, exists: false, mode: 'off', allowlist: [], machine: hostname() }
  let config
  try {
    config = readJson(path)
  } catch (error) {
    throw new UsageError(`${path} is not valid JSON: ${error.message}`)
  }
  const problem = validateConfig(config)
  if (problem) throw new UsageError(`${path}: ${problem}`)
  return {
    path,
    exists: true,
    mode: config.mode ?? 'off',
    // The allowlist defaults to the configured GitHub login, and is empty without one.
    allowlist: config.allowlist ?? (config.githubLogin ? [config.githubLogin] : []),
    machine: config.machine ?? hostname(),
    boardUrl: config.boardUrl,
  }
}

// Repository identity

// The only remote forms that name a github.com repository: `git@github.com:o/r`,
// `ssh://git@github.com/o/r`, and `https://github.com/o/r`, each with an optional `.git` and
// trailing slash. Anything else (another host, user information on https, a port, a query, a
// fragment, a local path, a nested path) is not a github.com identity.
const githubOwner = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})'
const githubRepo = '(?!\\.{1,2}(?:\\.git)?/?$)[A-Za-z0-9._-]{1,100}?'
const githubRemote = new RegExp(
  `^(?:git@github\\.com:|ssh://git@github\\.com/|https://github\\.com/)(${githubOwner})/(${githubRepo})(?:\\.git)?/?$`,
  'iu',
)

/**
 * Returns a remote's repository identity: `github.com/<owner>/<repo>` for a github.com remote,
 * otherwise `other:<hash>`. The hash lets two sessions compare remotes without storing them.
 */
const normalizeRemote = (remote) => {
  if (!remote) return ''
  const match = githubRemote.exec(remote)
  if (match) return `github.com/${match[1]}/${match[2]}`
  return `other:${createHash('sha256').update(remote).digest('hex').slice(0, 32)}`
}

// An inherited GIT_DIR or GIT_WORK_TREE would make git describe another repository.
const gitEnv = (env) => Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_')))

/** Returns the normalized `origin` of the repository containing `cwd`, or '' outside a repository or without an origin. */
const repoIdentityOf = ({ cwd, env = process.env }) => {
  const git = (args) => spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8', env: gitEnv(env), timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'],
  })
  // The configured URL, as written, and the URL git uses after `url.*.insteadOf` rewrites. A
  // rewrite could turn a host alias into github.com, so both must name the same repository.
  const configured = git(['config', '--get-all', 'remote.origin.url'])
  const resolved = git(['remote', 'get-url', 'origin'])
  if (configured.status !== 0 || resolved.status !== 0) return ''
  const urls = configured.stdout.split('\n').filter(Boolean)
  const identity = normalizeRemote(urls.join('\n'))
  return urls.length === 1 && normalizeRemote(resolved.stdout.trim()) === identity
    ? identity
    : normalizeRemote(`${urls.join('\n')}\n${resolved.stdout.trim()}`)
}

/**
 * Returns `owner/repo` when the identity is a github.com repository whose owner is on the
 * allowlist, else null. A host alias, a port, a nested path, or no remote is never allowlisted.
 */
const allowlistedRepo = ({ identity, allowlist }) => {
  const match = /^github\.com\/([^/]+)\/([^/]+)$/u.exec(identity ?? '') // only normalizeRemote makes this form
  if (!match) return null
  const owner = match[1].toLowerCase()
  return allowlist.some((entry) => entry.toLowerCase() === owner) ? `${match[1]}/${match[2]}` : null
}

// Sessions

const sessionVariables = { claude: 'CLAUDE_CODE_SESSION_ID', codex: 'CODEX_THREAD_ID' }

/**
 * Reads the session key of the harness running this command: Claude Code's
 * `CLAUDE_CODE_SESSION_ID` or Codex's `CODEX_THREAD_ID`. Both set means one harness runs inside
 * the other, so the harness is unknown and there is no key.
 */
const sessionKeyOf = (env = process.env) => {
  const found = Object.entries(sessionVariables).filter(([, name]) => env[name])
  if (found.length === 0) return { key: null, source: null }
  if (found.length > 1) return { key: null, source: 'ambiguous' }
  const [[harness, name]] = found
  return { key: { harness, id: env[name] }, source: name }
}

/** Reads a session record. An unreadable record counts as conflicting, so it routes to local. */
const readSessionRecord = ({ key, env = process.env }) => {
  const path = sessionPath({ key, env })
  if (!existsSync(path)) return null
  try {
    const record = readJson(path)
    return { repo: typeof record.repo === 'string' ? record.repo : '', conflicting: record.conflicting !== false }
  } catch {
    return { repo: '', conflicting: true }
  }
}

/**
 * Records the repository identity of a session's starting directory under its session key
 * (`{ harness, id }`). Only a top-level start (`startup` or `clear`) creates a record, so a
 * session whose start went unrecorded stays unknown, and its writes stay on this machine. A later
 * start, resume, or subagent start under the same key from another identity marks the record
 * conflicting, for good. A compaction changes nothing: the agent may have moved since.
 *
 * Only the first record is written as not conflicting, and that write is exclusive: when two
 * hooks race, the loser sees the winner's record and compares against it.
 */
export const recordSession = ({ key, cwd, source, subagent = false, env = process.env, now = new Date() }) => {
  if (source === 'compact') return
  const path = sessionPath({ key, env })
  const record = ({ repo, conflicting }) => `${JSON.stringify({ schema: 1, repo, conflicting, recordedAt: now.toISOString() }, null, 2)}\n`
  const establishes = !subagent && (source === 'startup' || source === 'clear')
  let existing = readSessionRecord({ key, env })
  if (!existing && !establishes) return
  const repo = repoIdentityOf({ cwd, env })
  if (!existing) {
    if (writeExclusive(path, record({ repo, conflicting: false }))) return
    existing = readSessionRecord({ key, env })
  }
  if (existing.conflicting || existing.repo === repo) return
  writeAtomic(path, record({ repo: existing.repo, conflicting: true }))
}

/**
 * Writes the plugin path file that the `devchat` shim reads: line 1 is the plugin root, line 2
 * its version. Rewrites it when it is missing, names another version, or names a removed root.
 */
export const refreshPluginPath = ({ root, version, env = process.env }) => {
  const path = pluginPathFile(env)
  if (existsSync(path)) {
    const [recordedRoot, recordedVersion] = readFileSync(path, 'utf8').split('\n')
    if (recordedVersion === version && recordedRoot && existsSync(recordedRoot)) return false
  }
  writeAtomic(path, `${root}\n${version}\n`)
  return true
}

// Router

const local = (reason) => ({ target: 'local', reason })

/**
 * Decides where a write goes (spec §5). Unknown provenance is settled first: no session key, a
 * harness whose hook cannot prove where its session started (Codex, for now), no session record,
 * or a conflicting record keeps the write on this machine. A board write needs
 * mode `readwrite` and both the session's starting repo and the working directory allowlisted.
 */
export const route = ({ mode, sessionKey, record, cwdIdentity, allowlist }) => {
  if (!sessionKey) return local('no session key')
  // Codex can skip an untrusted hook on resume, and records the first turn's directory, which a
  // client may override. So a Codex record does not prove where the session started yet.
  if (sessionKey.harness !== 'claude') return local(`${sessionKey.harness} sessions stay on this machine`)
  if (!record) return local('no session record')
  if (record.conflicting) return local('conflicting session record')
  if (mode !== 'readwrite') return local(`mode ${mode}`)
  if (!allowlistedRepo({ identity: record.repo, allowlist })) return local('the session started outside an allowlisted repo')
  const repo = allowlistedRepo({ identity: cwdIdentity, allowlist })
  if (!repo) return local('the working directory is not an allowlisted repo')
  return { target: 'board', repo }
}

const routeHere = ({ config, env, cwd }) => {
  const { key } = sessionKeyOf(env)
  return route({
    mode: config.mode,
    sessionKey: key,
    record: key ? readSessionRecord({ key, env }) : null,
    cwdIdentity: repoIdentityOf({ cwd, env }),
    allowlist: config.allowlist,
  })
}

// Guard: Field Guide's new-text patterns (spec §5), checked against devchat's shared guard
// fixture (`general`). Kept here because each plugin installs on its own.
const guardPatterns = [
  { pattern: /\/(?:Users|home)\/[^/\s]+\//u, reason: 'absolute home-directory path' },
  { pattern: /[A-Za-z]:\\Users\\[^\\\s]+\\/u, reason: 'absolute home-directory path' },
  { pattern: /https:\/\/[^\s?]+\?[^\s]*/iu, reason: 'URL query string' },
  { pattern: /%[0-9a-f]{2}/iu, reason: 'percent-encoded source text' },
  { pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/u, reason: 'private key' },
  { pattern: /\b(?:github_pat_|gh[pousr]_|AKIA)[A-Za-z0-9_]{12,}\b/u, reason: 'credential token' },
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/u, reason: 'credential token' },
  { pattern: /\b(?:password|passwd|access[_-]?token|api[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s,;]+/iu, reason: 'credential assignment' },
  { pattern: /^(?:user|assistant|system):\s+/imu, reason: 'raw transcript marker' },
  { pattern: /<(?:user|assistant|system)>|BEGIN (?:RAW )?PROMPT/iu, reason: 'raw prompt marker' },
  { pattern: /[a-z][a-z0-9+.-]*:[^\s?]*\?\S/iu, reason: 'URL query string' },
  { pattern: /[a-z][a-z0-9+.-]*:\/\/[^\s/?#@]*@/iu, reason: 'URL user information' },
  { pattern: /(?<![\w.-])\/(?:Users|home)\/[^/\s]+/u, reason: 'absolute home-directory path' },
  { pattern: /(?:\/mnt\/[a-z]\/(?:users|home)|[a-z]:[\\/]users)[\\/][^\\/\s]+/iu, reason: 'absolute home-directory path' },
]

/** Returns the reason the guard refuses `text`, or null when it passes. */
const guardReason = (text) => guardPatterns.find(({ pattern }) => pattern.test(text))?.reason ?? null

// Local todos. Each is one file in `local/`, in the snapshot's item shape.

const readLocalTodos = (env) => {
  const dir = localDir(env)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      try {
        return readJson(join(dir, name))
      } catch (error) {
        throw new UsageError(`${join(dir, name)} is not a readable devchat record: ${error.message}`)
      }
    })
    .filter((item) => item.channel === todoChannel)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// A board root with no `status` yet reads as open (spec §2).
const isOpen = (item) => ['open', 'blocked'].includes(item.labels.status ?? 'open')

/** Reads `snapshot.json`, the board state the last sync pulled, or returns null before the first sync. */
const readSnapshot = (env) => {
  const path = snapshotPath(env)
  if (!existsSync(path)) return null
  let snapshot
  try {
    snapshot = readJson(path)
  } catch (error) {
    throw new UsageError(`${path} is not valid JSON: ${error.message}`)
  }
  if (snapshot?.schema !== 1 || !Array.isArray(snapshot.items)) throw new UsageError(`${path} is not a schema 1 devchat snapshot: run devchat sync`)
  return snapshot
}

const findOpenTodo = ({ prefix, env }) => {
  if (!prefix) throw new UsageError('give the todo rid, or a unique prefix of it')
  const matches = readLocalTodos(env).filter((item) => isOpen(item) && item.rid.startsWith(prefix))
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) throw new UsageError(`${prefix} matches ${matches.length} todos: ${matches.map(({ rid }) => rid).join(', ')}`)
  const onBoard = (readSnapshot(env)?.items ?? []).some((item) => item.channel === todoChannel && item.rid.startsWith(prefix))
  throw new UsageError(onBoard ? `${prefix} is a board todo: resolve it in the devchat UI for now` : `no open todo on this machine matches ${prefix}`)
}

const requireText = (text) => {
  if (typeof text !== 'string' || text.trim().length === 0) throw new UsageError('todo text is required')
  if (text.length > maxTextLength) throw new UsageError(`todo text exceeds ${maxTextLength} characters`)
  const reason = guardReason(text)
  if (reason) throw new UsageError(`the guard refused the text: ${reason}. Rewrite it without that and try again.`)
  return text
}

const newTodoRid = () => `todo-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`

const saveLocalTodo = ({ text, config, env }) => {
  const now = new Date().toISOString()
  const rid = newTodoRid()
  writeJsonAtomic(join(localDir(env), `${rid}.json`), {
    rid, channel: todoChannel, text, labels: { rid, status: 'open', host: config.machine }, createdAt: now, updatedAt: now,
  })
  return rid
}

// Outbox

// Board profile names start with a letter and hold at most 32 letters, digits, and hyphens.
const profilePattern = /^[A-Za-z][A-Za-z0-9-]{0,31}$/u

/** Returns this machine's board profile for Claude Code writes, `<machine>-claude`, as a valid profile name. */
const profileOf = (machine) => {
  const name = machine.replace(/[^A-Za-z0-9-]+/gu, '-').replace(/^[^A-Za-z]+/u, '').slice(0, 25).replace(/-+$/u, '')
  return `${name || 'devchat'}-claude`
}

// The fields of a release 1 todo intent, as devchat's `src/shared/layout.ts` defines it, and of
// the outbox record that carries it.
const todoIntentFields = ['v', 'rid', 'kind', 'channel', 'text', 'by', 'repo', 'machine']
const outboxFields = ['schema', 'op', 'target', 'profile', 'repo', 'lane', 'body', 'queuedAt']

/**
 * Queues a todo intent: one label-free `inbox` post whose `id` is the intent's `rid`, so a retry
 * replays it. The request body is stored as the exact string sync sends, so every retry is
 * byte-identical. Returns the rid and the outbox file name, which sorts by queue time.
 */
const queueTodo = ({ text, repo, config, env }) => {
  const rid = newTodoRid()
  const profile = profileOf(config.machine)
  const intent = { v: 1, rid, kind: 'todo', channel: todoChannel, text, by: profile, repo, machine: config.machine }
  const body = JSON.stringify({ channel: 'inbox', id: rid, text: JSON.stringify(intent) })
  const queuedAt = new Date().toISOString()
  const name = `${queuedAt.replace(/[-:.]/gu, '')}-post-${rid}.json`
  writeJsonAtomic(join(outboxDir(env), name), { schema: 1, op: 'post', target: rid, profile, repo, lane: 'repo', body, queuedAt })
  return { rid, name }
}

const pendingOutbox = (env) => {
  if (!existsSync(outboxDir(env))) return []
  return readdirSync(outboxDir(env), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map(({ name }) => name)
    .sort()
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const hasExactly = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const ridPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,195}$/u
const isLabelValue = (value) => typeof value === 'string' && value.length >= 1 && value.length <= 256 && !/\p{Cc}/u.test(value)

const parseOutboxBody = (entry) => {
  try {
    const body = JSON.parse(entry.body)
    return { body, intent: JSON.parse(body.text) }
  } catch {
    return null
  }
}

const intentProblem = ({ entry, body, intent, config }) => {
  const checks = [
    [hasExactly(intent, todoIntentFields) && intent.v === 1 && intent.kind === 'todo' && intent.channel === todoChannel, 'the intent is not a release 1 todo'],
    [ridPattern.test(String(intent.rid)) && intent.rid === body.id && intent.rid === entry.target, 'the intent rid does not match the post id'],
    [entry.lane === 'repo' && intent.by === entry.profile && intent.repo === entry.repo, 'the intent does not match its outbox record'],
    // The board refuses a bad profile with a 400, which would stop every flush at this file.
    [profilePattern.test(String(entry.profile)), 'the profile is not a board profile name'],
    [allowlistedRepo({ identity: `github.com/${intent.repo}`, allowlist: config.allowlist }) === intent.repo, 'the source repo is not on the allowlist'],
    [typeof intent.text === 'string' && intent.text.trim().length > 0 && intent.text.length <= maxTextLength, 'the todo text is empty or too long'],
    [[intent.by, intent.repo, intent.machine].every(isLabelValue), 'a provenance field is not a board label value'],
    [[intent.text, intent.by, intent.repo, intent.machine].every((field) => !guardReason(field)), 'the guard refused an outbound field'],
  ]
  return checks.find(([passes]) => !passes)?.[1] ?? null
}

/**
 * The check at flush (spec §5). Sync sends only a todo intent shaped exactly as `queueTodo` wrote
 * it, from a repo still on the allowlist, whose every outbound field passes the guard again.
 * Returns why a file fails, or null.
 */
const outboxProblem = ({ entry, config }) => {
  if (!hasExactly(entry, outboxFields) || entry.schema !== 1 || entry.op !== 'post' || typeof entry.body !== 'string') return 'not a devchat outbox post'
  const parsed = parseOutboxBody(entry)
  if (!hasExactly(parsed?.body, ['channel', 'id', 'text']) || parsed.body.channel !== 'inbox') return 'the request is not an inbox post'
  if (!isRecord(parsed.intent)) return 'the intent is not a release 1 todo'
  return intentProblem({ entry, ...parsed, config })
}

// Board client. Every request goes to the configured board URL with plain `fetch`, and carries
// no credential: the tailnet identity comes from `tailscale serve`.

/** A network error, a timeout, a non-2xx answer, or an unexpected body: sync stops, and the next run retries. */
class SyncStop extends Error {}

const requestTimeoutMs = 10_000

const boardClient = ({ boardUrl, signal }) => {
  const base = boardUrl.replace(/\/+$/u, '')
  const call = async ({ url, method = 'GET', body, headers, missingOk = false }) => {
    const timeout = AbortSignal.timeout(requestTimeoutMs)
    const where = `${method} ${new URL(url).pathname}`
    let response
    try {
      response = await fetch(url, { method, body, headers, redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
    } catch (error) {
      throw new SyncStop(`the board is unreachable (${error.cause?.code ?? error.cause?.message ?? error.name})`)
    }
    if (!response.ok) {
      await response.body?.cancel()
      if (missingOk && response.status === 404) return null
      throw new SyncStop(`${where} answered ${response.status}`)
    }
    try {
      return await response.json()
    } catch {
      throw new SyncStop(`${where} sent no readable JSON`)
    }
  }
  return {
    get: (path) => call({ url: `${base}${path}` }),
    post: ({ body, profile }) => call({ url: `${base}/messages`, method: 'POST', body, headers: { 'content-type': 'application/json', 'x-board-profile': profile } }),
    // The devchat app serves `/devchat.json` at the root of the board's HTTPS origin.
    appStatus: () => call({ url: new URL('/devchat.json', `${base}/`).href, missingOk: true }),
  }
}

/** Reads every thread root in a channel, page by page. */
const pullChannel = async ({ client, channel }) => {
  const roots = []
  let before = null
  do {
    const query = new URLSearchParams({ channel, limit: '500' })
    if (before) query.set('before', before)
    const page = await client.get(`/threads?${query}`)
    if (!Array.isArray(page?.threads)) throw new SyncStop(`GET /threads?channel=${channel} sent an unexpected answer`)
    roots.push(...page.threads.map(({ message }) => message))
    before = page.older ?? null
  } while (before)
  return roots
}

/** Reads the board marker's `epoch`: the `sys` root whose client ID is `board`. */
const readBoardEpoch = async (client) => {
  const marker = (await pullChannel({ client, channel: 'sys' })).find((message) => message.thread === 'board')
  const epoch = marker?.labels?.epoch
  if (typeof epoch !== 'string') throw new SyncStop('the board has no marker with an epoch: the host setup posts it')
  return epoch
}

// The snapshot keeps open and blocked roots of these channels, in the local item shape.
const snapshotChannels = [todoChannel, 'work']

const snapshotItem = (message) => ({
  rid: message.labels.rid,
  channel: message.channel,
  text: message.text,
  labels: message.labels,
  createdAt: message.createdAt,
  updatedAt: message.editedAt ?? message.createdAt,
})

const pullSnapshotItems = async (client) => {
  const items = []
  for (const channel of snapshotChannels) {
    const roots = await pullChannel({ client, channel })
    items.push(...roots.filter((message) => !message.deleted && typeof message.labels?.rid === 'string').map(snapshotItem).filter(isOpen))
  }
  return items
}

// Sync (spec §3). One flusher per device: sync takes a lock file in `outbox/`, and a second sync
// exits. The lock holds its owner's PID and PID namespace. A PID proves its owner exited only in
// the same namespace, because each sandboxed command can run in its own, so a lock is stale when
// its owner exited there, or when it is older than any sync runs.
const staleSyncLockMs = 15 * 60 * 1000

const pidNamespace = () => {
  try {
    return readlinkSync('/proc/self/ns/pid')
  } catch {
    return null // No /proc (macOS): every process shares one PID space.
  }
}

const ownerExited = (owner) => {
  if (owner.namespace !== pidNamespace()) return false
  try {
    process.kill(owner.pid, 0)
    return false
  } catch (error) {
    return error.code === 'ESRCH'
  }
}

const syncLockIsStale = ({ text, ageMs }) => {
  if (ageMs > staleSyncLockMs) return true
  try {
    return ownerExited(JSON.parse(text))
  } catch {
    return false // An unreadable lock is stale only by age.
  }
}

// Removes a stale lock only while it still holds the content judged stale, so a lock another sync
// took in the meantime survives. Returns whether the lock is gone.
const clearStaleSyncLock = (path) => {
  try {
    const text = readFileSync(path, 'utf8')
    if (!syncLockIsStale({ text, ageMs: Date.now() - statSync(path).mtimeMs })) return false
    if (readFileSync(path, 'utf8') === text) unlinkSync(path)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return true
}

/** Takes the outbox lock and returns its content, or null while another sync holds it. */
const takeSyncLock = (env) => {
  const path = syncLockPath(env)
  const owner = JSON.stringify({ pid: process.pid, namespace: pidNamespace(), token: randomBytes(8).toString('hex') })
  if (writeExclusive(path, owner)) return owner
  return clearStaleSyncLock(path) && writeExclusive(path, owner) ? owner : null
}

const releaseSyncLock = ({ env, owner }) => {
  const path = syncLockPath(env)
  try {
    if (readFileSync(path, 'utf8') === owner) unlinkSync(path)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

const rejectOutboxFile = ({ env, name, problem, out }) => {
  mkdirSync(rejectedDir(env), { recursive: true })
  renameSync(join(outboxDir(env), name), join(rejectedDir(env), name))
  out(`rejected ${name}: ${problem}`)
}

/** Sends the outbox in time order. The first failed send stops the flush; its file stays queued. */
const flush = async ({ client, config, env, out }) => {
  for (const name of pendingOutbox(env)) {
    const path = join(outboxDir(env), name)
    let entry = null
    try {
      entry = readJson(path)
    } catch {
      // An unreadable file fails the check below.
    }
    const problem = outboxProblem({ entry, config })
    if (problem) {
      rejectOutboxFile({ env, name, problem, out })
      continue
    }
    const answer = await client.post({ body: entry.body, profile: entry.profile })
    if (typeof answer?.message?.id !== 'string') throw new SyncStop('POST /messages sent no message ID')
    // The sent copy keeps the board's `inbox` ID. It is written before the queued file goes, so a
    // crash between the two sends the file again, which the post `id` turns into a replay.
    writeJsonAtomic(join(sentDir(env), name), { ...entry, inboxId: answer.message.id, sentAt: new Date().toISOString() })
    unlinkSync(path)
    out(`sent ${entry.target}`)
  }
}

const syncSteps = async ({ config, env, out, client }) => {
  const snapshot = readSnapshot(env)
  const epoch = await readBoardEpoch(client)
  if (snapshot && snapshot.epoch !== epoch) {
    throw new SyncStop(`the board epoch is ${epoch} and the snapshot's is ${snapshot.epoch}: nothing is sent or pulled until the outbox is reconciled`)
  }
  if (config.mode === 'readwrite') await flush({ client, config, env, out })
  const status = await client.appStatus()
  const applied = ['string', 'number'].includes(typeof status?.applied) ? String(status.applied) : null
  const pulledAt = new Date().toISOString()
  const items = await pullSnapshotItems(client)
  writeJsonAtomic(snapshotPath(env), { schema: 1, pulledAt, epoch, applied, items })
  out(`snapshot: ${items.length} open item(s), epoch ${epoch}`)
}

/**
 * Runs one sync (spec §3): stop on a changed board epoch, send the outbox in time order (mode
 * `readwrite` only), read the app's `applied` cursor, then pull and replace the snapshot with one
 * rename. Returns `{ locked: true }` when another sync holds the lock, else `{ stopped }`: null,
 * or why the run stopped.
 */
const runSync = async ({ config, env, out = () => {}, signal }) => {
  const owner = takeSyncLock(env)
  if (!owner) return { locked: true }
  try {
    await syncSteps({ config, env, out, client: boardClient({ boardUrl: config.boardUrl, signal }) })
    return { stopped: null }
  } catch (error) {
    if (error instanceof SyncStop) return { stopped: error.message }
    throw error
  } finally {
    releaseSyncLock({ env, owner })
  }
}

// The sync right after a queued write is best effort and gives up after 3 s. The write has
// already succeeded, so no outcome here fails the command.
const postWriteSyncMs = 3000

const syncAfterWrite = async ({ config, env, name }) => {
  let reason
  try {
    const result = await runSync({ config, env, signal: AbortSignal.timeout(postWriteSyncMs) })
    reason = result.locked ? 'another sync is running' : result.stopped
  } catch (error) {
    reason = error.message
  }
  if (existsSync(join(sentDir(env), name))) return 'sent'
  return `not sent yet (${reason ?? 'it is still queued'}): the next devchat sync sends it`
}

const sync = async ({ args, env, out }) => {
  if (args.length > 0) throw new UsageError('usage: devchat sync')
  const config = readConfig(env)
  if (config.mode === 'off') {
    out('mode off: sync makes no network request')
    return 0
  }
  const result = await runSync({ config, env, out })
  if (result.locked) {
    out('another devchat sync holds the outbox lock; this one exits')
    return 0
  }
  if (!result.stopped) return 0
  process.stderr.write(`devchat sync stopped: ${result.stopped}\n`)
  return 1
}

// Todo commands

const todoAdd = async ({ args, env, cwd, out }) => {
  if (args.length !== 1) throw new UsageError('usage: devchat todo add "<text>"')
  const text = requireText(args[0])
  const config = readConfig(env)
  const decision = routeHere({ config, env, cwd })
  if (decision.target !== 'board') {
    out(`${saveLocalTodo({ text, config, env })}: saved on this machine only (${decision.reason})`)
    return 0
  }
  const { rid, name } = queueTodo({ text, repo: decision.repo, config, env })
  out(`${rid}: saved to the board (${decision.repo}) through the outbox`)
  out(`${rid}: ${await syncAfterWrite({ config, env, name })}`)
  return 0
}

const todoList = ({ args, env, out }) => {
  if (args.length > 0) throw new UsageError('usage: devchat todo list')
  const board = (readSnapshot(env)?.items ?? []).filter((item) => item.channel === todoChannel).map((item) => ({ ...item, source: 'board' }))
  const local = readLocalTodos(env).map((item) => ({ ...item, source: 'local' }))
  const open = [...board, ...local].filter(isOpen).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  if (open.length === 0) {
    out('No open todos.')
    return
  }
  for (const item of open) out(`${item.rid}  ${item.createdAt.slice(0, 10)}  ${item.source.padEnd(5)}  ${item.text}`)
}

const todoResolve = (status) => ({ args, env, out }) => {
  if (args.length !== 1) throw new UsageError(`usage: devchat todo ${status === 'done' ? 'done' : 'drop'} <rid>`)
  const item = findOpenTodo({ prefix: args[0], env })
  const updated = { ...item, labels: { ...item.labels, status }, updatedAt: new Date().toISOString() }
  writeJsonAtomic(join(localDir(env), `${item.rid}.json`), updated)
  out(`${item.rid}: ${status} on this machine only`)
}

const todoCommands = { add: todoAdd, list: todoList, done: todoResolve('done'), drop: todoResolve('dropped') }

const todo = ({ args: [subcommand, ...args], ...context }) => {
  if (!Object.hasOwn(todoCommands, subcommand ?? '')) throw new UsageError('usage: devchat todo add "<text>" | list | done <rid> | drop <rid>')
  return todoCommands[subcommand]({ args, ...context })
}

const guard = ({ args, stdin }) => {
  if (args.length > 0) throw new UsageError('usage: devchat guard < text')
  const reason = guardReason(stdin())
  if (!reason) return 0
  process.stderr.write(`devchat guard: refused: ${reason}\n`)
  return 1
}

// Doctor. The local checks print the session key's source and the route for this directory, so a
// reviewer can confirm in each harness that the hook's `session_id` matches the CLI's key. The
// board and timer checks run only when the mode is not `off`, and never print the tailnet login.

const isWritable = (path) => {
  try {
    mkdirSync(path, { recursive: true })
    accessSync(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

const pluginPathStatus = (env) => {
  const path = pluginPathFile(env)
  if (!existsSync(path)) return 'missing (the session hook or devchat setup writes it)'
  const [root, version] = readFileSync(path, 'utf8').split('\n')
  return existsSync(root) ? `version ${version}` : `stale: ${root} no longer exists`
}

const sessionStatus = ({ key, env }) => {
  const record = readSessionRecord({ key, env })
  if (!record) return 'no record (writes stay on this machine)'
  return record.conflicting ? 'conflicting (writes stay on this machine)' : 'recorded'
}

const localChecks = ({ config, env, cwd }) => {
  const { key, source } = sessionKeyOf(env)
  const decision = routeHere({ config, env, cwd })
  return [
    { ok: true, line: `config: ${config.exists ? config.path : `${config.path} not found, using defaults`}` },
    { ok: true, line: `mode: ${config.mode}` },
    { ok: config.mode === 'off' || config.allowlist.length > 0, line: `allowlist: ${config.allowlist.length} owner(s)` },
    { ok: isWritable(stateDir(env)), line: `state directory: ${stateDir(env)}` },
    { ok: true, line: `plugin path file: ${pluginPathStatus(env)}` },
    { ok: true, line: `session key: ${source ?? 'none'}` },
    { ok: true, line: `session record: ${key ? sessionStatus({ key, env }) : 'none'}` },
    { ok: true, line: `route here: ${decision.target === 'board' ? `board (${decision.repo})` : `this machine only (${decision.reason})`}` },
  ]
}

const outboxCheck = (env) => {
  const count = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')).length : 0)
  const rejected = count(rejectedDir(env))
  return { ok: rejected === 0, line: `outbox: ${pendingOutbox(env).length} queued, ${count(sentDir(env))} sent, ${rejected} rejected` }
}

// A machine that has not synced for 3 days fails doctor (spec §3).
const staleSnapshotMs = 3 * 24 * 60 * 60 * 1000

const formatAge = (ms) => {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  if (minutes < 120) return `${minutes} min`
  return minutes < 48 * 60 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} days`
}

const snapshotCheck = ({ config, snapshot }) => {
  if (!snapshot) return { ok: true, line: 'snapshot: none yet (devchat sync writes it)' }
  const ageMs = Date.now() - Date.parse(snapshot.pulledAt)
  return { ok: config.mode === 'off' || ageMs < staleSnapshotMs, line: `snapshot: pulled ${formatAge(ageMs)} ago, epoch ${snapshot.epoch}` }
}

const doctorTimeoutMs = 5000

const boardCheck = async ({ config, snapshot }) => {
  try {
    const epoch = await readBoardEpoch(boardClient({ boardUrl: config.boardUrl, signal: AbortSignal.timeout(doctorTimeoutMs) }))
    const matches = !snapshot || snapshot.epoch === epoch
    return { ok: matches, line: `board: reachable, marker epoch ${epoch}${matches ? '' : `, but the snapshot's is ${snapshot.epoch}: sync sends nothing`}` }
  } catch (error) {
    if (!(error instanceof SyncStop)) throw error
    return { ok: false, line: `board: ${error.message}` }
  }
}

// The sync timer `devchat setup` installs: a systemd user timer on Linux, a launchd agent on macOS.
const timerUnit = 'devchat-sync'
const launchdLabel = 'devchat.sync'

const timerCheck = () => {
  if (process.platform === 'linux') {
    const result = spawnSync('systemctl', ['--user', 'is-active', `${timerUnit}.timer`], { encoding: 'utf8', timeout: 3000 })
    const state = result.stdout?.trim() || 'unknown'
    return { ok: state === 'active', line: `sync timer: ${timerUnit}.timer ${state}` }
  }
  if (process.platform === 'darwin') {
    const result = spawnSync('launchctl', ['print', `gui/${process.getuid()}/${launchdLabel}`], { stdio: 'ignore', timeout: 3000 })
    return { ok: result.status === 0, line: `sync timer: ${launchdLabel} ${result.status === 0 ? 'loaded' : 'not loaded'}` }
  }
  return { ok: true, line: `sync timer: none on ${process.platform} (run devchat sync on a schedule yourself)` }
}

const doctorChecks = async ({ env, cwd }) => {
  let config
  let snapshot
  try {
    config = readConfig(env)
  } catch (error) {
    return [{ ok: false, line: `config: ${error.message}` }]
  }
  const checks = [...localChecks({ config, env, cwd }), outboxCheck(env)]
  try {
    snapshot = readSnapshot(env)
    checks.push(snapshotCheck({ config, snapshot }))
  } catch (error) {
    checks.push({ ok: false, line: `snapshot: ${error.message}` })
  }
  if (config.mode === 'off') return checks
  return [...checks, await boardCheck({ config, snapshot }), timerCheck()]
}

const doctor = async ({ args, env, cwd, out }) => {
  if (args.length > 0) throw new UsageError('usage: devchat doctor')
  const checks = await doctorChecks({ env, cwd })
  for (const { ok, line } of checks) out(`${ok ? 'ok  ' : 'FAIL'} ${line}`)
  return checks.every(({ ok }) => ok) ? 0 : 1
}

// Setup: the client join (spec §8). It runs from the plugin, so it knows the plugin root. It
// needs no sudo, stores no token, and takes every personal value from its arguments.

const pluginRoot = fileURLToPath(new URL('../../..', import.meta.url)).replace(/\/$/u, '')

/** Returns the version in the plugin's manifest; each harness's install carries at least one. */
export const pluginVersion = (root) => {
  for (const manifest of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    try {
      return readJson(join(root, manifest)).version
    } catch {
      // Try the next harness's manifest.
    }
  }
  return 'unknown'
}

const setupUsage = 'usage: devchat setup (--host <tailnet host> [--port <https port>] | --board-url <url>) --github-login <login> --mode read|readwrite [--allowlist <owner,...>] [--dry-run]'
const setupOptions = {
  host: { type: 'string' },
  port: { type: 'string', default: '8443' },
  'board-url': { type: 'string' },
  'github-login': { type: 'string' },
  mode: { type: 'string' },
  allowlist: { type: 'string' },
  'dry-run': { type: 'boolean', default: false },
}

const readSetupArgs = (args) => {
  let values
  try {
    ({ values } = parseArgs({ args, options: setupOptions, strict: true, allowPositionals: false }))
  } catch (error) {
    throw new UsageError(`${error.message}\n${setupUsage}`)
  }
  if (!values['github-login'] || !['read', 'readwrite'].includes(values.mode) || Boolean(values.host) === Boolean(values['board-url'])) throw new UsageError(setupUsage)
  if (!/^\d{1,5}$/u.test(values.port)) throw new UsageError('--port takes a TCP port number')
  const boardUrl = values['board-url'] ?? `https://${values.host}:${values.port}/api/board`
  if (!isHttpUrl(boardUrl)) throw new UsageError(`${boardUrl} is not an http or https URL`)
  const allowlist = values.allowlist ? values.allowlist.split(',').map((owner) => owner.trim()).filter(Boolean) : [values['github-login']]
  return { dryRun: values['dry-run'], settings: { mode: values.mode, githubLogin: values['github-login'], allowlist, boardUrl } }
}

const configHome = (env) => dirname(dirname(configPath(env)))
const stateHome = (env) => dirname(stateDir(env))
const shimPath = () => join(homedir(), '.local', 'bin', 'devchat')
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`
const systemdQuote = (value) => `"${value.replace(/[\\"]/gu, '\\$&').replaceAll('%', '%%')}"`
const xmlEscape = (value) => value.replace(/[<>&'"]/gu, (character) => `&#${character.codePointAt(0)};`)

const shimScript = (env) => `#!/bin/sh
# devchat shim, written by devchat setup. It runs the plugin that the plugin path file names; the
# session hook and devchat setup keep that file current.
plugin_root=$(sed -n 1p ${shellQuote(pluginPathFile(env))} 2>/dev/null)
launcher="$plugin_root/skills/devchat/scripts/devchat.sh"
if [ -z "$plugin_root" ] || [ ! -f "$launcher" ]; then
  printf '%s\\n' 'devchat: the plugin path file is missing or stale. Start a Claude Code or Codex session, or run devchat setup from the plugin.' >&2
  exit 127
fi
exec /bin/sh "$launcher" "$@"
`

const systemdUnits = (env) => ({
  [`${timerUnit}.service`]: `[Unit]
Description=devchat sync

[Service]
Type=oneshot
Environment=${systemdQuote(`XDG_CONFIG_HOME=${configHome(env)}`)} ${systemdQuote(`XDG_STATE_HOME=${stateHome(env)}`)}
ExecStart=/bin/sh ${systemdQuote(shimPath())} sync
`,
  [`${timerUnit}.timer`]: `[Unit]
Description=Run devchat sync every 15 minutes

[Timer]
OnActiveSec=1min
OnUnitActiveSec=15min

[Install]
WantedBy=timers.target
`,
})

const launchdPlist = (env) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${launchdLabel}</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>${xmlEscape(shimPath())}</string><string>sync</string></array>
  <key>EnvironmentVariables</key><dict><key>XDG_CONFIG_HOME</key><string>${xmlEscape(configHome(env))}</string><key>XDG_STATE_HOME</key><string>${xmlEscape(stateHome(env))}</string></dict>
  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`

const fileStep = ({ path, content, mode = 0o644 }) => ({
  describe: `write ${path}`,
  run: () => {
    writeAtomic(path, content)
    chmodSync(path, mode)
  },
})

const commandStep = ({ argv, mayFail = false }) => ({
  describe: `run ${argv.join(' ')}`,
  run: () => {
    const result = spawnSync(argv[0], argv.slice(1), { encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'] })
    if (result.status === 0 || mayFail) return
    throw new Error(`${argv.join(' ')} failed (${(result.stderr || result.error?.message || `exit ${result.status}`).trim()}): install the timer by hand, or run devchat sync on a schedule`)
  },
})

const configStep = ({ env, settings }) => {
  const path = configPath(env)
  return {
    describe: `write ${path}: mode ${settings.mode}, GitHub login ${settings.githubLogin}, allowlist ${settings.allowlist.join(', ')}, board ${settings.boardUrl}`,
    run: () => {
      // Keep the keys setup does not set, such as `machine`.
      const existing = existsSync(path) ? readJson(path) : {}
      writeJsonAtomic(path, { ...(isRecord(existing) ? existing : {}), ...settings })
    },
  }
}

const timerSteps = (env) => {
  if (process.platform === 'linux') {
    const dir = join(configHome(env), 'systemd', 'user')
    return [
      ...Object.entries(systemdUnits(env)).map(([name, content]) => fileStep({ path: join(dir, name), content })),
      commandStep({ argv: ['systemctl', '--user', 'daemon-reload'] }),
      commandStep({ argv: ['systemctl', '--user', 'enable', '--now', `${timerUnit}.timer`] }),
    ]
  }
  if (process.platform === 'darwin') {
    const path = join(homedir(), 'Library', 'LaunchAgents', `${launchdLabel}.plist`)
    const domain = `gui/${process.getuid()}`
    return [
      fileStep({ path, content: launchdPlist(env) }),
      commandStep({ argv: ['launchctl', 'bootout', `${domain}/${launchdLabel}`], mayFail: true }),
      commandStep({ argv: ['launchctl', 'bootstrap', domain, path] }),
    ]
  }
  return [{ describe: `skip the sync timer: ${process.platform} has none devchat installs. Run "devchat sync" every 15 minutes with your scheduler`, run: () => {} }]
}

const setup = async ({ args, env, cwd, out }) => {
  const { dryRun, settings } = readSetupArgs(args)
  const steps = [
    configStep({ env, settings }),
    { describe: `write ${pluginPathFile(env)}: plugin root and version`, run: () => refreshPluginPath({ root: pluginRoot, version: pluginVersion(pluginRoot), env }) },
    fileStep({ path: shimPath(), content: shimScript(env), mode: 0o755 }),
    ...timerSteps(env),
  ]
  if (dryRun) {
    for (const step of steps) out(`would ${step.describe}`)
    out('would run devchat doctor')
    return 0
  }
  let failed = false
  for (const step of steps) {
    out(step.describe)
    try {
      step.run()
    } catch (error) {
      failed = true
      out(`FAIL ${error.message}`)
    }
  }
  out('devchat doctor:')
  const code = await doctor({ args: [], env, cwd, out })
  return failed ? 1 : code
}

const commands = { todo, guard, doctor, sync, setup }

/** Runs one CLI invocation and returns its exit code. */
const main = async ({ argv, env = process.env, cwd = process.cwd(), out = (line) => process.stdout.write(`${line}\n`), stdin = () => readFileSync(0, 'utf8') }) => {
  const [command, ...args] = argv
  try {
    if (!Object.hasOwn(commands, command ?? '')) throw new UsageError('usage: devchat <todo|sync|doctor|setup|guard> ...')
    return (await commands[command]({ args, env, cwd, out, stdin })) ?? 0
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    process.stderr.write(`devchat: ${error.message}\n`)
    return 1
  }
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) process.exitCode = await main({ argv: process.argv.slice(2) })
