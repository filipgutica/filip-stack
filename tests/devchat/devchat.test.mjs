import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, beforeEach, test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { agentCommands, route } from '../../plugins/devchat/skills/devchat/scripts/devchat.mjs'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const pluginRoot = join(repoRoot, 'plugins/devchat')
const launcher = join(pluginRoot, 'skills/devchat/scripts/devchat.sh')
const preload = pathToFileURL(fileURLToPath(new URL('no-network.mjs', import.meta.url))).href
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const hookCommand = readJson(join(pluginRoot, 'hooks/hooks.json')).hooks.SessionStart[0].hooks[0].command
// A copy of devchat's `fixtures/guard.json` (filipgutica/devchat, a0e9293), kept byte-identical
// until `@filipgutica/devchat` publishes it. Refresh it from that repository; do not edit it here.
const guardFixture = readJson(fileURLToPath(new URL('fixtures/guard.json', import.meta.url)))

const allowed = 'example-owner'
const root = mkdtempSync(join(tmpdir(), 'devchat-'))
after(() => rmSync(root, { recursive: true, force: true }))

const makeRepo = (name, remote) => {
  const dir = join(root, 'repos', name)
  mkdirSync(dir, { recursive: true })
  execFileSync('git', ['init', '-q', dir])
  if (remote) execFileSync('git', ['-C', dir, 'remote', 'add', 'origin', remote])
  return dir
}
const repos = {
  allowed: makeRepo('allowed', `git@github.com:${allowed}/tools.git`),
  allowedHttps: makeRepo('allowed-https', `https://github.com/${allowed}/notes.git`),
  other: makeRepo('other', 'git@github.com:other-owner/service.git'),
  alias: makeRepo('alias', `git@github-alias:${allowed}/tools.git`),
  noRemote: makeRepo('no-remote'),
}

// A fresh home per test, with no session key inherited from the harness running the tests.
let home
let env
beforeEach(() => {
  home = mkdtempSync(join(root, 'home-'))
  env = {
    PATH: process.env.PATH,
    HOME: home,
    XDG_CONFIG_HOME: join(home, 'config'),
    XDG_STATE_HOME: join(home, 'state'),
    DEVCHAT_NODE: process.execPath,
    DEVCHAT_TEST_NETWORK_LOG: join(home, 'network.log'),
    NODE_OPTIONS: `--import=${preload}`,
  }
})
const stateDir = () => join(env.XDG_STATE_HOME, 'devchat')
const networkCalls = () => (existsSync(env.DEVCHAT_TEST_NETWORK_LOG) ? readFileSync(env.DEVCHAT_TEST_NETWORK_LOG, 'utf8').split('\n').filter(Boolean) : [])
const writeConfig = (config) => {
  mkdirSync(join(env.XDG_CONFIG_HOME, 'devchat'), { recursive: true })
  writeFileSync(join(env.XDG_CONFIG_HOME, 'devchat', 'config.json'), JSON.stringify(config))
}

// Runs the hook through the exact command hooks.json registers.
const runHook = ({ input, extraEnv = {} }) => spawnSync('/bin/sh', ['-c', hookCommand], {
  input, encoding: 'utf8', env: { ...env, PLUGIN_ROOT: pluginRoot, ...extraEnv },
})
const startSession = ({ key, cwd, source = 'startup' }) => {
  const result = runHook({ input: JSON.stringify({ session_id: key, cwd, hook_event_name: 'SessionStart', source }) })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '', 'the hook prints nothing')
}
const devchat = ({ args, cwd = repos.allowed, sessionEnv = {}, input = '' }) => spawnSync('/bin/sh', [launcher, ...args], {
  cwd, input, encoding: 'utf8', env: { ...env, ...sessionEnv },
})
const localTodos = () => {
  const dir = join(stateDir(), 'local')
  return existsSync(dir) ? readdirSync(dir).map((name) => readJson(join(dir, name))) : []
}

test('route decides by provenance first, then mode, then both allowlists', () => {
  const allowedRecord = { repo: `github.com/${allowed}/tools`, conflicting: false }
  const base = { mode: 'readwrite', sessionKey: 'k', record: allowedRecord, cwdIdentity: `github.com/${allowed}/notes`, allowlist: [allowed] }
  const rows = [
    [{}, { target: 'board', repo: `${allowed}/notes` }],
    [{ sessionKey: null }, { target: 'local', reason: 'no session key' }],
    [{ record: null }, { target: 'local', reason: 'no session record' }],
    [{ record: { ...allowedRecord, conflicting: true } }, { target: 'local', reason: 'conflicting session record' }],
    [{ mode: 'off' }, { target: 'local', reason: 'mode off' }],
    [{ mode: 'read' }, { target: 'local', reason: 'mode read' }],
    [{ record: { repo: 'github.com/other-owner/service', conflicting: false } }, { target: 'local', reason: 'the session started outside an allowlisted repo' }],
    [{ cwdIdentity: 'github.com/other-owner/service' }, { target: 'local', reason: 'the working directory is not an allowlisted repo' }],
    [{ cwdIdentity: `github-alias/${allowed}/tools` }, { target: 'local', reason: 'the working directory is not an allowlisted repo' }],
    [{ cwdIdentity: '' }, { target: 'local', reason: 'the working directory is not an allowlisted repo' }],
    [{ allowlist: [] }, { target: 'local', reason: 'the session started outside an allowlisted repo' }],
    [{ sessionKey: null, mode: 'off', record: null }, { target: 'local', reason: 'no session key' }],
  ]
  for (const [change, expected] of rows) assert.deepEqual(route({ ...base, ...change }), expected, JSON.stringify(change))
})

test('the CLI routes each source as the table says, with zero outbound requests', () => {
  const rows = [
    { name: 'allowlisted start and cwd', start: repos.allowed, cwd: repos.allowedHttps, target: 'board' },
    { name: 'non-allowlisted start, allowlisted cwd', start: repos.other, cwd: repos.allowed, reason: 'the session started outside an allowlisted repo' },
    { name: 'allowlisted start, non-allowlisted cwd', start: repos.allowed, cwd: repos.other, reason: 'the working directory is not an allowlisted repo' },
    { name: 'host alias start', start: repos.alias, cwd: repos.allowed, reason: 'the session started outside an allowlisted repo' },
    { name: 'start outside any remote', start: repos.noRemote, cwd: repos.allowed, reason: 'the session started outside an allowlisted repo' },
    { name: 'no session key', start: repos.allowed, cwd: repos.allowed, sessionEnv: {}, reason: 'no session key' },
    { name: 'no session record', cwd: repos.allowed, reason: 'no session record' },
    { name: 'conflicting record', start: repos.allowed, restart: repos.other, cwd: repos.allowed, reason: 'conflicting session record' },
    { name: 'two differing session keys', start: repos.allowed, cwd: repos.allowed, sessionEnv: { CLAUDE_CODE_SESSION_ID: 'row', CODEX_THREAD_ID: 'other' }, reason: 'no session key' },
  ]
  for (const row of rows) {
    rmSync(stateDir(), { recursive: true, force: true })
    writeConfig({ mode: 'readwrite', githubLogin: allowed })
    if (row.start) startSession({ key: 'row', cwd: row.start })
    if (row.restart) startSession({ key: 'row', cwd: row.restart })
    const result = devchat({ args: ['todo', 'add', 'Review the handoff.'], cwd: row.cwd, sessionEnv: row.sessionEnv ?? { CLAUDE_CODE_SESSION_ID: 'row' } })
    if (row.target === 'board') {
      assert.equal(result.status, 1, row.name)
      assert.match(result.stderr, /board writes arrive with devchat setup\. Nothing was saved\./u, row.name)
      assert.deepEqual(localTodos(), [], row.name)
    } else {
      assert.equal(result.status, 0, `${row.name}: ${result.stderr}`)
      assert.match(result.stdout, new RegExp(`saved on this machine only \\(${row.reason}\\)`, 'u'), row.name)
      assert.equal(localTodos().length, 1, row.name)
    }
    assert.deepEqual(networkCalls(), [], row.name)
  }
})

test('the hook records the stdin session_id that both harness keys read', () => {
  writeConfig({ mode: 'readwrite', githubLogin: allowed })
  const started = Date.now()
  startSession({ key: 'session-1', cwd: repos.allowed })
  assert.ok(Date.now() - started < 5000, 'the hook stays inside its 5 s budget')
  const [file] = readdirSync(join(stateDir(), 'sessions'))
  assert.doesNotMatch(file, /session-1/u, 'the file name is a hash of the key')
  assert.equal(readJson(join(stateDir(), 'sessions', file)).repo, `github.com/${allowed}/tools`)
  for (const sessionEnv of [{ CLAUDE_CODE_SESSION_ID: 'session-1' }, { CODEX_THREAD_ID: 'session-1' }]) {
    const doctor = devchat({ args: ['doctor'], sessionEnv })
    assert.match(doctor.stdout, new RegExp(`session key: ${Object.keys(sessionEnv)[0]}`, 'u'))
    assert.match(doctor.stdout, /session record: recorded/u)
    assert.match(doctor.stdout, new RegExp(`route here: board \\(${allowed}/tools\\)`, 'u'))
  }
  assert.deepEqual(networkCalls(), [], 'the hook and doctor import and call no network module')
})

test('a second start from another repo marks the record conflicting for good', () => {
  startSession({ key: 'k', cwd: repos.allowed })
  startSession({ key: 'k', cwd: repos.other })
  startSession({ key: 'k', cwd: repos.allowed })
  const [file] = readdirSync(join(stateDir(), 'sessions'))
  assert.deepEqual(
    (({ repo, conflicting }) => ({ repo, conflicting }))(readJson(join(stateDir(), 'sessions', file))),
    { repo: `github.com/${allowed}/tools`, conflicting: true },
  )
})

test('a compaction keeps the record, and a resume from another repo still conflicts', () => {
  const record = () => {
    const [file] = readdirSync(join(stateDir(), 'sessions'))
    return (({ repo, conflicting }) => ({ repo, conflicting }))(readJson(join(stateDir(), 'sessions', file)))
  }
  startSession({ key: 'k', cwd: repos.allowed })
  startSession({ key: 'k', cwd: repos.other, source: 'compact' })
  assert.deepEqual(record(), { repo: `github.com/${allowed}/tools`, conflicting: false })
  startSession({ key: 'k', cwd: repos.other, source: 'resume' })
  assert.deepEqual(record(), { repo: `github.com/${allowed}/tools`, conflicting: true })

  rmSync(stateDir(), { recursive: true, force: true })
  startSession({ key: 'k', cwd: repos.other, source: 'compact' })
  assert.deepEqual(record(), { repo: 'github.com/other-owner/service', conflicting: false }, 'a compaction fills a missing record')
})

test('the hook fails open, prints nothing, and opens no socket', () => {
  for (const input of ['not json', '', '{"cwd": 3}']) {
    const result = runHook({ input })
    assert.equal(result.status, 0, input)
    assert.equal(result.stdout, '', input)
  }
  // A state directory that cannot be created.
  writeFileSync(join(home, 'state-file'), '')
  const blocked = runHook({ input: JSON.stringify({ session_id: 'k', cwd: repos.allowed }), extraEnv: { XDG_STATE_HOME: join(home, 'state-file') } })
  assert.equal(blocked.status, 0)
  assert.equal(blocked.stdout, '')
  assert.match(blocked.stderr, /devchat session hook skipped/u)
  assert.deepEqual(networkCalls(), [])
})

test('the hook rewrites the plugin path file only when the version or root changed', () => {
  const pathFile = () => join(stateDir(), 'plugin-path')
  const { version } = readJson(join(pluginRoot, '.claude-plugin/plugin.json'))
  startSession({ key: 'k', cwd: repos.allowed })
  assert.equal(readFileSync(pathFile(), 'utf8'), `${pluginRoot}\n${version}\n`)

  const otherRoot = mkdtempSync(join(home, 'plugin-'))
  writeFileSync(pathFile(), `${otherRoot}\n${version}\n`)
  startSession({ key: 'k', cwd: repos.allowed })
  assert.equal(readFileSync(pathFile(), 'utf8'), `${otherRoot}\n${version}\n`, 'same version and a live root: unchanged')

  for (const stale of [`${otherRoot}\n0.0.1\n`, `${join(home, 'removed')}\n${version}\n`]) {
    writeFileSync(pathFile(), stale)
    startSession({ key: 'k', cwd: repos.allowed })
    assert.equal(readFileSync(pathFile(), 'utf8'), `${pluginRoot}\n${version}\n`, stale)
  }
})

test('guard exit codes match the shared fixture', () => {
  for (const { name, text, general } of guardFixture) {
    const result = devchat({ args: ['guard'], input: text })
    assert.equal(result.status, general ? 0 : 1, `${name}: ${result.stderr}`)
    if (!general) assert.match(result.stderr, /refused: /u, name)
  }
  const refused = devchat({ args: ['todo', 'add', 'api_key=<secret>'], sessionEnv: { CLAUDE_CODE_SESSION_ID: 'k' } })
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /guard refused the text: credential assignment/u)
  assert.deepEqual(localTodos(), [])
})

test('the skill lists exactly the agent commands this release ships', () => {
  const skill = readFileSync(join(pluginRoot, 'skills/devchat/SKILL.md'), 'utf8')
  const block = skill.match(/## Agent command\n\n```text\n([\s\S]*?)```/u)?.[1] ?? ''
  const listed = block.split('\n').filter(Boolean).map((line) => line.match(/^devchat ((?:[a-z]+ )*[a-z]+)/u)?.[1])
  assert.deepEqual(listed, agentCommands)
})

test('mode off runs every skill and admin command on this machine', () => {
  writeConfig({ mode: 'off', githubLogin: allowed })
  startSession({ key: 'k', cwd: repos.allowed })
  const sessionEnv = { CLAUDE_CODE_SESSION_ID: 'k' }
  assert.deepEqual(agentCommands, ['todo add'])

  const add = devchat({ args: ['todo', 'add', 'Rotate the staging deploy key.'], sessionEnv })
  assert.equal(add.status, 0, add.stderr)
  assert.match(add.stdout, /saved on this machine only \(mode off\)/u)
  const second = devchat({ args: ['todo', 'add', 'Drop the old fixture.'], sessionEnv })
  assert.equal(second.status, 0, second.stderr)
  const [first, other] = localTodos().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  assert.deepEqual(Object.keys(first.labels).sort(), ['host', 'rid', 'status'])

  const list = devchat({ args: ['todo', 'list'] })
  assert.equal(list.status, 0)
  assert.match(list.stdout, /Rotate the staging deploy key\.[\s\S]*Drop the old fixture\./u)

  assert.equal(devchat({ args: ['todo', 'done', first.rid.slice(0, -2)] }).status, 0)
  assert.equal(devchat({ args: ['todo', 'drop', other.rid] }).status, 0)
  assert.deepEqual(localTodos().map(({ labels }) => labels.status).sort(), ['done', 'dropped'])
  assert.match(devchat({ args: ['todo', 'list'] }).stdout, /No open todos on this machine\./u)
  assert.equal(devchat({ args: ['todo', 'done', first.rid] }).status, 1, 'a resolved todo is not open')

  const doctor = devchat({ args: ['doctor'], sessionEnv })
  assert.equal(doctor.status, 0, doctor.stdout)
  assert.match(doctor.stdout, /route here: this machine only \(mode off\)/u)
  assert.equal(devchat({ args: ['guard'], input: 'Check the queue.' }).status, 0)
  assert.deepEqual(networkCalls(), [])
})

test('without a config the mode is off; an invalid config writes nothing', () => {
  const add = devchat({ args: ['todo', 'add', 'Review the handoff.'], sessionEnv: { CLAUDE_CODE_SESSION_ID: 'k' } })
  assert.equal(add.status, 0, add.stderr)
  assert.match(add.stdout, /saved on this machine only \(no session record\)/u)
  assert.match(devchat({ args: ['doctor'] }).stdout, /mode: off/u)

  rmSync(stateDir(), { recursive: true, force: true })
  writeConfig({ mode: 'write' })
  const invalid = devchat({ args: ['todo', 'add', 'Review the handoff.'] })
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /mode must be one of off, read, readwrite/u)
  assert.deepEqual(localTodos(), [])
  assert.equal(devchat({ args: ['doctor'] }).status, 1)
})

test('doctor fails when the state directory is not writable', () => {
  writeFileSync(join(home, 'state-file'), '')
  chmodSync(join(home, 'state-file'), 0o400)
  const doctor = spawnSync('/bin/sh', [launcher, 'doctor'], { encoding: 'utf8', env: { ...env, XDG_STATE_HOME: join(home, 'state-file') } })
  assert.equal(doctor.status, 1)
  assert.match(doctor.stdout, /FAIL state directory/u)
})

test('the plugin registers its hook and both marketplace entries', () => {
  const read = (path) => readJson(join(repoRoot, path))
  assert.deepEqual(read('.claude-plugin/marketplace.json').plugins.find(({ name }) => name === 'devchat'), { name: 'devchat', source: './plugins/devchat' })
  assert.deepEqual(read('.agents/plugins/marketplace.json').plugins.find(({ name }) => name === 'devchat'), {
    name: 'devchat',
    source: { source: 'local', path: './plugins/devchat' },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Productivity',
  })
  const hooks = read('plugins/devchat/hooks/hooks.json').hooks
  assert.deepEqual(Object.keys(hooks), ['SessionStart'])
  assert.equal(hooks.SessionStart[0].matcher, undefined, 'every start, resume included, reaches the hook')
  assert.match(hookCommand, /scripts\/run-node\.sh" --fail-open "\$\{PLUGIN_ROOT:-\$\{CLAUDE_PLUGIN_ROOT\}\}\/hooks\/devchat-session\.mjs"/u)
})
