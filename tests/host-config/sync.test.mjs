import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

const source = new URL('../../', import.meta.url)
const execute = (command, args, options = {}) => spawnSync(command, args, { encoding: 'utf8', ...options })
const success = (result) => { assert.equal(result.status, 0, result.stderr || result.stdout); return result.stdout.trim() }
const put = (path, content) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content) }
const snapshot = (root) => readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile()).map((entry) => [join(entry.parentPath, entry.name), readFileSync(join(entry.parentPath, entry.name), 'utf8')])

const fixture = (t) => {
  const root = mkdtempSync(join(tmpdir(), 'filip-stack-sync-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const seed = join(root, 'seed')
  const repo = join(root, 'repo')
  const home = join(root, 'home')
  mkdirSync(home)
  for (const path of ['scripts/sync.mjs', 'scripts/host-config.mjs', 'scripts/plugin-payload-policy.mjs', 'host-config']) {
    mkdirSync(dirname(join(seed, path)), { recursive: true })
    cpSync(new URL(path, source), join(seed, path), { recursive: true })
  }
  put(join(seed, 'skills/example/SKILL.md'), 'An installed skill.\n')
  put(join(seed, 'plugins/example/.claude-plugin/plugin.json'), JSON.stringify({ name: 'example', version: '1.0.0' }))
  put(join(seed, 'plugins/example/.codex-plugin/plugin.json'), JSON.stringify({ name: 'example', version: '1.0.0' }))
  put(join(seed, 'plugins/example/skills/example/SKILL.md'), 'Published plugin payload.\n')
  success(execute('git', ['init', '-q', '-b', 'main', seed]))
  success(execute('git', ['-C', seed, 'add', '.']))
  success(execute('git', ['-C', seed, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture']))
  const origin = join(root, 'origin.git')
  success(execute('git', ['clone', '--bare', '-q', seed, origin]))
  success(execute('git', ['clone', '-q', origin, repo]))
  const env = { ...process.env, HOME: home, PATH: '/usr/bin:/bin', CODEX_HOME: join(home, '.codex'), CLAUDE_CONFIG_DIR: join(home, '.claude'), XDG_CONFIG_HOME: join(home, '.config'), XDG_STATE_HOME: join(home, '.local/state'), GIT_CONFIG_GLOBAL: '/dev/null' }
  const sync = (...args) => execute(process.execPath, [join(repo, 'scripts/sync.mjs'), '--json', ...args], { env })
  const apply = () => success(execute(process.execPath, [join(repo, 'scripts/host-config.mjs'), 'apply', '--home', home], { env }))
  return { root, repo, home, env, sync, apply, seed, origin }
}

test('sync applies real guidance repeatedly, preserves local text, and records structured results', (t) => {
  const { home, repo, apply, sync } = fixture(t)
  apply()
  const path = join(home, '.codex/AGENTS.md')
  const local = '\n## Local machine\nUse this machine-specific rule.\n'
  writeFileSync(path, readFileSync(path, 'utf8') + local)
  const before = snapshot(home).filter(([file]) => !file.includes('/.local/state/'))
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const report = JSON.parse(success(sync()))
    assert.equal(report.ok, true)
    assert.equal(report.components.find(({ name }) => name === 'guidance').targets, 35)
    assert.equal(report.components.find(({ name }) => name === 'skills').skills.length, 0)
    assert.equal(report.components.find(({ name }) => name === 'claude').state, 'skipped')
    assert.equal(readFileSync(path, 'utf8').endsWith(local), true)
  }
  assert.deepEqual(snapshot(home).filter(([file]) => !file.includes('/.local/state/')), before)
  assert.equal(JSON.parse(readFileSync(join(home, '.local/state/filip-stack/last-sync.json'))).ok, true)
  assert.equal(existsSync(join(home, '.local/state/filip-stack/sync.lock')), false)
  assert.equal(success(execute('git', ['-C', repo, 'status', '--porcelain'])), '')
})

test('dry-run writes nothing; a dirty checkout blocks mutations', (t) => {
  const { home, repo, sync } = fixture(t)
  const before = snapshot(home)
  const preview = JSON.parse(success(sync('--dry-run')))
  assert.equal(preview.dryRun, true)
  assert.deepEqual(snapshot(home), before)
  put(join(repo, 'unrelated-work.txt'), 'Keep this work.\n')
  const blocked = sync()
  assert.equal(blocked.status, 1)
  assert.match(JSON.parse(blocked.stdout).components[0].message, /local changes/)
  assert.equal(existsSync(join(home, '.codex/AGENTS.md')), false)
  assert.equal(readFileSync(join(repo, 'unrelated-work.txt'), 'utf8'), 'Keep this work.\n')
})

test('a locally edited managed block remains intact and the failure is visible', (t) => {
  const { home, apply, sync } = fixture(t)
  apply()
  const path = join(home, '.codex/AGENTS.md')
  const edited = readFileSync(path, 'utf8').replace('Global Engineering Principles', 'Local edit inside managed guidance')
  writeFileSync(path, edited)
  const result = sync()
  assert.equal(result.status, 1)
  const report = JSON.parse(result.stdout)
  assert.equal(report.ok, false)
  assert.equal(report.components.find(({ name }) => name === 'guidance').state, 'blocked')
  assert.equal(report.components.find(({ name }) => name === 'skills').state, 'current')
  assert.equal(readFileSync(path, 'utf8'), edited)
  assert.equal(existsSync(`${path}.bak`), false)
})

test('a locally edited skill is detected from its Git tree lock before reinstallation', (t) => {
  const { home, repo, sync } = fixture(t)
  const hash = success(execute('git', ['-C', repo, 'rev-parse', 'HEAD:skills/example']))
  const installed = join(home, '.agents/skills/example')
  cpSync(join(repo, 'skills/example'), installed, { recursive: true })
  put(join(home, '.agents/.skill-lock.json'), JSON.stringify({ version: 3, skills: { example: { source: 'filipgutica/filip-stack', skillFolderHash: hash } } }))
  assert.equal(JSON.parse(success(sync('--dry-run'))).components.find(({ name }) => name === 'skills').skills[0].name, 'example')
  put(join(installed, 'SKILL.md'), 'An important local edit.\n')
  const result = sync()
  assert.equal(result.status, 1)
  assert.match(JSON.parse(result.stdout).components.find(({ name }) => name === 'skills').message, /local edits/)
  assert.equal(readFileSync(join(installed, 'SKILL.md'), 'utf8'), 'An important local edit.\n')
})

const installedTools = (context, { corruptCodex = false } = {}) => {
  const { root, home, repo, env } = context
  const bin = join(root, 'bin')
  env.PATH = `${bin}:/usr/bin:/bin`
  env.FIXTURE_REPO = repo
  env.CORRUPT_CODEX = String(corruptCodex)
  const body = `
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
const home = process.env.HOME, repo = process.env.FIXTURE_REPO, tool = basename(process.argv[1]), args = process.argv.slice(2);
const output = value => process.stdout.write(JSON.stringify(value));
if (args[0] === '--version') { output('1.0.0'); process.exit(0); }
appendFileSync(join(home, 'tool-actions.jsonl'), JSON.stringify({tool, args}) + '\\n');
const marker = join(home, tool + '-updated');
const version = existsSync(marker) ? '1.0.0' : '0.9.0';
const cache = host => join(home, host, 'plugins/cache/filip-stack/example/1.0.0');
const install = host => {
  mkdirSync(cache(host), {recursive:true}); cpSync(join(repo, 'plugins/example'), cache(host), {recursive:true});
  if (host === '.codex' && process.env.CORRUPT_CODEX === 'true') writeFileSync(join(cache(host), 'skills/example/SKILL.md'), 'stale payload');
  writeFileSync(marker, 'updated'); output({});
};
if (tool === 'npx') {
  const name = args[args.indexOf('-s') + 1], path = join(home, '.agents/skills', name);
  rmSync(path, {recursive:true, force:true}); cpSync(join(repo, 'skills', name), path, {recursive:true});
  const lockPath = join(home, '.agents/.skill-lock.json'), lock = JSON.parse(readFileSync(lockPath));
  lock.skills[name].skillFolderHash = spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD:skills/' + name], {encoding:'utf8'}).stdout.trim();
  writeFileSync(lockPath, JSON.stringify(lock)); output({});
} else if (tool === 'claude') {
  if (args[1] === 'list') output([{id:'example@filip-stack',version,scope:'user',enabled:false,installPath:cache('.claude')}]);
  else if (args[1] === 'update') install('.claude');
  else output({});
} else if (args[1] === 'list') {
  output({installed:[{pluginId:'example@filip-stack',name:'example',version,enabled:true},{pluginId:'disabled@filip-stack',name:'disabled',version:'0.9.0',enabled:false}]});
} else if (args[2] === 'list') {
  output({marketplaces:[{name:'filip-stack',marketplaceSource:{sourceType:'git',source:'https://github.com/filipgutica/filip-stack.git'}}]});
} else if (args[1] === 'add') install('.codex');
else output({});
`
  for (const tool of ['npx', 'codex', 'claude']) {
    const path = join(bin, tool)
    put(path, `#!${process.execPath}\n${body}`)
    chmodSync(path, 0o755)
  }
  put(join(home, '.claude/plugins/known_marketplaces.json'), JSON.stringify({ 'filip-stack': { source: { source: 'github', repo: 'filipgutica/filip-stack' } } }))
  const hash = success(execute('git', ['-C', repo, 'rev-parse', 'HEAD:skills/example']))
  cpSync(join(repo, 'skills/example'), join(home, '.agents/skills/example'), { recursive: true })
  put(join(home, '.agents/.skill-lock.json'), JSON.stringify({ version: 3, skills: { example: { source: 'filipgutica/filip-stack', skillFolderHash: hash }, unrelated: { source: 'another/owner', skillFolderHash: 'untouched' } } }))
  mkdirSync(join(home, '.claude/skills'), { recursive: true })
  symlinkSync(join(home, '.agents/skills/example'), join(home, '.claude/skills/example'))
}

test('sync verifies installed skills and both plugin payloads while preserving selections and disabled state', (t) => {
  const context = fixture(t)
  installedTools(context)
  const report = JSON.parse(success(context.sync()))
  assert.equal(report.ok, true)
  assert.deepEqual(report.components.find(({ name }) => name === 'skills').skills[0].hosts, ['codex', 'claude-code'])
  assert.equal(report.components.find(({ name }) => name === 'claude').plugins[0].version, '1.0.0')
  assert.deepEqual(report.components.find(({ name }) => name === 'codex').plugins[1], { name: 'disabled', state: 'disabled' })
  const actions = readFileSync(join(context.home, 'tool-actions.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.equal(actions.some(({ args }) => args.includes('disabled@filip-stack')), false)
  assert.equal(actions.filter(({ tool }) => tool === 'npx').length, 1)
  assert.equal(JSON.parse(readFileSync(join(context.home, '.agents/.skill-lock.json'))).skills.unrelated.skillFolderHash, 'untouched')
})

test('a successful plugin installer with a stale payload is an incomplete sync', (t) => {
  const context = fixture(t)
  installedTools(context, { corruptCodex: true })
  const result = context.sync()
  assert.equal(result.status, 1)
  const report = JSON.parse(result.stdout)
  assert.equal(report.components.find(({ name }) => name === 'claude').state, 'current')
  assert.match(report.components.find(({ name }) => name === 'codex').message, /payload differs/)
  assert.equal(report.ok, false)
})

test('a concurrent sync cannot replace another run\'s lock or result', (t) => {
  const { home, sync } = fixture(t)
  const state = join(home, '.local/state/filip-stack')
  put(join(state, 'sync.lock/owner.json'), '{"pid":1234}')
  put(join(state, 'last-sync.json'), '{"previous":true}')
  const result = sync()
  assert.equal(result.status, 1)
  assert.match(JSON.parse(result.stdout).components[0].message, /another sync owns/)
  assert.equal(readFileSync(join(state, 'sync.lock/owner.json'), 'utf8'), '{"pid":1234}')
  assert.equal(readFileSync(join(state, 'last-sync.json'), 'utf8'), '{"previous":true}')
})

test('sync fast-forwards source and applies the pulled guidance', (t) => {
  const { seed, origin, home, repo, sync } = fixture(t)
  put(join(seed, 'host-config/agents/CODING_STANDARDS.md'), 'New upstream guidance.\n')
  const updater = join(seed, 'scripts/sync.mjs')
  writeFileSync(updater, readFileSync(updater, 'utf8').replace('const report = { host:', "const report = { updaterGeneration: 'new', host:"))
  success(execute('git', ['-C', seed, 'add', '.']))
  success(execute('git', ['-C', seed, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'new upstream guidance']))
  success(execute('git', ['-C', seed, 'push', '-q', origin, 'main']))
  const commit = success(execute('git', ['-C', seed, 'rev-parse', 'HEAD']))
  const report = JSON.parse(success(sync()))
  assert.equal(report.updaterGeneration, 'new')
  assert.equal(report.components[0].commit, commit)
  assert.equal(success(execute('git', ['-C', repo, 'rev-parse', 'HEAD'])), commit)
  assert.equal(readFileSync(join(home, '.agents/CODING_STANDARDS.md'), 'utf8'), 'New upstream guidance.\n')
})

test('an installed but non-executable host is blocked rather than skipped as absent', (t) => {
  const context = fixture(t)
  installedTools(context)
  chmodSync(join(context.root, 'bin/codex'), 0o644)
  const result = context.sync()
  assert.equal(result.status, 1)
  const codex = JSON.parse(result.stdout).components.find(({ name }) => name === 'codex')
  assert.equal(codex.state, 'blocked')
  assert.match(codex.message, /EACCES/)
})

test('custom agent homes block guidance before any default-home writes', (t) => {
  const context = fixture(t)
  context.env.CODEX_HOME = join(context.home, 'custom-codex')
  const result = context.sync()
  assert.equal(result.status, 1)
  const guidance = JSON.parse(result.stdout).components.find(({ name }) => name === 'guidance')
  assert.equal(guidance.state, 'blocked')
  assert.match(guidance.message, /custom CODEX_HOME/)
  assert.equal(existsSync(join(context.home, '.codex/AGENTS.md')), false)
  assert.equal(existsSync(join(context.home, '.claude/CLAUDE.md')), false)
})
