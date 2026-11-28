#!/usr/bin/env node

// devchat client: the write router, the text guard, local todos and work items, the board outbox
// and sync, setup, and checks. A write the router keeps on this machine goes to `local/` and makes
// no network request. A board write goes to `outbox/`, and `devchat sync` alone sends it, with
// plain `fetch`.
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { accessSync, chmodSync, closeSync, constants, existsSync, fstatSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

/** The commands the skill shows agents. The skill's command block must list exactly these. */
export const agentCommands = ['work start', 'work note', 'work done', 'todo add']

const modes = ['off', 'read', 'readwrite']
const todoChannel = 'todos'
const workChannel = 'work'
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

// The machine name goes into rollback commands and board labels, so it must stay on one line.
const machineProblem = (machine) => {
  if (machine !== undefined && typeof machine !== 'string') return 'machine must be a string'
  if (/\p{Cc}/u.test(machine ?? '')) return 'machine must not hold control characters'
  return null
}

const validateConfig = (config) => {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return 'config must be a JSON object'
  if (config.mode !== undefined && !modes.includes(config.mode)) return `mode must be one of ${modes.join(', ')}`
  if (config.githubLogin !== undefined && typeof config.githubLogin !== 'string') return 'githubLogin must be a string'
  if (config.allowlist !== undefined && !(Array.isArray(config.allowlist) && config.allowlist.every((owner) => typeof owner === 'string'))) {
    return 'allowlist must be an array of GitHub owners'
  }
  const machine = machineProblem(config.machine)
  if (machine) return machine
  const urlProblem = config.boardUrl === undefined ? null : checkBoardUrl(config.boardUrl).problem
  if (urlProblem) return `boardUrl is refused: ${urlProblem}`
  // Without a board URL, a mode that talks to the board has nowhere to go.
  if ((config.mode ?? 'off') !== 'off' && config.boardUrl === undefined) return `mode ${config.mode} needs boardUrl: run devchat setup`
  return null
}

const loopbackHost = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])$/u

/**
 * The one check for a board URL, in the config and in setup. It refuses user information, a query,
 * or a fragment, which could carry a credential, so no caller prints a refused URL. It requires
 * `https:`, except on a loopback host. Returns `{ url }`, normalized without a trailing slash, or
 * `{ problem }`.
 */
const checkBoardUrl = (value) => {
  // `scheme://authority` first: the URL parser also accepts forms such as `https:/@host`, reads a
  // backslash as a slash, and drops tabs and newlines, so the raw authority must hold none.
  const authority = typeof value === 'string' ? /^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]+)/u.exec(value)?.[1] : undefined
  if (authority === undefined || /[\\\t\n\f\r ]/u.test(authority) || !URL.canParse(value)) return { problem: 'it is not a URL' }
  const url = new URL(value)
  // `https://@host` parses with empty user information, so the raw text is checked too.
  if (url.username || url.password || /^[^/]*\/\/[^/]*@/u.test(value)) return { problem: 'it holds user information' }
  if (url.search || url.hash || /[?#]/u.test(value)) return { problem: 'it holds a query or a fragment' }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopbackHost.test(url.hostname))) return { problem: 'it must use https, or http on a loopback host' }
  return { url: `${url.origin}${url.pathname.replace(/\/+$/u, '')}` }
}

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
    // The parser's message can quote the file, and the file can hold a refused board URL.
    throw new UsageError(`${path} is not valid JSON`)
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
    boardUrl: config.boardUrl === undefined ? undefined : checkBoardUrl(config.boardUrl).url,
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

const gitIn = ({ cwd, env }) => (args) => spawnSync('git', ['-C', cwd, ...args], {
  encoding: 'utf8', env: gitEnv(env), timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'],
})

/** Returns the normalized `origin` of the repository containing `cwd`, or '' outside a repository or without an origin. */
const repoIdentityOf = ({ cwd, env = process.env }) => {
  const git = gitIn({ cwd, env })
  // The configured URL, as written, and the URL git uses after `url.*.insteadOf` rewrites. A
  // rewrite could turn a host alias into github.com, so both must name the same repository.
  const configured = git(['config', '--get-all', 'remote.origin.url'])
  const resolved = git(['remote', 'get-url', 'origin'])
  if (configured.status !== 0 || resolved.status !== 0) return ''
  const urls = configured.stdout.split('\n').filter(Boolean)
  const identity = normalizeRemote(urls.join('\n'))
  return urls.length === 1 && sameRepo(normalizeRemote(resolved.stdout.trim()), identity)
    ? identity
    : normalizeRemote(`${urls.join('\n')}\n${resolved.stdout.trim()}`)
}

const scopeFailure = 'git could not read the repository here, so devchat shows and changes no item. Fix the repository, or run the command outside any git checkout. Nothing was saved.'

/**
 * Returns the identity that scopes todos and work items to the checkout containing `cwd`: the
 * router's `github.com/<owner>/<repo>` for a GitHub checkout, and for any other the hash of the
 * real path of its common git directory, which its linked worktrees share. Origin URLs are never
 * read for the second. Returns '' only when git says `cwd` is not in a repository; any other git
 * failure throws, so the command sees and changes nothing. Routing never uses this identity.
 */
const scopeIdentityOf = ({ cwd, env = process.env }) => {
  const common = spawnSync('git', ['-C', cwd, 'rev-parse', '--git-common-dir'], {
    encoding: 'utf8', env: { ...gitEnv(env), LC_ALL: 'C' }, timeout: 2000, stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (common.status !== 0) {
    if (/^fatal: not a git repository/mu.test(common.stderr ?? '')) return ''
    throw new UsageError(scopeFailure)
  }
  const identity = repoIdentityOf({ cwd, env })
  if (identity.startsWith('github.com/')) return identity
  // Resolved by the file system, never by collapsing `..` first: a `..` after a symbolic link
  // leaves the link's target.
  const dir = common.stdout.replace(/\n$/u, '')
  try {
    return normalizeRemote(realpathSync.native(isAbsolute(dir) ? dir : `${cwd}/${dir}`))
  } catch {
    throw new UsageError(scopeFailure)
  }
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

/** Whether two repo identities or `owner/repo` names are the same repo: GitHub ignores case in both parts. */
const sameRepo = (a, b) => isString(a) && isString(b) && a.toLowerCase() === b.toLowerCase()

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
  if (existing.conflicting || sameRepo(existing.repo, repo)) return
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

// Local todos and work items. Each is one file in `local/`, in the snapshot's item shape, with
// `identity`, the scope identity (`scopeIdentityOf`) of the checkout it was saved in, so commands
// in that checkout see it. The identity never leaves this machine.

const readLocalItems = (env) => {
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
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// A board root with no `status` yet reads as open (spec §2).
const isOpen = (item) => ['open', 'blocked'].includes(item.labels.status ?? 'open')

// The fold (spec §2): a root's state labels after one more post in its thread, given the post's
// labels. The release 1 rows: a note, a question, a user reply, and a resolve. The app folds with
// the same table, and devchat's `fixtures/fold.json` keeps the two in step.
//
// Pending guard: while `ask=answered`, an agent's post changes the root only when its `re` equals
// `turn`. The app stores such a note and changes nothing, and refuses such a resolve.
const isResolved = (labels) => labels.status === 'done' || labels.status === 'dropped'

const clearAsk = (state) => {
  delete state.ask
  delete state.turn
}
const resolveRow = (state, post) => {
  clearAsk(state)
  state.status = post.kind === 'done' ? 'done' : 'dropped'
}
// One row of the fold table per post kind: each changes `state`, the root's labels, in place.
const foldRows = {
  answer: (state, post) => {
    if (post.by !== 'user' || post.rid === undefined) return
    // A reply on a resolved thread reopens it before its own change applies.
    if (isResolved(state)) state.status = 'open'
    state.ask = 'answered'
    state.turn = post.rid
  },
  note: (state, post) => {
    clearAsk(state)
    state.status = 'open'
    for (const [key, value] of Object.entries(post)) if (key.startsWith('pr.')) state[key] = value
  },
  ask: (state, post) => {
    if (post.rid === undefined) return
    state.ask = 'open'
    state.turn = post.rid
    state.status = post.block === '1' ? 'blocked' : 'open'
  },
  done: resolveRow,
  drop: resolveRow,
}

// The pending guard: an agent's post while `ask=answered` that does not name `turn` with `re`.
const blockedByPending = (labels, post) => post.by !== 'user' && labels.ask === 'answered' && !(post.re !== undefined && post.re === labels.turn)

/** Returns a root's labels after one more post in its thread, `post` being that post's labels (spec §2). */
export const foldStep = (labels, post) => {
  const state = { ...labels }
  if (blockedByPending(state, post)) return state
  if (Object.hasOwn(foldRows, post.kind)) foldRows[post.kind](state, post)
  return state
}

/**
 * Folds one reply, `{ labels, text, createdAt }`, into its root item, and keeps the reply. A
 * resolve the pending guard stops is left out: the app refuses it, so it never joins the thread.
 */
const foldReply = (item, reply) => {
  if (isResolveKind(reply.labels.kind) && blockedByPending(item.labels, reply.labels)) return item
  return {
    ...item,
    labels: foldStep({ status: 'open', ...item.labels }, reply.labels),
    replies: [...(item.replies ?? []), reply],
  }
}

// A root is pending while `ask=answered`: the user replied, and no agent post has answered the
// reply `turn` names (spec §2).
const isPending = (item) => item.labels.ask === 'answered'

// The unanswered messages after one more reply.
const unansweredAfter = ({ unanswered, reply }) => {
  const { by, kind, re } = reply.labels
  if (isResolveKind(kind)) return []
  if (by === 'user') return kind === 'answer' ? [...unanswered, reply] : unanswered
  return re === undefined ? unanswered : unanswered.slice(unanswered.findIndex(({ labels }) => labels.rid === re) + 1)
}

/**
 * The user's unanswered messages on a pending root (spec §2), from its replies in log order: each
 * user reply, less every one up to the reply an agent post names with `re`. A resolve answers all.
 */
const unansweredOf = (item) => {
  if (!isPending(item)) return []
  return (item.replies ?? []).reduce((unanswered, reply) => unansweredAfter({ unanswered, reply }), [])
}

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

const requireText = (text, noun = 'todo') => {
  if (typeof text !== 'string' || text.trim().length === 0) throw new UsageError(`${noun} text is required`)
  if (text.length > maxTextLength) throw new UsageError(`${noun} text exceeds ${maxTextLength} characters`)
  const reason = guardReason(text)
  if (reason) throw new UsageError(`the guard refused the text: ${reason}. Rewrite it without that and try again.`)
  return text
}

/** Checks a value bound for a board label: a label value the guard passes. */
const requireLabel = ({ value, name }) => {
  if (!isLabelValue(value)) throw new UsageError(`${name} must be 1 to 256 characters with no control characters`)
  const reason = guardReason(value)
  if (reason) throw new UsageError(`the guard refused ${name}: ${reason}`)
  return value
}

const requireRid = ({ value, name }) => {
  if (!ridPattern.test(value)) throw new UsageError(`${name} must be a devchat rid: letters, digits, and . _ : -`)
  return value
}

// The app reads a PR's number from the end of its URL's path, as `/pull/<n>`, and refuses any other.
const prNumberOf = (url) => (URL.canParse(url) ? /\/pull\/(\d{1,9})\/?$/u.exec(new URL(url).pathname)?.[1] ?? null : null)

// References. A structured reference names its repo, and the board takes one only to an
// allowlisted repo (spec §5): at queue time and again at flush. A bare number names the item's
// own repo.
const githubName = '([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/([A-Za-z0-9._-]{1,100})'
const shortIssue = new RegExp(`^${githubName}#\\d{1,9}$`, 'u')
const issuePath = new RegExp(`^/${githubName}/issues/\\d{1,9}/?$`, 'u')
const pullPath = new RegExp(`^/${githubName}/pull/\\d{1,9}/?$`, 'u')
const repoOfMatch = (match) => (match ? `${match[1]}/${match[2]}` : null)
// The path of a github.com URL, with the scheme and host matched ignoring case, as URLs read them.
const githubPathOf = (url) => /^https:\/\/github\.com(\/.*)$/iu.exec(url)?.[1] ?? ''

/** The `owner/repo` an `--issue` reference names: '' for a bare `#<n>` or `<n>`, null for a form devchat does not take. */
const issueRepoOf = (value) => (/^#?\d{1,9}$/u.test(value) ? '' : repoOfMatch(shortIssue.exec(value) ?? issuePath.exec(githubPathOf(value))))
/** The `owner/repo` a `--pr` URL names, or null when it is not a github.com pull request URL. */
const prRepoOf = (url) => repoOfMatch(pullPath.exec(githubPathOf(url)))
const isAllowlisted = ({ repo, allowlist }) => repo === '' || allowlistedRepo({ identity: `github.com/${repo}`, allowlist }) === repo

const requireIssue = ({ value, board, config }) => {
  requireLabel({ value, name: '--issue' })
  const repo = issueRepoOf(value)
  if (repo === null) throw new UsageError('--issue must be #<number>, <owner>/<repo>#<number>, or a github.com issue URL')
  if (board && !isAllowlisted({ repo, allowlist: config.allowlist })) throw new UsageError('--issue names a repo whose owner is not on the allowlist, and the board takes no reference to it. Nothing was saved.')
  return value
}

/**
 * Checks `--pr`: a github.com pull request URL, or a number in `repo`, the target item's repo. A
 * board item takes only a pull request in an allowlisted repo.
 */
const requirePr = ({ value, repo, board, config }) => {
  requireLabel({ value, name: '--pr' })
  if (/^#?\d{1,9}$/u.test(value)) {
    if (!repo) throw new UsageError('--pr takes a number only for an item in a github.com repo: give the pull request URL')
    return `https://github.com/${repo}/pull/${value.replace('#', '')}`
  }
  const named = prRepoOf(value)
  if (named === null) throw new UsageError('--pr must be a github.com pull request URL, or a pull request number in the item\'s repo')
  if (board && !isAllowlisted({ repo: named, allowlist: config.allowlist })) throw new UsageError('--pr names a repo whose owner is not on the allowlist, and the board takes no reference to it. Nothing was saved.')
  return value
}

const newRid = (kind) => `${kind}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`

// The labels a post carries in the fold: what the app writes on the canonical post of a reply intent.
const definedLabels = (labels) => Object.fromEntries(Object.entries(labels).filter(([, value]) => value !== undefined))
const postLabelsOf = (intent) => definedLabels({
  rid: intent.rid,
  by: intent.by,
  kind: intent.kind,
  re: intent.re,
  block: intent.block === 1 ? '1' : undefined,
  ...(intent.pr === undefined ? {} : { [`pr.${prNumberOf(intent.pr)}`]: intent.pr }),
})
// The app writes a resolve with fixed text, because Board refuses a post with none.
const replyTextOf = (intent) => ({ done: 'Resolved.', drop: 'Dropped.' })[intent.kind] ?? intent.text

const saveLocalRoot = ({ kind, text, labels = {}, identity, config, env, rid = newRid(kind) }) => {
  writeJsonAtomic(join(localDir(env), `${rid}.json`), localRoot({ kind, text, labels, identity, config, rid }))
  return rid
}
const localRoot = ({ kind, text, labels, identity, config, rid }) => {
  const now = new Date().toISOString()
  const channel = kind === 'todo' ? todoChannel : workChannel
  return { rid, channel, text, labels: definedLabels({ rid, status: 'open', host: config.machine, ...labels }), identity, createdAt: now, updatedAt: now }
}

// Outbox

// Board profile names start with a letter and hold at most 32 letters, digits, and hyphens.
const profilePattern = /^[A-Za-z][A-Za-z0-9-]{0,31}$/u

/** Returns this machine's board profile for Claude Code writes, `<machine>-claude`, as a valid profile name. */
const profileOf = (machine) => {
  const name = machine.replace(/[^A-Za-z0-9-]+/gu, '-').replace(/^[^A-Za-z]+/u, '').slice(0, 25).replace(/-+$/u, '')
  return `${name || 'devchat'}-claude`
}

// The fields of the outbox record that carries an intent. `target` is the intent's own rid, `repo`
// the source repo the router allowlisted, and `board` the normalized board URL the file was queued for.
const outboxFields = ['schema', 'op', 'target', 'profile', 'repo', 'lane', 'board', 'epoch', 'body', 'queuedAt']
// Board refuses a post whose text is longer than this, in UTF-16 code units. An intent's post text
// is the serialized intent.
const boardTextLimit = 10_000

// The release 1 intents the client sends, as devchat's `src/shared/layout.ts` defines them: the
// fields of each kind in their canonical order, required ones first. A new root names its channel;
// a reply names its root's rid. `thread`, `issue`, `re`, `pr`, and `block` are optional.
const intentShapes = {
  todo: { channel: todoChannel, required: ['v', 'rid', 'kind', 'channel', 'text', 'by', 'repo', 'machine'], optional: [] },
  work: { channel: workChannel, required: ['v', 'rid', 'kind', 'channel', 'text', 'by', 'repo', 'machine'], optional: ['thread', 'issue'] },
  note: { required: ['v', 'rid', 'kind', 'root', 'text', 'by'], optional: ['re', 'pr'] },
  ask: { required: ['v', 'rid', 'kind', 'root', 'text', 'by'], optional: ['re', 'block'] },
  done: { required: ['v', 'rid', 'kind', 'root', 'text', 'by'], optional: ['re'] },
  drop: { required: ['v', 'rid', 'kind', 'root', 'text', 'by'], optional: ['re'] },
}
const isIntentKind = (kind) => isString(kind) && Object.hasOwn(intentShapes, kind)
const isRootKind = (kind) => kind === 'todo' || kind === 'work'
const isResolveKind = (kind) => kind === 'done' || kind === 'drop'

// The canonical intent and request body. Sync compares a file's stored body with these bytes, so a
// body that parses to the same values through duplicate keys or another order is refused.
const canonicalIntent = (intent) => {
  const { required, optional } = intentShapes[intent.kind]
  return Object.fromEntries([...required, ...optional].filter((key) => intent[key] !== undefined).map((key) => [key, intent[key]]))
}
const requestBodyOf = (intent) => JSON.stringify({ channel: 'inbox', id: intent.rid, text: JSON.stringify(intent) })
const intentNouns = { todo: 'todo', work: 'goal', note: 'note', ask: 'question' }

// The board epoch an intent is queued for: the one in the configured board's snapshot, or null when
// this machine has no readable snapshot of that board. Sync holds a file whose epoch has changed.
const intendedEpoch = ({ config, env }) => {
  try {
    const snapshot = readSnapshot(env)
    return snapshot?.board === config.boardUrl ? snapshot.epoch : null
  } catch {
    return null
  }
}

// The length of an intent's canonical JSON, which the board's text limit bounds.
const intentSize = ({ fields, rid, config }) => JSON.stringify(canonicalIntent({ ...fields, v: 1, rid, by: profileOf(config.machine) })).length

/**
 * Queues an intent (`fields` without `v`, `rid`, and `by`): one label-free `inbox` post whose `id`
 * is the intent's `rid`, so a retry replays it. The request body is stored as the exact canonical
 * string sync sends, so every retry is byte-identical. `repo` is the source repo the router
 * allowlisted. `epoch` defaults to the snapshot's; a reply takes its root's, so sync holds it
 * when the board's has changed since. Returns the rid and the outbox file name, which sorts by
 * queue time.
 */
const queueIntent = ({ fields, repo, config, env, epoch = intendedEpoch({ config, env }), rid = newRid(fields.kind) }) => {
  const profile = profileOf(config.machine)
  const intent = canonicalIntent({ ...fields, v: 1, rid, by: profile })
  const size = intentSize({ fields, rid, config })
  if (size > boardTextLimit) {
    throw new UsageError(`the ${intentNouns[fields.kind]} is too long for the board: its intent is ${size} characters, and the board takes at most ${boardTextLimit}. Shorten it and try again. Nothing was saved.`)
  }
  const queuedAt = new Date().toISOString()
  const name = nextOutboxName({ env, rid })
  writeJsonAtomic(join(outboxDir(env), name), { schema: 1, op: 'post', target: rid, profile, repo, lane: 'repo', board: config.boardUrl, epoch, body: requestBodyOf(intent), queuedAt })
  return { rid, name }
}

// Outbox names sort in queue order by a sequence number, never by the clock, so a reply queued
// after its root always sorts after it: `q` and 12 digits, which also sort after the time-stamped
// names of earlier versions. Two writers at the same moment may share a number; their rids then
// order them, and neither is the other's root.
const nextOutboxName = ({ env, rid }) => {
  const used = [outboxDir(env), sentDir(env), rejectedDir(env)].flatMap(outboxNames).map((name) => /^q(\d{12})-/u.exec(name)?.[1]).filter(Boolean)
  return `q${String(Math.max(0, ...used.map(Number)) + 1).padStart(12, '0')}-post-${rid}.json`
}

// Every `.json` name in an outbox folder, whatever it is, so a directory, a symbolic link, or
// another odd entry is checked and rejected rather than left in place.
const outboxNames = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')).sort() : [])
const pendingOutbox = (env) => outboxNames(outboxDir(env))
const sentNames = (env) => outboxNames(sentDir(env))

const maxOutboxEntryBytes = 64 * 1024

/**
 * Reads an outbox file through one descriptor: it never follows a symbolic link, never blocks on a
 * FIFO, and reads only a regular file of at most 64 KiB. Returns `{ entry }`, `{ problem }`, or
 * `{ gone: true }` when another flusher already moved the file.
 */
const readOutboxEntry = (path) => {
  let descriptor
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    const stat = fstatSync(descriptor)
    if (!stat.isFile()) return { problem: 'not a regular file' }
    if (stat.size > maxOutboxEntryBytes) return { problem: `larger than ${maxOutboxEntryBytes} bytes` }
    return { entry: JSON.parse(readFileSync(descriptor, 'utf8')) }
  } catch (error) {
    if (error.code === 'ENOENT') return { gone: true }
    return { problem: error.code === 'ELOOP' ? 'a symbolic link' : 'not readable JSON' }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const hasExactly = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const isString = (value) => typeof value === 'string'
const ridPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,195}$/u
const isLabelValue = (value) => isString(value) && value.length >= 1 && value.length <= 256 && !/\p{Cc}/u.test(value)

const parseJson = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// Field types and values follow devchat's intent schema, with no coercion. Each check runs only
// after the ones before it pass.
const intentProblem = ({ entry, body, intent, config }) => {
  const shape = intentShapes[intent.kind]
  const strings = Object.entries(intent).filter(([key]) => key !== 'v' && key !== 'block').map(([, value]) => value)
  const labels = ['by', 'repo', 'machine', 'thread', 'issue', 'pr'].filter((key) => intent[key] !== undefined).map((key) => intent[key])
  const checks = [
    [() => isIntentKind(intent.kind) && shape.required.every((key) => Object.hasOwn(intent, key))
      && Object.keys(intent).every((key) => shape.required.includes(key) || shape.optional.includes(key))
      && intent.v === 1 && intent.channel === shape.channel && (intent.block === undefined || intent.block === 1), 'the intent is not a release 1 intent'],
    [() => strings.every(isString), 'an intent field is not a string'],
    [() => ridPattern.test(intent.rid) && intent.rid === body.id && intent.rid === entry.target, 'the intent rid does not match the post id'],
    [() => [intent.root, intent.re].every((rid) => rid === undefined || ridPattern.test(rid)), 'a target is not a rid'],
    [() => intent.by === entry.profile && (!isRootKind(intent.kind) || intent.repo === entry.repo), 'the intent does not match its outbox record'],
    // The board refuses a bad profile with a 400, which would stop every flush at this file.
    [() => profilePattern.test(entry.profile) && intent.by !== 'user', 'the profile is not a board profile name'],
    [() => allowlistedRepo({ identity: `github.com/${entry.repo}`, allowlist: config.allowlist }) === entry.repo, 'the source repo is not on the allowlist'],
    // A resolve has no text: the app writes its fixed text.
    [() => (isResolveKind(intent.kind) ? intent.text === '' : intent.text.trim().length > 0 && intent.text.length <= maxTextLength), 'the text is empty or too long'],
    [() => labels.every(isLabelValue), 'a provenance field is not a board label value'],
    [() => intent.pr === undefined || prRepoOf(intent.pr) !== null, 'the pr is not a pull request URL'],
    [() => [intent.issue === undefined ? '' : issueRepoOf(intent.issue), intent.pr === undefined ? '' : prRepoOf(intent.pr)].every((repo) => repo !== null && isAllowlisted({ repo, allowlist: config.allowlist })), 'a reference names a repo off the allowlist'],
    [() => strings.every((field) => !guardReason(field)), 'the guard refused an outbound field'],
    [() => entry.body === requestBodyOf(canonicalIntent(intent)), 'the request body is not in canonical form'],
  ]
  return checks.find(([passes]) => !passes())?.[1] ?? null
}

/**
 * The check at flush (spec §5). Sync sends only an intent shaped exactly as `queueIntent` wrote it,
 * byte for byte, from a repo still on the allowlist, whose every outbound field passes the guard
 * again. Returns why a file fails, or null.
 */
const isBoardUrl = (value) => isString(value) && checkBoardUrl(value).url === value

const outboxProblem = ({ entry, config }) => {
  const recordFields = [entry?.target, entry?.profile, entry?.repo, entry?.board, entry?.body, entry?.queuedAt]
  // A file without an epoch was queued with the epoch unknown.
  if (!hasExactly({ epoch: null, ...entry }, outboxFields) || !(entry.epoch == null || isString(entry.epoch)) || entry.schema !== 1 || entry.op !== 'post' || entry.lane !== 'repo' || !recordFields.every(isString)) return 'not a devchat outbox post'
  if (!isBoardUrl(entry.board)) return 'the board is not a normalized board URL'
  const body = parseJson(entry.body)
  if (!hasExactly(body, ['channel', 'id', 'text']) || body.channel !== 'inbox' || !isString(body.text)) return 'the request is not an inbox post'
  if (body.text.length > boardTextLimit) return `the intent is longer than the board's ${boardTextLimit}-character limit`
  const intent = parseJson(body.text)
  if (!isRecord(intent)) return 'the intent is not a release 1 intent'
  return intentProblem({ entry, body, intent, config })
}

// Board client. Every request goes to the configured board URL with plain `fetch`, and carries
// no credential: the tailnet identity comes from `tailscale serve`.

/** A network error, a timeout, a non-2xx answer, or an unexpected body: sync stops, and the next run retries. */
class SyncStop extends Error {
  /** `brief` is the reason a write's own sync prints: it names no outbox file, so no other repo's rid. */
  constructor(message, brief = message) {
    super(message)
    this.brief = brief
  }
}

const heldBrief = 'the outbox is held by a write queued for another board or epoch; run devchat sync for details'

const requestTimeoutMs = 10_000

const boardClient = ({ boardUrl, signal, onAnswer = () => {} }) => {
  const base = boardUrl.replace(/\/+$/u, '')
  const call = async ({ url, method = 'GET', body, headers }) => {
    const timeout = AbortSignal.timeout(requestTimeoutMs)
    const where = `${method} ${new URL(url).pathname}`
    let response
    try {
      response = await fetch(url, { method, body, headers, redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
    } catch (error) {
      throw new SyncStop(`the board is unreachable (${error.cause?.code ?? error.cause?.message ?? error.name})`)
    }
    onAnswer()
    // Board's 409 `duplicate_id` means the id is taken for good and nothing was written. Any other
    // conflict stops the run, as every other error answer does.
    if (response.status === 409) {
      const code = (await response.json().catch(() => null))?.error?.code
      if (code === 'duplicate_id') return { duplicateId: true }
      throw new SyncStop(`${where} answered 409 ${code ?? 'without an error code'}`)
    }
    if (!response.ok) {
      await response.body?.cancel()
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
  }
}

/** Reads every thread root in a channel, page by page; with `label`, only roots that carry that label key. */
const pullChannel = async ({ client, channel, label }) => {
  const roots = []
  let before = null
  do {
    const query = new URLSearchParams({ channel, limit: '500' })
    if (label) query.set('label', label)
    if (before) query.set('before', before)
    const page = await client.get(`/threads?${query}`)
    if (!Array.isArray(page?.threads)) throw new SyncStop(`GET /threads?channel=${channel} sent an unexpected answer`)
    roots.push(...page.threads.map(({ message }) => message))
    before = page.older ?? null
  } while (before)
  return roots
}

/**
 * Returns the label on the one root in `channel` that carries it, or null when none does. Board
 * does not expose a marker's client ID (`board`, `app`) to other readers, and only the host's
 * service account can label these channels, so the label itself finds the marker. More than one
 * such root stops sync.
 */
const readMarkerLabel = async ({ client, channel, label }) => {
  const roots = await pullChannel({ client, channel, label })
  if (roots.length > 1) throw new SyncStop(`${roots.length} roots in ${channel} carry ${label}; the host's marker must be the only one`)
  return roots[0]?.labels?.[label] ?? null
}

/** Reads the board marker's `epoch`, the label on the one `sys` root that carries it. */
const readBoardEpoch = async (client) => {
  const epoch = await readMarkerLabel({ client, channel: 'sys', label: 'epoch' })
  if (epoch === null) throw new SyncStop('the board has no marker with an epoch: the host setup posts it')
  return epoch
}

const isMessageId = (value) => isString(value) && /^\d+$/u.test(value)

/**
 * Reads the app's `applied` cursor, the label on the one `inbox` root that carries it: the app
 * marker. No marker or no label yet means no cursor yet. The cursor is a Board message ID.
 */
const readApplied = async (client) => {
  const applied = await readMarkerLabel({ client, channel: 'inbox', label: 'applied' })
  if (applied !== null && !isMessageId(applied)) throw new SyncStop('the app marker\'s applied label is not a message ID')
  return applied
}

// The snapshot keeps open and blocked roots of these channels, in the local item shape.
const snapshotChannels = [todoChannel, workChannel]

const snapshotItem = (message) => ({
  rid: message.labels.rid,
  channel: message.channel,
  text: message.text,
  labels: message.labels,
  createdAt: message.createdAt,
  updatedAt: message.editedAt ?? message.createdAt,
})

const threadPageSize = 500

/** Reads every reply of the thread whose root has board message ID `id`, oldest first. */
const readReplies = async ({ client, id }) => {
  const replies = []
  let after = id
  for (;;) {
    const page = await client.get(`/messages/${encodeURIComponent(id)}?${new URLSearchParams({ after, limit: String(threadPageSize) })}`)
    if (!Array.isArray(page?.replies)) throw new SyncStop('GET /messages/:id sent an unexpected answer')
    replies.push(...page.replies)
    if (page.replies.length < threadPageSize) return replies
    after = page.replies.at(-1).id
  }
}

const foldedLabels = ['status', 'ask', 'turn']

/**
 * The replies the snapshot keeps for a pending root (spec §3): the last three, the user's
 * unanswered messages however old, and the question each of those answers with `re`. Sync reads
 * the replies after the root's labels, so the thread can have moved past them: `changed` says a
 * post after the root's `turn` changes its state, and pickup then shows no call until a sync reads
 * them together.
 */
const keptReplies = ({ messages, labels }) => {
  const replies = messages
    .filter((message) => !message.deleted && isRecord(message.labels) && isString(message.labels.rid))
    .map((message) => ({ labels: message.labels, text: message.text, createdAt: message.createdAt }))
  const turn = replies.findIndex((reply) => reply.labels.rid === labels.turn)
  const folded = replies.slice(turn + 1).reduce((state, reply) => foldStep(state, reply.labels), labels)
  const changed = turn < 0 || foldedLabels.some((key) => folded[key] !== labels[key])
  const unanswered = unansweredOf({ labels, replies })
  const asked = new Set(unanswered.map(({ labels }) => labels.re))
  const kept = new Set([...replies.slice(-3), ...unanswered])
  return { replies: replies.filter((reply) => kept.has(reply) || asked.has(reply.labels.rid)), changed }
}

// How many resolved roots per channel the snapshot keeps, newest first, labels only: a note can
// reopen one, and a command can name only a root this machine has seen.
const resolvedKept = 500

/** Pulls the open roots, with replies for each pending one, and the latest resolved roots by their labels. */
const pullSnapshotItems = async (client) => {
  const items = []
  const resolved = []
  for (const channel of snapshotChannels) {
    const closed = []
    for (const message of await pullChannel({ client, channel })) {
      if (message.deleted || typeof message.labels?.rid !== 'string') continue
      const item = snapshotItem(message)
      if (!isOpen(item)) {
        closed.push({ rid: item.rid, channel, text: '', labels: item.labels, createdAt: item.createdAt })
        continue
      }
      if (isPending(item)) Object.assign(item, keptReplies({ messages: await readReplies({ client, id: message.id }), labels: item.labels }))
      items.push(item)
    }
    resolved.push(...closed.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, resolvedKept))
  }
  return { items, resolved }
}

// Sync (spec §3). One flusher per device: sync takes a lock file in `outbox/`, and a second sync
// exits. A lock the OS frees on exit, such as an abstract Unix socket, is scoped to a network
// namespace, and Claude Code's sandbox runs each command in its own; so a sandboxed post-write
// sync and the timer's sync would not see each other. A file is seen from every namespace.
//
// The lock holds its owner's PID and PID namespace. In this PID namespace (always, on macOS), the
// lock is stale once that PID has exited. A PID in another namespace cannot be checked, so that
// lock is stale only when its owner has not refreshed it for 15 minutes; the owner refreshes it
// after every board answer, and every request times out within 10 s.
const staleForeignLockMs = 15 * 60 * 1000

const pidNamespace = () => {
  try {
    return readlinkSync('/proc/self/ns/pid')
  } catch {
    return null // No /proc (macOS): every process shares one PID space.
  }
}

const syncLockIsStale = ({ text, ageMs }) => {
  const owner = parseJson(text)
  if (owner?.namespace !== pidNamespace() || !Number.isSafeInteger(owner.pid)) return ageMs > staleForeignLockMs
  try {
    process.kill(owner.pid, 0)
    return false
  } catch (error) {
    return error.code === 'ESRCH'
  }
}

/**
 * Moves a stale lock aside with one rename, then checks that the file it moved holds the content
 * it judged stale. If another sync took the lock in between, it links that lock back. Returns
 * whether the stale lock is gone.
 */
const takeStaleSyncLock = (path) => {
  const aside = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.stale`
  try {
    const text = readFileSync(path, 'utf8')
    if (!syncLockIsStale({ text, ageMs: Date.now() - statSync(path).mtimeMs })) return false
    renameSync(path, aside)
    const moved = readFileSync(aside, 'utf8')
    if (moved !== text) linkSync(aside, path)
    return moved === text
  } catch (error) {
    // ENOENT: the lock went before this sync read or moved it. EEXIST: a third sync took the lock
    // before the moved one could go back, and that sync holds it now.
    if (error.code === 'ENOENT') return true
    if (error.code === 'EEXIST') return false
    throw error
  } finally {
    rmSync(aside, { force: true })
  }
}

/** Takes the outbox lock and returns its content, or null while another sync holds it. */
const takeSyncLock = (env) => {
  const path = syncLockPath(env)
  const owner = JSON.stringify({ pid: process.pid, namespace: pidNamespace(), token: randomBytes(8).toString('hex') })
  if (writeExclusive(path, owner)) return owner
  return takeStaleSyncLock(path) && writeExclusive(path, owner) ? owner : null
}

// Runs `action` only while the lock still holds this sync's content.
const whileOwned = ({ env, owner, action }) => {
  const path = syncLockPath(env)
  try {
    if (readFileSync(path, 'utf8') === owner) action(path)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}
const refreshSyncLock = ({ env, owner }) => whileOwned({ env, owner, action: (path) => utimesSync(path, new Date(), new Date()) })
const releaseSyncLock = ({ env, owner }) => whileOwned({ env, owner, action: unlinkSync })

// Two flushers can run at once: the lock only makes a second sync exit. So every move and removal
// below treats a missing file as done by the other flusher, a resend only replays the post its
// `id` names, and each file write is an atomic rename.
const ignoreMissing = (action) => {
  try {
    action()
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

const rejectOutboxFile = ({ env, name, problem, out }) => {
  mkdirSync(rejectedDir(env), { recursive: true })
  ignoreMissing(() => {
    renameSync(join(outboxDir(env), name), join(rejectedDir(env), name))
    out(`rejected ${name}: ${problem}`)
  })
}

/**
 * Sends the outbox in time order. A file queued for another board stops the flush and stays, and
 * no other check applies to it. A file that fails the check moves to `rejected/`. The first
 * failed send stops the flush, and its file stays.
 */
const flush = async ({ client, config, env, epoch, out, outcomes }) => {
  for (const name of pendingOutbox(env)) {
    const path = join(outboxDir(env), name)
    const { entry, problem: unreadable, gone } = readOutboxEntry(path)
    if (gone) continue
    // Only a valid, normalized board URL names another board; any other value fails the check below.
    if (isBoardUrl(entry?.board) && entry.board !== config.boardUrl) {
      throw new SyncStop(`${name} was queued for another board than the configured one: nothing is sent until the config names that board again, or the file leaves outbox/`, heldBrief)
    }
    const problem = unreadable ?? outboxProblem({ entry, config })
    if (problem) {
      rejectOutboxFile({ env, name, problem, out })
      outcomes.set(name, { rejected: problem })
      continue
    }
    // A file queued with the epoch unknown takes the epoch of the first sync that reads the
    // marker. One queued under another epoch is held: the board was restored after it was queued.
    // A reply queued on a root still in outbox/ takes the root's epoch, or none when the root has
    // none: it sorts after the root, so this loop stamps it right after the root, under the same
    // epoch, or stops at the root first.
    if (entry.epoch == null) writeJsonAtomic(path, { ...entry, epoch })
    else if (entry.epoch !== epoch) {
      throw new SyncStop(`${name} was queued under board epoch ${entry.epoch}, and the board's is ${epoch}: nothing is sent until the file leaves outbox/`, heldBrief)
    }
    await sendEntry({ client, env, name, path, entry, epoch, out, outcomes })
  }
}

// Posts one checked outbox file and records what the board did with it.
const sendEntry = async ({ client, env, name, path, entry, epoch, out, outcomes }) => {
  const answer = await client.post({ body: entry.body, profile: entry.profile })
  // Another post holds this id on the board: this one can never be sent, and the rest of the
  // outbox can.
  if (answer?.duplicateId) {
    rejectOutboxFile({ env, name, problem: 'already on the board', out })
    outcomes.set(name, { taken: true })
    return
  }
  if (!isMessageId(answer?.message?.id)) throw new SyncStop('POST /messages sent no message ID')
  // The sent copy keeps the board's `inbox` ID and the epoch it was sent under. It is written
  // before the queued file goes, so a crash between the two sends the file again, which the post
  // `id` turns into a replay.
  writeJsonAtomic(join(sentDir(env), name), { ...entry, inboxId: answer.message.id, epoch, sentAt: new Date().toISOString() })
  ignoreMissing(() => unlinkSync(path))
  outcomes.set(name, { sent: true })
  out(`sent ${entry.target}`)
}

// Board message IDs are log indexes: compare them as integers, never as strings ('9' < '10').
const isCovered = ({ id, applied }) => isMessageId(id) && isMessageId(applied) && BigInt(id) <= BigInt(applied)

// A sent entry belongs to the board and epoch it was sent to; only that board's cursor decides it.
const sentHere = ({ entry, config, epoch }) => entry?.board === config.boardUrl && entry?.epoch === epoch

/**
 * Finds the sent intents the app has decided, which the `applied` cursor of the board and epoch
 * they were sent to says (spec §3, decided intents), with the app's reason code for each refused
 * one. An entry sent to another board or epoch is not decided here.
 */
const readDecided = async ({ client, config, env, epoch, applied }) => {
  const covered = sentNames(env)
    .map((name) => ({ name, entry: readOutboxEntry(join(sentDir(env), name)).entry }))
    .filter(({ entry }) => sentHere({ entry, config, epoch }) && isCovered({ id: entry.inboxId, applied }))
  if (covered.length === 0) return []
  const refused = new Map((await pullChannel({ client, channel: 'inbox', label: 'refused' })).map((message) => [message.id, message.labels.refused]))
  return covered.map((decided) => ({ ...decided, reason: refused.get(decided.entry.inboxId) }))
}

const intentOfEntry = (entry) => {
  const intent = isString(entry?.body) ? parseJson(parseJson(entry.body)?.text) : undefined
  return isRecord(intent) && isIntentKind(intent.kind) && isString(intent.rid) && isString(intent.text) ? intent : null
}

// A refused intent moves to `rejected/` with its reason code, which sync prints as it is. Any
// other decided intent was applied, so its file goes. A refused reply on a root that still waits
// for its pending reply also prints the call that answers it (spec §4). Each line names the
// intent's source repo, so a write's own sync can print only that repo's (`syncAfterWrite`).
const retireDecided = ({ env, decided, items, out }) => {
  for (const { name, entry, reason } of decided) {
    if (reason !== undefined) {
      writeJsonAtomic(join(rejectedDir(env), name), { ...entry, refused: reason })
      out(`refused ${entry.target}: ${reason}`, { repo: entry.repo })
      const root = items.find((item) => item.rid === intentOfEntry(entry)?.root)
      if (root && isPending(root)) out(`not applied: ${root.rid} ${root.changed ? changedNote : `waits on a reply. ${answerCall(root)}`}`, { repo: entry.repo })
    }
    ignoreMissing(() => unlinkSync(join(sentDir(env), name)))
  }
}

// An older sync that overlapped a newer one finds the newer snapshot in place: same board and
// epoch, a higher cursor. It must not replace that snapshot, or retire receipts by its older
// cursor. Cursors of different boards do not compare, so another board's snapshot is replaced.
const newerSnapshotInPlace = ({ env, board, epoch, applied }) => {
  let current
  try {
    current = readSnapshot(env)
  } catch {
    return false // An unreadable snapshot is replaced.
  }
  return current?.board === board && current.epoch === epoch && isMessageId(current.applied) && (!isMessageId(applied) || BigInt(current.applied) > BigInt(applied))
}

// Only a snapshot of the configured board can hold an old epoch. Sync replaces a snapshot of
// another board, or one without a board URL, without comparing it.
const snapshotEpochDiffers = ({ snapshot, config, epoch }) => snapshot?.board === config.boardUrl && snapshot.epoch !== epoch

const syncSteps = async ({ config, env, out, client, outcomes }) => {
  const snapshot = readSnapshot(env)
  const epoch = await readBoardEpoch(client)
  if (snapshotEpochDiffers({ snapshot, config, epoch })) {
    throw new SyncStop(`the board epoch is ${epoch} and the snapshot's is ${snapshot.epoch}: nothing is sent or pulled until the outbox is reconciled`)
  }
  if (config.mode === 'readwrite') await flush({ client, config, env, epoch, out, outcomes })
  const applied = await readApplied(client)
  const pulledAt = new Date().toISOString()
  const { items, resolved } = await pullSnapshotItems(client)
  const decided = await readDecided({ client, config, env, epoch, applied })
  // A restore during this sync would make every read above an old board's. Read the epoch again
  // before anything local changes.
  const now = await readBoardEpoch(client)
  if (now !== epoch) throw new SyncStop(`the board epoch changed from ${epoch} to ${now} during this sync: the snapshot and receipts stay as they were`)
  // The check and the rename below are not atomic. Two syncs inside the lock-bypass window can
  // still leave the older snapshot. It is a read cache the next sync rebuilds, and each sync
  // retires receipts only by its own cursor and refusals, so no data is lost.
  if (newerSnapshotInPlace({ env, board: config.boardUrl, epoch, applied })) {
    out('a newer snapshot is already in place: this sync leaves it and its receipts')
    return
  }
  writeJsonAtomic(snapshotPath(env), { schema: 1, pulledAt, board: config.boardUrl, epoch, applied, items, resolved })
  out(`snapshot: ${items.length} open item(s), epoch ${epoch}`)
  retireDecided({ env, decided, items, out })
}

/**
 * Runs one sync (spec §3): stop on a changed board epoch, send the outbox in time order (mode
 * `readwrite` only), read the app's `applied` cursor, then pull and replace the snapshot with one
 * rename. Returns `{ locked: true }` when another sync holds the lock, else `{ stopped }`: null,
 * or why the run stopped.
 */
const runSync = async ({ config, env, out = () => {}, signal, outcomes = new Map() }) => {
  const owner = takeSyncLock(env)
  if (!owner) return { locked: true }
  try {
    const client = boardClient({ boardUrl: config.boardUrl, signal, onAnswer: () => refreshSyncLock({ env, owner }) })
    await syncSteps({ config, env, out, client, outcomes })
    return { stopped: null }
  } catch (error) {
    if (error instanceof SyncStop) return { stopped: error.message, brief: error.brief }
    throw error
  } finally {
    releaseSyncLock({ env, owner })
  }
}

// The sync right after a queued write is best effort and gives up after 3 s. The write has
// already succeeded, so no outcome here fails the command.
const postWriteSyncMs = 3000

const syncAfterWrite = async ({ config, env, name, repo, out }) => {
  // What this sync's flush did with each file, by name.
  const outcomes = new Map()
  let reason
  try {
    // Of this sync's lines, only a refusal of an earlier intent from this write's repo is news
    // here. `devchat sync` prints every refusal.
    const refusals = (line, about) => sameRepo(about?.repo, repo) && out(line)
    const result = await runSync({ config, env, out: refusals, signal: AbortSignal.timeout(postWriteSyncMs), outcomes })
    reason = result.locked ? 'another sync is running' : result.brief
  } catch (error) {
    reason = error.message
  }
  return outcomeText({ outcome: outcomes.get(name), reason })
}

// What a sync's flush did with one outbox file, as a write reports it.
const outcomeText = ({ outcome, reason }) => {
  if (outcome?.sent) return 'sent'
  if (outcome?.taken) return 'not sent: another post already holds its id on the board; moved to outbox/rejected/'
  if (outcome?.rejected) return `not sent: the check at flush rejected it (${outcome.rejected}) and moved it to outbox/rejected/`
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

// The offline view (spec §3): the snapshot's roots, then every intent this machine queued or sent
// that the app has not decided yet, folded in queue order, then the records in `local/`. So an
// item marked done offline leaves the view at once; the app decides when it ingests the intent.

// The snapshot of the configured board, or null: another board's snapshot is no view of this one.
const currentSnapshot = ({ config, env }) => {
  const snapshot = readSnapshot(env)
  return snapshot?.board === config.boardUrl ? snapshot : null
}

// An outbox entry belongs to the configured board's view when it was queued for that board and,
// once both know the epoch, for that epoch. An entry queued with the epoch unknown takes the next.
const ofThisBoard = ({ entry, config, snapshot }) => entry.board === config.boardUrl
  && (entry.epoch == null || snapshot == null || entry.epoch === snapshot.epoch)

// The intents this machine queued or sent for the configured board that the app has not decided
// yet, in queue order. A rid in both folders, after a crash or two flushers, counts once, as its
// `sent/` copy.
const outstandingIntents = ({ config, snapshot, env }) => {
  const found = new Map()
  for (const [dir, source] of [[sentDir(env), 'sent'], [outboxDir(env), 'queued']]) {
    for (const name of outboxNames(dir)) {
      const { entry } = readOutboxEntry(join(dir, name))
      const intent = intentOfEntry(entry)
      if (!intent || !isString(entry.queuedAt) || !ofThisBoard({ entry, config, snapshot }) || found.has(intent.rid)) continue
      found.set(intent.rid, { name, intent, entry, queuedAt: entry.queuedAt, source })
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** The configured board's items: the snapshot's open and resolved roots, with this machine's outstanding intents folded in. */
const boardView = ({ config, env }) => {
  const snapshot = currentSnapshot({ config, env })
  const roots = [...(snapshot?.items ?? []), ...(snapshot?.resolved ?? [])]
  // Each board item carries the epoch it belongs to: the snapshot's, or its outbox entry's, which
  // is null while the epoch was unknown when it was queued.
  const items = new Map(roots.map((item) => [item.rid, { ...item, source: 'board', epoch: snapshot.epoch }]))
  for (const { intent, entry, queuedAt, source } of outstandingIntents({ config, snapshot, env })) {
    if (isRootKind(intent.kind)) {
      if (items.has(intent.rid)) continue
      const labels = definedLabels({ rid: intent.rid, status: 'open', repo: intent.repo, thread: intent.thread, issue: intent.issue })
      items.set(intent.rid, { rid: intent.rid, channel: intent.channel, text: intent.text, labels, createdAt: queuedAt, source, epoch: entry.epoch ?? null })
      continue
    }
    const root = items.get(intent.root)
    if (root) items.set(root.rid, foldReply(root, { labels: postLabelsOf(intent), text: replyTextOf(intent), createdAt: queuedAt }))
  }
  return [...items.values()]
}

/** Every todo and work item this machine knows, oldest first, each with its `source`: board, queued, sent, or local. Mode off has no board. */
const viewItems = ({ config, env }) => [
  ...(config.mode === 'off' ? [] : boardView({ config, env })),
  ...readLocalItems(env).map((item) => ({ ...item, source: 'local' })),
].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

// A board item is in the configured board's current epoch when its epoch is the snapshot's. With
// no snapshot of the board yet, or a root queued with the epoch unknown, only a root still in
// outbox/ counts: a reply takes its epoch and sorts after it, so flush sends both under one epoch,
// or holds the root first. A sent root waits for a sync, which may find the board restored.
const inCurrentEpoch = ({ item, epoch }) => (epoch === null || item.epoch == null ? item.source === 'queued' : item.epoch === epoch)

/**
 * Whether an item belongs to the checkout containing `cwd`: a local item by its identity, a board
 * item by its `repo` label and the configured board's current epoch. Null outside a checkout.
 */
const repoScope = ({ config, env, cwd }) => {
  const identity = scopeIdentityOf({ cwd, env })
  if (identity === '') return null
  const epoch = currentSnapshot({ config, env })?.epoch ?? null
  return (item) => (item.source === 'local'
    ? sameRepo(item.identity, identity)
    : sameRepo(`github.com/${item.labels.repo}`, identity) && inCurrentEpoch({ item, epoch }))
}

/**
 * The items a command may see (spec §5). Inside a git checkout, whatever the session, only that
 * checkout's repo's: another repo's item reads exactly as an unknown rid, so no list or lookup
 * shows it. Outside any checkout, every item.
 */
const visibleItems = ({ config, env, cwd }) => {
  const items = viewItems({ config, env })
  const inRepo = repoScope({ config, env, cwd })
  return inRepo === null ? items : items.filter(inRepo)
}

const nouns = { [todoChannel]: 'todo', [workChannel]: 'work item' }
const listCommands = { [todoChannel]: 'devchat todo list', [workChannel]: 'devchat work list' }

const threadItem = ({ items, noun, env }) => {
  const thread = env.T3CODE_THREAD_ID
  if (!thread) throw new UsageError(`give the ${noun} rid: without one, devchat looks for this T3 thread's open ${noun}, and T3CODE_THREAD_ID is not set`)
  const ofThread = items.filter((item) => isOpen(item) && item.labels.thread === thread)
  if (ofThread.length === 1) return ofThread[0]
  throw new UsageError(ofThread.length === 0
    ? `no open ${noun} belongs to this T3 thread: give its rid`
    : `${ofThread.length} open ${noun}s belong to this T3 thread: give one rid of ${ofThread.map(({ rid }) => rid).join(', ')}`)
}

/**
 * Finds the item a command names, in this machine's view of the configured board and `local/`:
 * by its rid or a prefix unique among all of them, or, for a work item named by neither, the open
 * one whose `thread` is this T3 thread (`T3CODE_THREAD_ID`, F24). A resolve names only open items.
 * A rid this machine has not seen names nothing: run sync first. The argument may be anything the
 * agent pasted, so no error prints it.
 */
const findTarget = ({ prefix, channel, openOnly = false, config, env, cwd }) => {
  const noun = nouns[channel]
  const items = visibleItems({ config, env, cwd }).filter((item) => item.channel === channel)
  if (prefix === undefined) return threadItem({ items, noun, env })
  if (!ridPattern.test(prefix)) throw new UsageError(`the ${noun} rid is not a devchat rid: it holds letters, digits, and . _ : - only`)
  const exact = items.filter((item) => item.rid === prefix)
  const matches = exact.length > 0 ? exact : items.filter((item) => item.rid.startsWith(prefix))
  if (matches.length > 1) throw new UsageError(`that rid prefix matches ${matches.length} ${noun}s: ${matches.map(({ rid }) => rid).join(', ')}`)
  if (matches.length === 0) throw new UsageError(`no ${noun} on this machine has that rid: run devchat sync, or find it with ${listCommands[channel]}`)
  if (openOnly && !isOpen(matches[0])) throw new UsageError(`${matches[0].rid} is already resolved`)
  return matches[0]
}

/**
 * Checks that this session may write on a board item, and returns the router's decision. The
 * item's repo and epoch need no check here: `findTarget` sees only this repo's items of the
 * configured board's current epoch. Nothing about the item prints before this passes.
 */
const boardWriteTo = ({ target, config, env, cwd }) => {
  const decision = routeHere({ config, env, cwd })
  if (decision.target !== 'board') throw new UsageError(`${target.rid} is on the board, and this session's writes stay on this machine (${decision.reason}). Nothing was saved.`)
  return decision
}

/**
 * Writes one reply, `fields` without `v`, `rid`, `by`, and `root`, on `target`. An item kept on
 * this machine folds it into its `local/` record. A board item takes it as an intent queued under
 * the item's epoch, which needs `boardWriteTo` to pass: anything else saves nothing.
 */
const writeReply = async ({ target, fields, config, env, cwd, out }) => {
  const intent = { ...fields, root: target.rid }
  if (target.source === 'local') {
    const rid = newRid(fields.kind)
    const now = new Date().toISOString()
    const { source, ...item } = foldReply(target, { labels: postLabelsOf({ ...intent, rid, by: profileOf(config.machine) }), text: replyTextOf(intent), createdAt: now })
    writeJsonAtomic(join(localDir(env), `${target.rid}.json`), { ...item, updatedAt: now })
    out(`${rid}: saved on this machine only (${target.rid} is kept on this machine)`)
    return
  }
  const decision = boardWriteTo({ target, config, env, cwd })
  const { rid, name } = queueIntent({ fields: intent, repo: decision.repo, epoch: target.epoch, config, env })
  out(`${rid}: saved to the board (${decision.repo}) through the outbox`)
  out(`${rid}: ${await syncAfterWrite({ config, env, name, repo: decision.repo, out })}`)
}

// The repo `--pr <number>` names: a board item's `repo`, or a local item's github.com repo.
const repoOfItem = (item) => item.labels.repo ?? /^github\.com\/([^/]+\/[^/]+)$/u.exec(item.identity ?? '')?.[1]

// Pending replies (spec §13, pickup): for each pending item one line with the call that answers
// every unanswered message, `--re <turn>`, then the messages, cut short.

const oneLine = (text, max) => {
  const flat = text.replace(/\s+/gu, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

const replyCall = (item) => `devchat work note ${item.rid} --re ${item.labels.turn} "<what you did, or the next question>"`
const answerCall = (item) => `Answer it: ${replyCall(item)}`

const changedNote = 'changed since the last sync: run devchat sync, then answer it'

/** The one line pickup always prints for a pending item: its rid, its goal, and the call, or why it has none yet. */
const pendingSummary = (item) => `${item.rid}  ${oneLine(item.text, 48)}  ${item.changed ? changedNote : `answer: ${replyCall(item)}`}`

/** A pending item's unanswered messages, each with the question it answers, cut short. */
const pendingReplies = (item) => {
  if (item.changed) return []
  const asks = new Map((item.replies ?? []).filter(({ labels }) => labels.kind === 'ask').map((reply) => [reply.labels.rid, reply]))
  return unansweredOf(item).flatMap((reply) => [
    ...(asks.has(reply.labels.re) ? [`  you asked: ${oneLine(asks.get(reply.labels.re).text, 100)}`] : []),
    `  the user replied: ${oneLine(reply.text, 120)}`,
  ])
}

const pendingLines = (item) => [
  pendingSummary(item),
  ...pendingReplies(item),
  `  Read them whole: devchat work show ${item.rid}`,
]

// The intents the app refused for the configured board, which sync moved to `rejected/` with
// their reason code.
const refusedReplies = ({ config, env }) => {
  const snapshot = currentSnapshot({ config, env })
  return outboxNames(rejectedDir(env)).flatMap((name) => {
    const { entry } = readOutboxEntry(join(rejectedDir(env), name))
    const intent = intentOfEntry(entry)
    return intent?.root !== undefined && isString(entry.refused) && ofThisBoard({ entry, config, snapshot }) ? [{ intent, reason: entry.refused }] : []
  })
}

const contextBudget = 1024
// Room kept for the line that says how much did not fit.
const moreLineBytes = 80

/**
 * The lines of `sections` that fit in 1 KB, in order. A block shows whole or not at all, and once
 * one does not fit, nothing after it shows, so a cut never splits a call or reorders the list. A
 * section marked `always` shows whatever its size: it holds the calls that answer waiting replies.
 */
const fitSections = (sections) => {
  const lines = []
  let used = 0
  let omitted = 0
  for (const { header, blocks, always = false } of sections) {
    let headed = false
    for (const block of blocks) {
      const candidate = headed ? block : [header, ...block]
      const size = candidate.reduce((sum, line) => sum + Buffer.byteLength(line) + 1, 0)
      if (!always && (omitted > 0 || used + size > contextBudget - moreLineBytes)) {
        omitted += 1
        continue
      }
      lines.push(...candidate)
      used += size
      headed = true
    }
  }
  if (omitted > 0) lines.push(`${omitted} more not shown: devchat work list, devchat todo list`)
  return lines
}

const flagOf = (item) => {
  if (isPending(item)) return '[reply waiting] '
  if (item.labels.ask === 'open') return '[question open] '
  return item.labels.status === 'blocked' ? '[blocked] ' : ''
}

/**
 * What `work start` prints about this repo (spec §4), in at most 1 KB: first one line per pending
 * item with the call that answers it, and any reply the app refused while it waited, whatever
 * their size; then the waiting messages, cut short; then open work items; then open todos. A board
 * item is this repo's by its `repo` label, a local one by its identity.
 */
const startContext = ({ config, env, cwd, exclude }) => {
  const inRepo = repoScope({ config, env, cwd }) ?? (() => false)
  const open = viewItems({ config, env }).filter(inRepo).filter((item) => item.rid !== exclude && isOpen(item))
  const work = open.filter(({ channel }) => channel === workChannel)
  const pending = work.filter(isPending)
  const refusals = refusedReplies({ config, env })
  const notesFor = (item) => refusals
    .filter(({ intent }) => intent.root === item.rid)
    .map(({ intent, reason }) => `  not applied: ${intent.rid} (${intent.kind}), refused: ${reason}`)
  const lines = fitSections([
    { header: 'Replies waiting for you; answer each with its call:', blocks: pending.map((item) => [pendingSummary(item), ...notesFor(item)]), always: true },
    { header: 'What the user replied, cut short; devchat work show <rid> prints it whole:', blocks: pending.filter((item) => !item.changed).map((item) => [`${item.rid}:`, ...pendingReplies(item)]) },
    { header: 'Open work items here; add a note with devchat work note <rid> "<text>":', blocks: work.filter((item) => !isPending(item)).map((item) => [`${item.rid}  ${flagOf(item)}${oneLine(item.text, 80)}`]) },
    { header: 'Open todos here:', blocks: open.filter(({ channel }) => channel === todoChannel).map((item) => [`${item.rid}  ${oneLine(item.text, 80)}`]) },
  ])
  return lines.length > 0 ? lines : ['Nothing else is open in this repo.']
}

const parseCommand = ({ args, options = {}, usage }) => {
  try {
    return parseArgs({ args, options, allowPositionals: true, strict: true })
  } catch {
    throw new UsageError(usage)
  }
}

// Work commands

const workStart = async ({ args, env, cwd, out }) => {
  const usage = 'usage: devchat work start "<goal>" [--issue <ref>]'
  const { values, positionals } = parseCommand({ args, options: { issue: { type: 'string' } }, usage })
  if (positionals.length !== 1) throw new UsageError(usage)
  const text = requireText(positionals[0], 'goal')
  // The T3 thread that starts the item (F24): a later call without a rid finds the item by it.
  const thread = env.T3CODE_THREAD_ID ? requireLabel({ value: env.T3CODE_THREAD_ID, name: 'T3CODE_THREAD_ID' }) : undefined
  const config = readConfig(env)
  const decision = routeHere({ config, env, cwd })
  const issue = values.issue === undefined ? undefined : requireIssue({ value: values.issue, board: decision.target === 'board', config })
  let rid
  if (decision.target === 'board') {
    const queued = queueIntent({ fields: { kind: 'work', channel: workChannel, text, repo: decision.repo, machine: config.machine, thread, issue }, repo: decision.repo, config, env })
    rid = queued.rid
    out(`${rid}: saved to the board (${decision.repo}) through the outbox`)
    out(`${rid}: ${await syncAfterWrite({ config, env, name: queued.name, repo: decision.repo, out })}`)
  } else {
    rid = saveLocalRoot({ kind: 'work', text, labels: { thread, issue }, identity: scopeIdentityOf({ cwd, env }), config, env })
    out(`${rid}: saved on this machine only (${decision.reason})`)
  }
  for (const line of startContext({ config, env, cwd, exclude: rid })) out(line)
}

const workNote = async ({ args, env, cwd, out }) => {
  const usage = 'usage: devchat work note [<rid>] "<text>" [--pr <url>] [--ask|--blocked] [--re <id>]'
  const options = { pr: { type: 'string' }, ask: { type: 'boolean' }, blocked: { type: 'boolean' }, re: { type: 'string' } }
  const { values, positionals } = parseCommand({ args, options, usage })
  if (positionals.length < 1 || positionals.length > 2 || (values.ask && values.blocked)) throw new UsageError(usage)
  const question = values.ask || values.blocked
  if (question && values.pr !== undefined) throw new UsageError('--pr goes on a plain note, not on a question')
  const [prefix, text] = positionals.length === 2 ? positionals : [undefined, positionals[0]]
  const fields = {
    kind: question ? 'ask' : 'note',
    text: requireText(text, 'note'),
    re: values.re === undefined ? undefined : requireRid({ value: values.re, name: '--re' }),
    block: values.blocked ? 1 : undefined,
  }
  const config = readConfig(env)
  const target = findTarget({ prefix, channel: workChannel, config, env, cwd })
  if (values.pr !== undefined) fields.pr = requirePr({ value: values.pr, repo: repoOfItem(target), board: target.source !== 'local', config })
  await writeReply({ target, fields, config, env, cwd, out })
  // While a reply is pending, a note that does not name `turn` is stored and changes nothing (spec §2).
  if (isPending(target) && fields.re !== target.labels.turn) {
    out(`${target.rid} waits on a reply from the user, so this ${intentNouns[fields.kind]} changes nothing there until you answer it:`)
    for (const line of pendingLines(target)) out(line)
  }
}

const workResolve = (kind) => async ({ args, env, cwd, out }) => {
  const usage = `usage: devchat work ${kind} ${kind === 'done' ? '[<rid>]' : '<rid>'} [--re <id>]`
  const { values, positionals } = parseCommand({ args, options: { re: { type: 'string' } }, usage })
  if (positionals.length > 1 || (kind === 'drop' && positionals.length !== 1)) throw new UsageError(usage)
  const re = values.re === undefined ? undefined : requireRid({ value: values.re, name: '--re' })
  const config = readConfig(env)
  const target = findTarget({ prefix: positionals[0], channel: workChannel, openOnly: true, config, env, cwd })
  if (target.source !== 'local') boardWriteTo({ target, config, env, cwd })
  // While the view shows a pending reply, a resolve without `re` sends nothing: the app would
  // refuse it, and the user's message would wait unseen (spec §4).
  if (isPending(target) && re === undefined) {
    out(`${target.rid} waits on a reply from the user, so work ${kind} sent nothing:`)
    for (const line of pendingLines(target)) out(line)
    if (!target.changed) out(`  Then resolve it: devchat work ${kind} ${target.rid} --re ${target.labels.turn}`)
    return 1
  }
  await writeReply({ target, fields: { kind, text: '', re }, config, env, cwd, out })
  return 0
}

const workList = ({ args, env, cwd, out }) => {
  if (args.length > 0) throw new UsageError('usage: devchat work list')
  const open = visibleItems({ config: readConfig(env), env, cwd }).filter((item) => item.channel === workChannel && isOpen(item))
  if (open.length === 0) {
    out('No open work items.')
    return
  }
  for (const item of open) out(`${item.rid}  ${item.createdAt.slice(0, 10)}  ${item.source.padEnd(6)}  ${flagOf(item)}${item.text}`)
}

// Shows what this machine knows of a work item, replies in full: the snapshot keeps replies only
// while one is pending, and a local item keeps all of its own.
const workShow = ({ args, env, cwd, out }) => {
  if (args.length !== 1) throw new UsageError('usage: devchat work show <rid>')
  const item = findTarget({ prefix: args[0], channel: workChannel, config: readConfig(env), env, cwd })
  const { status = 'open', repo, issue } = item.labels
  out(`${item.rid}  ${item.source}  ${status}${repo ? `  ${repo}` : ''}${issue ? `  issue ${issue}` : ''}`)
  if (item.text) out(item.text)
  // A changed item's replies are older than its thread: show none, and no call, until a sync.
  if (item.changed) {
    out(`This item ${changedNote}.`)
    return
  }
  for (const reply of item.replies ?? []) out(`  ${reply.labels.by ?? 'unknown'} (${reply.labels.kind ?? 'reply'}): ${reply.text}`)
  if (isPending(item)) out(answerCall(item))
}

const workCommands = { start: workStart, note: workNote, done: workResolve('done'), drop: workResolve('drop'), list: workList, show: workShow }

const work = ({ args: [subcommand, ...args], ...context }) => {
  if (!Object.hasOwn(workCommands, subcommand ?? '')) throw new UsageError('usage: devchat work start "<goal>" | note [<rid>] "<text>" | done [<rid>] | list | show <rid> | drop <rid>')
  return workCommands[subcommand]({ args, ...context })
}

// Todo commands

const todoAdd = async ({ args, env, cwd, out }) => {
  if (args.length !== 1) throw new UsageError('usage: devchat todo add "<text>"')
  const text = requireText(args[0])
  const config = readConfig(env)
  const decision = routeHere({ config, env, cwd })
  if (decision.target !== 'board') {
    out(`${saveLocalRoot({ kind: 'todo', text, identity: scopeIdentityOf({ cwd, env }), config, env })}: saved on this machine only (${decision.reason})`)
    return 0
  }
  const { rid, name } = queueIntent({ fields: { kind: 'todo', channel: todoChannel, text, repo: decision.repo, machine: config.machine }, repo: decision.repo, config, env })
  out(`${rid}: saved to the board (${decision.repo}) through the outbox`)
  out(`${rid}: ${await syncAfterWrite({ config, env, name, repo: decision.repo, out })}`)
  return 0
}

const todoList = ({ args, env, cwd, out }) => {
  if (args.length > 0) throw new UsageError('usage: devchat todo list')
  const open = visibleItems({ config: readConfig(env), env, cwd }).filter((item) => item.channel === todoChannel && isOpen(item))
  if (open.length === 0) {
    out('No open todos.')
    return
  }
  for (const item of open) out(`${item.rid}  ${item.createdAt.slice(0, 10)}  ${item.source.padEnd(6)}  ${item.text}`)
}

// A todo on this machine resolves in its record; a board todo through a resolve intent.
const todoResolve = (kind) => async ({ args, env, cwd, out }) => {
  if (args.length !== 1) throw new UsageError(`usage: devchat todo ${kind} <rid>`)
  const config = readConfig(env)
  const target = findTarget({ prefix: args[0], channel: todoChannel, openOnly: true, config, env, cwd })
  await writeReply({ target, fields: { kind, text: '' }, config, env, cwd, out })
}

const todoCommands = { add: todoAdd, list: todoList, done: todoResolve('done'), drop: todoResolve('drop') }

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

const outboxCheck = ({ config, env }) => {
  const sent = sentNames(env)
  const elsewhere = sent.filter((name) => readOutboxEntry(join(sentDir(env), name)).entry?.board !== config.boardUrl).length
  const rejected = outboxNames(rejectedDir(env)).length
  const sentLine = elsewhere > 0 ? `${sent.length} sent (${elsewhere} to another board)` : `${sent.length} sent`
  return { ok: rejected === 0, line: `outbox: ${pendingOutbox(env).length} queued, ${sentLine}, ${rejected} rejected` }
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
    const matches = !snapshotEpochDiffers({ snapshot, config, epoch })
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
  const checks = [...localChecks({ config, env, cwd }), outboxCheck({ config, env })]
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
  const { url: boardUrl, problem } = checkBoardUrl(values['board-url'] ?? `https://${values.host}:${values.port}/api/board`)
  if (problem) throw new UsageError(`the board URL is refused: ${problem}. Nothing was written.`)
  const allowlist = values.allowlist ? values.allowlist.split(',').map((owner) => owner.trim()).filter(Boolean) : [values['github-login']]
  return { dryRun: values['dry-run'], settings: { mode: values.mode, githubLogin: values['github-login'], allowlist, boardUrl } }
}

const configHome = (env) => dirname(dirname(configPath(env)))
const stateHome = (env) => dirname(stateDir(env))
const shimPath = () => join(homedir(), '.local', 'bin', 'devchat')
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`
const systemdQuote = (value) => `"${value.replace(/[\\"]/gu, '\\$&').replaceAll('%', '%%')}"`
const xmlEscape = (value) => value.replace(/[<>&'"]/gu, (character) => `&#${character.codePointAt(0)};`)

// Setup writes this line into every shim, unit, and plist it installs, and replaces only a file
// that carries it.
const managedMarker = 'devchat-managed: devchat setup wrote this file and replaces it when rerun'

const shimScript = (env) => `#!/bin/sh
# ${managedMarker}
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
  [`${timerUnit}.service`]: `# ${managedMarker}
[Unit]
Description=devchat sync

[Service]
Type=oneshot
Environment=${systemdQuote(`XDG_CONFIG_HOME=${configHome(env)}`)} ${systemdQuote(`XDG_STATE_HOME=${stateHome(env)}`)}
ExecStart=/bin/sh ${systemdQuote(shimPath())} sync
`,
  [`${timerUnit}.timer`]: `# ${managedMarker}
[Unit]
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
<!-- ${managedMarker} -->
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

// Setup writes each file by an atomic rename, which needs write and search access to its folder,
// or, for a folder it creates, to the nearest folder that exists.
const canWriteIn = (path) => {
  let folder = dirname(path)
  while (!existsSync(folder)) folder = dirname(folder)
  try {
    accessSync(folder, constants.W_OK | constants.X_OK)
    return statSync(folder).isDirectory()
  } catch {
    return false
  }
}

// The exact marker lines setup writes: a shell or unit comment, or an XML comment in a plist.
const managedLines = [`# ${managedMarker}`, `<!-- ${managedMarker} -->`]

/** Returns why setup must not write `path`, or null. A `managed` file must carry a marker line. */
const destinationProblem = ({ path, managed = false, json = false }) => {
  if (!canWriteIn(path)) return 'its folder is not writable and searchable'
  let stat
  try {
    stat = lstatSync(path)
  } catch (error) {
    return error.code === 'ENOENT' ? null : error.code
  }
  if (!stat.isFile()) return 'not a regular file'
  const text = readFileSync(path, 'utf8')
  if (managed && !text.split('\n').some((line) => managedLines.includes(line))) return 'not written by devchat setup'
  if (json && !isRecord(parseJson(text))) return 'not a JSON object'
  return null
}

const fileStep = ({ path, content, mode = 0o644 }) => ({
  describe: `write ${path}`,
  path,
  preflight: () => destinationProblem({ path, managed: true }),
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
    path,
    preflight: () => {
      const problem = destinationProblem({ path, json: true })
      if (problem || !existsSync(path)) return problem
      const existing = readJson(path)
      return isRecord(existing) ? machineProblem(existing.machine) : null
    },
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

const pluginPathStep = (env) => {
  const path = pluginPathFile(env)
  return {
    describe: `write ${path}: plugin root and version`,
    path,
    preflight: () => destinationProblem({ path }),
    run: () => refreshPluginPath({ root: pluginRoot, version: pluginVersion(pluginRoot), env }),
  }
}

// Checks every file setup would write before it writes any. Returns the refused paths.
const preflight = ({ steps, out }) => steps.filter((step) => step.preflight).flatMap((step) => {
  const problem = step.preflight()
  out(`preflight ${step.path}: ${problem ? `refused, ${problem}` : existsSync(step.path) ? 'ok, setup updates it' : 'ok, new'}`)
  return problem ? [step.path] : []
})

const setup = async ({ args, env, cwd, out }) => {
  const { dryRun, settings } = readSetupArgs(args)
  const steps = [configStep({ env, settings }), pluginPathStep(env), fileStep({ path: shimPath(), content: shimScript(env), mode: 0o755 }), ...timerSteps(env)]
  const refused = preflight({ steps, out })
  if (refused.length > 0) {
    out(`setup changed nothing. Move each refused file aside, or remove it, and run setup again: ${refused.join(', ')}`)
    return 1
  }
  if (dryRun) {
    for (const step of steps) out(`would ${step.describe}`)
    out('would run devchat doctor')
    return 0
  }
  for (const step of steps) {
    out(step.describe)
    try {
      step.run()
    } catch (error) {
      out(`FAIL ${error.message}`)
      out('setup stopped: the steps after this one did not run')
      return 1
    }
  }
  out('devchat doctor:')
  return doctor({ args: [], env, cwd, out })
}

// Admin: the todos import and its rollback list (spec §9). The old store is the `todos` skill's
// private `<login>/todos` repo. Import only reads it with `gh`; the rollback list only prints the
// `gh` commands that replay this machine's changes there. Neither changes that repo.

const importedRid = (number) => `todo:gh:${number}`
// The issue number of an imported todo's rid, or undefined for any other rid.
const importedIssue = (rid) => /^todo:gh:(\d+)$/u.exec(rid)?.[1]

/** Runs a reading `gh` command and returns its stdout, or throws with gh's first error line. */
const runGh = ({ args, env }) => {
  const result = spawnSync('gh', args, { encoding: 'utf8', env, timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.status !== 0) {
    const reason = (result.error?.message ?? result.stderr ?? '').trim().split('\n')[0] || `exit ${result.status}`
    throw new UsageError(`gh ${args.slice(0, 2).join(' ')} failed: ${reason}`)
  }
  return result.stdout
}

// The todos skill's repo: `<login>/todos` for the signed-in `gh` login, and only while it is private.
const todosRepoOf = (env) => {
  const login = runGh({ args: ['api', 'user', '--jq', '.login'], env }).trim()
  if (!new RegExp(`^${githubOwner}$`, 'u').test(login)) throw new UsageError('gh api user returned no GitHub login')
  const repo = `${login}/todos`
  const visibility = runGh({ args: ['repo', 'view', repo, '--json', 'visibility', '--jq', '.visibility'], env }).trim()
  if (visibility !== 'PRIVATE') throw new UsageError(`${repo} is not a private repository (${visibility || 'unknown'})`)
  return repo
}

const issueLimit = 1000
const openIssues = ({ repo, env }) => {
  const issues = JSON.parse(runGh({ args: ['issue', 'list', '-R', repo, '--state', 'open', '--limit', String(issueLimit), '--json', 'number,title,body,createdAt'], env }))
  if (!Array.isArray(issues)) throw new UsageError('gh issue list returned no list. Nothing was imported.')
  if (issues.length >= issueLimit) throw new UsageError(`${repo} has ${issueLimit} or more open issues, more than one import reads. Nothing was imported.`)
  return issues.sort((a, b) => a.number - b.number)
}

// The `From:` value of an issue body (`From: <repo or thread> · Host: <host>`), or ''.
const fromOf = (body) => /^From:[ \t]*(.*?)[ \t]*(?:·.*)?$/mu.exec(body ?? '')?.[1] ?? ''

// The GitHub identity a `From:` value names, `github.com/<owner>/<repo>`, or null. Only the strict
// remote forms parse, an `owner/repo` pair as its https URL.
const fromIdentity = (from) => {
  const identity = normalizeRemote(/^[^/\s:]+\/[^/\s:]+$/u.test(from) ? `https://github.com/${from}` : from)
  return identity.startsWith('github.com/') ? identity : null
}

// The todos repo the first approved import claimed, so a later import never mixes another
// account's issue numbers into the same `todo:gh:<n>` rids.
const importSourcePath = (env) => join(stateDir(env), 'import-source.json')

/** Claims the import source with an exclusive create, or checks the one already claimed. */
const claimImportSource = ({ env, repo }) => {
  if (writeExclusive(importSourcePath(env), `${JSON.stringify({ schema: 1, repo }, null, 2)}\n`)) return
  const claimed = readJson(importSourcePath(env)).repo
  if (!sameRepo(claimed, repo)) throw new UsageError(`this machine imported from ${claimed}, and this import reads ${repo}: switch gh to the account that owns ${claimed}. Nothing was imported.`)
}

/**
 * Decides one issue: `{ skip }` with the reason it is not imported, or `{ board: repo }` or
 * `{ local: identity }`. A board placement needs a `From:` that is an allowlisted github.com repo,
 * and an intent within the board's limit; the board keeps the first post of a rid, so a rerun
 * posts nothing new. Import is not a routed write (§5). `local` holds this machine's local rids.
 */
const planIssue = ({ issue, local, config }) => {
  const rid = importedRid(issue.number)
  if (local.has(rid)) return { rid, skip: 'already imported, kept local' }
  const title = typeof issue.title === 'string' ? issue.title.trim() : ''
  if (title === '' || title.length > maxTextLength) return { rid, skip: 'refused: the title is empty or too long' }
  const titleReason = guardReason(title)
  if (titleReason) return { rid, skip: `refused: ${titleReason} in the title` }
  const bodyReason = guardReason(issue.body ?? '')
  if (bodyReason) return { rid, title, skip: `refused: ${bodyReason} in the body` }
  const from = fromOf(issue.body)
  const identity = fromIdentity(from)
  const repo = allowlistedRepo({ identity, allowlist: config.allowlist })
  if (repo === null) return { rid, title, from, local: identity ?? undefined }
  const fields = { kind: 'todo', channel: todoChannel, text: title, repo, machine: config.machine }
  if (intentSize({ fields, rid, config }) > boardTextLimit) return { rid, title, skip: 'refused: too long for the board' }
  return { rid, title, from, board: repo, fields }
}

const previewLine = ({ issue, plan }) => {
  const where = plan.skip ?? (plan.board ? `board (${plan.board})` : 'this machine only')
  const title = plan.title === undefined ? '' : `  ${plan.title}`
  return `#${issue.number}  ${where}${title}${plan.from === undefined ? '' : `  From: ${plan.from || '(none)'}`}`
}

// Reads one line from stdin, for the approval prompt; '' at end of input.
const readLine = () => {
  const byte = Buffer.alloc(1)
  const bytes = []
  for (;;) {
    let count
    try {
      count = readSync(0, byte, 0, 1, null)
    } catch (error) {
      if (error.code === 'EAGAIN') continue
      if (error.code === 'EOF') count = 0
      else throw error
    }
    if (count === 0 || byte[0] === 0x0a) return Buffer.from(bytes).toString('utf8')
    bytes.push(byte[0])
  }
}

// Saves a local import only when no record holds its rid, through an exclusive link: an import
// approved from an older preview never overwrites a todo another import saved, and maybe resolved.
const saveLocalImport = ({ plan, config, env }) => writeExclusive(
  join(localDir(env), `${plan.rid}.json`),
  `${JSON.stringify(localRoot({ kind: 'todo', text: plan.title, labels: {}, identity: plan.local, config, rid: plan.rid }), null, 2)}\n`,
)

const saveImported = async ({ plans, config, env, out }) => {
  const queued = []
  let saved = 0
  for (const plan of plans) {
    if (plan.board) queued.push({ rid: plan.rid, name: queueIntent({ fields: plan.fields, repo: plan.board, rid: plan.rid, config, env }).name })
    else if (saveLocalImport({ plan, config, env })) saved += 1
    else out(`${plan.rid}: already imported, kept as it is`)
  }
  out(`imported ${queued.length + saved}: ${queued.length} queued for the board, ${saved} saved on this machine only`)
  if (queued.length === 0) return
  const outcomes = new Map()
  const result = await runSync({ config, env, signal: AbortSignal.timeout(postWriteSyncMs), outcomes }).catch((error) => ({ brief: error.message }))
  const reason = result.locked ? 'another sync is running' : result.brief
  for (const { rid, name } of queued) out(`${rid}: ${outcomeText({ outcome: outcomes.get(name), reason })}`)
}

// A short digest of what the preview showed: the source repo, the mode, board, and machine name
// (the profile the posts carry), and each issue's number, title, raw
// `From:` line, body guard result, and destination with its identity. `--yes` must name it, so an
// agent imports only the set the user approved.
const previewDigest = ({ repo, config, plans }) => createHash('sha256').update(JSON.stringify([repo, config.mode, config.boardUrl, config.machine, ...plans.map(({ issue, plan }) => [
  issue.number, issue.title, /^From:.*$/mu.exec(issue.body ?? '')?.[0] ?? '', guardReason(issue.body ?? '') ?? 'ok',
  plan.skip ?? (plan.board ? 'board' : 'local'), plan.board ?? plan.local ?? null,
])])).digest('hex').slice(0, 12)

// Import runs in mode `readwrite` only, right after a sync that succeeded, so the preview and the
// board placement read the board as it is.
const syncBeforeImport = async ({ config, env }) => {
  if (config.mode !== 'readwrite') throw new UsageError(`import runs only in mode readwrite, on one machine; this one is in mode ${config.mode}. Nothing was imported.`)
  const result = await runSync({ config, env })
  if (result.locked) throw new UsageError('another devchat sync holds the outbox lock: run import again when it ends. Nothing was imported.')
  if (result.stopped) throw new UsageError(`import syncs first, and that sync stopped: ${result.stopped}. Nothing was imported.`)
}

/**
 * `devchat admin import [--yes <digest>]` (spec §9): syncs, previews every open issue of the todos
 * repo with its `From:` line, then, once approved, saves each as a todo with rid `todo:gh:<n>`.
 */
// Reads the todos repo and plans every issue against `config` and this machine's local records.
const importPreview = ({ config, env }) => {
  const repo = todosRepoOf(env)
  const issues = openIssues({ repo, env })
  const local = new Set(readLocalItems(env).map(({ rid }) => rid))
  const plans = issues.map((issue) => ({ issue, plan: planIssue({ issue, local, config }) }))
  return { repo, issues, plans, digest: previewDigest({ repo, config, plans }) }
}

const printPreview = ({ preview: { repo, issues, plans, digest }, out }) => {
  out(`${repo}: ${issues.length} open issue(s)`)
  for (const entry of plans) out(previewLine(entry))
  out(`preview digest: ${digest}`)
}

/**
 * Re-checks an approved preview before any write. The `gh` account, the config (mode, board,
 * allowlist), the issues, and the local records may have changed while the prompt waited: any change
 * to what the preview showed refuses the import and prints the fresh preview.
 */
const recheckImport = ({ preview, env, out }) => {
  const config = readConfig(env)
  if (config.mode !== 'readwrite') throw new UsageError(`the mode changed to ${config.mode} since the preview: import runs only in mode readwrite. Nothing was imported.`)
  const fresh = importPreview({ config, env })
  if (!sameRepo(fresh.repo, preview.repo)) throw new UsageError(`gh now resolves to ${fresh.repo}, not ${preview.repo}, the repo this preview read. Nothing was imported.`)
  if (fresh.digest === preview.digest) return config
  printPreview({ preview: fresh, out })
  throw new UsageError(`the config, the issues, or this machine's records changed since the approved preview (digest ${preview.digest}): review the fresh preview above, and import again. Nothing was imported.`)
}

const adminImport = async ({ args, env, out, ask }) => {
  const approved = args[0] === '--yes' && args.length === 2 ? args[1] : null
  if (args.length > 0 && approved === null) throw new UsageError('usage: devchat admin import [--yes <digest>]')
  await syncBeforeImport({ config: readConfig(env), env })
  const preview = importPreview({ config: readConfig(env), env })
  printPreview({ preview, out })
  const { repo, plans, digest } = preview
  const chosen = plans.map(({ plan }) => plan).filter((plan) => !plan.skip)
  if (chosen.length === 0) {
    out('Nothing to import.')
    return 0
  }
  if (approved !== null && approved !== digest) {
    out(`This preview's digest is ${digest}, not ${approved}: the issues changed since the approved preview. Show the user this preview, and run import --yes ${digest} once they approve it. Nothing was imported.`)
    return 1
  }
  if (approved === null) {
    out(`Import ${chosen.length} todo(s)? [y/N]`)
    if (!/^y(?:es)?$/iu.test(ask().trim())) {
      out('Nothing was imported.')
      return 1
    }
  }
  const config = recheckImport({ preview, env, out })
  claimImportSource({ env, repo })
  await saveImported({ plans: chosen, config, env, out })
  return 0
}

// Control characters to spaces, so a value from the config or the board keeps a command on its line.
const flat = (value) => String(value).replace(/\p{Cc}/gu, ' ')

// The rollback list. Before the import every todo lived in GitHub, so the rid decides each line:
// a resolved `todo:gh:<n>` is closed, and an open todo with any other rid is created. Every line is
// safe to run twice and from every machine: a close is, and a create first looks for an issue that
// already carries its `devchat-rid:` line, through the list API, which sees a new issue at once.
// The create runs only when that list succeeded, so a failed list creates nothing.
const createCommand = ({ rid, text, body, repo }) => {
  const marker = `devchat-rid: ${flat(rid)}`
  return `out=$(gh issue list -R ${repo} --state all --limit 1000 --json body --jq '.[].body') && { printf '%s\\n' "$out" | grep -qxF ${shellQuote(marker)} || gh issue create -R ${repo} --title ${shellQuote(oneLine(flat(text), Infinity))} --body "$(printf '%s\\n\\n%s' ${shellQuote(flat(body))} ${shellQuote(marker)})"; }`
}

/** The line for one todo: `{ op, rid, line }`, or none. */
const rollbackLine = ({ item, where, host, repo }) => {
  const issue = importedIssue(item.rid)
  if (issue !== undefined) {
    if (!isResolved(item.labels)) return []
    const reason = item.labels.status === 'done' ? 'completed' : shellQuote('not planned')
    return [{ op: 'close', rid: item.rid, line: `close ${item.rid} ${where} gh issue close ${issue} -R ${repo} --reason ${reason}` }]
  }
  if (!isOpen(item)) return []
  const command = createCommand({ rid: item.rid, text: item.text, body: `From: ${item.labels.repo ?? 'devchat'} · Host: ${host}`, repo })
  return [{ op: 'create', rid: item.rid, line: `create ${item.rid} ${where} ${command}` }]
}

// The line an intent this machine queued or sent, and the board has not applied, stands for: a
// todo root is created, and a resolve of an imported todo closes its issue.
const intentLine = ({ intent, where, repo }) => {
  if (intent.kind === 'todo') return rollbackLine({ item: { rid: intent.rid, text: intent.text, labels: { status: 'open', repo: intent.repo } }, where, host: intent.machine, repo })
  if (isResolveKind(intent.kind)) return rollbackLine({ item: { rid: intent.root, labels: { status: intent.kind === 'done' ? 'done' : 'dropped' } }, where, repo })
  return []
}

/**
 * One read-only pull of the board: its todos, and the `sent/` entries its `applied` cursor does not
 * cover yet. Returns `{ items, unapplied }`, or `{ reason }` when there is no board to pull.
 */
const pullForExport = async ({ config, sent }) => {
  if (config.mode === 'off' || !config.boardUrl) return { reason: config.mode === 'off' ? 'mode off' : 'no board URL' }
  try {
    const client = boardClient({ boardUrl: config.boardUrl })
    const epoch = await readBoardEpoch(client)
    const applied = await readApplied(client)
    const { items, resolved } = await pullSnapshotItems(client)
    const unapplied = sent.filter((entry) => !(sentHere({ entry, config, epoch }) && isCovered({ id: entry?.inboxId, applied })))
    return { items: [...items, ...resolved].filter((item) => item.channel === todoChannel), unapplied }
  } catch (error) {
    if (!(error instanceof SyncStop)) throw error
    return { reason: `the pull failed: ${error.message}` }
  }
}

// The repo export names: the one `gh` resolves to now, which must be the one import claimed here.
const exportRepo = (env) => {
  const repo = todosRepoOf(env)
  const claimed = existsSync(importSourcePath(env)) ? readJson(importSourcePath(env)).repo : null
  if (claimed !== null && !sameRepo(claimed, repo)) throw new UsageError(`this machine imported from ${claimed}, and gh now resolves to ${repo}: switch gh to the account that owns ${claimed}, then export again`)
  return repo
}

const entriesIn = (dir) => outboxNames(dir).map((name) => readOutboxEntry(join(dir, name)).entry)

/** Every rollback line this machine knows, from each source, without a todo a queued resolve cancels. */
const exportLines = ({ pull, queued, config, env, repo }) => {
  const intents = [
    ...(pull.unapplied ?? []).map((entry) => ({ intent: intentOfEntry(entry), where: 'sent' })),
    ...queued.map((entry) => ({ intent: intentOfEntry(entry), where: 'pending' })),
  ].filter(({ intent }) => intent)
  // A todo never imported that a queued or unapplied resolve ends needs no issue.
  const cancelled = new Set(intents.filter(({ intent }) => isResolveKind(intent.kind) && importedIssue(intent.root) === undefined).map(({ intent }) => intent.root))
  return [
    ...(pull.items ?? []).flatMap((item) => rollbackLine({ item, where: 'board', host: item.labels.machine ?? config.machine, repo })),
    ...intents.flatMap(({ intent, where }) => intentLine({ intent, where, repo })),
    ...readLocalItems(env).filter((item) => item.channel === todoChannel).flatMap((item) => rollbackLine({ item, where: 'local', host: item.labels.host ?? config.machine, repo })),
  ].filter(({ op, rid }) => !(op === 'create' && cancelled.has(rid)))
}

/**
 * `devchat admin export --rollback` (spec §9): prints the replay list. It reads the todos repo's
 * name with `gh`, as import does, and pulls the board once, read-only; it writes nothing.
 */
const adminExport = async ({ args, env, out }) => {
  if (args.length !== 1 || args[0] !== '--rollback') throw new UsageError('usage: devchat admin export --rollback')
  const config = readConfig(env)
  const repo = exportRepo(env)
  // The outbox first, then `sent/`: a sync that moves an entry between the two reads leaves it in
  // both lists, never in neither, and its create line is safe to run twice.
  const queued = entriesIn(outboxDir(env))
  const sent = entriesIn(sentDir(env))
  const pull = await pullForExport({ config, sent })
  out(`# devchat rollback list for ${repo}. Every list you replay must name this same repo.`)
  out(pull.items
    ? '# Board lines: pulled from the board just now.'
    : `# Board lines and ${sent.length} sent/ entries are left out (${pull.reason}): this list may be incomplete, but every line is still safe to run.`)
  out("# Replay: run every line from every machine's list, in order. A create first checks the repo for its devchat-rid line, and a close is safe to repeat.")
  out('# Each line is <op> <rid> <where> <command>. Run each command, everything after the third space, with sh.')
  for (const { line } of exportLines({ pull, queued, config, env, repo })) out(line)
  return 0
}

const adminCommands = { import: adminImport, export: adminExport }
const admin = ({ args: [subcommand, ...args], ...context }) => {
  if (!Object.hasOwn(adminCommands, subcommand ?? '')) throw new UsageError('usage: devchat admin import [--yes] | export --rollback')
  return adminCommands[subcommand]({ args, ...context })
}

const commands = { work, todo, guard, doctor, sync, setup, admin }

/** Runs one CLI invocation and returns its exit code. */
const main = async ({ argv, env = process.env, cwd = process.cwd(), out = (line) => process.stdout.write(`${line}\n`), stdin = () => readFileSync(0, 'utf8'), ask = readLine }) => {
  const [command, ...args] = argv
  try {
    if (!Object.hasOwn(commands, command ?? '')) throw new UsageError('usage: devchat <work|todo|sync|doctor|setup|guard|admin> ...')
    return (await commands[command]({ args, env, cwd, out, stdin, ask })) ?? 0
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    process.stderr.write(`devchat: ${error.message}\n`)
    return 1
  }
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) process.exitCode = await main({ argv: process.argv.slice(2) })
