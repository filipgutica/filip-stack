import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startBoardServer } from '@filipgutica/devchat/testing'
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
// A board URL on a closed loopback port: a readwrite config needs one, and these tests never reach it.
const readwrite = { mode: 'readwrite', githubLogin: allowed, boardUrl: 'http://127.0.0.1:9/api/board' }
const root = mkdtempSync(join(tmpdir(), 'devchat-'))
after(() => rmSync(root, { recursive: true, force: true }))

// A stand-in for `systemctl` on PATH, so no test touches the real user manager. It logs each call
// in the test's home, and reports the timer active once `enable` ran there.
const fakeBin = join(root, 'bin')
mkdirSync(fakeBin)
writeFileSync(join(fakeBin, 'systemctl'), `#!/bin/sh
printf '%s\\n' "$*" >> "$HOME/systemctl.log"
case "$*" in
  *enable*) touch "$HOME/timer-enabled" ;;
  *is-active*) if [ -f "$HOME/timer-enabled" ]; then echo active; else echo inactive; exit 3; fi ;;
esac
`)
chmodSync(join(fakeBin, 'systemctl'), 0o755)

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
// Remotes that only look like an allowlisted github.com repository.
const lookalikes = {
  'another host carrying a github path': `https://git.example.test/team@github.com/${allowed}/tools.git`,
  'a relative path': `github.com/${allowed}/tools`,
  'a query string': `https://github.com/${allowed}/tools?ref=main`,
  'a fragment': `https://github.com/${allowed}/tools#main`,
  'user information on https': `https://token@github.com/${allowed}/tools.git`,
  'a port': `ssh://git@github.com:2222/${allowed}/tools.git`,
  'a nested path': `https://github.com/${allowed}/tools/extra`,
}
for (const [index, remote] of Object.values(lookalikes).entries()) repos[`lookalike${index}`] = makeRepo(`lookalike-${index}`, remote)
// A host alias that `url.*.insteadOf` rewrites to github.com, and a github.com URL rewritten away.
repos.rewrittenAlias = makeRepo('rewritten-alias', `git@github-alias:${allowed}/tools.git`)
execFileSync('git', ['-C', repos.rewrittenAlias, 'config', 'url.git@github.com:.insteadOf', 'git@github-alias:'])
repos.rewrittenAway = makeRepo('rewritten-away', `git@github.com:${allowed}/tools.git`)
execFileSync('git', ['-C', repos.rewrittenAway, 'config', 'url.git@git.example.test:.insteadOf', 'git@github.com:'])
repos.allowedSsh = makeRepo('allowed-ssh', `ssh://git@github.com/${allowed}/notes.git`)
repos.allowedSlash = makeRepo('allowed-slash', `https://github.com/${allowed}/notes/`)

// A fresh home per test, with no session key inherited from the harness running the tests.
let home
let env
beforeEach(() => {
  home = mkdtempSync(join(root, 'home-'))
  env = {
    PATH: `${fakeBin}:${process.env.PATH}`,
    HOME: home,
    XDG_CONFIG_HOME: join(home, 'config'),
    XDG_STATE_HOME: join(home, 'state'),
    DEVCHAT_NODE: process.execPath,
    DEVCHAT_TEST_NETWORK_LOG: join(home, 'network.log'),
    NODE_OPTIONS: `--import=${preload}`,
  }
})
const stateDir = () => join(env.XDG_STATE_HOME, 'devchat')
const localDir = () => join(stateDir(), 'local')
const networkCalls = () => (existsSync(env.DEVCHAT_TEST_NETWORK_LOG) ? readFileSync(env.DEVCHAT_TEST_NETWORK_LOG, 'utf8').split('\n').filter(Boolean) : [])
const writeConfig = (config) => {
  mkdirSync(join(env.XDG_CONFIG_HOME, 'devchat'), { recursive: true })
  writeFileSync(join(env.XDG_CONFIG_HOME, 'devchat', 'config.json'), JSON.stringify(config))
}

// Each harness tells its hook apart the way it runs plugin hooks: Codex sets PLUGIN_ROOT and
// Claude Code sets CLAUDE_PLUGIN_ROOT.
const harnessEnv = { claude: { CLAUDE_PLUGIN_ROOT: pluginRoot }, codex: { PLUGIN_ROOT: pluginRoot } }
const hookInput = ({ key, cwd, source = 'startup', agentId }) => JSON.stringify({ session_id: key, cwd, hook_event_name: 'SessionStart', source, agent_id: agentId })

// Runs the hook through the exact command hooks.json registers.
const runHook = ({ input, harness = 'claude', extraEnv = {} }) => spawnSync('/bin/sh', ['-c', hookCommand], {
  input, encoding: 'utf8', env: { ...env, ...harnessEnv[harness], ...extraEnv },
})
const startSession = ({ key, cwd, source, harness, agentId }) => {
  const result = runHook({ input: hookInput({ key, cwd, source, agentId }), harness })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '', 'the hook prints nothing')
}
const sessionRecord = () => {
  const [file, ...others] = readdirSync(join(stateDir(), 'sessions'))
  assert.deepEqual(others, [], 'one session record')
  return (({ repo, conflicting }) => ({ repo, conflicting }))(readJson(join(stateDir(), 'sessions', file)))
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
  const base = { mode: 'readwrite', sessionKey: { harness: 'claude', id: 'k' }, record: allowedRecord, cwdIdentity: `github.com/${allowed}/notes`, allowlist: [allowed] }
  const rows = [
    [{}, { target: 'board', repo: `${allowed}/notes` }],
    [{ sessionKey: null }, { target: 'local', reason: 'no session key' }],
    [{ sessionKey: { harness: 'codex', id: 'k' } }, { target: 'local', reason: 'codex sessions stay on this machine' }],
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

test('the CLI routes each source as the table says; only a board route attempts a request', () => {
  const rows = [
    { name: 'allowlisted start and cwd', start: repos.allowed, cwd: repos.allowedHttps, target: 'board' },
    { name: 'non-allowlisted start, allowlisted cwd', start: repos.other, cwd: repos.allowed, reason: 'the session started outside an allowlisted repo' },
    { name: 'allowlisted start, non-allowlisted cwd', start: repos.allowed, cwd: repos.other, reason: 'the working directory is not an allowlisted repo' },
    { name: 'host alias start', start: repos.alias, cwd: repos.allowed, reason: 'the session started outside an allowlisted repo' },
    { name: 'start outside any remote', start: repos.noRemote, cwd: repos.allowed, reason: 'the session started outside an allowlisted repo' },
    { name: 'no session key', start: repos.allowed, cwd: repos.allowed, sessionEnv: {}, reason: 'no session key' },
    { name: 'no session record', cwd: repos.allowed, reason: 'no session record' },
    { name: 'conflicting record', start: repos.allowed, restart: repos.other, cwd: repos.allowed, reason: 'conflicting session record' },
    { name: 'both harness keys set', start: repos.allowed, cwd: repos.allowed, sessionEnv: { CLAUDE_CODE_SESSION_ID: 'row', CODEX_THREAD_ID: 'other' }, reason: 'no session key' },
    { name: 'both harness keys set to the same ID', start: repos.allowed, cwd: repos.allowed, sessionEnv: { CLAUDE_CODE_SESSION_ID: 'row', CODEX_THREAD_ID: 'row' }, reason: 'no session key' },
    { name: 'a Claude record read with the same ID as a Codex key', start: repos.allowed, cwd: repos.allowed, sessionEnv: { CODEX_THREAD_ID: 'row' }, reason: 'codex sessions stay on this machine' },
  ]
  for (const row of rows) {
    rmSync(stateDir(), { recursive: true, force: true })
    rmSync(env.DEVCHAT_TEST_NETWORK_LOG, { force: true })
    writeConfig(readwrite)
    if (row.start) startSession({ key: 'row', cwd: row.start })
    if (row.restart) startSession({ key: 'row', cwd: row.restart })
    const result = devchat({ args: ['todo', 'add', 'Review the handoff.'], cwd: row.cwd, sessionEnv: row.sessionEnv ?? { CLAUDE_CODE_SESSION_ID: 'row' } })
    if (row.target === 'board') {
      assert.equal(result.status, 0, `${row.name}: ${result.stderr}`)
      assert.match(result.stdout, new RegExp(`saved to the board \\(${allowed}/notes\\) through the outbox`, 'u'), row.name)
      assert.match(result.stdout, /not sent yet \(the board is unreachable \(Error\)\): the next devchat sync sends it/u, row.name)
      assert.equal(readdirSync(join(stateDir(), 'outbox')).filter((name) => name.endsWith('.json')).length, 1, row.name)
      assert.deepEqual(localTodos(), [], row.name)
      // The preload blocks the post-write sync's request, and the queued write still succeeds.
      assert.deepEqual(networkCalls(), ['fetch'], row.name)
      continue
    }
    assert.equal(result.status, 0, `${row.name}: ${result.stderr}`)
    assert.match(result.stdout, new RegExp(`saved on this machine only \\(${row.reason}\\)`, 'u'), row.name)
    assert.equal(localTodos().length, 1, row.name)
    assert.deepEqual(networkCalls(), [], row.name)
  }
})

test("each harness's hook records the stdin session_id that only that harness's key reads", () => {
  writeConfig(readwrite)
  const keys = { claude: 'CLAUDE_CODE_SESSION_ID', codex: 'CODEX_THREAD_ID' }
  for (const [harness, variable] of Object.entries(keys)) {
    rmSync(stateDir(), { recursive: true, force: true })
    const started = Date.now()
    startSession({ key: 'session-1', cwd: repos.allowed, harness })
    assert.ok(Date.now() - started < 5000, 'the hook stays inside its 5 s budget')
    const [file] = readdirSync(join(stateDir(), 'sessions'))
    assert.doesNotMatch(file, /session-1/u, 'the file name is a hash of the key')
    assert.equal(sessionRecord().repo, `github.com/${allowed}/tools`)
    assert.deepEqual(networkCalls(), [], 'the hook imports and calls no network module')
    for (const [otherHarness, otherVariable] of Object.entries(keys)) {
      const doctor = devchat({ args: ['doctor'], sessionEnv: { [otherVariable]: 'session-1' } })
      assert.match(doctor.stdout, new RegExp(`session key: ${otherVariable}`, 'u'))
      assert.match(doctor.stdout, otherHarness === harness ? /session record: recorded/u : /session record: no record/u, `${harness} record, ${otherHarness} key`)
      const expectedRoute = otherHarness === 'codex'
        ? 'this machine only (codex sessions stay on this machine)'
        : otherHarness === harness ? `board (${allowed}/tools)` : 'this machine only (no session record)'
      assert.equal(doctor.stdout.match(/route here: (.*)/u)[1], expectedRoute, `${harness} record, ${otherHarness} key`)
    }
    // Doctor in mode readwrite checks the board, which the preload blocks.
    rmSync(env.DEVCHAT_TEST_NETWORK_LOG, { force: true })
  }
})

test('only a github.com remote in a supported form is an allowlisted identity', () => {
  writeConfig(readwrite)
  startSession({ key: 'k', cwd: repos.allowed })
  const routeIn = (cwd) => devchat({ args: ['doctor'], cwd, sessionEnv: { CLAUDE_CODE_SESSION_ID: 'k' } }).stdout.match(/route here: (.*)/u)[1]
  for (const cwd of [repos.allowedSsh, repos.allowedSlash, repos.allowedHttps]) assert.equal(routeIn(cwd), `board (${allowed}/notes)`, cwd)
  for (const [index, name] of Object.keys(lookalikes).entries()) {
    assert.equal(routeIn(repos[`lookalike${index}`]), 'this machine only (the working directory is not an allowlisted repo)', name)
  }
  for (const cwd of [repos.rewrittenAlias, repos.rewrittenAway]) {
    assert.equal(routeIn(cwd), 'this machine only (the working directory is not an allowlisted repo)', cwd)
  }
})

test('racing starts from two repos always end conflicting', async () => {
  // Two starts under one key, from different repos, both find no record. Whichever writes first,
  // the other must see its record and mark it conflicting.
  const spawnHook = (input) => new Promise((resolve) => {
    const child = spawn('/bin/sh', ['-c', hookCommand], { env: { ...env, ...harnessEnv.claude }, stdio: ['pipe', 'ignore', 'ignore'] })
    child.on('close', resolve)
    child.stdin.end(input)
  })
  for (let round = 0; round < 15; round += 1) {
    rmSync(stateDir(), { recursive: true, force: true })
    await Promise.all([
      spawnHook(hookInput({ key: `race-${round}`, cwd: repos.other })),
      spawnHook(hookInput({ key: `race-${round}`, cwd: repos.allowed })),
    ])
    assert.equal(sessionRecord().conflicting, true, `round ${round}`)
  }
})

test('a second start from another repo marks the record conflicting for good', () => {
  startSession({ key: 'k', cwd: repos.allowed })
  startSession({ key: 'k', cwd: repos.other })
  startSession({ key: 'k', cwd: repos.allowed })
  assert.deepEqual(sessionRecord(), { repo: `github.com/${allowed}/tools`, conflicting: true })
})

test('a compaction keeps the record, and a resume from another repo still conflicts', () => {
  const record = sessionRecord
  startSession({ key: 'k', cwd: repos.allowed })
  startSession({ key: 'k', cwd: repos.other, source: 'compact' })
  assert.deepEqual(record(), { repo: `github.com/${allowed}/tools`, conflicting: false })
  startSession({ key: 'k', cwd: repos.other, source: 'resume' })
  assert.deepEqual(record(), { repo: `github.com/${allowed}/tools`, conflicting: true })

})

test('only a top-level start creates a record', () => {
  writeConfig(readwrite)
  const routeHere = () => devchat({ args: ['doctor'], sessionEnv: { CLAUDE_CODE_SESSION_ID: 'k' } }).stdout.match(/route here: (.*)/u)[1]
  // The session started elsewhere and its startup hook was missed; later events from an
  // allowlisted repo must not establish provenance.
  for (const event of [{ source: 'compact' }, { source: 'resume' }, { source: 'startup', agentId: 'agent-1' }, { source: 'unknown' }]) {
    rmSync(stateDir(), { recursive: true, force: true })
    startSession({ key: 'k', cwd: repos.allowed, ...event })
    assert.equal(existsSync(join(stateDir(), 'sessions')), false, JSON.stringify(event))
    assert.equal(routeHere(), 'this machine only (no session record)', JSON.stringify(event))
  }
  rmSync(stateDir(), { recursive: true, force: true })
  startSession({ key: 'k', cwd: repos.allowed, source: 'clear' })
  assert.equal(routeHere(), `board (${allowed}/tools)`)
  startSession({ key: 'k', cwd: repos.other, agentId: 'agent-1' })
  assert.deepEqual(sessionRecord(), { repo: `github.com/${allowed}/tools`, conflicting: true }, 'a subagent start elsewhere still conflicts')
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
  assert.match(devchat({ args: ['todo', 'list'] }).stdout, /No open todos\./u)
  assert.equal(devchat({ args: ['todo', 'done', first.rid] }).status, 1, 'a resolved todo is not open')

  const doctor = devchat({ args: ['doctor'], sessionEnv })
  assert.equal(doctor.status, 0, doctor.stdout)
  assert.match(doctor.stdout, /route here: this machine only \(mode off\)/u)
  assert.doesNotMatch(doctor.stdout, /board:|sync timer:/u, 'doctor checks no board or timer in mode off')
  assert.equal(devchat({ args: ['guard'], input: 'Check the queue.' }).status, 0)
  const sync = devchat({ args: ['sync'] })
  assert.equal(sync.status, 0, sync.stderr)
  assert.match(sync.stdout, /mode off: sync makes no network request/u)
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

test('the hook launcher never runs a Node shim from PATH', () => {
  const bin = mkdtempSync(join(home, 'bin-'))
  const marker = join(home, 'shim-ran')
  writeFileSync(join(bin, 'node'), `#!/bin/sh\ntouch '${marker}'\nexec '${process.execPath}' "$@"\n`)
  chmodSync(join(bin, 'node'), 0o755)
  const script = join(home, 'noop.mjs')
  writeFileSync(script, '')
  const { DEVCHAT_NODE, NODE_OPTIONS, ...rest } = env
  const result = spawnSync('/bin/sh', [join(pluginRoot, 'scripts/run-node.sh'), '--fail-open', script], {
    encoding: 'utf8', env: { ...rest, PATH: `${bin}:/usr/bin:/bin`, NVM_BIN: '' },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(existsSync(marker), false, 'the PATH node shim never ran')
})

// Board tests. A real board from `@filipgutica/devchat/testing` sits behind a proxy that plays
// `tailscale serve`: it adds the tailnet login and the board's host, serves the app's
// `/devchat.json`, logs each request's raw body, and injects failures on demand. CLI runs here
// spawn asynchronously, because the proxy answers from this process.
const boardHost = 'board.example.test'
const boardLogin = 'user@example.com'
const machine = 'test-box'
const profile = `${machine}-claude`
let board
let proxy
let marker

const startTailnetProxy = async (upstreamUrl) => {
  const upstream = new URL(upstreamUrl)
  const state = { requests: [], fault: () => null, app: null }
  const forward = ({ req, res, body }) => {
    const headers = { host: boardHost, 'tailscale-user-login': boardLogin }
    for (const name of ['content-type', 'x-board-profile']) if (req.headers[name]) headers[name] = req.headers[name]
    request({ hostname: upstream.hostname, port: upstream.port, path: req.url, method: req.method, headers }, (answer) => {
      res.writeHead(answer.statusCode, answer.headers)
      answer.pipe(res)
    }).end(body)
  }
  const answer = ({ req, res, body }) => {
    const fault = state.fault(req)
    if (fault === 'hang') return
    if (typeof fault === 'number') return res.writeHead(fault).end('{"error":{}}')
    if (req.url !== '/devchat.json') return setTimeout(() => forward({ req, res, body }), fault?.delayMs ?? 0)
    if (!state.app) return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(state.app))
  }
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      state.requests.push({ method: req.method, path: req.url, body, profile: req.headers['x-board-profile'] })
      answer({ req, res, body })
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return Object.assign(state, {
    url: `http://127.0.0.1:${server.address().port}${upstream.pathname}`,
    close: () => {
      server.closeAllConnections()
      server.close()
    },
  })
}

const asOwner = async ({ path, method = 'GET', body }) => {
  const response = await fetch(`${board.url}${path}`, {
    method, headers: { authorization: `Bearer ${board.ownerToken}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body),
  })
  assert.ok(response.ok, `${method} ${path} answered ${response.status}`)
  return response.json()
}

before(async () => {
  board = await startBoardServer({ directory: root })
  proxy = await startTailnetProxy(board.url)
  ;({ message: marker } = await asOwner({ path: '/messages', method: 'POST', body: { channel: 'sys', id: 'board', text: 'devchat board marker', labels: { epoch: '1' } } }))
})
after(async () => {
  proxy?.close()
  await board?.stop()
})

const setEpoch = (epoch) => asOwner({ path: `/messages/${marker.id}/labels`, method: 'POST', body: { set: { epoch } } })

// Plays the devchat app: writes each todo intent in `inbox` as its canonical todo, then moves `applied`.
const applyInbox = async () => {
  const { threads } = await asOwner({ path: '/threads?channel=inbox&limit=500' })
  for (const { message } of threads) {
    const intent = JSON.parse(message.text)
    await asOwner({ path: '/messages', method: 'POST', body: { channel: 'todos', id: `app:${intent.rid}`, text: intent.text, labels: { rid: intent.rid, status: 'open', host: intent.machine, repo: intent.repo } } })
  }
  proxy.app = { name: 'devchat', applied: String(Math.max(...threads.map(({ message }) => Number(message.id)))) }
}

const inboxPostsFor = async (rid) => (await asOwner({ path: '/threads?channel=inbox&limit=500' })).threads.filter(({ message }) => message.thread === rid)

let offlineBoardUrl
before(async () => {
  // A loopback port that was just free: nothing listens there during the tests.
  const closed = createServer()
  await new Promise((resolve) => closed.listen(0, '127.0.0.1', resolve))
  offlineBoardUrl = `http://127.0.0.1:${closed.address().port}/api/board`
  await new Promise((resolve) => closed.close(resolve))
})
const boardSession = { CLAUDE_CODE_SESSION_ID: 'board-session' }

/** A Claude Code session started in an allowlisted repo, in mode readwrite, against the proxy or an offline URL. */
const joinBoard = ({ mode = 'readwrite', boardUrl = proxy.url, machineName = machine } = {}) => {
  proxy.requests = []
  proxy.fault = () => null
  proxy.app = null
  writeConfig({ ...readwrite, mode, machine: machineName, boardUrl })
  if (!existsSync(join(stateDir(), 'sessions'))) startSession({ key: boardSession.CLAUDE_CODE_SESSION_ID, cwd: repos.allowed })
}

// The CLI without the no-network preload, run asynchronously, unless the test keeps the preload.
const devchatAsync = ({ args, cwd = repos.allowed, sessionEnv = boardSession, preload = false }) => new Promise((resolve) => {
  const { NODE_OPTIONS, ...withoutPreload } = env
  const child = spawn('/bin/sh', [launcher, ...args], { cwd, env: { ...(preload ? env : withoutPreload), ...sessionEnv }, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.on('close', (status) => resolve({ status, stdout, stderr }))
})

const filesIn = (...parts) => {
  const dir = join(stateDir(), ...parts)
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')).sort() : []
}
const posts = () => proxy.requests.filter(({ method }) => method === 'POST')
const ridOf = (stdout) => stdout.match(/^(todo-[a-z0-9-]+): saved to the board/mu)?.[1]

/** Queues todos while the board is unreachable, then points the config at the proxy. */
const queueOffline = async (texts) => {
  joinBoard({ boardUrl: offlineBoardUrl })
  const rids = []
  for (const text of texts) {
    const add = await devchatAsync({ args: ['todo', 'add', text] })
    assert.equal(add.status, 0, add.stderr)
    assert.match(add.stdout, /not sent yet \(the board is unreachable \(ECONNREFUSED\)\)/u)
    rids.push(ridOf(add.stdout))
  }
  joinBoard()
  return rids
}

test('a board write queues one label-free inbox intent, and the post-write sync sends it', async () => {
  joinBoard()
  const add = await devchatAsync({ args: ['todo', 'add', 'Review the handoff.'] })
  assert.equal(add.status, 0, add.stderr)
  assert.match(add.stdout, new RegExp(`saved to the board \\(${allowed}/tools\\) through the outbox`, 'u'))
  const rid = ridOf(add.stdout)
  assert.match(add.stdout, new RegExp(`^${rid}: sent$`, 'mu'))

  const [post, ...others] = posts()
  assert.deepEqual(others, [], 'one post')
  assert.equal(post.path, '/api/board/messages')
  assert.equal(post.profile, profile)
  const [sentFile] = filesIn('outbox', 'sent')
  const sent = readJson(join(stateDir(), 'outbox', 'sent', sentFile))
  assert.equal(post.body, sent.body, 'the request body is the stored string')
  assert.deepEqual(filesIn('outbox'), [])
  const body = JSON.parse(post.body)
  assert.deepEqual(Object.keys(body), ['channel', 'id', 'text'], 'no labels')
  assert.deepEqual({ channel: body.channel, id: body.id }, { channel: 'inbox', id: rid })
  assert.deepEqual(JSON.parse(body.text), { v: 1, rid, kind: 'todo', channel: 'todos', text: 'Review the handoff.', by: profile, repo: `${allowed}/tools`, machine })
  assert.equal(sent.inboxId, (await inboxPostsFor(rid))[0].message.id, 'the sent file keeps the inbox ID')
  assert.deepEqual(Object.keys(sent).sort(), ['body', 'inboxId', 'lane', 'op', 'profile', 'queuedAt', 'repo', 'schema', 'sentAt', 'target'])
  assert.deepEqual({ target: sent.target, repo: sent.repo, lane: sent.lane }, { target: rid, repo: `${allowed}/tools`, lane: 'repo' })

  await applyInbox()
  mkdirSync(localDir(), { recursive: true })
  writeFileSync(join(localDir(), 'note.json'), JSON.stringify({ rid: 'todo-local-1', channel: 'todos', text: 'Water the plants.', labels: { rid: 'todo-local-1', status: 'open' }, createdAt: '2026-01-01T00:00:00.000Z' }))
  const sync = await devchatAsync({ args: ['sync'] })
  assert.equal(sync.status, 0, sync.stderr)
  const snapshot = readJson(join(stateDir(), 'snapshot.json'))
  assert.equal(snapshot.schema, 1)
  assert.ok(Date.parse(snapshot.pulledAt) <= Date.now())
  assert.deepEqual({ epoch: snapshot.epoch, applied: snapshot.applied }, { epoch: '1', applied: proxy.app.applied })
  assert.equal(snapshot.items.find((item) => item.rid === rid)?.labels.repo, `${allowed}/tools`)
  assert.deepEqual(readdirSync(stateDir()).filter((name) => name.endsWith('.tmp')), [], 'the snapshot is written by rename')
  assert.ok(proxy.requests.every(({ method, path }) => method === 'GET' || path === '/api/board/messages'), 'the client writes only to /messages')
  assert.ok(posts().every(({ body: raw }) => JSON.parse(raw).channel === 'inbox'), 'every write is an inbox post')

  const list = await devchatAsync({ args: ['todo', 'list'] })
  assert.match(list.stdout, /todo-local-1 {2}2026-01-01 {2}local {2}Water the plants\./u)
  assert.match(list.stdout, new RegExp(`${rid} {2}\\d{4}-\\d{2}-\\d{2} {2}board {2}Review the handoff\\.`, 'u'))
})

test('offline writes send in queue order, and a resend replays byte-identically', async () => {
  const rids = await queueOffline(['First item.', 'Second item.', 'Third item.'])
  const queued = filesIn('outbox')
  assert.equal(queued.length, 3)
  const stored = queued.map((name) => readFileSync(join(stateDir(), 'outbox', name), 'utf8'))
  const sync = await devchatAsync({ args: ['sync'] })
  assert.equal(sync.status, 0, sync.stderr)
  assert.deepEqual(posts().map(({ body }) => JSON.parse(body).id), rids, 'time order')
  assert.deepEqual(posts().map(({ body }) => body), stored.map((text) => JSON.parse(text).body), 'the stored bytes')
  assert.deepEqual(filesIn('outbox'), [])
  assert.deepEqual(filesIn('outbox', 'sent'), queued)

  // A crash after the send and before the queued file moved leaves it queued: the resend replays.
  const firstSent = readJson(join(stateDir(), 'outbox', 'sent', queued[0]))
  writeFileSync(join(stateDir(), 'outbox', queued[0]), stored[0])
  proxy.requests = []
  const resend = await devchatAsync({ args: ['sync'] })
  assert.equal(resend.status, 0, resend.stderr)
  assert.deepEqual(posts().map(({ body }) => body), [firstSent.body], 'the same bytes again')
  assert.equal(readJson(join(stateDir(), 'outbox', 'sent', queued[0])).inboxId, firstSent.inboxId, 'the board returns the first post')
  for (const rid of rids) assert.equal((await inboxPostsFor(rid)).length, 1, `${rid} posted once`)
})

test('a network error or a 5xx stops the flush until the next run', async () => {
  const rids = await queueOffline(['Retry me.', 'And me.'])
  proxy.fault = (req) => (req.method === 'POST' ? 503 : null)
  const failed = await devchatAsync({ args: ['sync'] })
  assert.equal(failed.status, 1)
  assert.match(failed.stderr, /devchat sync stopped: POST \/api\/board\/messages answered 503/u)
  assert.equal(posts().length, 1, 'the first failure stops the flush')
  assert.equal(filesIn('outbox').length, 2)
  assert.equal(existsSync(join(stateDir(), 'snapshot.json')), false, 'a stopped sync pulls nothing')

  writeConfig({ ...readwrite, machine, boardUrl: offlineBoardUrl })
  const offline = await devchatAsync({ args: ['sync'] })
  assert.equal(offline.status, 1)
  assert.match(offline.stderr, /the board is unreachable \(ECONNREFUSED\)/u)
  assert.equal(filesIn('outbox').length, 2)

  joinBoard()
  const next = await devchatAsync({ args: ['sync'] })
  assert.equal(next.status, 0, next.stderr)
  assert.deepEqual(posts().map(({ body }) => JSON.parse(body).id), rids)
  assert.deepEqual(filesIn('outbox'), [])
})

test('a failed pull leaves the last snapshot whole', async () => {
  joinBoard()
  assert.equal((await devchatAsync({ args: ['sync'] })).status, 0)
  const path = join(stateDir(), 'snapshot.json')
  const pulled = readFileSync(path, 'utf8')
  proxy.fault = (req) => (req.url.includes('channel=work') ? 500 : null)
  const failed = await devchatAsync({ args: ['sync'] })
  assert.equal(failed.status, 1)
  assert.match(failed.stderr, /GET \/api\/board\/threads answered 500/u)
  assert.equal(readFileSync(path, 'utf8'), pulled)
  assert.deepEqual(readdirSync(stateDir()).filter((name) => name.endsWith('.tmp')), [])
})

test('a changed board epoch stops sync before it sends or pulls', async () => {
  joinBoard()
  assert.equal((await devchatAsync({ args: ['sync'] })).status, 0)
  const path = join(stateDir(), 'snapshot.json')
  const snapshot = readFileSync(path, 'utf8')
  await queueOffline(['Hold me.'])
  await setEpoch('2')
  try {
    const stopped = await devchatAsync({ args: ['sync'] })
    assert.equal(stopped.status, 1)
    assert.match(stopped.stderr, /the board epoch is 2 and the snapshot's is 1: nothing is sent or pulled/u)
    assert.deepEqual(posts(), [])
    assert.equal(filesIn('outbox').length, 1)
    assert.equal(readFileSync(path, 'utf8'), snapshot)
    const doctor = await devchatAsync({ args: ['doctor'] })
    assert.match(doctor.stdout, /FAIL board: reachable, marker epoch 2, but the snapshot's is 1: sync sends nothing/u)
  } finally {
    await setEpoch('1')
  }
})

test('one flusher: a second sync exits while another holds the outbox lock', async () => {
  await queueOffline(['Lock me.'])
  const lock = join(stateDir(), 'outbox', 'sync.lock')
  const namespace = existsSync('/proc/self/ns/pid') ? readlinkSync('/proc/self/ns/pid') : null
  writeFileSync(lock, JSON.stringify({ pid: process.pid, namespace, token: 'live' }))
  const held = await devchatAsync({ args: ['sync'] })
  assert.equal(held.status, 0, held.stderr)
  assert.match(held.stdout, /another devchat sync holds the outbox lock; this one exits/u)
  assert.deepEqual(proxy.requests, [])
  assert.equal(readFileSync(lock, 'utf8'), JSON.stringify({ pid: process.pid, namespace, token: 'live' }), 'the live lock stays')

  // A lock whose owner exited is stale.
  writeFileSync(lock, JSON.stringify({ pid: spawnSync(process.execPath, ['-e', '']).pid, namespace, token: 'dead' }))
  const takeover = await devchatAsync({ args: ['sync'] })
  assert.equal(takeover.status, 0, takeover.stderr)
  assert.equal(posts().length, 1)
  assert.equal(existsSync(lock), false, 'sync releases its lock')

  // Two syncs at once: the slow first one holds the lock, so the second sends nothing.
  await queueOffline(['Race me.'])
  proxy.fault = (req) => (req.method === 'POST' ? { delayMs: 1500 } : null)
  const [first, second] = await Promise.all([devchatAsync({ args: ['sync'] }), new Promise((resolve) => setTimeout(resolve, 500)).then(() => devchatAsync({ args: ['sync'] }))])
  assert.deepEqual([first.status, second.status], [0, 0], `${first.stderr}${second.stderr}`)
  assert.match(second.stdout, /another devchat sync holds the outbox lock/u)
  assert.equal(posts().length, 1)
})

test('a machine name the board would refuse as a profile still sends', async () => {
  joinBoard({ machineName: '9-Desk_Top.example.lan' })
  const add = await devchatAsync({ args: ['todo', 'add', 'Any host name works.'] })
  assert.equal(add.status, 0, add.stderr)
  assert.match(add.stdout, /: sent$/mu)
  assert.equal(posts()[0].profile, 'Desk-Top-example-lan-claude')
  assert.equal(JSON.parse(JSON.parse(posts()[0].body).text).machine, '9-Desk_Top.example.lan')
})

test('mode read pulls and never sends', async () => {
  await queueOffline(['Stay queued.'])
  joinBoard({ mode: 'read' })
  const sync = await devchatAsync({ args: ['sync'] })
  assert.equal(sync.status, 0, sync.stderr)
  assert.deepEqual(posts(), [])
  assert.ok(proxy.requests.some(({ path }) => path.startsWith('/api/board/threads?channel=todos')), 'it pulls')
  assert.equal(readJson(join(stateDir(), 'snapshot.json')).schema, 1)
  assert.equal(filesIn('outbox').length, 1, 'the queued file waits')
  const add = await devchatAsync({ args: ['todo', 'add', 'Read mode stays local.'] })
  assert.match(add.stdout, /saved on this machine only \(mode read\)/u)
  assert.deepEqual(posts(), [])
})

test('the post-write sync gives up after 3 s, and the write still succeeds', async () => {
  joinBoard()
  proxy.fault = () => 'hang'
  const started = Date.now()
  const add = await devchatAsync({ args: ['todo', 'add', 'Slow board.'] })
  const elapsed = Date.now() - started
  assert.equal(add.status, 0, add.stderr)
  assert.ok(elapsed >= 3000 && elapsed < 6000, `${elapsed} ms`)
  assert.match(add.stdout, /saved to the board/u)
  assert.match(add.stdout, /not sent yet \(the board is unreachable \(TimeoutError\)\): the next devchat sync sends it/u)
  assert.equal(filesIn('outbox').length, 1)
})

test('denied input and local routes make zero outbound requests, the post-write sync included', async () => {
  joinBoard()
  const refused = await devchatAsync({ args: ['todo', 'add', 'api_key=<secret>'], preload: true })
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /guard refused the text/u)
  const outside = await devchatAsync({ args: ['todo', 'add', 'From another owner.'], cwd: repos.other, preload: true })
  assert.match(outside.stdout, /saved on this machine only \(the working directory is not an allowlisted repo\)/u)
  const unrecorded = await devchatAsync({ args: ['todo', 'add', 'No record.'], sessionEnv: { CLAUDE_CODE_SESSION_ID: 'unrecorded' }, preload: true })
  assert.match(unrecorded.stdout, /saved on this machine only \(no session record\)/u)
  assert.deepEqual(networkCalls(), [])
  assert.deepEqual(proxy.requests, [])
  assert.deepEqual(filesIn('outbox'), [])
})

test('the check at flush sends only what the router queued', async () => {
  const [rid] = await queueOffline(['A real todo.'])
  const [name] = filesIn('outbox')
  const entry = readJson(join(stateDir(), 'outbox', name))
  const intent = JSON.parse(JSON.parse(entry.body).text)
  const planted = {
    'a direct todos post': { ...entry, body: JSON.stringify({ channel: 'todos', id: rid, text: 'x' }) },
    'a repo off the allowlist': { ...entry, repo: 'other-owner/service', body: JSON.stringify({ channel: 'inbox', id: rid, text: JSON.stringify({ ...intent, repo: 'other-owner/service' }) }) },
    'guarded text': { ...entry, body: JSON.stringify({ channel: 'inbox', id: rid, text: JSON.stringify({ ...intent, text: 'password=hunter2' }) }) },
    'an extra intent field': { ...entry, body: JSON.stringify({ channel: 'inbox', id: rid, text: JSON.stringify({ ...intent, status: 'done' }) }) },
    'a mismatched id': { ...entry, body: JSON.stringify({ channel: 'inbox', id: 'other', text: JSON.stringify(intent) }) },
    'labels on the post': { ...entry, body: JSON.stringify({ channel: 'inbox', id: rid, text: JSON.stringify(intent), labels: { status: 'done' } }) },
    'a profile the board refuses': { ...entry, profile: 'box.local', body: JSON.stringify({ channel: 'inbox', id: rid, text: JSON.stringify({ ...intent, by: 'box.local' }) }) },
  }
  for (const [index, value] of Object.values(planted).entries()) writeFileSync(join(stateDir(), 'outbox', `0000-${index}.json`), JSON.stringify(value))
  writeFileSync(join(stateDir(), 'outbox', '0000-9.json'), 'not json')
  const sync = await devchatAsync({ args: ['sync'] })
  assert.equal(sync.status, 0, sync.stderr)
  assert.deepEqual(posts().map(({ body }) => body), [entry.body], 'only the queued file is sent')
  assert.equal(filesIn('outbox', 'rejected').length, Object.keys(planted).length + 1)
  const doctor = await devchatAsync({ args: ['doctor'] })
  assert.match(doctor.stdout, /FAIL outbox: 0 queued, 1 sent, 8 rejected/u)
})

test('doctor reports the board, the outbox, the snapshot, and the timer', async () => {
  joinBoard()
  const unsynced = await devchatAsync({ args: ['doctor'] })
  assert.match(unsynced.stdout, /ok {3}snapshot: none yet/u)
  assert.equal((await devchatAsync({ args: ['sync'] })).status, 0)
  const doctor = await devchatAsync({ args: ['doctor'] })
  assert.match(doctor.stdout, /ok {3}board: reachable, marker epoch 1\n/u)
  assert.match(doctor.stdout, /ok {3}outbox: 0 queued, 0 sent, 0 rejected/u)
  assert.match(doctor.stdout, /ok {3}snapshot: pulled 0 min ago, epoch 1/u)
  assert.doesNotMatch(doctor.stdout, new RegExp(boardLogin, 'u'), 'doctor never prints the tailnet login')
  if (process.platform === 'linux') assert.match(doctor.stdout, /FAIL sync timer: devchat-sync\.timer inactive/u)

  writeConfig({ ...readwrite, machine, boardUrl: offlineBoardUrl })
  const offline = await devchatAsync({ args: ['doctor'] })
  assert.equal(offline.status, 1)
  assert.match(offline.stdout, /FAIL board: the board is unreachable \(ECONNREFUSED\)/u)
})

const setupArgs = ['--github-login', allowed, '--mode', 'readwrite']

test('setup --dry-run prints every step and changes nothing', { skip: process.platform !== 'linux' && 'the steps name the systemd timer' }, async () => {
  const dryRun = await devchatAsync({ args: ['setup', '--host', boardHost, ...setupArgs, '--dry-run'], preload: true })
  assert.equal(dryRun.status, 0, dryRun.stderr)
  const configFile = join(env.XDG_CONFIG_HOME, 'devchat', 'config.json')
  const units = join(env.XDG_CONFIG_HOME, 'systemd', 'user')
  assert.deepEqual(dryRun.stdout.trim().split('\n'), [
    `would write ${configFile}: mode readwrite, GitHub login ${allowed}, allowlist ${allowed}, board https://${boardHost}:8443/api/board`,
    `would write ${join(stateDir(), 'plugin-path')}: plugin root and version`,
    `would write ${join(home, '.local', 'bin', 'devchat')}`,
    `would write ${join(units, 'devchat-sync.service')}`,
    `would write ${join(units, 'devchat-sync.timer')}`,
    'would run systemctl --user daemon-reload',
    'would run systemctl --user enable --now devchat-sync.timer',
    'would run devchat doctor',
  ])
  assert.deepEqual(readdirSync(home), [], 'nothing written')
  assert.deepEqual(networkCalls(), [])

  const usage = await devchatAsync({ args: ['setup', '--host', boardHost, '--github-login', allowed] })
  assert.equal(usage.status, 1)
  assert.match(usage.stderr, /usage: devchat setup/u)
})

test('setup writes the config, the shim, and the timer, then runs doctor', { skip: process.platform !== 'linux' && 'the fake timer is systemd' }, async () => {
  joinBoard()
  writeConfig({ machine })
  const run = await devchatAsync({ args: ['setup', '--board-url', proxy.url, ...setupArgs, '--allowlist', `${allowed},second-owner`] })
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`)
  assert.deepEqual(readJson(join(env.XDG_CONFIG_HOME, 'devchat', 'config.json')), {
    machine, mode: 'readwrite', githubLogin: allowed, allowlist: [allowed, 'second-owner'], boardUrl: proxy.url,
  })
  assert.equal(readFileSync(join(stateDir(), 'plugin-path'), 'utf8').split('\n')[0], pluginRoot)
  assert.deepEqual(readFileSync(join(home, 'systemctl.log'), 'utf8').split('\n').filter(Boolean), [
    '--user daemon-reload', '--user enable --now devchat-sync.timer', '--user is-active devchat-sync.timer',
  ])
  const service = readFileSync(join(env.XDG_CONFIG_HOME, 'systemd', 'user', 'devchat-sync.service'), 'utf8')
  assert.match(service, new RegExp(`ExecStart=/bin/sh "${join(home, '.local', 'bin', 'devchat')}" sync`, 'u'))
  assert.match(readFileSync(join(env.XDG_CONFIG_HOME, 'systemd', 'user', 'devchat-sync.timer'), 'utf8'), /OnUnitActiveSec=15min/u)
  assert.match(run.stdout, /devchat doctor:\n[\s\S]*ok {3}board: reachable[\s\S]*ok {3}sync timer: devchat-sync\.timer active/u)

  // The shim finds the plugin through the plugin path file.
  const shim = spawnSync(join(home, '.local', 'bin', 'devchat'), ['todo', 'list'], { encoding: 'utf8', env, timeout: 10_000 })
  assert.equal(shim.status, 0, shim.stderr)
  assert.match(shim.stdout, /No open todos\./u)
  writeFileSync(join(stateDir(), 'plugin-path'), `${join(home, 'removed')}\n0.0.0\n`)
  const stale = spawnSync(join(home, '.local', 'bin', 'devchat'), ['todo', 'list'], { encoding: 'utf8', env, timeout: 10_000 })
  assert.equal(stale.status, 127)
  assert.match(stale.stderr, /the plugin path file is missing or stale/u)
})
