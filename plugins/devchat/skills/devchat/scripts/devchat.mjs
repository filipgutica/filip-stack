#!/usr/bin/env node

// devchat client: the write router, the text guard, local todos, and local checks. This version
// has no network code: every write stays in the state directory, and a write the router sends to
// the board is refused until `devchat setup` and the outbox exist.
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { accessSync, constants, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
// A session key arrives from hook stdin and from the environment, so its file name is a hash.
const sessionPath = ({ key, env }) => join(stateDir(env), 'sessions', `${createHash('sha256').update(key).digest('hex').slice(0, 32)}.json`)

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const writeAtomic = (path, content) => {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  writeFileSync(temporary, content, { mode: 0o600 })
  renameSync(temporary, path)
}
const writeJsonAtomic = (path, value) => writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`)

// Config

const validateConfig = (config) => {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return 'config must be a JSON object'
  if (config.mode !== undefined && !modes.includes(config.mode)) return `mode must be one of ${modes.join(', ')}`
  if (config.githubLogin !== undefined && typeof config.githubLogin !== 'string') return 'githubLogin must be a string'
  if (config.allowlist !== undefined && !(Array.isArray(config.allowlist) && config.allowlist.every((owner) => typeof owner === 'string'))) {
    return 'allowlist must be an array of GitHub owners'
  }
  if (config.machine !== undefined && typeof config.machine !== 'string') return 'machine must be a string'
  return null
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
  }
}

// Repository identity

/** Normalizes a git remote to `host/path`, as Field Guide does: `git@github.com:o/r.git` gives `github.com/o/r`. */
const normalizeRemote = (remote) => {
  if (!remote) return ''
  const scpStyle = remote.match(/^[^@]+@([^:]+):(.+)$/)
  if (scpStyle) {
    return `${scpStyle[1].toLowerCase()}/${scpStyle[2]}`.replace(/\/+$/, '').replace(/\.git$/i, '')
  }
  const withoutTransport = remote.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^.*@/, '')
  const firstSlash = withoutTransport.indexOf('/')
  const normalized = firstSlash > 0
    ? `${withoutTransport.slice(0, firstSlash).toLowerCase()}${withoutTransport.slice(firstSlash)}`
    : withoutTransport
  return normalized.replace(/\/+$/, '').replace(/\.git$/i, '')
}

// An inherited GIT_DIR or GIT_WORK_TREE would make git describe another repository.
const gitEnv = (env) => Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_')))

/** Returns the normalized `origin` of the repository containing `cwd`, or '' outside a repository or without an origin. */
const repoIdentityOf = ({ cwd, env = process.env }) => {
  const result = spawnSync('git', ['-C', cwd, 'remote', 'get-url', 'origin'], {
    encoding: 'utf8', env: gitEnv(env), timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'],
  })
  return result.status === 0 ? normalizeRemote(result.stdout.trim()) : ''
}

/**
 * Returns `owner/repo` when the identity is a github.com repository whose owner is on the
 * allowlist, else null. A host alias, a port, a nested path, or no remote is never allowlisted.
 */
const allowlistedRepo = ({ identity, allowlist }) => {
  const match = /^github\.com\/([^/]+)\/([^/]+)$/u.exec(identity ?? '')
  if (!match) return null
  const owner = match[1].toLowerCase()
  return allowlist.some((entry) => entry.toLowerCase() === owner) ? `${match[1]}/${match[2]}` : null
}

// Sessions

/**
 * Reads the session key the harness set: Claude Code's `CLAUDE_CODE_SESSION_ID` or Codex's
 * `CODEX_THREAD_ID`. Both set to different values is ambiguous and gives no key.
 */
const sessionKeyOf = (env = process.env) => {
  const found = ['CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID'].filter((name) => env[name])
  if (found.length === 0) return { key: null, source: null }
  if (found.length === 2 && env[found[0]] !== env[found[1]]) return { key: null, source: 'ambiguous' }
  return { key: env[found[0]], source: found[0] }
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
 * Records the repository identity of a session's starting directory under its session key. A
 * later start under the same key from another identity marks the record conflicting, for good.
 */
export const recordSession = ({ key, cwd, env = process.env, now = new Date() }) => {
  const repo = repoIdentityOf({ cwd, env })
  const existing = readSessionRecord({ key, env })
  if (existing && !existing.conflicting && existing.repo === repo) return
  writeJsonAtomic(sessionPath({ key, env }), {
    schema: 1,
    repo: existing ? existing.repo : repo,
    conflicting: existing !== null,
    recordedAt: now.toISOString(),
  })
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
 * Decides where a write goes (spec §5). Unknown provenance is settled first: no session key, no
 * session record, or a conflicting record keeps the write on this machine. A board write needs
 * mode `readwrite` and both the session's starting repo and the working directory allowlisted.
 */
export const route = ({ mode, sessionKey, record, cwdIdentity, allowlist }) => {
  if (!sessionKey) return local('no session key')
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

const isOpen = (item) => ['open', 'blocked'].includes(item.labels.status)

const findOpenTodo = ({ prefix, env }) => {
  if (!prefix) throw new UsageError('give the todo rid, or a unique prefix of it')
  const matches = readLocalTodos(env).filter((item) => isOpen(item) && item.rid.startsWith(prefix))
  if (matches.length === 1) return matches[0]
  if (matches.length === 0) throw new UsageError(`no open todo on this machine matches ${prefix}`)
  throw new UsageError(`${prefix} matches ${matches.length} todos: ${matches.map(({ rid }) => rid).join(', ')}`)
}

const requireText = (text) => {
  if (typeof text !== 'string' || text.trim().length === 0) throw new UsageError('todo text is required')
  if (text.length > maxTextLength) throw new UsageError(`todo text exceeds ${maxTextLength} characters`)
  const reason = guardReason(text)
  if (reason) throw new UsageError(`the guard refused the text: ${reason}. Rewrite it without that and try again.`)
  return text
}

const todoAdd = ({ args, env, cwd, out }) => {
  if (args.length !== 1) throw new UsageError('usage: devchat todo add "<text>"')
  const text = requireText(args[0])
  const config = readConfig(env)
  const decision = routeHere({ config, env, cwd })
  if (decision.target === 'board') {
    throw new UsageError('this write goes to the board, and this version cannot send it yet: board writes arrive with devchat setup. Nothing was saved.')
  }
  const now = new Date().toISOString()
  const rid = `todo-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  writeJsonAtomic(join(localDir(env), `${rid}.json`), {
    rid, channel: todoChannel, text, labels: { rid, status: 'open', host: config.machine }, createdAt: now, updatedAt: now,
  })
  out(`${rid}: saved on this machine only (${decision.reason})`)
}

const todoList = ({ args, env, out }) => {
  if (args.length > 0) throw new UsageError('usage: devchat todo list')
  const open = readLocalTodos(env).filter(isOpen)
  if (open.length === 0) {
    out('No open todos on this machine.')
    return
  }
  for (const item of open) out(`${item.rid}  ${item.createdAt.slice(0, 10)}  ${item.text}`)
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
  todoCommands[subcommand]({ args, ...context })
}

const guard = ({ args, stdin }) => {
  if (args.length > 0) throw new UsageError('usage: devchat guard < text')
  const reason = guardReason(stdin())
  if (!reason) return 0
  process.stderr.write(`devchat guard: refused: ${reason}\n`)
  return 1
}

// Doctor: local checks only. It prints the session key's source and the route for this directory,
// so a reviewer can confirm in each harness that the hook's `session_id` matches the CLI's key.

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

const doctorChecks = ({ env, cwd }) => {
  let config
  try {
    config = readConfig(env)
  } catch (error) {
    return [{ ok: false, line: `config: ${error.message}` }]
  }
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

const doctor = ({ args, env, cwd, out }) => {
  if (args.length > 0) throw new UsageError('usage: devchat doctor')
  const checks = doctorChecks({ env, cwd })
  for (const { ok, line } of checks) out(`${ok ? 'ok  ' : 'FAIL'} ${line}`)
  return checks.every(({ ok }) => ok) ? 0 : 1
}

const commands = { todo, guard, doctor }

/** Runs one CLI invocation and returns its exit code. */
const main = ({ argv, env = process.env, cwd = process.cwd(), out = (line) => process.stdout.write(`${line}\n`), stdin = () => readFileSync(0, 'utf8') }) => {
  const [command, ...args] = argv
  try {
    if (!Object.hasOwn(commands, command ?? '')) throw new UsageError('usage: devchat <todo|guard|doctor> ...')
    return commands[command]({ args, env, cwd, out, stdin }) ?? 0
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    process.stderr.write(`devchat: ${error.message}\n`)
    return 1
  }
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) process.exitCode = main({ argv: process.argv.slice(2) })
