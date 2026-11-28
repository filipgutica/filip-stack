import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startBoardServer } from '@filipgutica/devchat/testing'
import { agentCommands, foldStep, route } from '../../plugins/devchat/skills/devchat/scripts/devchat.mjs'

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
  *"\${FAKE_SYSTEMCTL_FAIL:-no such call}"*) exit 1 ;;
  *enable*) touch "$HOME/timer-enabled" ;;
  *is-active*) if [ -f "$HOME/timer-enabled" ]; then echo active; else echo inactive; exit 3; fi ;;
esac
`)
chmodSync(join(fakeBin, 'systemctl'), 0o755)
// A stand-in for `gh`: it logs each call in the test's home, with a body's newlines as `|`. It
// answers the todos skill's reads with a fake login (or the one in \`$HOME/gh-login\`) and the
// issues in \`$HOME/gh-issues.json\`, keeps the body of each issue it creates, and lists those
// bodies for \`issue list --json body\`, a list that fails while \`$HOME/gh-list-fails\` exists.
writeFileSync(join(fakeBin, 'gh'), `#!/bin/sh
printf '%s' "$*" | tr '\\n' '|' >> "$HOME/gh.log"
printf '\\n' >> "$HOME/gh.log"
case "$1 $2" in
  'api user') cat "$HOME/gh-login" 2>/dev/null || echo example-login ;;
  'repo view') echo PRIVATE ;;
  'issue list')
    case "$*" in
      *'--json body'*) [ -e "$HOME/gh-list-fails" ] && exit 1; cat "$HOME/gh-bodies" 2>/dev/null || true ;;
      *) cat "$HOME/gh-issues.json" ;;
    esac ;;
  'issue create')
    while [ $# -gt 0 ]; do
      if [ "$1" = --body ]; then printf '%s\\n' "$2" >> "$HOME/gh-bodies"; fi
      shift
    done ;;
  'issue close') ;;
  *) exit 1 ;;
esac
`)
chmodSync(join(fakeBin, 'gh'), 0o755)

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
// A rewrite that changes only the case of the owner names the same repository.
repos.rewrittenCase = makeRepo('rewritten-case', `git@github.com:${allowed}/notes.git`)
execFileSync('git', ['-C', repos.rewrittenCase, 'config', `url.git@github.com:${allowed.toUpperCase()}/.insteadOf`, `git@github.com:${allowed}/`])

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
  for (const cwd of [repos.allowedSsh, repos.allowedSlash, repos.allowedHttps, repos.rewrittenCase]) assert.equal(routeIn(cwd), `board (${allowed}/notes)`, cwd)
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
  assert.deepEqual(agentCommands, ['work start', 'work note', 'work done', 'todo add'])

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

  const start = devchat({ args: ['work', 'start', 'Ship the export fix.', '--issue', '#12'], sessionEnv: { ...sessionEnv, T3CODE_THREAD_ID: 't3-local' } })
  assert.equal(start.status, 0, start.stderr)
  const item = start.stdout.match(/^(work-[a-z0-9-]+): saved on this machine only \(mode off\)$/mu)?.[1]
  assert.ok(item, start.stdout)
  const asked = devchat({ args: ['work', 'note', 'Which format? I recommend CSV.', '--blocked'], sessionEnv: { ...sessionEnv, T3CODE_THREAD_ID: 't3-local' } })
  assert.equal(asked.status, 0, asked.stderr)
  assert.match(devchat({ args: ['work', 'list'] }).stdout, new RegExp(`^${item} {2}\\d{4}-\\d{2}-\\d{2} {2}local {3}\\[question open\\] Ship the export fix\\.$`, 'mu'))
  assert.equal(devchat({ args: ['work', 'note', item.slice(0, -2), 'The PR is up.', '--pr', 'https://github.com/example-owner/tools/pull/7'], sessionEnv }).status, 0)
  const show = devchat({ args: ['work', 'show', item] })
  assert.match(show.stdout, /local {2}open {2}issue #12\nShip the export fix\.\n.*\(ask\): Which format\? I recommend CSV\.\n.*\(note\): The PR is up\./u)
  const stored = localTodos().find(({ rid }) => rid === item)
  assert.deepEqual(stored.labels, { rid: item, status: 'open', host: stored.labels.host, thread: 't3-local', issue: '#12', 'pr.7': 'https://github.com/example-owner/tools/pull/7' })
  assert.equal(devchat({ args: ['work', 'done'], sessionEnv: { ...sessionEnv, T3CODE_THREAD_ID: 't3-local' } }).status, 0)
  assert.match(devchat({ args: ['work', 'list'] }).stdout, /No open work items\./u)
  assert.equal(devchat({ args: ['work', 'drop', item] }).status, 1, 'a resolved item takes no resolve')

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
// `tailscale serve`: it adds the tailnet login and the board's host, logs each request's raw
// body, and injects failures on demand. The test plays the devchat app through the owner token.
// CLI runs here spawn asynchronously, because the proxy answers from this process.
const boardHost = 'board.example.test'
const boardLogin = 'user@example.com'
const machine = 'test-box'
const profile = `${machine}-claude`
let board
let proxy
let marker
let appMarker

const startTailnetProxy = async (upstreamUrl) => {
  const upstream = new URL(upstreamUrl)
  const state = { requests: [], fault: () => null, onRequest: () => {} }
  const forward = ({ req, res, body }) => {
    const headers = { host: boardHost, 'tailscale-user-login': boardLogin }
    for (const name of ['content-type', 'x-board-profile']) if (req.headers[name]) headers[name] = req.headers[name]
    request({ hostname: upstream.hostname, port: upstream.port, path: req.url, method: req.method, headers }, (answer) => {
      res.writeHead(answer.statusCode, answer.headers)
      answer.pipe(res)
    }).end(body)
  }
  const answer = ({ req, res, body }) => {
    const fault = state.fault(req, body)
    if (fault === 'hang') return
    if (fault === 'drop') return req.socket.destroy()
    if (typeof fault === 'number') return res.writeHead(fault).end('{"error":{}}')
    if (fault?.status) return res.writeHead(fault.status, { 'content-type': 'application/json' }).end(fault.body)
    // A held request reaches the board only once the test resolves `until`.
    Promise.resolve(fault?.until).then(() => forward({ req, res, body }))
  }
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      state.requests.push({ method: req.method, path: req.url, body, profile: req.headers['x-board-profile'] })
      state.onRequest(req)
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

// Posts as host setup and the app do: through Board's Node handle, as the board's owner. Board
// then keys the post's thread by a hash, so no other reader sees its client ID.
const devchatPackage = realpathSync(fileURLToPath(new URL('../../node_modules/@filipgutica/devchat/', import.meta.url)))
const postAsHost = ({ on = board, channel, ...post }) => {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    const { board } = await import('@vercel/board')
    const posted = await board().post(${JSON.stringify(channel)}, ${JSON.stringify(post)})
    process.stdout.write(JSON.stringify(posted.message ?? posted))
  `], { cwd: devchatPackage, encoding: 'utf8', env: { ...process.env, XDG_CONFIG_HOME: on.configHome, BOARD_URL: on.url, BOARD_TOKEN: '', BOARD_PROFILE: '' } })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

before(async () => {
  board = await startBoardServer({ directory: root })
  proxy = await startTailnetProxy(board.url)
  marker = postAsHost({ channel: 'sys', id: 'board', text: 'devchat board marker', labels: { epoch: '1' } })
  // The app posts its marker in `inbox` and labels it `applied` after its first batch.
  appMarker = postAsHost({ channel: 'inbox', id: 'app', text: 'devchat app marker' })
  assert.ok(![marker.thread, appMarker.thread].some((thread) => ['board', 'app'].includes(thread)), 'Board hides the markers\' client IDs')
})
after(async () => {
  proxy?.close()
  await board?.stop()
})

const setEpoch = (epoch) => asOwner({ path: `/messages/${marker.id}/labels`, method: 'POST', body: { set: { epoch } } })

// Plays the devchat app: writes each todo intent in `inbox` as its canonical todo, or labels it
// `refused` when `refuse` names its rid, then sets `applied` on its marker to the last intent it
// handled. Returns that cursor.
const applyInbox = async ({ refuse = {} } = {}) => {
  const intents = (await asOwner({ path: '/threads?channel=inbox&limit=500' })).threads.map(({ message }) => message).filter(({ id }) => id !== appMarker.id)
  for (const message of intents.filter(({ labels }) => !labels.refused)) {
    const intent = JSON.parse(message.text)
    if (refuse[intent.rid]) await asOwner({ path: `/messages/${message.id}/labels`, method: 'POST', body: { set: { refused: refuse[intent.rid] } } })
    else await asOwner({ path: '/messages', method: 'POST', body: { channel: 'todos', id: `app:${intent.rid}`, text: intent.text, labels: { rid: intent.rid, status: 'open', host: intent.machine, repo: intent.repo } } })
  }
  const applied = String(Math.max(...intents.map(({ id }) => Number(id))))
  await asOwner({ path: `/messages/${appMarker.id}/labels`, method: 'POST', body: { set: { applied } } })
  return applied
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

/** A Claude Code session started in an allowlisted repo, in mode readwrite, against a proxy (`via`) or an offline URL. */
const joinBoard = ({ via = proxy, mode = 'readwrite', boardUrl = via.url, machineName = machine } = {}) => {
  via.requests = []
  via.fault = () => null
  via.onRequest = () => {}
  writeConfig({ ...readwrite, mode, machine: machineName, boardUrl })
  if (!existsSync(join(stateDir(), 'sessions'))) startSession({ key: boardSession.CLAUDE_CODE_SESSION_ID, cwd: repos.allowed })
}

// The CLI without the no-network preload, run asynchronously, unless the test keeps the preload.
const devchatAsync = ({ args, cwd = repos.allowed, sessionEnv = boardSession, preload = false, input }) => new Promise((resolve) => {
  const { NODE_OPTIONS, ...withoutPreload } = env
  const child = spawn('/bin/sh', [launcher, ...args], { cwd, env: { ...(preload ? env : withoutPreload), ...sessionEnv }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] })
  if (input !== undefined) child.stdin.end(input)
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.on('close', (status) => resolve({ status, stdout, stderr }))
})

/** Runs `devchat sync` and asserts it succeeded. */
const syncOk = async () => {
  const sync = await devchatAsync({ args: ['sync'] })
  assert.equal(sync.status, 0, sync.stderr)
  return sync
}
const filesIn = (...parts) => {
  const dir = join(stateDir(), ...parts)
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')).sort() : []
}
const posts = () => proxy.requests.filter(({ method }) => method === 'POST')
const ridOf = (stdout) => stdout.match(/^(todo-[a-z0-9-]+): saved to the board/mu)?.[1]

/** Queues todos for the proxy's board while it answers 503, then lets it answer again. */
const queueOffline = async (texts) => {
  joinBoard()
  proxy.fault = () => 503
  const rids = []
  for (const text of texts) {
    const add = await devchatAsync({ args: ['todo', 'add', text] })
    assert.equal(add.status, 0, add.stderr)
    assert.match(add.stdout, /not sent yet \(GET \/api\/board\/threads answered 503\)/u)
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
  assert.deepEqual(Object.keys(sent).sort(), ['board', 'body', 'epoch', 'inboxId', 'lane', 'op', 'profile', 'queuedAt', 'repo', 'schema', 'sentAt', 'target'])
  assert.deepEqual({ target: sent.target, repo: sent.repo, lane: sent.lane, board: sent.board }, { target: rid, repo: `${allowed}/tools`, lane: 'repo', board: proxy.url })

  // No test has run the app yet, so the marker has no `applied` label.
  assert.equal(readJson(join(stateDir(), 'snapshot.json')).applied, null, 'no cursor yet')
  const applied = await applyInbox()
  mkdirSync(localDir(), { recursive: true })
  writeFileSync(join(localDir(), 'note.json'), JSON.stringify({ rid: 'todo-local-1', channel: 'todos', text: 'Water the plants.', identity: `github.com/${allowed}/tools`, labels: { rid: 'todo-local-1', status: 'open' }, createdAt: '2026-01-01T00:00:00.000Z' }))
  await syncOk()
  const snapshot = readJson(join(stateDir(), 'snapshot.json'))
  assert.equal(snapshot.schema, 1)
  assert.ok(Date.parse(snapshot.pulledAt) <= Date.now())
  assert.deepEqual({ epoch: snapshot.epoch, applied: snapshot.applied }, { epoch: '1', applied })
  assert.equal(snapshot.items.find((item) => item.rid === rid)?.labels.repo, `${allowed}/tools`)
  assert.deepEqual(readdirSync(stateDir()).filter((name) => name.endsWith('.tmp')), [], 'the snapshot is written by rename')
  assert.ok(proxy.requests.every(({ method, path }) => method === 'GET' || path === '/api/board/messages'), 'the client writes only to /messages')
  assert.ok(posts().every(({ body: raw }) => JSON.parse(raw).channel === 'inbox'), 'every write is an inbox post')

  const list = await devchatAsync({ args: ['todo', 'list'] })
  assert.match(list.stdout, /todo-local-1 {2}2026-01-01 {2}local {3}Water the plants\./u)
  assert.match(list.stdout, new RegExp(`${rid} {2}\\d{4}-\\d{2}-\\d{2} {2}board {3}Review the handoff\\.`, 'u'))
})

test('offline writes send in queue order, and a resend replays byte-identically', async () => {
  const rids = await queueOffline(['First item.', 'Second item.', 'Third item.'])
  const queued = filesIn('outbox')
  assert.equal(queued.length, 3)
  const stored = queued.map((name) => readFileSync(join(stateDir(), 'outbox', name), 'utf8'))
  await syncOk()
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

test('todo list shows queued and sent board todos until sync retires them as applied or refused', async () => {
  const listed = async () => (await devchatAsync({ args: ['todo', 'list'] })).stdout
  const [kept] = await queueOffline(['Waiting to send.'])
  assert.match(await listed(), new RegExp(`${kept} {2}\\S+ {2}queued {2}Waiting to send\\.`, 'u'))
  await syncOk()
  assert.match(await listed(), new RegExp(`${kept} {2}\\S+ {2}sent {4}Waiting to send\\.`, 'u'))

  // A crash between the sent copy and the queued file's removal leaves both: the list shows one.
  const [sentName] = filesIn('outbox', 'sent')
  const { inboxId, epoch, sentAt, ...queuedCopy } = readJson(join(stateDir(), 'outbox', 'sent', sentName))
  writeFileSync(join(stateDir(), 'outbox', sentName), JSON.stringify(queuedCopy))
  assert.equal((await listed()).match(new RegExp(kept, 'gu')).length, 1)
  assert.match(await listed(), new RegExp(`${kept} {2}\\S+ {2}sent {4}`, 'u'), 'the sent copy wins')
  await syncOk()

  const add = await devchatAsync({ args: ['todo', 'add', 'Refuse me.'] })
  const refused = ridOf(add.stdout)
  assert.match(add.stdout, /: sent$/mu)
  const applied = await applyInbox({ refuse: { [refused]: 'repo' } })
  // Message IDs compare as integers: '9' is below a two-digit cursor, though it sorts after it.
  assert.ok(applied.length > 1 && applied[0] < '9', `cursor ${applied}`)
  writeFileSync(join(stateDir(), 'outbox', 'sent', '0000-early.json'), JSON.stringify({ ...queuedCopy, target: 'todo-early', inboxId: '9', epoch: '1' }))
  const sync = await syncOk()
  assert.match(sync.stdout, new RegExp(`^refused ${refused}: repo$`, 'mu'), 'the reason code prints as it is')
  assert.deepEqual(filesIn('outbox', 'sent'), [], 'every decided intent retires, the one with ID 9 included')
  const [rejectedFile] = filesIn('outbox', 'rejected')
  assert.equal(readJson(join(stateDir(), 'outbox', 'rejected', rejectedFile)).refused, 'repo')
  const list = await listed()
  assert.match(list, new RegExp(`${kept} {2}\\S+ {2}board {3}Waiting to send\\.`, 'u'))
  assert.doesNotMatch(list, new RegExp(refused, 'u'))

  // Mode off has no board: the list reads only local/, though a snapshot and outbox exist.
  await queueOffline(['Still queued.'])
  writeConfig({ mode: 'off' })
  assert.match(await devchatAsync({ args: ['todo', 'add', 'Local only.'] }).then(({ stdout }) => stdout), /saved on this machine only \(mode off\)/u)
  const offList = await listed()
  assert.match(offList, /local {3}Local only\./u)
  assert.doesNotMatch(offList, /board|queued|sent/u)
})

test('a sent intent retires only against the board and epoch it was sent to', async () => {
  joinBoard()
  const add = await devchatAsync({ args: ['todo', 'add', 'Sent to board A.'] })
  const rid = ridOf(add.stdout)
  assert.match(add.stdout, /: sent$/mu)
  const [name] = filesIn('outbox', 'sent')
  assert.deepEqual((({ board: sentBoard, epoch }) => ({ sentBoard, epoch }))(readJson(join(stateDir(), 'outbox', 'sent', name))), { sentBoard: proxy.url, epoch: '1' })
  await applyInbox({ refuse: { [rid]: 'invalid' } })

  // Board B: another URL to the same proxy. Its cursor does not decide board A's intent.
  joinBoard({ boardUrl: proxy.url.replace('127.0.0.1', 'localhost') })
  const onB = await syncOk()
  assert.doesNotMatch(onB.stdout, /refused/u)
  assert.deepEqual(filesIn('outbox', 'sent'), [name], 'it stays in sent/')
  assert.match((await devchatAsync({ args: ['doctor'] })).stdout, /outbox: 0 queued, 1 sent \(1 to another board\), 0 rejected/u)

  joinBoard()
  const onA = await syncOk()
  assert.match(onA.stdout, new RegExp(`^refused ${rid}: invalid$`, 'mu'), 'back on board A, the refusal is reported')
  assert.deepEqual(filesIn('outbox', 'sent'), [])
})

test('a second root carrying a marker label stops sync', async () => {
  joinBoard()
  const add = await devchatAsync({ args: ['todo', 'add', 'Not a marker.'] })
  const [post] = await inboxPostsFor(ridOf(add.stdout))
  const label = (labels) => asOwner({ path: `/messages/${post.message.id}/labels`, method: 'POST', body: labels })
  await label({ set: { applied: '1' } })
  try {
    const stopped = await devchatAsync({ args: ['sync'] })
    assert.equal(stopped.status, 1)
    assert.match(stopped.stderr, /devchat sync stopped: 2 roots in inbox carry applied; the host's marker must be the only one/u)
  } finally {
    await label({ unset: ['applied'] })
  }
  await syncOk()
})

test('overlapping syncs land one post per client ID, and an older one leaves the newer snapshot', async () => {
  const rids = await queueOffline(['Race one.', 'Race two.', 'Race three.'])
  let release
  const released = new Promise((resolve) => { release = resolve })
  proxy.fault = (req) => (req.method === 'POST' ? { until: released } : null)
  const reached = (check) => new Promise((resolve) => {
    const poll = () => (check() ? resolve() : setTimeout(poll, 10))
    poll()
  })
  const lock = join(stateDir(), 'outbox', 'sync.lock')
  const first = devchatAsync({ args: ['sync'] })
  await reached(() => posts().length >= 1)
  // Bypass the lock: the first sync is mid-flush, and the second takes a fresh lock.
  rmSync(lock)
  const second = devchatAsync({ args: ['sync'] })
  await reached(() => posts().length >= 2)
  release()
  for (const result of await Promise.all([first, second])) {
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stderr, '')
  }
  assert.ok(posts().length > rids.length, 'both flushed')
  for (const rid of rids) assert.equal((await inboxPostsFor(rid)).length, 1, `${rid} landed once`)
  assert.deepEqual(filesIn('outbox'), [])
  assert.equal(filesIn('outbox', 'sent').length, rids.length)

  // An older sync holds after reading the cursor. The app then applies the three intents, and a
  // newer sync publishes that cursor and retires them before the older one finishes.
  let releaseOlder
  const olderHeld = new Promise((resolve) => { releaseOlder = resolve })
  let cursorRead = false
  let held = false
  proxy.fault = (req) => {
    if (!cursorRead) {
      cursorRead = req.url.includes('label=applied')
      return null
    }
    if (held) return null
    held = true
    return { until: olderHeld }
  }
  const older = devchatAsync({ args: ['sync'] })
  await reached(() => held)
  const applied = await applyInbox()
  rmSync(lock)
  await syncOk()
  releaseOlder()
  const olderSync = await older
  assert.equal(olderSync.status, 0, olderSync.stderr)
  assert.match(olderSync.stdout, /a newer snapshot is already in place: this sync leaves it and its receipts/u)
  assert.equal(readJson(join(stateDir(), 'snapshot.json')).applied, applied, 'the newer snapshot survives')
  assert.deepEqual(filesIn('outbox', 'sent'), [])
})

test('a network error or a 5xx stops the flush until the next run', async () => {
  const rids = await queueOffline(['Retry me.', 'And me.'])
  proxy.fault = (req) => (req.method === 'POST' ? 503 : null)
  const failed = await devchatAsync({ args: ['sync'] })
  assert.equal(failed.status, 1)
  assert.match(failed.stderr, /devchat sync stopped: POST \/api\/board\/messages answered 503/u)
  assert.equal(posts().length, 1, 'the first failure stops the flush')
  assert.deepEqual(filesIn('outbox').map((name) => readJson(join(stateDir(), 'outbox', name)).epoch), ['1', null], 'the first sync to read the marker stamps the file it tries')
  assert.equal(existsSync(join(stateDir(), 'snapshot.json')), false, 'a stopped sync pulls nothing')

  proxy.fault = () => 'drop'
  const offline = await devchatAsync({ args: ['sync'] })
  assert.equal(offline.status, 1)
  assert.match(offline.stderr, /devchat sync stopped: the board is unreachable/u)
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

test("another board's snapshot is replaced, whatever its cursor", async () => {
  joinBoard()
  await syncOk()
  const path = join(stateDir(), 'snapshot.json')
  const { applied } = readJson(path)
  const otherBoard = proxy.url.replace('127.0.0.1', 'localhost')
  // Board A's snapshot at the same epoch, with a higher cursor than this board's.
  const planted = { schema: 1, pulledAt: new Date().toISOString(), epoch: '1', applied: String(BigInt(applied ?? '0') + 1000n), items: [] }
  for (const board of [otherBoard, undefined]) {
    writeFileSync(path, JSON.stringify({ ...planted, board }))
    const sync = await syncOk()
    assert.doesNotMatch(sync.stdout, /a newer snapshot is already in place/u, board ?? 'no board')
    assert.deepEqual((({ board: pulled, applied: cursor }) => ({ pulled, cursor }))(readJson(path)), { pulled: proxy.url, cursor: applied }, board ?? 'no board')
  }
})

test("another board's epoch does not stop sync", async () => {
  // Board A, another URL to the same proxy, is at epoch 2 when this machine last synced.
  joinBoard({ boardUrl: proxy.url.replace('127.0.0.1', 'localhost') })
  await setEpoch('2')
  try {
    await syncOk()
  } finally {
    await setEpoch('1')
  }
  const path = join(stateDir(), 'snapshot.json')
  const { board, ...withoutBoard } = readJson(path)
  for (const snapshot of ['board A', 'no board URL']) {
    if (snapshot === 'no board URL') writeFileSync(path, JSON.stringify(withoutBoard))
    joinBoard()
    assert.match((await devchatAsync({ args: ['doctor'] })).stdout, /ok {3}board: reachable, marker epoch 1\n/u, snapshot)
    const sync = await syncOk()
    assert.match(sync.stdout, /snapshot: \d+ open item\(s\), epoch 1/u, snapshot)
  }
})

test('a todo queued under an older epoch is held, and one queued with the epoch unknown takes the next', async () => {
  joinBoard()
  await syncOk()
  await queueOffline(['Queued under epoch 1.'])
  // Board B, read only, replaces the snapshot. The next todo for board A has no epoch to queue under.
  joinBoard({ mode: 'read', boardUrl: proxy.url.replace('127.0.0.1', 'localhost') })
  await syncOk()
  await queueOffline(['Queued with the epoch unknown.'])
  const queued = filesIn('outbox')
  assert.deepEqual(queued.map((name) => readJson(join(stateDir(), 'outbox', name)).epoch), ['1', null])

  // Board A is restored to epoch 2. B's snapshot does not stop sync, so the held file must.
  await setEpoch('2')
  try {
    joinBoard()
    const held = await devchatAsync({ args: ['sync'] })
    assert.equal(held.status, 1)
    assert.match(held.stderr, new RegExp(`${queued[0]} was queued under board epoch 1, and the board's is 2: nothing is sent`, 'u'))
    assert.deepEqual(posts(), [])
    assert.deepEqual(filesIn('outbox'), queued)
  } finally {
    await setEpoch('1')
  }
  joinBoard()
  await syncOk()
  assert.deepEqual(filesIn('outbox', 'sent').map((name) => readJson(join(stateDir(), 'outbox', 'sent', name)).epoch), ['1', '1'])
})

test('todo add reports a todo the check at flush rejects', async () => {
  joinBoard({ machineName: 'x'.repeat(257) })
  const add = await devchatAsync({ args: ['todo', 'add', 'From a machine name too long for a label.'] })
  assert.equal(add.status, 0, add.stderr)
  assert.match(add.stdout, /: not sent: the check at flush rejected it \(a provenance field is not a board label value\) and moved it to outbox\/rejected\/$/mu)
  assert.doesNotMatch(add.stdout, /: sent$/mu)
  assert.deepEqual(posts(), [])
  assert.equal(filesIn('outbox', 'rejected').length, 1)
})

test('an epoch change during sync keeps the snapshot and the receipts', async () => {
  joinBoard()
  const add = await devchatAsync({ args: ['todo', 'add', 'Restored away.'] })
  assert.match(add.stdout, /: sent$/mu)
  await applyInbox()
  const path = join(stateDir(), 'snapshot.json')
  const snapshot = readFileSync(path, 'utf8')
  const [sent] = filesIn('outbox', 'sent')
  // A restore lands between the first epoch read and the cursor read.
  let restored
  proxy.fault = (req) => (req.url.includes('label=applied') ? { until: (restored ??= setEpoch('2')) } : null)
  try {
    const stopped = await devchatAsync({ args: ['sync'] })
    assert.equal(stopped.status, 1)
    assert.match(stopped.stderr, /the board epoch changed from 1 to 2 during this sync: the snapshot and receipts stay as they were/u)
    assert.equal(readFileSync(path, 'utf8'), snapshot)
    assert.deepEqual(filesIn('outbox', 'sent'), [sent])
    assert.deepEqual(filesIn('outbox', 'rejected'), [])
  } finally {
    await setEpoch('1')
  }
  joinBoard()
  await syncOk()
  assert.deepEqual(filesIn('outbox', 'sent'), [], 'back on epoch 1, the receipt retires')
})

test('one flusher: a second sync exits while another holds the outbox lock', async () => {
  await queueOffline(['Lock me.'])
  const lock = join(stateDir(), 'outbox', 'sync.lock')
  const namespace = existsSync('/proc/self/ns/pid') ? readlinkSync('/proc/self/ns/pid') : null
  writeFileSync(lock, JSON.stringify({ pid: process.pid, namespace, token: 'live' }))
  // A live owner in this PID namespace holds the lock however old it is.
  utimesSync(lock, new Date(Date.now() - 60 * 60_000), new Date(Date.now() - 60 * 60_000))
  const held = await devchatAsync({ args: ['sync'] })
  assert.equal(held.status, 0, held.stderr)
  assert.match(held.stdout, /another devchat sync holds the outbox lock; this one exits/u)
  assert.deepEqual(proxy.requests, [])
  assert.equal(readFileSync(lock, 'utf8'), JSON.stringify({ pid: process.pid, namespace, token: 'live' }), 'the live lock stays')

  // A lock from another PID namespace cannot be checked: it holds until its owner stops refreshing it.
  const foreign = JSON.stringify({ pid: 1, namespace: 'pid:[0]', token: 'foreign' })
  writeFileSync(lock, foreign)
  utimesSync(lock, new Date(Date.now() - 14 * 60_000), new Date(Date.now() - 14 * 60_000))
  assert.match((await devchatAsync({ args: ['sync'] })).stdout, /another devchat sync holds the outbox lock/u, 'refreshed 14 minutes ago')
  assert.equal(readFileSync(lock, 'utf8'), foreign)
  utimesSync(lock, new Date(Date.now() - 16 * 60_000), new Date(Date.now() - 16 * 60_000))
  await syncOk()
  assert.equal(posts().length, 1, 'not refreshed for 16 minutes: stale')
  assert.equal(existsSync(lock), false, 'sync releases its lock')
  assert.deepEqual(readdirSync(join(stateDir(), 'outbox')).filter((name) => name.includes('.stale')), [], 'the stale lock is gone')

  // A lock whose owner exited is stale, whatever its age.
  await queueOffline(['Dead owner.'])
  writeFileSync(lock, JSON.stringify({ pid: spawnSync(process.execPath, ['-e', '']).pid, namespace, token: 'dead' }))
  await syncOk()
  assert.equal(posts().length, 1)
  assert.equal(existsSync(lock), false)

  // Two syncs at once: the proxy holds the first one's send, so it holds the lock while the second runs.
  await queueOffline(['Race me.'])
  let release
  const released = new Promise((resolve) => { release = resolve })
  const sending = new Promise((resolve) => { proxy.onRequest = (req) => req.method === 'POST' && resolve() })
  proxy.fault = (req) => (req.method === 'POST' ? { until: released } : null)
  const first = devchatAsync({ args: ['sync'] })
  await sending
  const second = await devchatAsync({ args: ['sync'] })
  release()
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /another devchat sync holds the outbox lock/u)
  assert.equal((await first).status, 0)
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
  await syncOk()
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

/** The queued outbox file at `index`, its intent, and a copy of it carrying another intent. */
const queuedFile = (index = 0) => {
  const entry = readJson(join(stateDir(), 'outbox', filesIn('outbox')[index]))
  const intent = JSON.parse(JSON.parse(entry.body).text)
  const withIntent = (changed, raw = JSON.stringify(changed)) => ({ ...entry, body: JSON.stringify({ channel: 'inbox', id: intent.rid, text: raw }) })
  return { entry, intent, withIntent }
}

test('the check at flush sends only what the router queued, byte for byte', async () => {
  const [rid] = await queueOffline(['A real todo.'])
  const { entry, intent, withIntent } = queuedFile()
  const planted = {
    'a direct todos post': [{ ...entry, body: JSON.stringify({ channel: 'todos', id: rid, text: 'x' }) }, 'the request is not an inbox post'],
    'a repo off the allowlist': [{ ...withIntent({ ...intent, repo: 'other-owner/service' }), repo: 'other-owner/service' }, 'the source repo is not on the allowlist'],
    'guarded text': [withIntent({ ...intent, text: 'password=hunter2' }), 'the guard refused an outbound field'],
    'an extra intent field': [withIntent({ ...intent, status: 'done' }), 'the intent is not a release 1 intent'],
    'a string version': [withIntent({ ...intent, v: '1' }), 'the intent is not a release 1 intent'],
    'a mismatched id': [{ ...entry, body: JSON.stringify({ channel: 'inbox', id: 'other', text: JSON.stringify(intent) }) }, 'the intent rid does not match the post id'],
    'labels on the post': [{ ...entry, body: JSON.stringify({ channel: 'inbox', id: rid, text: JSON.stringify(intent), labels: { status: 'done' } }) }, 'the request is not an inbox post'],
    'a credential-shaped ID': [{ ...entry, target: 'AKIAABCDEFGHIJKLMNOP', body: JSON.stringify({ channel: 'inbox', id: 'AKIAABCDEFGHIJKLMNOP', text: JSON.stringify({ ...intent, rid: 'AKIAABCDEFGHIJKLMNOP' }) }) }, 'the guard refused an outbound field'],
    'a profile the board refuses': [{ ...withIntent({ ...intent, by: 'box.local' }), profile: 'box.local' }, 'the profile is not a board profile name'],
    'a board that is not a string': [{ ...entry, board: 1 }, 'not a devchat outbox post'],
    'an empty board': [{ ...entry, board: '' }, 'the board is not a normalized board URL'],
    'a board URL not in normal form': [{ ...entry, board: `${entry.board}/` }, 'the board is not a normalized board URL'],
    // JSON.parse keeps the last of two keys, so these parse to a valid todo, but not from the queued bytes.
    'a duplicate key hiding guarded text': [withIntent(intent, JSON.stringify(intent).replace('"text":', '"text":"password=hunter2","text":')), 'the request body is not in canonical form'],
    'a duplicate request key': [{ ...entry, body: entry.body.replace('{"channel":"inbox"', '{"channel":"todos","channel":"inbox"') }, 'the request body is not in canonical form'],
    'an intent over the board limit': [{ ...entry, body: JSON.stringify({ channel: 'inbox', id: rid, text: 'x'.repeat(10_001) }) }, "the intent is longer than the board's 10000-character limit"],
  }
  const outbox = join(stateDir(), 'outbox')
  for (const [index, [value]] of Object.values(planted).entries()) writeFileSync(join(outbox, `0000-${String(index).padStart(2, '0')}.json`), JSON.stringify(value))
  const odd = { '0001-text.json': 'not readable JSON', '0001-large.json': 'larger than 65536 bytes', '0001-link.json': 'a symbolic link' }
  writeFileSync(join(outbox, '0001-text.json'), 'not json')
  writeFileSync(join(outbox, '0001-large.json'), JSON.stringify({ ...entry, padding: 'x'.repeat(70_000) }))
  writeFileSync(join(home, 'elsewhere.json'), JSON.stringify(entry))
  symlinkSync(join(home, 'elsewhere.json'), join(outbox, '0001-link.json'))
  mkdirSync(join(outbox, '0001-dir.json'))
  odd['0001-dir.json'] = 'not a regular file'
  if (spawnSync('mkfifo', [join(outbox, '0001-fifo.json')]).status === 0) odd['0001-fifo.json'] = 'not a regular file'

  const sync = await syncOk()
  assert.deepEqual(posts().map(({ body }) => body), [entry.body], 'only the queued file is sent')
  for (const [index, [label, [, reason]]] of Object.entries(planted).entries()) {
    assert.match(sync.stdout, new RegExp(`rejected 0000-${String(index).padStart(2, '0')}\\.json: ${reason.replace(/[.()]/gu, '\\$&')}\n`, 'u'), label)
  }
  for (const [file, reason] of Object.entries(odd)) assert.match(sync.stdout, new RegExp(`rejected ${file}: ${reason}\n`, 'u'), file)
  const rejected = Object.keys(planted).length + Object.keys(odd).length
  assert.equal(filesIn('outbox', 'rejected').length, rejected)
  assert.deepEqual(filesIn('outbox'), [], 'nothing stalls the queue')
  const doctor = await devchatAsync({ args: ['doctor'] })
  assert.match(doctor.stdout, new RegExp(`FAIL outbox: 0 queued, 1 sent, ${rejected} rejected`, 'u'))
})

test('a todo whose intent fits the board limit exactly is sent; one character more is refused', async () => {
  joinBoard()
  const fixed = JSON.stringify({ v: 1, rid: `todo-${Date.now().toString(36)}-00000000`, kind: 'todo', channel: 'todos', text: '', by: profile, repo: `${allowed}/tools`, machine }).length
  const fits = await devchatAsync({ args: ['todo', 'add', 'a'.repeat(10_000 - fixed)] })
  assert.equal(fits.status, 0, fits.stderr)
  assert.match(fits.stdout, /: sent$/mu, 'the board takes 10000 characters')
  const over = await devchatAsync({ args: ['todo', 'add', 'a'.repeat(10_001 - fixed)] })
  assert.equal(over.status, 1)
  assert.match(over.stderr, /the todo is too long for the board: its intent is 10001 characters, and the board takes at most 10000\. Shorten it and try again\. Nothing was saved\./u)
  assert.equal(posts().length, 1)
})

test('a file queued for another board stops sync and stays queued', { skip: process.platform !== 'linux' && 'setup runs the fake systemd timer' }, async () => {
  await queueOffline(['For the first board.'])
  // Another board URL that reaches the same proxy, so only the URL differs.
  const otherBoard = proxy.url.replace('127.0.0.1', 'localhost')
  const rerun = await devchatAsync({ args: ['setup', '--board-url', otherBoard, '--github-login', allowed, '--mode', 'readwrite', '--allowlist', 'other-owner'] })
  assert.match(rerun.stdout, /write .*config\.json: mode readwrite/u, rerun.stderr)
  const sync = await devchatAsync({ args: ['sync'] })
  assert.equal(sync.status, 1)
  assert.match(sync.stderr, /\.json was queued for another board than the configured one: nothing is sent/u)
  assert.equal(filesIn('outbox').length, 1, 'the file stays')
  assert.deepEqual(filesIn('outbox', 'rejected'), [])
  assert.deepEqual(posts(), [])
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

test('setup and the config refuse a board URL with a credential slot or without https, and never print it', async () => {
  const refused = {
    'user information': 'https://someone:secret-pass@board.example.test:8443/api/board',
    'empty user information': 'https://@board.example.test:8443/api/board',
    'a query': 'https://board.example.test:8443/api/board?secret-token=1',
    'a fragment': 'https://board.example.test:8443/api/board#secret-token',
    'http off loopback': 'http://board.example.test:8443/api/board',
    'another scheme': 'ftp://board.example.test/api/board',
    'no authority': 'https:/@board.example.test/api/secret-board',
    'a backslash in the authority': 'https://board.example.test\\@secret.example.test/api/board',
    'whitespace in the authority': 'https://board.example.test\t/api/secret-board',
  }
  const reasons = {
    'user information': 'it holds user information',
    'empty user information': 'it holds user information',
    'a query': 'it holds a query or a fragment',
    'a fragment': 'it holds a query or a fragment',
    'http off loopback': 'it must use https, or http on a loopback host',
    'another scheme': 'it must use https, or http on a loopback host',
    'no authority': 'it is not a URL',
    'a backslash in the authority': 'it is not a URL',
    'whitespace in the authority': 'it is not a URL',
  }
  for (const [name, url] of Object.entries(refused)) {
    const run = await devchatAsync({ args: ['setup', '--board-url', url, '--github-login', allowed, '--mode', 'readwrite'], preload: true })
    assert.equal(run.status, 1, name)
    assert.match(run.stderr, new RegExp(`the board URL is refused: ${reasons[name]}\\. Nothing was written\\.`, 'u'), name)
    assert.ok(!`${run.stdout}${run.stderr}`.includes('secret') && !`${run.stdout}${run.stderr}`.includes(url), `${name}: the URL is not printed`)
    assert.deepEqual(readdirSync(home), [], `${name}: nothing written`)

    writeConfig({ mode: 'readwrite', githubLogin: allowed, boardUrl: url })
    const doctor = await devchatAsync({ args: ['doctor'], preload: true })
    assert.equal(doctor.status, 1, name)
    assert.match(doctor.stdout, new RegExp(`FAIL config: .*boardUrl is refused: ${reasons[name]}`, 'u'), name)
    assert.ok(!doctor.stdout.includes('secret'), `${name}: doctor does not print the URL`)
    rmSync(env.XDG_CONFIG_HOME, { recursive: true, force: true })
  }
  const host = await devchatAsync({ args: ['setup', '--host', 'someone@board.example.test', '--github-login', allowed, '--mode', 'readwrite', '--dry-run'] })
  assert.match(host.stderr, /the board URL is refused: it holds user information/u)
  writeConfig({})
  writeFileSync(join(env.XDG_CONFIG_HOME, 'devchat', 'config.json'), '{"boardUrl": "https://board.example.test/?secret-token=1",')
  const broken = await devchatAsync({ args: ['doctor'], preload: true })
  assert.match(broken.stdout, /FAIL config: .* is not valid JSON\n/u)
  assert.ok(!broken.stdout.includes('secret'), 'a parse error does not quote the file')
  assert.deepEqual(networkCalls(), [])
})

/** Runs setup as a dry run and for real, and asserts each refuses `path` in the preflight and runs no step. */
const assertSetupRefuses = async ({ path, problem }) => {
  for (const extra of [['--dry-run'], []]) {
    const refused = await devchatAsync({ args: ['setup', '--host', boardHost, ...setupArgs, ...extra], preload: true })
    assert.equal(refused.status, 1, extra.join(' '))
    assert.match(refused.stdout, new RegExp(`preflight ${path}: refused, ${problem}\n`, 'u'))
    assert.match(refused.stdout, new RegExp(`^setup changed nothing\\. Move each refused file aside, or remove it, and run setup again: .*${path}`, 'mu'))
    assert.doesNotMatch(refused.stdout, /^(?:would )?(?:write|run) /mu, 'no step runs')
  }
}

test('setup --dry-run prints every step and changes nothing', { skip: process.platform !== 'linux' && 'the steps name the systemd timer' }, async () => {
  const dryRun = await devchatAsync({ args: ['setup', '--host', boardHost, ...setupArgs, '--dry-run'], preload: true })
  assert.equal(dryRun.status, 0, dryRun.stderr)
  const configFile = join(env.XDG_CONFIG_HOME, 'devchat', 'config.json')
  const units = join(env.XDG_CONFIG_HOME, 'systemd', 'user')
  const shim = join(home, '.local', 'bin', 'devchat')
  const files = [configFile, join(stateDir(), 'plugin-path'), shim, join(units, 'devchat-sync.service'), join(units, 'devchat-sync.timer')]
  assert.deepEqual(dryRun.stdout.trim().split('\n'), [
    ...files.map((file) => `preflight ${file}: ok, new`),
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

  // A file setup did not write is refused in the preflight, in a dry run and a real run alike. The
  // marker counts only as its exact line.
  mkdirSync(join(home, '.local', 'bin'), { recursive: true })
  const foreign = '#!/bin/sh\necho "# devchat-managed: devchat setup wrote this file and replaces it when rerun"\n'
  writeFileSync(shim, foreign)
  await assertSetupRefuses({ path: shim, problem: 'not written by devchat setup' })
  assert.deepEqual(readdirSync(home), ['.local'], 'nothing else written')
  assert.equal(readFileSync(shim, 'utf8'), foreign)

  // A folder setup cannot write in fails the preflight, even for a file that would be new. Root
  // ignores folder modes, so this part needs an ordinary user.
  if (process.getuid() === 0) return
  rmSync(join(home, '.local'), { recursive: true })
  mkdirSync(units, { recursive: true })
  chmodSync(units, 0o555)
  await assertSetupRefuses({ path: join(units, 'devchat-sync.service'), problem: 'its folder is not writable and searchable' })
  assert.equal(existsSync(configFile), false, 'config.json is not written either')
  assert.deepEqual(readdirSync(env.XDG_CONFIG_HOME), ['systemd'])
  chmodSync(units, 0o755)
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

  // A rerun updates setup's own files.
  const rerun = await devchatAsync({ args: ['setup', '--board-url', proxy.url, ...setupArgs] })
  assert.equal(rerun.status, 0, rerun.stdout)
  assert.match(rerun.stdout, new RegExp(`preflight ${join(home, '.local', 'bin', 'devchat')}: ok, setup updates it`, 'u'))
})

test('setup stops before enabling the timer when an earlier step fails', { skip: process.platform !== 'linux' && 'the fake timer is systemd' }, async () => {
  const run = await devchatAsync({ args: ['setup', '--board-url', proxy.url, ...setupArgs], sessionEnv: { FAKE_SYSTEMCTL_FAIL: 'daemon-reload' } })
  assert.equal(run.status, 1)
  assert.match(run.stdout, /FAIL systemctl --user daemon-reload failed .*\nsetup stopped: the steps after this one did not run\n$/u)
  assert.deepEqual(readFileSync(join(home, 'systemctl.log'), 'utf8').split('\n').filter(Boolean), ['--user daemon-reload'], 'enable never ran')
  assert.doesNotMatch(run.stdout, /devchat doctor:/u)
})

test("the client fold gives devchat's fold fixture, row by row", () => {
  const fixture = readJson(join(devchatPackage, 'fixtures/fold.json'))
  assert.ok(fixture.length > 0)
  for (const { name, steps: [root, ...replies] } of fixture) {
    let labels = { ...root.post.labels, status: 'open' }
    assert.deepEqual(labels, root.rootLabels, `${name}: root`)
    for (const [index, { post, rootLabels }] of replies.entries()) {
      labels = foldStep(labels, post.labels)
      assert.deepEqual(labels, rootLabels, `${name}: step ${index + 1}`)
    }
  }
  // The fixture has no resolve the pending guard stops, since ingest refuses one; the offline view folds it.
  const pending = { rid: 'work-1', status: 'open', ask: 'answered', turn: 'answer-2' }
  for (const re of [undefined, 'answer-1']) assert.deepEqual(foldStep(pending, { rid: 'done-1', by: 'agent', kind: 'done', re }), pending, `a resolve with re ${re}`)
  assert.deepEqual(foldStep(pending, { rid: 'done-1', by: 'agent', kind: 'done', re: 'answer-2' }), { rid: 'work-1', status: 'done' })
})

test('work start prints at most 1 KB of context, whole items only', () => {
  writeConfig({ mode: 'off', githubLogin: allowed })
  for (let index = 0; index < 12; index += 1) {
    assert.equal(devchat({ args: ['work', 'start', `Item ${index}: ${'a long goal that fills the budget '.repeat(3)}`] }).status, 0)
  }
  assert.equal(devchat({ args: ['todo', 'add', 'Elsewhere.'], cwd: repos.other }).status, 0)
  const start = devchat({ args: ['work', 'start', 'One more.'] })
  assert.equal(start.status, 0, start.stderr)
  const [, ...context] = start.stdout.trimEnd().split('\n')
  assert.ok(Buffer.byteLength(context.join('\n')) <= 1024, `${Buffer.byteLength(context.join('\n'))} bytes`)
  assert.equal(context[0], 'Open work items here; add a note with devchat work note <rid> "<text>":')
  assert.match(context.at(-1), /^\d+ more not shown: devchat work list, devchat todo list$/u)
  assert.ok(context.slice(1, -1).every((line) => /^work-[a-z0-9-]+ {2}Item \d+: /u.test(line)), 'whole item lines, oldest first')
  assert.doesNotMatch(start.stdout, /One more\.|Elsewhere\./u, 'neither the new item nor another repo\'s todo')
})

// Work commands against devchat's real state writer, on a board of their own: the writer's first
// pass ingests `inbox` from the start, and must not meet the todos the tests above applied by hand.
let workBoard
let workProxy
let workMarker
const writerState = join(root, 'writer-state.json')
before(async () => {
  mkdirSync(join(root, 'work-board'))
  workBoard = await startBoardServer({ directory: join(root, 'work-board') })
  workProxy = await startTailnetProxy(workBoard.url)
  workMarker = postAsHost({ on: workBoard, channel: 'sys', id: 'board', text: 'devchat board marker', labels: { epoch: '1' } })
})
after(async () => {
  workProxy?.close()
  await workBoard?.stop()
})

// Runs `script` with the app's state writer (`createStateWriter`, from the package's built server
// code: the package exports no app entry for tests) as the board's owner, as the host's app runs.
const runWriter = (script) => {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    const { createStateWriter } = await import('./dist/server/writer.js')
    const writer = createStateWriter({ settings: { allowlist: [${JSON.stringify(allowed)}], machines: {} }, stateFile: ${JSON.stringify(writerState)} })
    ${script}
  `], { cwd: devchatPackage, encoding: 'utf8', env: { ...process.env, XDG_CONFIG_HOME: workBoard.configHome, BOARD_URL: workBoard.url, BOARD_TOKEN: '', BOARD_PROFILE: '' } })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}
/** One state writer pass: ingest `inbox`, write canonical posts, fold, move `applied`. */
const writerPass = () => runWriter('await writer.pass()')
/** The user's reply in a work thread, as the UI route writes it. Returns its rid. */
const userReply = ({ item, re, text }) => {
  const rid = `ui-${randomUUID()}`
  const result = JSON.parse(runWriter(`process.stdout.write(JSON.stringify(await writer.writeUser(${JSON.stringify({ kind: 'answer', rid, root: item, re, text })})))`))
  assert.equal(result.refused, undefined, `the UI write was refused: ${result.refused}`)
  return rid
}
const ownerRead = async (path) => {
  const response = await fetch(`${workBoard.url}${path}`, { headers: { authorization: `Bearer ${workBoard.ownerToken}` } })
  assert.ok(response.ok, `GET ${path} answered ${response.status}`)
  return response.json()
}
const rootLabels = async (rid) => (await ownerRead(`/threads?${new URLSearchParams({ channel: 'work', label: `rid=${rid}` })}`)).threads[0]?.message.labels

// Each test works in a repo and a T3 thread of its own, because the board keeps the open items of
// earlier tests, and `work start` shows this repo's.
let thread
let workRepo
let workRepos = 0
const joinWork = (options = {}) => {
  workRepos += 1
  thread = `t3-${randomUUID()}`
  workRepo = makeRepo(`work-${workRepos}`, `git@github.com:${allowed}/work-${workRepos}.git`)
  joinBoard({ via: workProxy, ...options })
}
const work = (args, options = {}) => devchatAsync({ args: ['work', ...args], cwd: workRepo, sessionEnv: { ...boardSession, T3CODE_THREAD_ID: thread }, ...options })
const ridIn = (stdout, kind) => stdout.match(new RegExp(`^(${kind}-[a-z0-9-]+): saved`, 'mu'))?.[1]
const sentIntents = () => workProxy.requests.filter(({ method }) => method === 'POST').map(({ body }) => JSON.parse(JSON.parse(body).text))
const snapshotItem = (rid) => readJson(join(stateDir(), 'snapshot.json')).items.find((item) => item.rid === rid)
const replyCallFor = (item, turn) => `devchat work note ${item} --re ${turn} "<what you did, or the next question>"`
const answerCallFor = (item, turn) => `Answer it: ${replyCallFor(item, turn)}`
/** The line `work start` always prints for a pending item. */
const pickupLine = ({ item, turn, goal = 'Ship the export fix.' }) => `${item}  ${goal}  answer: ${replyCallFor(item, turn)}`

/** A board work item whose question the user answered, written by the real writer, and synced here. */
const answeredItem = async ({ goal = 'Ship the export fix.', answer = 'Use CSV.' } = {}) => {
  const start = await work(['start', goal])
  assert.equal(start.status, 0, start.stderr)
  const item = ridIn(start.stdout, 'work')
  const ask = ridIn((await work(['note', item, 'Which format? I recommend CSV.', '--ask'])).stdout, 'ask')
  assert.ok(item && ask)
  writerPass()
  const reply = userReply({ item, re: ask, text: answer })
  await syncOk()
  return { item, ask, reply }
}

test('work start, note, and done send one label-free inbox intent each, with the fields of spec §2', async () => {
  joinWork()
  const start = await work(['start', 'Ship the export fix.', '--issue', 'example-owner/tools#12'])
  assert.equal(start.status, 0, start.stderr)
  const item = ridIn(start.stdout, 'work')
  const repo = `${allowed}/work-${workRepos}`
  assert.match(start.stdout, new RegExp(`^${item}: saved to the board \\(${repo}\\) through the outbox\n${item}: sent$`, 'mu'))
  const pr = 'https://github.com/example-owner/tools/pull/12'
  assert.equal((await work(['note', 'The draft is up.', '--pr', pr])).status, 0, 'the T3 thread names the item')
  assert.equal((await work(['note', item.slice(0, -3), 'Which format? I recommend CSV.', '--ask', '--re', 'ui-0'])).status, 0, 'a unique prefix names it')
  assert.equal((await work(['note', item, 'Blocked on access. I recommend asking the owner.', '--blocked'])).status, 0)
  assert.equal((await work(['done', '--re', 'ui-0'])).status, 0)
  const [workIntent, note, ask, blocked, done] = sentIntents()
  const by = profile
  assert.deepEqual(workIntent, { v: 1, rid: item, kind: 'work', channel: 'work', text: 'Ship the export fix.', by, repo, machine, thread, issue: 'example-owner/tools#12' })
  assert.deepEqual(note, { v: 1, rid: note.rid, kind: 'note', root: item, text: 'The draft is up.', by, pr })
  assert.deepEqual(ask, { v: 1, rid: ask.rid, kind: 'ask', root: item, text: 'Which format? I recommend CSV.', by, re: 'ui-0' })
  assert.deepEqual(blocked, { v: 1, rid: blocked.rid, kind: 'ask', root: item, text: 'Blocked on access. I recommend asking the owner.', by, block: 1 })
  assert.deepEqual(done, { v: 1, rid: done.rid, kind: 'done', root: item, text: '', by, re: 'ui-0' })
  for (const { path, body } of workProxy.requests.filter(({ method }) => method === 'POST')) {
    assert.equal(path, '/api/board/messages', 'the client writes only to /messages')
    assert.deepEqual(Object.keys(JSON.parse(body)), ['channel', 'id', 'text'], 'no labels')
    assert.equal(JSON.parse(body).channel, 'inbox', 'never todos, work, msg, or sched')
  }

  writerPass()
  const labels = await rootLabels(item)
  assert.deepEqual({ status: labels.status, issue: labels.issue, thread: labels.thread, pr: labels['pr.12'] }, { status: 'done', issue: 'example-owner/tools#12', thread, pr })
})

test('a sent intent stays in the offline view until applied covers it', async () => {
  joinWork()
  const item = ridIn((await work(['start', 'Wait for the app.'])).stdout, 'work')
  assert.match((await work(['list'])).stdout, new RegExp(`^${item} {2}\\S+ {2}sent {4}Wait for the app\\.$`, 'mu'))
  await syncOk()
  assert.equal(snapshotItem(item), undefined, 'the app has not written it yet')
  assert.match((await work(['list'])).stdout, new RegExp(`^${item} {2}\\S+ {2}sent `, 'mu'), 'still in the view, from sent/')
  writerPass()
  await syncOk()
  assert.deepEqual(filesIn('outbox', 'sent'), [])
  assert.match((await work(['list'])).stdout, new RegExp(`^${item} {2}\\S+ {2}board `, 'mu'))
})

test('with the network blocked, work start prints a pending reply with its --re call', async () => {
  joinWork()
  const { item, reply } = await answeredItem()
  assert.deepEqual(snapshotItem(item).labels.turn, reply)
  const start = await work(['start', 'Another task.'], { preload: true })
  assert.equal(start.status, 0, start.stderr)
  assert.match(start.stdout, /: not sent yet \(the board is unreachable \(Error\)\): the next devchat sync sends it\n/u)
  assert.ok(start.stdout.includes([
    'Replies waiting for you; answer each with its call:',
    pickupLine({ item, turn: reply }),
    "What the user replied, cut short; devchat work show <rid> prints it whole:",
    `${item}:`,
    '  you asked: Which format? I recommend CSV.',
    '  the user replied: Use CSV.',
  ].join('\n')), start.stdout)
  assert.deepEqual(networkCalls(), ['fetch'], 'only the post-write sync tried the board')
})

test('work done without --re while a reply is pending sends nothing; a resolve the app refuses is reported', async () => {
  joinWork()
  const { item, reply } = await answeredItem()
  const before = workProxy.requests.length
  const done = await work(['done', item])
  assert.equal(done.status, 1)
  assert.match(done.stdout, new RegExp(`^${item} waits on a reply from the user, so work done sent nothing:$`, 'mu'))
  assert.ok(done.stdout.includes(`${pickupLine({ item, turn: reply })}\n`), done.stdout)
  assert.ok(done.stdout.includes(`  Read them whole: devchat work show ${item}\n  Then resolve it: devchat work done ${item} --re ${reply}\n`), done.stdout)
  assert.equal(workProxy.requests.length, before, 'no request')
  assert.deepEqual(filesIn('outbox'), [])

  // A reply that arrives after this machine's last sync: the resolve goes, and the app refuses it.
  const { item: late } = await answeredItem({ goal: 'A later reply.' })
  const ask = ridIn((await work(['note', late, 'Anything else? I recommend no.', '--ask', '--re', snapshotItem(late).labels.turn])).stdout, 'ask')
  writerPass()
  await syncOk()
  const newer = userReply({ item: late, re: ask, text: 'One more thing.' })
  const resolve = await work(['done', late])
  assert.equal(resolve.status, 0, resolve.stdout)
  const resolveRid = ridIn(resolve.stdout, 'done')
  writerPass()
  const sync = await syncOk()
  assert.match(sync.stdout, new RegExp(`^refused ${resolveRid}: pending$`, 'mu'))
  assert.ok(sync.stdout.includes(`not applied: ${late} waits on a reply. ${answerCallFor(late, newer)}`), sync.stdout)
  assert.equal((await rootLabels(late)).status, 'open')
  const start = await work(['start', 'Next task.'])
  assert.ok(start.stdout.includes(`${pickupLine({ item: late, turn: newer, goal: 'A later reply.' })}\n  not applied: ${resolveRid} (done), refused: pending\n`), start.stdout)
})

test('work note --re clears the reply; after a newer reply, that note clears nothing and the newer reply stays pending', async () => {
  joinWork()
  const { item, reply } = await answeredItem()
  const answered = await work(['note', item, 'Switched to CSV.', '--re', reply])
  assert.doesNotMatch(answered.stdout, /waits on a reply/u)
  assert.equal(snapshotItem(item).labels.ask, 'answered')
  assert.match((await work(['list'])).stdout, new RegExp(`^${item} {2}\\S+ {2}board {3}Ship the export fix\\.$`, 'mu'), 'the queued note folds into the view')
  writerPass()
  assert.equal((await rootLabels(item)).ask, undefined, 'the writer clears ask')

  // The same note, made offline against an older reply, reaches the writer after a newer one.
  const { item: other, reply: older } = await answeredItem({ goal: 'An offline answer.' })
  const offline = await work(['note', other, 'Done with CSV.', '--re', older], { preload: true })
  assert.match(offline.stdout, /not sent yet/u)
  const ask = (await rootLabels(other)).turn
  assert.equal(ask, older)
  const newer = userReply({ item: other, text: 'Also add a header row.' })
  await syncOk()
  writerPass()
  assert.deepEqual({ ask: (await rootLabels(other)).ask, turn: (await rootLabels(other)).turn }, { ask: 'answered', turn: newer })
  await syncOk()
  const start = await work(['start', 'Pick up.'])
  assert.ok(start.stdout.includes(pickupLine({ item: other, turn: newer, goal: 'An offline answer.' })), start.stdout)
  assert.ok(start.stdout.includes(`${other}:\n  the user replied: Also add a header row.\n`), start.stdout)
  assert.doesNotMatch(start.stdout, /the user replied: Use CSV\./u, 'the older reply is answered')
})

test('two user replies made while offline both print at work start, in order, and one --re note clears the item', async () => {
  joinWork()
  const { item, reply: first } = await answeredItem({ answer: 'Use CSV.' })
  const second = userReply({ item, text: 'And gzip it.' })
  await syncOk()
  const start = await work(['start', 'Pick up both.'])
  assert.ok(start.stdout.includes(pickupLine({ item, turn: second })), start.stdout)
  assert.ok(start.stdout.includes(`${item}:\n  you asked: Which format? I recommend CSV.\n  the user replied: Use CSV.\n  the user replied: And gzip it.\n`), start.stdout)
  assert.notEqual(first, second)
  await work(['note', item, 'CSV, gzipped.', '--re', second])
  writerPass()
  await syncOk()
  assert.equal(snapshotItem(item).labels.ask, undefined)
  const again = await work(['start', 'Again.'])
  assert.match(again.stdout, new RegExp(`^${item} {2}Ship the export fix\\.$`, 'mu'), 'open, with no reply waiting')
  assert.doesNotMatch(again.stdout, /Replies waiting/u)
})

test('the snapshot keeps the post turn names after four later notes', async () => {
  joinWork()
  const { item, reply } = await answeredItem({ answer: 'Keep this one.' })
  for (const text of ['One.', 'Two.', 'Three.', 'Four.']) {
    const note = await work(['note', item, text])
    assert.match(note.stdout, /waits on a reply from the user, so this note changes nothing there until you answer it:/u)
  }
  writerPass()
  await syncOk()
  const { labels, replies } = snapshotItem(item)
  assert.equal(labels.turn, reply)
  assert.deepEqual(replies.map(({ text }) => text), ['Which format? I recommend CSV.', 'Keep this one.', 'Two.', 'Three.', 'Four.'])
  const start = await work(['start', 'Pick up.'], { preload: true })
  assert.ok(start.stdout.includes(pickupLine({ item, turn: reply })), start.stdout)
  assert.ok(start.stdout.includes(`  the user replied: Keep this one.\n`), start.stdout)
})

test('an item marked done offline leaves work start and work list before sync', async () => {
  joinWork()
  const item = ridIn((await work(['start', 'Finish offline.'])).stdout, 'work')
  writerPass()
  await syncOk()
  assert.match((await work(['start', 'Look.'])).stdout, new RegExp(`^${item} {2}Finish offline\\.$`, 'mu'))
  const done = await work(['done', item], { preload: true })
  assert.equal(done.status, 0, done.stderr)
  assert.doesNotMatch((await work(['start', 'Look again.'], { preload: true })).stdout, new RegExp(item, 'u'))
  assert.doesNotMatch((await work(['list'], { preload: true })).stdout, new RegExp(item, 'u'))
})

test('a note on a resolved item reopens it: the snapshot keeps resolved roots by their labels', async () => {
  joinWork()
  const item = ridIn((await work(['start', 'Reopen me.'])).stdout, 'work')
  await work(['done', item])
  writerPass()
  await syncOk()
  assert.equal(snapshotItem(item), undefined, 'not among the open items')
  const resolved = readJson(join(stateDir(), 'snapshot.json')).resolved.find(({ rid }) => rid === item)
  assert.deepEqual({ status: resolved.labels.status, text: resolved.text }, { status: 'done', text: '' })
  assert.doesNotMatch((await work(['list'])).stdout, new RegExp(item, 'u'))
  assert.equal((await work(['done', item])).status, 1, 'a resolve takes only an open item')
  const note = await work(['note', item.slice(0, -2), 'One more fix.'])
  assert.equal(note.status, 0, note.stderr)
  writerPass()
  assert.equal((await rootLabels(item)).status, 'open')
  await syncOk()
  assert.equal(snapshotItem(item).labels.status, 'open')
})

test('todo done resolves a board todo through a resolve intent', async () => {
  joinWork()
  const add = await devchatAsync({ args: ['todo', 'add', 'Resolve me on the board.'] })
  const rid = ridOf(add.stdout)
  writerPass()
  await syncOk()
  const done = await devchatAsync({ args: ['todo', 'done', rid] })
  assert.equal(done.status, 0, done.stderr)
  assert.deepEqual(sentIntents().at(-1), { v: 1, rid: ridIn(done.stdout, 'done'), kind: 'done', root: rid, text: '', by: profile })
  assert.doesNotMatch((await devchatAsync({ args: ['todo', 'list'] })).stdout, new RegExp(rid, 'u'), 'gone from the view at once')
  writerPass()
  await syncOk()
  assert.equal(readJson(join(stateDir(), 'snapshot.json')).items.some((item) => item.rid === rid), false)
})

test('a session whose writes stay local keeps its work items local, and saves nothing on a board item', async () => {
  joinWork()
  const boardItem = ridIn((await work(['start', 'On the board.'])).stdout, 'work')
  const codex = { CODEX_THREAD_ID: 'codex-session', T3CODE_THREAD_ID: 't3-codex' }
  const refused = await work(['note', boardItem, 'From Codex.'], { sessionEnv: codex, preload: true })
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, new RegExp(`${boardItem} is on the board, and this session's writes stay on this machine \\(codex sessions stay on this machine\\)\\. Nothing was saved\\.`, 'u'))
  const start = await work(['start', 'Kept here.'], { sessionEnv: codex, preload: true })
  const item = ridIn(start.stdout, 'work')
  assert.match(start.stdout, new RegExp(`^${item}: saved on this machine only \\(codex sessions stay on this machine\\)$`, 'mu'))
  assert.match(start.stdout, new RegExp(`^${boardItem} {2}On the board\\.$`, 'mu'), 'board items of this repo show too')
  assert.equal((await work(['note', 'Asking. I recommend yes.', '--ask'], { sessionEnv: codex, preload: true })).status, 0)
  assert.equal((await work(['done'], { sessionEnv: codex, preload: true })).status, 0)
  assert.equal(readJson(join(localDir(), `${item}.json`)).labels.status, 'done')
  assert.deepEqual(networkCalls(), [], 'no request from the local session')
  assert.deepEqual(filesIn('outbox').map((name) => readJson(join(stateDir(), 'outbox', name)).target), [], 'nothing queued')
})

test('the check at flush holds reply intents to their canonical shape', async () => {
  joinWork()
  const item = ridIn((await work(['start', 'Check replies.'])).stdout, 'work')
  workProxy.fault = () => 503
  assert.ok(ridIn((await work(['start', 'Another root.'])).stdout, 'work'))
  assert.ok(ridIn((await work(['note', item, 'A note.', '--pr', 'https://github.com/example-owner/tools/pull/3'])).stdout, 'note'))
  const { entry: queuedNote, intent, withIntent } = queuedFile(1)
  assert.equal(queuedNote.epoch, '1', 'a reply is queued under its root\'s epoch')
  const planted = {
    'a repo field on a reply': [withIntent({ ...intent, repo: `${allowed}/tools` }), 'the intent is not a release 1 intent'],
    'a pr on a resolve': [withIntent({ ...intent, kind: 'done', text: '' }), 'the intent is not a release 1 intent'],
    'text on a resolve': [withIntent({ v: 1, rid: intent.rid, kind: 'done', root: item, text: 'x', by: profile }), 'the text is empty or too long'],
    'a pr that is not a pull request': [withIntent({ ...intent, pr: 'https://github.com/example-owner/tools/issues/3' }), 'the pr is not a pull request URL'],
    'a root that is not a rid': [withIntent({ ...intent, root: 'a|b' }), 'a target is not a rid'],
    'a block that is not 1': [withIntent({ v: 1, rid: intent.rid, kind: 'ask', root: item, text: 'Q?', by: profile, block: true }), 'the intent is not a release 1 intent'],
    'a pr in a repo off the allowlist': [withIntent({ ...intent, pr: 'https://github.com/other-owner/service/pull/3' }), 'a reference names a repo off the allowlist'],
    'an issue in a repo off the allowlist': [(({ intent: root, withIntent: withRoot }) => withRoot({ ...root, issue: 'other-owner/service#3' }))(queuedFile(0)), 'a reference names a repo off the allowlist'],
  }
  const outbox = join(stateDir(), 'outbox')
  for (const [index, [value]] of Object.values(planted).entries()) writeFileSync(join(outbox, `0000-${index}.json`), JSON.stringify(value))
  workProxy.fault = () => null
  const sync = await syncOk()
  for (const [index, [label, [, reason]]] of Object.entries(planted).entries()) {
    assert.match(sync.stdout, new RegExp(`rejected 0000-${index}\\.json: ${reason}\n`, 'u'), label)
  }
  assert.deepEqual(sentIntents().map(({ kind }) => kind), ['work', 'work', 'note'], 'the queued intents go, byte for byte')
})

test('--issue and --pr name only allowlisted repos on the board, at queue time', async () => {
  joinWork()
  const other = 'other-owner/service'
  for (const args of [['start', 'Leak?', '--issue', `${other}#3`], ['start', 'Leak?', '--issue', `https://github.com/${other}/issues/3`], ['start', 'Odd?', '--issue', 'ABC-123']]) {
    const refused = await work(args, { preload: true })
    assert.equal(refused.status, 1, args.join(' '))
    assert.doesNotMatch(refused.stderr, /other-owner/u, 'the refusal does not repeat the reference')
  }
  assert.deepEqual(filesIn('outbox'), [])
  const start = await work(['start', 'Ship it.', '--issue', '#3'])
  const item = ridIn(start.stdout, 'work')
  for (const pr of [`https://github.com/${other}/pull/3`, 'https://example.test/x/y/pull/3']) {
    assert.equal((await work(['note', item, 'A PR.', '--pr', pr], { preload: true })).status, 1, pr)
  }
  assert.equal((await work(['note', item, 'Own repo.', '--pr', '7'])).status, 0)
  assert.equal((await work(['note', item, 'Allowlisted.', '--pr', `https://github.com/${allowed}/tools/pull/8`])).status, 0)
  assert.deepEqual(sentIntents().map(({ issue, pr }) => issue ?? pr), ['#3', `https://github.com/${allowed}/work-${workRepos}/pull/7`, `https://github.com/${allowed}/tools/pull/8`])
})

const unknownWork = 'devchat: no work item on this machine has that rid: run devchat sync, or find it with devchat work list\n'

test('a target must be a seen item of the configured board, of the right kind, in this session\'s repo', async () => {
  joinWork()
  const repo = `${allowed}/work-${workRepos}`
  const uiTodo = `ui-${randomUUID()}`
  assert.equal(JSON.parse(runWriter(`process.stdout.write(JSON.stringify(await writer.writeUser(${JSON.stringify({ kind: 'todo', rid: uiTodo, text: 'A UI todo.', repo })})))`)).refused, undefined)
  const item = ridIn((await work(['start', 'Mine.'])).stdout, 'work')
  writerPass()
  await syncOk()
  const before = filesIn('outbox', 'sent').length

  const wrongKind = await work(['done', uiTodo])
  assert.equal(wrongKind.status, 1)
  assert.match(wrongKind.stderr, /no work item on this machine has that rid: run devchat sync, or find it with devchat work list/u)
  const elsewhere = makeRepo(`work-${workRepos}-other`, `git@github.com:${allowed}/work-${workRepos}-other.git`)
  const otherRepo = await work(['note', item, 'From another repo.'], { cwd: elsewhere })
  assert.equal(otherRepo.status, 1)
  assert.equal(otherRepo.stderr, unknownWork, "another repo's item reads as an unknown rid")
  const otherShow = await work(['show', item], { cwd: elsewhere })
  assert.deepEqual({ status: otherShow.status, stdout: otherShow.stdout, stderr: otherShow.stderr }, { status: 1, stdout: '', stderr: unknownWork })
  assert.doesNotMatch((await work(['list'], { cwd: elsewhere })).stdout, new RegExp(item, 'u'))
  // Outside any git checkout, a command sees every repo's items.
  assert.equal((await devchatAsync({ args: ['work', 'show', item], cwd: root, sessionEnv: {} })).status, 0)
  const unseen = await work(['note', `work-${'0'.repeat(8)}-00000000`, 'Never seen.'])
  assert.equal(unseen.status, 1)
  assert.match(unseen.stderr, /no work item on this machine has that rid/u)
  assert.deepEqual(filesIn('outbox'), [])
  assert.equal(filesIn('outbox', 'sent').length, before, 'nothing was queued')
  // Prefix matching sees only this repo's items: `work-` names the one item here, not all of them.
  const here = ridIn((await work(['start', 'Elsewhere.'], { cwd: elsewhere })).stdout, 'work')
  const byPrefix = await work(['note', 'work-', 'By prefix.'], { cwd: elsewhere })
  assert.equal(byPrefix.status, 0, byPrefix.stderr)
  assert.equal(sentIntents().at(-1).root, here)
  assert.equal((await devchatAsync({ args: ['todo', 'done', uiTodo], cwd: workRepo })).status, 0, 'the todo resolves as a todo')
})

test('an invalid or unknown rid argument is never printed', async () => {
  joinWork()
  for (const rid of ['password=hunter2', 'AKIAABCDEFGHIJKLMNOP']) {
    for (const args of [['note', rid, 'Text.'], ['done', rid], ['show', rid], ['drop', rid]]) {
      const result = await work(args, { preload: true })
      assert.equal(result.status, 1, args.join(' '))
      assert.ok(!`${result.stdout}${result.stderr}`.includes(rid.slice(4)), `${args[0]} printed its rid argument`)
    }
    const todo = await devchatAsync({ args: ['todo', 'done', rid], cwd: workRepo, preload: true })
    assert.ok(!todo.stderr.includes(rid.slice(4)))
  }
  assert.match((await work(['done', 'password=hunter2'], { preload: true })).stderr, /the work item rid is not a devchat rid/u)
})

test("another board's snapshot, replies, refusals, and thread items stay out of the view", async () => {
  joinWork()
  const { item, reply } = await answeredItem()
  const refused = ridIn((await work(['done', item, '--re', 'ui-0'])).stdout, 'done')
  writerPass()
  await syncOk()
  assert.equal(filesIn('outbox', 'rejected').length, 1, `${refused} was refused`)
  const onA = await work(['start', 'On board A.'])
  assert.ok(onA.stdout.includes(pickupLine({ item, turn: reply })), onA.stdout)

  // The same repo and T3 thread, configured for board B.
  const [repoA, threadA] = [workRepo, thread]
  joinWork({ boardUrl: offlineBoardUrl })
  ;[workRepo, thread] = [repoA, threadA]
  const viaThread = await work(['note', 'Which item?'], { preload: true })
  assert.equal(viaThread.status, 1)
  assert.match(viaThread.stderr, /no open work item belongs to this T3 thread/u)
  assert.equal((await work(['note', item, 'By rid.'], { preload: true })).status, 1)
  const onB = await work(['start', 'On board B.'], { preload: true })
  assert.equal(onB.status, 0, onB.stderr)
  assert.doesNotMatch(onB.stdout, new RegExp(`${item}|${reply}|not applied`, 'u'))
  assert.match(onB.stdout, /Nothing else is open in this repo\./u)
  assert.doesNotMatch((await work(['list'], { preload: true })).stdout, new RegExp(item, 'u'))
})

test('a resolve the pending guard stops does not hide a newer reply', async () => {
  joinWork()
  const { item, reply } = await answeredItem()
  assert.equal((await work(['done', item, '--re', reply], { preload: true })).status, 0)
  const newer = userReply({ item, text: 'Wait, one more thing first.' })
  await syncOk()
  const start = await work(['start', 'Pick up.'], { preload: true })
  assert.ok(start.stdout.includes(pickupLine({ item, turn: newer })), start.stdout)
  assert.ok(start.stdout.includes('  the user replied: Wait, one more thing first.\n'), start.stdout)
})

test('pickup shows no call for an item whose thread moved past the turn it read', async () => {
  joinWork()
  const { item } = await answeredItem()
  const { item: resolved, reply: resolvedTurn } = await answeredItem({ goal: 'Resolved meanwhile.' })
  let newer
  // Between the sync's root listing and its reads of the items' replies, the user replies on one
  // item, and an agent resolves the other.
  workProxy.fault = (req) => {
    if (!newer && req.url.startsWith('/api/board/messages/')) {
      newer = userReply({ item, text: 'A later reply.' })
      const intent = { v: 1, rid: `done-${randomUUID()}`, kind: 'done', root: resolved, text: '', by: profile, re: resolvedTurn }
      postAsHost({ on: workBoard, channel: 'inbox', id: intent.rid, text: JSON.stringify(intent) })
      writerPass()
    }
    return null
  }
  await syncOk()
  workProxy.fault = () => null
  assert.ok(newer)
  const first = await work(['start', 'Pick up.'], { preload: true })
  for (const [rid, goal] of [[item, 'Ship the export fix.'], [resolved, 'Resolved meanwhile.']]) {
    assert.ok(first.stdout.includes(`${rid}  ${goal}  changed since the last sync: run devchat sync, then answer it\n`), first.stdout)
    assert.doesNotMatch(first.stdout, new RegExp(`devchat work note ${rid} --re|^${rid}:$`, 'mu'), 'no call and no replies')
  }
  const show = await work(['show', item], { preload: true })
  assert.match(show.stdout, /This item changed since the last sync: run devchat sync, then answer it\.\n$/u)
  assert.doesNotMatch(show.stdout, /devchat work note|Which format|Use CSV/u, 'no call and no replies')
  await syncOk()
  const second = await work(['start', 'Pick up again.'], { preload: true })
  assert.ok(second.stdout.includes(pickupLine({ item, turn: newer })), second.stdout)
  assert.ok(second.stdout.includes('  the user replied: A later reply.\n'), second.stdout)
})

test('a refused resolve on a changed item reports the change, never the call it read', async () => {
  joinWork()
  const { item, reply } = await answeredItem()
  userReply({ item, text: 'One more thing.' })
  const done = ridIn((await work(['done', item, '--re', reply], { preload: true })).stdout, 'done')
  await syncOk()
  writerPass()
  // Between the sync's root listing and its reads of the replies, the user replies again.
  let injected = false
  workProxy.fault = (req) => {
    if (!injected && req.url.startsWith('/api/board/messages/')) {
      injected = true
      userReply({ item, text: 'And another.' })
    }
    return null
  }
  const sync = await syncOk()
  workProxy.fault = () => null
  assert.ok(injected)
  assert.match(sync.stdout, new RegExp(`^refused ${done}: pending\nnot applied: ${item} changed since the last sync: run devchat sync, then answer it$`, 'mu'))
  assert.doesNotMatch(sync.stdout, /--re/u)
})

// Fully offline, nothing is stamped. With only posts failing, a sync stamps each root with the
// board's epoch before its post fails, and still no snapshot exists.
for (const [outage, fault] of [['fully offline', () => 503], ['with only posts failing', (req) => (req.method === 'POST' ? 503 : null)]]) {
  test(`${outage} from the first run, a resolve on a root not yet in a snapshot is queued, and both send with one epoch`, async () => {
    joinWork()
    rmSync(join(stateDir(), 'snapshot.json'), { force: true })
    workProxy.fault = fault
    const todo = ridIn((await devchatAsync({ args: ['todo', 'add', 'Offline todo.'], cwd: workRepo })).stdout, 'todo')
    const todoDone = await devchatAsync({ args: ['todo', 'done', todo], cwd: workRepo })
    assert.equal(todoDone.status, 0, todoDone.stderr)
    const item = ridIn((await work(['start', 'Offline work.'])).stdout, 'work')
    const workDone = await work(['done'])
    assert.equal(workDone.status, 0, workDone.stderr)
    assert.doesNotMatch((await devchatAsync({ args: ['todo', 'list'], cwd: workRepo })).stdout, new RegExp(todo, 'u'))
    assert.deepEqual(filesIn('outbox').map((name) => readJson(join(stateDir(), 'outbox', name)).epoch), outage === 'fully offline' ? [null, null, null, null] : ['1', '1', null, null])
    workProxy.fault = () => null
    await syncOk()
    assert.deepEqual(filesIn('outbox', 'sent').slice(-4).map((name) => readJson(join(stateDir(), 'outbox', 'sent', name)).epoch), ['1', '1', '1', '1'])
    writerPass()
    await syncOk()
    assert.equal((await rootLabels(item)).status, 'done')
    const todoRoot = (await ownerRead(`/threads?${new URLSearchParams({ channel: 'todos', label: `rid=${todo}` })}`)).threads[0]?.message.labels
    assert.equal(todoRoot?.status, 'done')
  })
}

test('the outbox sends in queue order whatever the clock says', async () => {
  joinWork()
  // Every write in this test reads one fixed time, so a name taken from the clock could not order them.
  const clock = join(root, 'fixed-clock.mjs')
  writeFileSync(clock, `const fixed = Date.parse('2030-01-01T00:00:00.000Z')
const Real = Date
globalThis.Date = class extends Real {
  constructor(...args) { super(...(args.length > 0 ? args : [fixed])) }
  static now() { return fixed }
}
`)
  const sessionEnv = { ...boardSession, T3CODE_THREAD_ID: thread, NODE_OPTIONS: `--import=${pathToFileURL(clock).href}` }
  workProxy.fault = () => 503
  const item = ridIn((await work(['start', 'Fixed clock.'], { sessionEnv })).stdout, 'work')
  assert.equal((await work(['done'], { sessionEnv })).status, 0)
  assert.deepEqual(filesIn('outbox').map((name) => readJson(join(stateDir(), 'outbox', name)).target.split('-')[0]), ['work', 'done'])
  workProxy.fault = () => null
  await syncOk()
  writerPass()
  await syncOk()
  assert.equal((await rootLabels(item)).status, 'done')
})

test("a write's own sync reports only its repo's refusals; devchat sync reports all", async () => {
  joinWork()
  const repoA = workRepo
  const item = ridIn((await work(['start', 'In repo A.'])).stdout, 'work')
  writerPass()
  await syncOk()
  userReply({ item, text: 'A reply this machine has not seen.' })
  const resolve = ridIn((await work(['done', item])).stdout, 'done')
  writerPass()
  workRepo = makeRepo(`work-${workRepos}-b`, `git@github.com:${allowed}/work-${workRepos}-b.git`)
  const inB = await work(['start', 'In repo B.'])
  assert.equal(inB.status, 0, inB.stderr)
  assert.doesNotMatch(inB.stdout, new RegExp(`${item}|${resolve}|refused|not applied`, 'u'))
  assert.deepEqual(filesIn('outbox', 'rejected').length, 1, 'the refusal was retired all the same')
  workRepo = repoA
  const inA = await work(['start', 'Back in repo A.'])
  assert.ok(inA.stdout.includes(`  not applied: ${resolve} (done), refused: pending`), inA.stdout)

  const other = ridIn((await work(['done', item])).stdout, 'done')
  assert.equal(other, undefined, 'the pending reply now blocks work done here')
})

test('one long pending item never pushes the others out of pickup', async () => {
  joinWork()
  const { item: long, reply } = await answeredItem({ goal: 'A long thread.' })
  let turn = reply
  for (let index = 0; index < 6; index += 1) turn = userReply({ item: long, text: `${index} ${'x'.repeat(158)}` })
  // Four more pending items, with goals of the 48 characters a call line keeps: their call lines
  // alone pass the 1 KB budget.
  const goalOf = (index) => `Thread ${index} ${'g'.repeat(39)}`
  const others = []
  for (let index = 0; index < 4; index += 1) others.push(await answeredItem({ goal: goalOf(index) }))
  await syncOk()
  const start = await work(['start', 'Pick up.'], { preload: true })
  assert.ok(start.stdout.includes(pickupLine({ item: long, turn, goal: 'A long thread.' })), start.stdout)
  for (const [index, { item, reply: turnOf }] of others.entries()) assert.ok(start.stdout.includes(pickupLine({ item, turn: turnOf, goal: goalOf(index) })), start.stdout)
  assert.match(start.stdout, /\d+ more not shown: devchat work list, devchat todo list\n$/u)
  const [, , ...context] = start.stdout.trimEnd().split('\n')
  assert.ok(Buffer.byteLength(context.join('\n')) > 1024, 'the call lines show past the budget')
  const show = await work(['show', long], { preload: true })
  assert.ok(show.stdout.includes(`5 ${'x'.repeat(158)}`), 'work show prints a reply whole')
  assert.ok(show.stdout.includes(answerCallFor(long, turn)), show.stdout)
})

// Inside a git checkout, every todo and work command sees only that checkout's repo, whatever the
// session; outside any checkout, it sees every item.
const localRid = (result, kind) => result.stdout.match(new RegExp(`^(${kind}-[a-z0-9-]+): saved on this machine only`, 'mu'))?.[1]
const unknownRid = (noun, list) => `devchat: no ${noun} on this machine has that rid: run devchat sync, or find it with devchat ${list} list\n`

test("an Antigravity session in a T3 thread cannot see or resolve another repo's local work item", () => {
  writeConfig({ mode: 'off', githubLogin: allowed })
  const sessionEnv = { T3CODE_THREAD_ID: 't3-antigravity' }
  const repoA = makeRepo('scope-a', `git@github.com:${allowed}/scope-a.git`)
  const repoB = makeRepo('scope-b', `git@github.com:${allowed}/scope-b.git`)
  const item = localRid(devchat({ args: ['work', 'start', 'A goal in repo A.'], cwd: repoA, sessionEnv }), 'work')
  assert.ok(item)
  for (const args of [['show', item], ['done', item], ['done'], ['note', item, 'From repo B.']]) {
    const result = devchat({ args: ['work', ...args], cwd: repoB, sessionEnv })
    assert.equal(result.status, 1, args.join(' '))
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /A goal in repo A/u, args.join(' '))
  }
  assert.equal(devchat({ args: ['work', 'show', item], cwd: repoB, sessionEnv }).stderr, unknownRid('work item', 'work'))
  assert.doesNotMatch(devchat({ args: ['work', 'list'], cwd: repoB, sessionEnv }).stdout, new RegExp(item, 'u'))
  assert.equal(readJson(join(localDir(), `${item}.json`)).labels.status, 'open')
  assert.equal(devchat({ args: ['work', 'done', item], cwd: repoA, sessionEnv }).status, 0)
})

/** Adds a todo in each of two checkouts, and asserts that neither sees or resolves the other's. */
const assertApart = (clones) => {
  const [first, second] = clones.map((cwd, index) => localRid(devchat({ args: ['todo', 'add', `Todo ${index + 1}.`], cwd }), 'todo'))
  const listed = clones.map((cwd) => devchat({ args: ['todo', 'list'], cwd }).stdout)
  assert.match(listed[0], new RegExp(first, 'u'))
  assert.doesNotMatch(listed[0], new RegExp(second, 'u'))
  assert.match(listed[1], new RegExp(second, 'u'))
  assert.doesNotMatch(listed[1], new RegExp(first, 'u'))
  assert.equal(devchat({ args: ['todo', 'done', first], cwd: clones[1] }).stderr, unknownRid('todo', 'todo'))
  assert.equal(devchat({ args: ['todo', 'done', first], cwd: clones[0] }).status, 0)
}

test('checkouts whose origin is a relative path to different repositories keep their todos apart', () => {
  writeConfig({ mode: 'off', githubLogin: allowed })
  assertApart(['one', 'two'].map((name) => {
    makeRepo(`relative-${name}/upstream`)
    return makeRepo(`relative-${name}/clone`, '../upstream')
  }))
})

// A checkout that is not a GitHub one is scoped by its own git directory; its origin is never read.
test('two clones of one local upstream keep their todos apart, before and after one points at ../backup', () => {
  writeConfig({ mode: 'off', githubLogin: allowed })
  makeRepo('shared/upstream')
  makeRepo('shared/backup')
  const clones = ['shared/a', 'shared/b'].map((name) => makeRepo(name, '../upstream'))
  assertApart(clones)
  execFileSync('git', ['-C', clones[1], 'remote', 'set-url', 'origin', '../backup'])
  assertApart(clones)
})

test('a file:// origin with %20 and a path with a literal %20 keep their todos apart', () => {
  writeConfig({ mode: 'off', githubLogin: allowed })
  const dir = join(root, 'repos', 'percent')
  makeRepo('percent/up stream')
  makeRepo('percent/up%20stream')
  assertApart([makeRepo('percent/a', `file://${dir}/up%20stream`), makeRepo('percent/b', `${dir}/up%20stream`)])
})

test('an origin through a symbolic link and its lexical twin keep their todos apart', () => {
  writeConfig({ mode: 'off', githubLogin: allowed })
  const dir = join(root, 'repos', 'linked')
  mkdirSync(join(dir, 'elsewhere', 'inner'), { recursive: true })
  const a = makeRepo('linked/a', 'link/../upstream')
  symlinkSync(join(dir, 'elsewhere', 'inner'), join(a, 'link'))
  assertApart([a, makeRepo('linked/b', `${dir}/a/upstream`)])
})

test('a git failure other than no repository scopes a command to nothing', () => {
  writeConfig({ mode: 'off', githubLogin: allowed })
  const [a, b] = [makeRepo('broken-a'), makeRepo('broken-b')]
  const todo = localRid(devchat({ args: ['todo', 'add', 'In A.'], cwd: a }), 'todo')
  assert.ok(todo)
  writeFileSync(join(b, '.git', 'config'), `${readFileSync(join(b, '.git', 'config'), 'utf8')}[remote\n`)
  const failure = 'devchat: git could not read the repository here, so devchat shows and changes no item. Fix the repository, or run the command outside any git checkout. Nothing was saved.\n'
  for (const args of [['todo', 'list'], ['todo', 'done', todo]]) {
    const result = devchat({ args, cwd: b })
    assert.deepEqual({ status: result.status, stdout: result.stdout, stderr: result.stderr }, { status: 1, stdout: '', stderr: failure }, args.join(' '))
  }
  assert.equal(readJson(join(localDir(), `${todo}.json`)).labels.status, 'open')
})

test('a checkout with no origin keeps its own work items', () => {
  writeConfig({ mode: 'off', githubLogin: allowed })
  const [fresh, other] = [makeRepo('no-origin-fresh'), makeRepo('no-origin-other')]
  const item = localRid(devchat({ args: ['work', 'start', 'No origin.'], cwd: fresh }), 'work')
  assert.ok(item)
  assert.equal(devchat({ args: ['work', 'show', item], cwd: other }).stderr, unknownRid('work item', 'work'))
  const done = devchat({ args: ['work', 'done', item], cwd: fresh })
  assert.equal(done.status, 0, done.stderr)
  assert.equal(readJson(join(localDir(), `${item}.json`)).labels.status, 'done')
})

test('a rid prefix must be unique among open and resolved items', () => {
  writeConfig({ mode: 'off', githubLogin: allowed })
  const item = (rid, status) => ({ rid, channel: 'work', text: `Item ${rid}.`, labels: { rid, status }, identity: `github.com/${allowed}/tools`, createdAt: '2026-01-01T00:00:00.000Z', replies: [] })
  mkdirSync(localDir(), { recursive: true })
  writeFileSync(join(localDir(), 'work-abc-11111111.json'), JSON.stringify(item('work-abc-11111111', 'done')))
  writeFileSync(join(localDir(), 'work-abc-22222222.json'), JSON.stringify(item('work-abc-22222222', 'open')))
  const done = devchat({ args: ['work', 'done', 'work-abc'] })
  assert.equal(done.status, 1)
  assert.match(done.stderr, /that rid prefix matches 2 work items: work-abc-11111111, work-abc-22222222/u)
  assert.equal(readJson(join(localDir(), 'work-abc-22222222.json')).labels.status, 'open')
  assert.equal(devchat({ args: ['work', 'done', 'work-abc-2'] }).status, 0)
})

const setWorkEpoch = async (epoch) => {
  const response = await fetch(`${workBoard.url}/messages/${workMarker.id}/labels`, {
    method: 'POST', headers: { authorization: `Bearer ${workBoard.ownerToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ set: { epoch } }),
  })
  assert.ok(response.ok, `the epoch label answered ${response.status}`)
}

test('a reply never crosses a board restore: a root seen under another epoch reads as unknown', async () => {
  joinWork()
  const [repoA, threadA] = [workRepo, thread]
  const item = ridIn((await work(['start', 'Before the restore.'])).stdout, 'work')
  assert.equal(filesIn('outbox', 'sent').length, 1, 'sent, and not decided yet')
  joinBoard({ via: proxy })
  await syncOk()
  try {
    await setWorkEpoch('2')
    joinWork()
    ;[workRepo, thread] = [repoA, threadA]
    const note = await work(['note', item, 'After the restore.'], { preload: true })
    assert.equal(note.status, 1)
    assert.equal(note.stderr, unknownWork)
    assert.deepEqual(filesIn('outbox'), [])
    await syncOk()
    assert.equal((await work(['note', item, 'After the sync.'])).status, 1, 'the epoch 1 root is gone from the view')
    assert.deepEqual(filesIn('outbox'), [])
  } finally {
    await setWorkEpoch('1')
  }
})

test("work done in another repo or a local session prints nothing of the item's thread", async () => {
  joinWork()
  const { item } = await answeredItem({ goal: 'A private goal.', answer: 'A private answer.' })
  const leaks = /A private goal|Which format|A private answer|--re ui-/u
  workRepo = makeRepo(`work-${workRepos}-elsewhere`, `git@github.com:${allowed}/work-${workRepos}-elsewhere.git`)
  const elsewhere = await work(['done', item])
  assert.equal(elsewhere.status, 1)
  assert.equal(elsewhere.stderr, unknownWork)
  const local = await work(['drop', item], { sessionEnv: { CODEX_THREAD_ID: 'codex-session' } })
  assert.equal(local.status, 1)
  for (const result of [elsewhere, local]) assert.doesNotMatch(`${result.stdout}${result.stderr}`, leaks)
})

test("a write's own sync names no outbox file when the outbox is held; devchat sync does", async () => {
  joinWork()
  const item = ridIn((await work(['start', 'Held.'])).stdout, 'work')
  workProxy.fault = () => 503
  await work(['note', item, 'Queued.'])
  workProxy.fault = () => null
  const [name] = filesIn('outbox')
  const path = join(stateDir(), 'outbox', name)
  writeFileSync(path, JSON.stringify({ ...readJson(path), board: offlineBoardUrl }))
  const start = await work(['start', 'Another.'])
  assert.match(start.stdout, /not sent yet \(the outbox is held by a write queued for another board or epoch; run devchat sync for details\)/u)
  assert.doesNotMatch(start.stdout, new RegExp(name.replace('.json', ''), 'u'))
  const sync = await devchatAsync({ args: ['sync'] })
  assert.equal(sync.status, 1)
  assert.match(sync.stderr, new RegExp(`${name} was queued for another board than the configured one`, 'u'))
})

test('repos compare ignoring case: targets, pickup, and session records', async () => {
  joinWork()
  const item = ridIn((await work(['start', 'Any case.'])).stdout, 'work')
  workRepo = makeRepo(`work-${workRepos}-upper`, `git@github.com:${allowed.toUpperCase()}/WORK-${workRepos}.git`)
  const start = await work(['start', 'Upper case.'])
  assert.match(start.stdout, new RegExp(`^${item} {2}Any case\\.$`, 'mu'), "this repo's item, whatever the case")
  assert.equal((await work(['note', item, 'From the upper-case clone.'])).status, 0)

  rmSync(join(stateDir(), 'sessions'), { recursive: true, force: true })
  const lower = makeRepo('case-lower', `git@github.com:${allowed}/case.git`)
  const upper = makeRepo('case-upper', `git@github.com:${allowed.toUpperCase()}/CASE.git`)
  startSession({ key: 'case', cwd: lower })
  startSession({ key: 'case', cwd: upper, source: 'resume' })
  assert.deepEqual(sessionRecord().conflicting, false, 'the same repo in another case does not conflict')
})

test('--issue and --pr URLs match their scheme and host ignoring case, and their path exactly', async () => {
  joinWork()
  const repo = `${allowed}/work-${workRepos}`
  const start = await work(['start', 'Case URLs.', '--issue', `HTTPS://GITHUB.COM/${repo}/issues/2`])
  const item = ridIn(start.stdout, 'work')
  assert.ok(item, start.stderr)
  assert.equal((await work(['note', item, 'Upper host.', '--pr', `Https://GitHub.com/${repo}/pull/9`])).status, 0)
  assert.equal((await work(['note', item, 'Upper path.', '--pr', `https://github.com/${repo}/PULL/9`], { preload: true })).status, 1)
  assert.equal((await work(['note', item, 'Other owner.', '--pr', 'HTTPS://GITHUB.COM/other-owner/service/pull/9'], { preload: true })).status, 1)
  assert.deepEqual(sentIntents().map(({ issue, pr }) => issue ?? pr), [`HTTPS://GITHUB.COM/${repo}/issues/2`, `Https://GitHub.com/${repo}/pull/9`])
})

// Admin: the todos import and its rollback list (spec §9), against the `gh` stub. Import runs in
// mode readwrite only, so these tests join the work board.
const ghIssues = (issues) => writeFileSync(join(home, 'gh-issues.json'), JSON.stringify(issues))
const ghCalls = () => (existsSync(join(home, 'gh.log')) ? readFileSync(join(home, 'gh.log'), 'utf8').split('\n').filter(Boolean) : [])
const ghIssue = (number, title, from) => ({ number, title, body: from === undefined ? 'Added by hand.' : `From: ${from} · Host: example-host`, createdAt: '2026-01-01T00:00:00Z' })
const ghReads = /^(?:api user|repo view example-login\/todos|issue list -R example-login\/todos) /u
const importSource = () => join(stateDir(), 'import-source.json')
/** Runs import once to read its preview digest, then again with `--yes <digest>`, as an agent does after approval. */
const importApproved = async (options = {}) => {
  const preview = await devchatAsync({ args: ['admin', 'import'], cwd: root, sessionEnv: {}, ...options })
  const digest = /^preview digest: ([0-9a-f]{12})$/mu.exec(preview.stdout)?.[1]
  assert.ok(digest, `${preview.stdout}${preview.stderr}`)
  return devchatAsync({ args: ['admin', 'import', '--yes', digest], cwd: root, sessionEnv: {}, ...options })
}
/** Starts an import that waits on its approval prompt; `answer` sends the reply and resolves to its result. */
const waitingImport = async () => {
  const { NODE_OPTIONS, ...childEnv } = env
  const child = spawn('/bin/sh', [launcher, 'admin', 'import'], { cwd: root, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] })
  const result = { stdout: '', stderr: '' }
  child.stdout.on('data', (chunk) => { result.stdout += chunk })
  child.stderr.on('data', (chunk) => { result.stderr += chunk })
  const closed = new Promise((resolve) => child.on('close', (status) => resolve({ ...result, status })))
  for (let tries = 0; !result.stdout.includes('[y/N]') && tries < 200; tries += 1) await new Promise((resolve) => setTimeout(resolve, 50))
  assert.ok(result.stdout.includes('[y/N]'), `${result.stdout}${result.stderr}`)
  return { answer: (input) => { child.stdin.end(input); return closed } }
}
const rollbackOf = async () => {
  const calls = ghCalls().length
  const exported = await devchatAsync({ args: ['admin', 'export', '--rollback'], cwd: root, sessionEnv: {} })
  assert.equal(exported.status, 0, exported.stderr)
  assert.deepEqual(ghCalls().slice(calls), ['api user --jq .login', 'repo view example-login/todos --json visibility --jq .visibility'], 'export only reads the repo name')
  const all = exported.stdout.split('\n').filter(Boolean)
  return { header: all.filter((line) => line.startsWith('#')), lines: all.filter((line) => !line.startsWith('#')) }
}
const linesFor = (lines, rids) => lines.filter((line) => rids.includes(line.split(' ')[1]))
/** Runs each line's command with sh against the stub, and returns the issue creates and closes it made. */
const replay = (lines) => {
  const calls = ghCalls().length
  for (const line of lines) execFileSync('/bin/sh', ['-c', line.split(' ').slice(3).join(' ')], { env })
  return ghCalls().slice(calls).filter((call) => /^issue (?:create|close) /u.test(call))
}
const quoted = (value) => `'${value.replaceAll("'", `'\\''`)}'`
/** The guarded create line export prints for a todo. */
const createLine = ({ rid, where, title, from = 'devchat', host = machine }) => `create ${rid} ${where} out=$(gh issue list -R example-login/todos --state all --limit 1000 --json body --jq '.[].body') && { printf '%s\\n' "$out" | grep -qxF 'devchat-rid: ${rid}' || gh issue create -R example-login/todos --title ${quoted(title)} --body "$(printf '%s\\n\\n%s' ${quoted(`From: ${from} · Host: ${host}`)} 'devchat-rid: ${rid}')"; }`
/** The stub's log line for that create. */
const createCall = ({ rid, title, from = 'devchat', host = machine }) => `issue create -R example-login/todos --title ${title} --body From: ${from} · Host: ${host}||devchat-rid: ${rid}`
const exportHeader = (pulled = '# Board lines: pulled from the board just now.') => [
  '# devchat rollback list for example-login/todos. Every list you replay must name this same repo.',
  pulled,
  "# Replay: run every line from every machine's list, in order. A create first checks the repo for its devchat-rid line, and a close is safe to repeat.",
  '# Each line is <op> <rid> <where> <command>. Run each command, everything after the third space, with sh.',
]
const workInbox = async (rid) => (await ownerRead('/threads?channel=inbox&limit=500')).threads.filter(({ message }) => message.thread === rid)
const onSecondMachine = async (run) => {
  const [ownHome, ownEnv] = [home, env]
  home = mkdtempSync(join(root, 'home-'))
  env = { ...ownEnv, HOME: home, XDG_CONFIG_HOME: join(home, 'config'), XDG_STATE_HOME: join(home, 'state'), DEVCHAT_TEST_NETWORK_LOG: join(home, 'network.log') }
  try {
    writeConfig({ ...readwrite, boardUrl: workProxy.url, machine: 'second-box' })
    return await run()
  } finally {
    [home, env] = [ownHome, ownEnv]
  }
}

test('import refuses every mode but readwrite, and stops when its sync stops', async () => {
  for (const mode of ['off', 'read']) {
    writeConfig({ ...readwrite, mode, machine })
    const result = devchat({ args: ['admin', 'import'], cwd: root })
    assert.equal(result.status, 1)
    assert.match(result.stderr, new RegExp(`import runs only in mode readwrite, on one machine; this one is in mode ${mode}\\. Nothing was imported\\.`, 'u'))
  }
  joinBoard({ boardUrl: offlineBoardUrl })
  const offline = await devchatAsync({ args: ['admin', 'import'], cwd: root, sessionEnv: {} })
  assert.equal(offline.status, 1)
  assert.match(offline.stderr, /import syncs first, and that sync stopped: the board is unreachable/u)
  assert.deepEqual(ghCalls(), [], 'no gh call before the sync succeeds')
})

test('import syncs, previews every issue with its From: line, and a declined import writes nothing', async () => {
  joinWork()
  const repo = `${allowed}/work-${workRepos}`
  ghIssues([
    ghIssue(1001, 'Board todo.', repo),
    ghIssue(1002, 'Review the notes.', 'other-owner/service'),
    ghIssue(1003, 'Call back.'),
    { number: 1004, title: 'Clean /home/example/notes', body: 'From: x/y · Host: h' },
    { number: 1005, title: 'Body refused.', body: 'From: x/y · Host: h\nSee /home/example/notes' },
  ])
  const preview = [
    'example-login/todos: 5 open issue(s)',
    `#1001  board (${repo})  Board todo.  From: ${repo}`,
    '#1002  this machine only  Review the notes.  From: other-owner/service',
    '#1003  this machine only  Call back.  From: (none)',
    '#1004  refused: absolute home-directory path in the title',
    '#1005  refused: absolute home-directory path in the body  Body refused.',
  ].join('\n')
  for (const input of ['n\n', '']) {
    const declined = await devchatAsync({ args: ['admin', 'import'], cwd: root, sessionEnv: {}, input })
    assert.equal(declined.status, 1)
    assert.match(declined.stdout, /^preview digest: [0-9a-f]{12}$/mu)
    assert.equal(declined.stdout.replace(/^preview digest: .*\n/mu, ''), `${preview}\nImport 3 todo(s)? [y/N]\nNothing was imported.\n`)
  }
  assert.ok(existsSync(join(stateDir(), 'snapshot.json')), 'import synced first')
  assert.deepEqual([existsSync(localDir()), filesIn('outbox'), existsSync(importSource())], [false, [], false], 'a declined import writes nothing')

  const approved = await devchatAsync({ args: ['admin', 'import'], cwd: root, sessionEnv: {}, input: 'y\n' })
  assert.equal(approved.status, 0, approved.stderr)
  assert.match(approved.stdout, /^imported 3: 1 queued for the board, 2 saved on this machine only\ntodo:gh:1001: sent$/mu)
  const todos = Object.fromEntries(localTodos().map((item) => [item.rid, item]))
  assert.deepEqual(Object.keys(todos).sort(), ['todo:gh:1002', 'todo:gh:1003'])
  assert.equal(todos['todo:gh:1002'].identity, 'github.com/other-owner/service')
  assert.equal(todos['todo:gh:1003'].identity, undefined, 'no From: repo, no identity')
  assert.deepEqual(readJson(importSource()), { schema: 1, repo: 'example-login/todos' })
  assert.ok(ghCalls().every((call) => ghReads.test(`${call} `)), ghCalls().join('\n'))
  assert.doesNotMatch(`${approved.stdout}${approved.stderr}`, /\/home\/example/u)
})

test('import sends an allowlisted From: repo to the board and keeps any other here; the board keeps one post per rid', async () => {
  joinWork()
  const repo = `${allowed}/work-${workRepos}`
  ghIssues([ghIssue(101, 'Board todo.', repo), ghIssue(102, 'Other repo todo.', 'other-owner/service')])
  const first = await importApproved()
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, new RegExp(`^#101  board \\(${repo}\\)  Board todo\\.  From: ${repo}$`, 'mu'))
  assert.match(first.stdout, /^#102  this machine only {2}Other repo todo\.  From: other-owner\/service$/mu)
  assert.match(first.stdout, /^imported 2: 1 queued for the board, 1 saved on this machine only\ntodo:gh:101: sent$/mu)
  assert.deepEqual(sentIntents().find(({ rid }) => rid === 'todo:gh:101'), { v: 1, rid: 'todo:gh:101', kind: 'todo', channel: 'todos', text: 'Board todo.', by: profile, repo, machine })
  assert.deepEqual(localTodos().map(({ rid }) => rid), ['todo:gh:102'])
  writerPass()
  await syncOk()
  assert.equal(snapshotItem('todo:gh:101').labels.repo, repo)

  // A rerun after the title changed on GitHub posts the rid again; the board keeps the first post.
  ghIssues([ghIssue(101, 'Board todo, edited on GitHub.', repo), ghIssue(102, 'Other repo todo.', 'other-owner/service')])
  const rerun = await importApproved()
  assert.equal(rerun.status, 0, rerun.stderr)
  assert.match(rerun.stdout, /^#102  already imported, kept local$/mu)
  assert.match(rerun.stdout, /^todo:gh:101: sent$/mu)
  assert.equal((await workInbox('todo:gh:101')).length, 1, 'one inbox post per rid')
  writerPass()
  await syncOk()
  assert.equal(snapshotItem('todo:gh:101').text, 'Board todo.')
})

test("a 409 duplicate_id moves that post to rejected/, and the flush sends the rest", async () => {
  joinWork()
  const repo = `${allowed}/work-${workRepos}`
  ghIssues([ghIssue(9001, 'Imported on two machines.', repo)])
  assert.equal((await importApproved()).status, 0)
  const second = await onSecondMachine(async () => {
    ghIssues([ghIssue(9001, 'Imported on two machines.', repo), ghIssue(9002, 'Only on the second machine.', repo)])
    workProxy.fault = (req, body) => (req.method === 'POST' && JSON.parse(body).id === 'todo:gh:9001' ? { status: 409, body: '{"error":{"code":"duplicate_id","message":"id taken"}}' } : null)
    try {
      const result = await importApproved()
      return { result, rejected: filesIn('outbox', 'rejected'), outbox: filesIn('outbox') }
    } finally {
      workProxy.fault = () => null
    }
  })
  assert.equal(second.result.status, 0, second.result.stderr)
  assert.match(second.result.stdout, /^todo:gh:9001: not sent: another post already holds its id on the board; moved to outbox\/rejected\/$/mu)
  assert.match(second.result.stdout, /^todo:gh:9002: sent$/mu)
  assert.deepEqual([second.rejected.length, second.outbox], [1, []])
})

test('export --rollback prints the release 1 drill as gh commands', async () => {
  joinWork()
  await syncOk()
  const repo = `${allowed}/work-${workRepos}`
  // Before the import every todo lived in GitHub, so an open board todo from before it is created too.
  const earlier = ridOf((await devchatAsync({ args: ['todo', 'add', 'Added before the import.'], cwd: workRepo })).stdout)
  writerPass()
  await syncOk()
  ghIssues([ghIssue(201, 'Imported, then done.', repo), ghIssue(202, 'Imported, then dropped.', repo), ghIssue(203, 'Imported, dropped offline.', repo)])
  assert.equal((await importApproved()).status, 0)
  writerPass()
  await syncOk()
  const added = ridOf((await devchatAsync({ args: ['todo', 'add', "Check the team's notes."], cwd: workRepo })).stdout)
  assert.equal((await devchatAsync({ args: ['todo', 'done', 'todo:gh:201'], cwd: workRepo })).status, 0)
  assert.equal((await devchatAsync({ args: ['todo', 'drop', 'todo:gh:202'], cwd: workRepo })).status, 0)
  writerPass()
  await syncOk()
  workProxy.fault = () => 503
  const offline = ridOf((await devchatAsync({ args: ['todo', 'add', 'Added offline.'], cwd: workRepo })).stdout)
  assert.equal((await devchatAsync({ args: ['todo', 'drop', 'todo:gh:203'], cwd: workRepo })).status, 0)
  workProxy.fault = () => null
  assert.ok(earlier && added && offline)

  const { header, lines } = await rollbackOf()
  assert.deepEqual(header, exportHeader())
  const ours = linesFor(lines, [earlier, added, offline, 'todo:gh:201', 'todo:gh:202', 'todo:gh:203'])
  assert.deepEqual([...ours].sort(), [
    createLine({ rid: earlier, where: 'board', title: 'Added before the import.', from: repo }),
    createLine({ rid: added, where: 'board', title: "Check the team's notes.", from: repo }),
    'close todo:gh:201 board gh issue close 201 -R example-login/todos --reason completed',
    "close todo:gh:202 board gh issue close 202 -R example-login/todos --reason 'not planned'",
    createLine({ rid: offline, where: 'pending', title: 'Added offline.', from: repo }),
    "close todo:gh:203 pending gh issue close 203 -R example-login/todos --reason 'not planned'",
  ].sort())
  // Replaying each command against the stub gives GitHub the drill's changes; a second replay
  // creates nothing more, and repeats only the closes.
  const closes = [
    'issue close 201 -R example-login/todos --reason completed',
    'issue close 202 -R example-login/todos --reason not planned',
    'issue close 203 -R example-login/todos --reason not planned',
  ]
  assert.deepEqual(replay(ours).sort(), [
    createCall({ rid: earlier, title: 'Added before the import.', from: repo }),
    createCall({ rid: added, title: "Check the team's notes.", from: repo }),
    createCall({ rid: offline, title: 'Added offline.', from: repo }),
    ...closes,
  ].sort())
  assert.deepEqual(replay(ours).sort(), closes)
})

test("a sent todo the writer has not applied is created; a stale sent/ copy of one now done on the board is not", async () => {
  joinWork()
  await syncOk()
  const repo = `${allowed}/work-${workRepos}`
  const rid = ridOf((await devchatAsync({ args: ['todo', 'add', 'Done elsewhere.'], cwd: workRepo })).stdout)
  assert.ok(rid && filesIn('outbox', 'sent').length === 1)
  assert.deepEqual(linesFor((await rollbackOf()).lines, [rid]), [createLine({ rid, where: 'sent', title: 'Done elsewhere.', from: repo })])
  // A second todo reaches this machine's snapshot open before the board resolves all three.
  writerPass()
  const synced = ridOf((await devchatAsync({ args: ['todo', 'add', 'Synced, then done elsewhere.'], cwd: workRepo })).stdout)
  writerPass()
  await syncOk()
  assert.equal(snapshotItem(synced)?.labels.status, 'open')
  const sentCopy = ridOf((await devchatAsync({ args: ['todo', 'add', 'Sent copy kept.'], cwd: workRepo })).stdout)
  writerPass()
  for (const root of [rid, synced, sentCopy]) {
    const intent = { v: 1, rid: `done-${randomUUID()}`, kind: 'done', root, text: '', by: profile }
    postAsHost({ on: workBoard, channel: 'inbox', id: intent.rid, text: JSON.stringify(intent) })
  }
  writerPass()
  // This machine never synced since: its snapshot shows one todo open, and sent/ holds the other's copy.
  const stale = await rollbackOf()
  assert.equal(filesIn('outbox', 'sent').length, 1)
  assert.deepEqual(linesFor(stale.lines, [rid, synced, sentCopy]), [])
})

test('export --rollback lists every outbox entry, whatever the mode or the configured board', async () => {
  joinBoard({ boardUrl: offlineBoardUrl })
  const queued = ridOf((await devchatAsync({ args: ['todo', 'add', 'Queued, then mode off.'] })).stdout)
  // A todo added and resolved in the same outbox needs no issue.
  const cancelled = ridOf((await devchatAsync({ args: ['todo', 'add', 'Queued, then done.'] })).stdout)
  assert.equal((await devchatAsync({ args: ['todo', 'done', cancelled] })).status, 0)
  assert.ok(queued && cancelled)
  const line = createLine({ rid: queued, where: 'pending', title: 'Queued, then mode off.', from: `${allowed}/tools` })
  for (const config of [{ ...readwrite, mode: 'off', boardUrl: offlineBoardUrl, machine }, { mode: 'off', githubLogin: allowed, machine }]) {
    writeConfig(config)
    const { header, lines } = await rollbackOf()
    assert.deepEqual(lines, [line])
    assert.deepEqual(header, exportHeader('# Board lines and 0 sent/ entries are left out (mode off): this list may be incomplete, but every line is still safe to run.'))
  }
})

test("export --rollback lists this machine's local todos by rid", async () => {
  joinWork()
  const add = async (text) => localRid(await devchatAsync({ args: ['todo', 'add', text], cwd: root, sessionEnv: {} }), 'todo')
  const kept = await add('Kept here.')
  const finished = await add('Finished here.')
  assert.equal((await devchatAsync({ args: ['todo', 'done', finished], cwd: root, sessionEnv: {} })).status, 0)
  // Only a rid that is exactly todo:gh:<n> names an issue.
  const lookalike = 'todo:gh:9.copy'
  writeFileSync(join(localDir(), `${lookalike}.json`), JSON.stringify({ rid: lookalike, channel: 'todos', text: 'Look-alike.', labels: { rid: lookalike, status: 'done' }, createdAt: '2026-01-01T00:00:00.000Z' }))
  const created = createLine({ rid: kept, where: 'local', title: 'Kept here.' })
  const rids = [kept, finished, lookalike, 'todo:gh:1', 'todo:gh:2', 'todo:gh:3']
  assert.deepEqual(linesFor((await rollbackOf()).lines, rids), [created], 'a resolved new todo gets no line')

  ghIssues([ghIssue(1, 'Done here.'), ghIssue(2, 'Dropped here.'), ghIssue(3, 'Still open.')])
  assert.equal((await importApproved()).status, 0)
  assert.equal((await devchatAsync({ args: ['todo', 'done', 'todo:gh:1'], cwd: root, sessionEnv: {} })).status, 0)
  assert.equal((await devchatAsync({ args: ['todo', 'drop', 'todo:gh:2'], cwd: root, sessionEnv: {} })).status, 0)
  assert.deepEqual(linesFor((await rollbackOf()).lines, rids).sort(), [
    created,
    'close todo:gh:1 local gh issue close 1 -R example-login/todos --reason completed',
    "close todo:gh:2 local gh issue close 2 -R example-login/todos --reason 'not planned'",
  ].sort(), 'an open imported todo gets no line')
})

test('an import approved from an older preview never overwrites a todo another import saved', async () => {
  joinWork()
  ghIssues([ghIssue(1, 'Raced.')])
  const waiting = await waitingImport()
  // While the first import waits on its prompt, a second one imports and the todo is done.
  assert.equal((await importApproved()).status, 0)
  assert.equal((await devchatAsync({ args: ['todo', 'done', 'todo:gh:1'], cwd: root, sessionEnv: {} })).status, 0)
  const first = await waiting.answer('y\n')
  assert.equal(first.status, 1)
  assert.match(first.stdout, /^#1 {2}already imported, kept local$/mu, 'the fresh preview')
  assert.match(first.stderr, /changed since the approved preview \(digest [0-9a-f]{12}\): review the fresh preview above, and import again\. Nothing was imported\./u)
  assert.equal(readJson(join(localDir(), 'todo:gh:1.json')).labels.status, 'done')
})

test('import re-reads the config after approval and refuses a changed mode, placement, or machine name', async () => {
  joinWork()
  const repo = `${allowed}/work-${workRepos}`
  ghIssues([ghIssue(1101, 'Placed on the board.', repo)])
  const config = { ...readwrite, boardUrl: workProxy.url, machine }
  for (const [changed, message] of [
    [{ ...config, allowlist: ['other-owner'] }, /the config, the issues, or this machine's records changed since the approved preview/u],
    [{ ...config, boardUrl: offlineBoardUrl }, /the config, the issues, or this machine's records changed since the approved preview/u],
    [{ ...config, machine: 'renamed-box' }, /the config, the issues, or this machine's records changed since the approved preview/u],
    [{ ...config, mode: 'read' }, /the mode changed to read since the preview: import runs only in mode readwrite\. Nothing was imported\./u],
  ]) {
    writeConfig(config)
    const waiting = await waitingImport()
    writeConfig(changed)
    const result = await waiting.answer('y\n')
    assert.equal(result.status, 1)
    assert.match(result.stderr, message)
    assert.deepEqual([filesIn('outbox'), sentIntents().some(({ rid }) => rid === 'todo:gh:1101')], [[], false], 'nothing was written')
  }
  writeConfig({ ...config, allowlist: ['other-owner'] })
  const waiting = await waitingImport()
  writeConfig(config)
  const result = await waiting.answer('y\n')
  assert.match(result.stdout, new RegExp(`^#1101  board \\(${repo}\\)  Placed on the board\\.`, 'mu'), 'the fresh preview shows the new placement')
})

test('a local import stays local on a rerun, even once its repo is allowlisted', async () => {
  joinWork()
  ghIssues([ghIssue(1201, 'Kept local.', 'other-owner/service')])
  assert.match((await importApproved()).stdout, /^imported 1: 0 queued for the board, 1 saved on this machine only$/mu)
  writeConfig({ ...readwrite, boardUrl: workProxy.url, machine, allowlist: [allowed, 'other-owner'] })
  const rerun = await importApproved()
  assert.match(rerun.stdout, /^#1201  already imported, kept local$/mu)
  assert.ok(!sentIntents().some(({ rid }) => rid === 'todo:gh:1201'))
})

test("two machines' lists, both naming one new todo, create one issue", async () => {
  joinWork()
  await syncOk()
  const repo = `${allowed}/work-${workRepos}`
  // This machine has sent the todo; the writer applies it, and a second machine pulls it.
  const rid = ridOf((await devchatAsync({ args: ['todo', 'add', 'Listed twice.'], cwd: workRepo })).stdout)
  const first = linesFor((await rollbackOf()).lines, [rid])
  writerPass()
  const second = linesFor(await onSecondMachine(async () => {
    await syncOk()
    return (await rollbackOf()).lines
  }), [rid])
  assert.deepEqual([first, second], [
    [createLine({ rid, where: 'sent', title: 'Listed twice.', from: repo })],
    [createLine({ rid, where: 'board', title: 'Listed twice.', from: repo })],
  ])
  assert.deepEqual(replay([...first, ...second]), [createCall({ rid, title: 'Listed twice.', from: repo })])
})

test('a replayed create creates nothing when its issue list fails', async () => {
  writeConfig({ mode: 'off', githubLogin: allowed, machine })
  const rid = localRid(await devchatAsync({ args: ['todo', 'add', 'Listed once.'], cwd: root, sessionEnv: {} }), 'todo')
  const lines = linesFor((await rollbackOf()).lines, [rid])
  assert.deepEqual(replay(lines), [createCall({ rid, title: 'Listed once.' })])
  writeFileSync(join(home, 'gh-list-fails'), '')
  const calls = ghCalls().length
  const again = spawnSync('/bin/sh', ['-c', lines[0].split(' ').slice(3).join(' ')], { env })
  assert.notEqual(again.status, 0, 'the line fails with its list')
  assert.deepEqual(ghCalls().slice(calls).filter((call) => call.startsWith('issue create')), [])
})

test('export lists a todo a sync moves from the outbox to sent/ while it reads', async () => {
  joinBoard()
  proxy.fault = () => 503
  const rid = ridOf((await devchatAsync({ args: ['todo', 'add', 'Moved mid-export.'] })).stdout)
  const [name] = filesIn('outbox')
  assert.ok(rid && name)
  // The move lands on export's first board read, after it read the outbox and sent/.
  proxy.fault = () => {
    proxy.fault = () => null
    const path = join(stateDir(), 'outbox', name)
    mkdirSync(join(stateDir(), 'outbox', 'sent'), { recursive: true })
    writeFileSync(join(stateDir(), 'outbox', 'sent', name), JSON.stringify({ ...readJson(path), inboxId: 999999, epoch: '1' }))
    rmSync(path)
    return null
  }
  const { lines } = await rollbackOf()
  assert.deepEqual(linesFor(lines, [rid]), [createLine({ rid, where: 'pending', title: 'Moved mid-export.', from: `${allowed}/tools` })])
})

test('a machine name with a newline is refused, and a stored one keeps each create on one line', async () => {
  writeConfig({ mode: 'off', githubLogin: allowed, machine: 'two\nlines' })
  const refused = devchat({ args: ['todo', 'add', 'Never saved.'] })
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /machine must not hold control characters/u)
  await assertSetupRefuses({ path: join(env.XDG_CONFIG_HOME, 'devchat', 'config.json'), problem: 'machine must not hold control characters' })

  writeConfig({ mode: 'off', githubLogin: allowed, machine })
  const rid = 'todo-stored-newline'
  mkdirSync(localDir(), { recursive: true })
  writeFileSync(join(localDir(), `${rid}.json`), JSON.stringify({ rid, channel: 'todos', text: 'Stored\nbefore.', labels: { rid, status: 'open', host: 'two\nlines' }, createdAt: '2026-01-01T00:00:00.000Z' }))
  const lines = linesFor((await rollbackOf()).lines, [rid])
  assert.deepEqual(lines, [createLine({ rid, where: 'local', title: 'Stored before.', host: 'two lines' })])
  assert.deepEqual(replay(lines), [createCall({ rid, title: 'Stored before.', host: 'two lines' })])
})

test('export skips a record whose rid is malformed, and counts it in the header', async () => {
  writeConfig({ mode: 'off', githubLogin: allowed, machine })
  const kept = localRid(await devchatAsync({ args: ['todo', 'add', 'Kept.'], cwd: root, sessionEnv: {} }), 'todo')
  const rid = 'todo-bad\ngh issue close 1'
  writeFileSync(join(localDir(), 'malformed.json'), JSON.stringify({ rid, channel: 'todos', text: 'Malformed.', labels: { rid, status: 'open' }, createdAt: '2026-01-01T00:00:00.000Z' }))
  const { header, lines } = await rollbackOf()
  assert.deepEqual(header.at(-1), '# 1 record skipped: malformed rid. Fix or remove each such file in local/ or outbox/, then export again.')
  assert.deepEqual(lines, [createLine({ rid: kept, where: 'local', title: 'Kept.' })])
})

test('export stops when gh resolves another account than the one import claimed here', async () => {
  joinWork()
  ghIssues([ghIssue(1, 'From the first account.')])
  assert.equal((await importApproved()).status, 0)
  writeFileSync(join(home, 'gh-login'), 'other-login\n')
  const exported = await devchatAsync({ args: ['admin', 'export', '--rollback'], cwd: root, sessionEnv: {} })
  assert.deepEqual({ status: exported.status, stdout: exported.stdout }, { status: 1, stdout: '' })
  assert.match(exported.stderr, /this machine imported from example-login\/todos, and gh now resolves to other-login\/todos: switch gh/u)
})

test('a POST 409 other than duplicate_id stops the flush', async () => {
  joinBoard()
  proxy.fault = (req) => (req.method === 'POST' ? { status: 409, body: '{"error":{"code":"conflict"}}' } : null)
  const add = await devchatAsync({ args: ['todo', 'add', 'Conflicted.'] })
  proxy.fault = () => null
  assert.equal(add.status, 0, add.stderr)
  assert.match(add.stdout, /: not sent yet \(POST \/api\/board\/messages answered 409 conflict\): the next devchat sync sends it$/mu)
  assert.equal(filesIn('outbox').length, 1)
  assert.deepEqual(filesIn('outbox', 'rejected'), [])
})

test('import stops before any write when gh resolves another account than it previewed or claimed', async () => {
  joinWork()
  ghIssues([ghIssue(1, 'From the first account.')])
  // The account changes while the prompt waits.
  const waiting = await waitingImport()
  writeFileSync(join(home, 'gh-login'), 'other-login\n')
  const switched = await waiting.answer('y\n')
  assert.equal(switched.status, 1)
  assert.match(switched.stderr, /gh now resolves to other-login\/todos, not example-login\/todos, the repo this preview read\. Nothing was imported\./u)
  assert.deepEqual([existsSync(localDir()), existsSync(importSource())], [false, false])

  rmSync(join(home, 'gh-login'))
  assert.equal((await importApproved()).status, 0)
  writeFileSync(join(home, 'gh-login'), 'other-login\n')
  ghIssues([ghIssue(2, 'From the second account.')])
  const other = await importApproved()
  assert.equal(other.status, 1)
  assert.match(other.stderr, /this machine imported from example-login\/todos, and this import reads other-login\/todos: switch gh/u)
  assert.ok(!existsSync(join(localDir(), 'todo:gh:2.json')))
  assert.deepEqual(readJson(importSource()).repo, 'example-login/todos')
})

test('an import the check at flush rejects is reported, and a rerun sends it', async () => {
  joinBoard({ machineName: 'x'.repeat(257) })
  ghIssues([ghIssue(301, 'Rejected at flush.', `${allowed}/tools`)])
  const first = await importApproved()
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, /^todo:gh:301: not sent: the check at flush rejected it \(a provenance field is not a board label value\) and moved it to outbox\/rejected\/$/mu)
  joinBoard()
  const rerun = await importApproved()
  assert.match(rerun.stdout, new RegExp(`^#301  board \\(${allowed}/tools\\)  Rejected at flush\\.`, 'mu'))
  assert.match(rerun.stdout, /^todo:gh:301: sent$/mu)
})

test('import --yes refuses a digest that does not match the preview, and shows the fresh one', async () => {
  joinWork()
  const digestOf = async () => /^preview digest: ([0-9a-f]{12})$/mu.exec((await devchatAsync({ args: ['admin', 'import'], cwd: root, sessionEnv: {} })).stdout)[1]
  ghIssues([{ number: 1, title: 'Approved title.', body: 'From: thread-a · Host: h' }])
  const digest = await digestOf()
  // A changed title, or only a changed From: line with the same destination, changes the digest.
  for (const issue of [{ number: 1, title: 'Changed after approval.', body: 'From: thread-a · Host: h' }, { number: 1, title: 'Approved title.', body: 'From: thread-b · Host: h' }]) {
    ghIssues([issue])
    const stale = await devchatAsync({ args: ['admin', 'import', '--yes', digest], cwd: root, sessionEnv: {} })
    assert.equal(stale.status, 1)
    assert.match(stale.stdout, new RegExp(`^#1 {2}this machine only {2}${issue.title.replace('.', '\\.')}`, 'mu'))
    assert.match(stale.stdout, new RegExp(`^This preview's digest is [0-9a-f]{12}, not ${digest}: .* Nothing was imported\\.$`, 'mu'))
  }
  assert.ok(!existsSync(localDir()), 'nothing was imported')
  assert.match((await devchatAsync({ args: ['admin', 'import', '--yes'], cwd: root, sessionEnv: {} })).stderr, /usage: devchat admin import \[--yes <digest>\]/u)
})
