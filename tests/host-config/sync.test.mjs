import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import test from 'node:test'
import { buildPackage, seedCache, writePin } from './design-system-fixture.mjs'

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
  for (const path of ['scripts/sync.mjs', 'scripts/host-config.mjs', 'scripts/plugin-payload-policy.mjs', 'scripts/fleet-config.mjs', 'host-config']) {
    mkdirSync(dirname(join(seed, path)), { recursive: true })
    cpSync(new URL(path, source), join(seed, path), { recursive: true })
  }
  // Pin a fixture package that sits in a seeded cache, so apply never downloads.
  const designSystem = buildPackage({ root })
  writePin({ repo: seed, pin: designSystem.pin })
  seedCache({ cacheHome: join(root, 'cache'), ...designSystem })
  for (const name of ['example', 'extra']) put(join(seed, 'skills', name, 'SKILL.md'), `An installed ${name} skill.\n`)
  for (const name of ['example', 'second']) {
    put(join(seed, 'plugins', name, '.claude-plugin/plugin.json'), JSON.stringify({ name, version: '1.0.0' }))
    put(join(seed, 'plugins', name, '.codex-plugin/plugin.json'), JSON.stringify({ name, version: '1.0.0' }))
    put(join(seed, 'plugins', name, 'skills/example/SKILL.md'), `Published ${name} plugin payload.\n`)
  }
  success(execute('git', ['init', '-q', '-b', 'main', seed]))
  success(execute('git', ['-C', seed, 'add', '.']))
  success(execute('git', ['-C', seed, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture']))
  const origin = join(root, 'origin.git')
  success(execute('git', ['clone', '--bare', '-q', seed, origin]))
  success(execute('git', ['clone', '-q', origin, repo]))
  const env = { ...process.env, HOME: home, PATH: '/usr/bin:/bin', CODEX_HOME: join(home, '.codex'), CLAUDE_CONFIG_DIR: join(home, '.claude'), XDG_CONFIG_HOME: join(home, '.config'), XDG_CACHE_HOME: join(root, 'cache'), XDG_STATE_HOME: join(home, '.local/state'), GIT_CONFIG_GLOBAL: '/dev/null' }
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
    const managed = JSON.parse(readFileSync(join(home, '.agents/.filip-stack-host-config.json'))).files
    assert.equal(report.components.find(({ name }) => name === 'guidance').targets, Object.keys(managed).length)
    assert.equal(report.components.find(({ name }) => name === 'skills').skills.length, 0)
    assert.equal(report.components.find(({ name }) => name === 'claude').state, 'skipped')
    assert.equal(readFileSync(path, 'utf8').endsWith(local), true)
  }
  assert.deepEqual(snapshot(home).filter(([file]) => !file.includes('/.local/state/')), before)
  assert.equal(JSON.parse(readFileSync(join(home, '.local/state/filip-stack/last-sync.json'))).ok, true)
  assert.equal(existsSync(join(home, '.local/state/filip-stack/sync.lock')), false)
  assert.equal(success(execute('git', ['-C', repo, 'status', '--porcelain'])), '')
})

test('dry-run writes nothing; dirty or unpublished checkout work blocks mutations', (t) => {
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
  success(execute('git', ['-C', repo, 'add', '.']))
  success(execute('git', ['-C', repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'local-only work']))
  assert.equal(JSON.parse(success(sync('--dry-run'))).components[0].updateAllowed, false)
  const unpublished = sync()
  assert.equal(unpublished.status, 1)
  assert.match(JSON.parse(unpublished.stdout).components[0].message, /unpublished commits/)
  assert.equal(existsSync(join(home, '.codex/AGENTS.md')), false)
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
  assert.match(report.components.find(({ name }) => name === 'guidance').message, /Local edit inside managed guidance/)
  assert.equal(report.components.find(({ name }) => name === 'skills').state, 'current')
  assert.equal(readFileSync(path, 'utf8'), edited)
  assert.equal(existsSync(`${path}.bak`), false)
})

// The skills CLI records a Git tree ID or a SHA-256 folder hash. The SHA-256
// values below come from `computeSkillFolderHash` in skills 1.8.1.
for (const format of [
  { name: 'Git tree', hash: ({ repo }) => success(execute('git', ['-C', repo, 'rev-parse', 'HEAD:skills/example'])) },
  { name: 'SHA-256 folder', hash: () => 'd9e57e4a3688867de0b9f51a0ec40d080a57daf3f5d811b10b20e368967bb552' },
]) {
  test(`a locally edited skill is detected from its ${format.name} lock before reinstallation`, (t) => {
    const { home, repo, sync } = fixture(t)
    const installed = join(home, '.agents/skills/example')
    cpSync(join(repo, 'skills/example'), installed, { recursive: true })
    put(join(home, '.agents/.skill-lock.json'), JSON.stringify({ version: 3, skills: { example: { source: 'filipgutica/filip-stack', skillFolderHash: format.hash({ repo }) } } }))
    assert.equal(JSON.parse(success(sync('--dry-run'))).components.find(({ name }) => name === 'skills').skills[0].name, 'example')
    put(join(installed, 'SKILL.md'), 'An important local edit.\n')
    const result = sync()
    assert.equal(result.status, 1)
    assert.match(JSON.parse(result.stdout).components.find(({ name }) => name === 'skills').message, /local edits/)
    assert.equal(readFileSync(join(installed, 'SKILL.md'), 'utf8'), 'An important local edit.\n')
  })
}

test('a SHA-256 folder lock follows the skills CLI rules for line endings, binaries, paths, and skipped files', (t) => {
  const { home, sync } = fixture(t)
  const installed = join(home, '.agents/skills/example')
  put(join(installed, 'SKILL.md'), 'line\r\n')
  put(join(installed, 'metadata.json'), '{}')
  put(join(installed, 'sub/__pycache__/a.pyc'), 'x')
  put(join(installed, 'sub/a\\d.txt'), 'slash\n')
  put(join(installed, 'sub/b.md'), 'nested\n')
  put(join(installed, 'sub/c.bin'), 'bin\0\r\n')
  put(join(home, '.agents/.skill-lock.json'), JSON.stringify({ version: 3, skills: { example: { source: 'filipgutica/filip-stack', skillFolderHash: 'dc05dc5eafe8bb56053a946b78671ca0caed8714b64d791faaaee73beeb1e616' } } }))
  const skills = JSON.parse(success(sync('--dry-run'))).components.find(({ name }) => name === 'skills')
  assert.equal(skills.state, 'planned', skills.message)
})

test('a skill lock without a hash blocks the skill', (t) => {
  const { home, repo, sync } = fixture(t)
  cpSync(join(repo, 'skills/example'), join(home, '.agents/skills/example'), { recursive: true })
  put(join(home, '.agents/.skill-lock.json'), JSON.stringify({ version: 3, skills: { example: { source: 'filipgutica/filip-stack', skillFolderHash: null } } }))
  const result = sync('--dry-run')
  assert.equal(result.status, 1)
  assert.match(JSON.parse(result.stdout).components.find(({ name }) => name === 'skills').message, /unverifiable lock/)
})

const installedTools = (context, { corruptCodex = false, empty = false } = {}) => {
  const { root, home, repo, env } = context
  const bin = join(root, 'bin')
  env.PATH = `${bin}:/usr/bin:/bin`
  env.FIXTURE_REPO = repo
  env.CORRUPT_CODEX = String(corruptCodex)
  env.UPSTREAM_ROOT = join(root, 'upstream')
  // The fake clients keep the real on-disk layouts: Claude's known_marketplaces.json
  // with each clone's installLocation, Codex marketplace roots, and plugin caches
  // under plugins/cache/<marketplace>/<plugin>/<version>. A marketplace add or
  // update copies UPSTREAM_ROOT/<marketplace> into the clone when it exists, and
  // INSTALLER_NOOP leaves an existing installation unchanged.
  const body = `
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
const home = process.env.HOME, repo = process.env.FIXTURE_REPO, tool = basename(process.argv[1]), args = process.argv.slice(2);
const output = value => process.stdout.write(JSON.stringify(value));
if (args[0] === '--version') { output('1.0.0'); process.exit(0); }
appendFileSync(join(home, 'tool-actions.jsonl'), JSON.stringify({tool, args}) + '\\n');
const read = (path, fallback = []) => existsSync(path) ? JSON.parse(readFileSync(path)) : fallback;
const write = (path, value) => { mkdirSync(dirname(path), {recursive:true}); writeFileSync(path, JSON.stringify(value)); };
const statePath = join(home, tool + '-plugins.json');
const knownPath = join(home, '.claude/plugins/known_marketplaces.json'), codexMarketplacesPath = join(home, 'codex-marketplaces.json');
const marketplaceRoot = (host, name) => host === '.claude' ? read(knownPath, {})[name].installLocation : read(codexMarketplacesPath).find(item => item.name === name).root;
const refreshClone = (root, name) => {
  const upstream = join(process.env.UPSTREAM_ROOT, name);
  if (existsSync(upstream)) { rmSync(root, {recursive:true, force:true}); cpSync(upstream, root, {recursive:true}); }
};
const install = host => {
  const id = args[2], [name, marketplace] = id.split('@');
  const plugins = read(statePath), previous = plugins.find(p => (p.id || p.pluginId) === id);
  if (previous && process.env.INSTALLER_NOOP === 'true') return output({});
  const source = marketplace === 'filip-stack' ? join(repo, 'plugins', name) : marketplaceRoot(host, marketplace);
  const version = read(join(source, host === '.claude' ? '.claude-plugin/plugin.json' : '.codex-plugin/plugin.json')).version;
  const path = join(home, host, 'plugins/cache', marketplace, name, version);
  mkdirSync(path, {recursive:true}); cpSync(source, path, {recursive:true});
  if (host === '.codex' && marketplace === 'filip-stack' && process.env.CORRUPT_CODEX === 'true') writeFileSync(join(path, 'skills/example/SKILL.md'), 'stale payload');
  const updated = host === '.claude' ? {id,scope:'user',installPath:path} : {pluginId:id,name};
  Object.assign(updated,{version,enabled:previous ? previous.enabled : true});
  write(statePath, [...plugins.filter(p => (p.id || p.pluginId) !== id),updated]); output({});
};
if (tool === 'npx') {
  const name = args[args.indexOf('-s') + 1], path = join(home, '.agents/skills', name);
  rmSync(path, {recursive:true, force:true}); cpSync(join(repo, 'skills', name), path, {recursive:true});
  const lockPath = join(home, '.agents/.skill-lock.json'), lock = JSON.parse(readFileSync(lockPath));
  lock.skills[name] = {source:'filipgutica/filip-stack',skillFolderHash:spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD:skills/' + name], {encoding:'utf8'}).stdout.trim()};
  if (args.includes('claude-code')) {
    const target = join(home, '.claude/skills', name); mkdirSync(join(home, '.claude/skills'),{recursive:true});
    if (!existsSync(target)) symlinkSync(path,target);
  }
  writeFileSync(lockPath, JSON.stringify(lock)); output({});
} else if (tool === 'claude') {
  if (args[1] === 'list') output(read(statePath));
  else if (['update','install'].includes(args[1])) install('.claude');
  else if (args[2] === 'add') {
    const name = args[3].split('/')[1], installLocation = join(home, '.claude/plugins/marketplaces', name);
    write(knownPath, {...read(knownPath, {}), [name]: {source:{source:'github',repo:args[3]}, installLocation}});
    refreshClone(installLocation, name); output({});
  } else if (args[2] === 'update') { refreshClone(marketplaceRoot('.claude', args[3]), args[3]); output({}); }
  else output({});
} else if (args[1] === 'list') {
  output({installed:read(statePath)});
} else if (args[2] === 'list') {
  output({marketplaces:read(codexMarketplacesPath)});
} else if (args[2] === 'add') {
  const name = args[3].split('/')[1], root = join(home, '.codex/.tmp/marketplaces', name);
  write(codexMarketplacesPath, [...read(codexMarketplacesPath), {name, root, marketplaceSource:{sourceType:'git',source:'https://github.com/' + args[3] + '.git'}}]);
  refreshClone(root, name); output({});
} else if (args[2] === 'upgrade') { refreshClone(marketplaceRoot('.codex', args[3]), args[3]); output({});
} else if (args[1] === 'add') install('.codex');
else output({});
`
  for (const tool of ['npx', 'codex', 'claude']) {
    const path = join(bin, tool)
    put(path, `#!${process.execPath}\n${body}`)
    chmodSync(path, 0o755)
  }
  const skills = { unrelated: { source: 'another/owner', skillFolderHash: 'untouched' } }
  if (!empty) {
    put(join(home, 'codex-marketplaces.json'), JSON.stringify([{ name: 'filip-stack', root: join(home, '.codex/.tmp/marketplaces/filip-stack'), marketplaceSource: { sourceType: 'git', source: 'https://github.com/filipgutica/filip-stack.git' } }]))
    put(join(home, '.claude/plugins/known_marketplaces.json'), JSON.stringify({ 'filip-stack': { source: { source: 'github', repo: 'filipgutica/filip-stack' }, installLocation: join(home, '.claude/plugins/marketplaces/filip-stack') } }))
    put(join(home, 'codex-plugins.json'), JSON.stringify([{ pluginId: 'example@filip-stack', name: 'example', version: '0.9.0', enabled: true }, { pluginId: 'disabled@filip-stack', name: 'disabled', version: '0.9.0', enabled: false }]))
    put(join(home, 'claude-plugins.json'), JSON.stringify([{ id: 'example@filip-stack', version: '0.9.0', scope: 'user', enabled: false }]))
    skills.example = { source: 'filipgutica/filip-stack', skillFolderHash: success(execute('git', ['-C', repo, 'rev-parse', 'HEAD:skills/example'])) }
    cpSync(join(repo, 'skills/example'), join(home, '.agents/skills/example'), { recursive: true })
    mkdirSync(join(home, '.claude/skills'), { recursive: true })
    symlinkSync(join(home, '.agents/skills/example'), join(home, '.claude/skills/example'))
  }
  put(join(home, '.agents/.skill-lock.json'), JSON.stringify({ version: 3, skills }))
}

test('sync verifies installed skills and both plugin payloads while preserving selections and disabled state', (t) => {
  const context = fixture(t)
  installedTools(context)
  const marker = join(context.home, '.claude/plugins/cache/filip-stack/example/1.0.0/.in_use/1234')
  const markerContent = JSON.stringify({ pid: 1234, procStart: 'Fri Nov 7 08:00:00 2026' })
  put(marker, markerContent)
  const report = JSON.parse(success(context.sync()))
  assert.equal(report.ok, true)
  assert.deepEqual(report.components.find(({ name }) => name === 'skills').skills[0].hosts, ['codex', 'claude-code'])
  assert.equal(report.components.find(({ name }) => name === 'claude').plugins[0].version, '1.0.0')
  assert.deepEqual(report.components.find(({ name }) => name === 'codex').plugins[1], { name: 'disabled', state: 'disabled' })
  const actions = readFileSync(join(context.home, 'tool-actions.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.equal(actions.some(({ args }) => args.includes('disabled@filip-stack')), false)
  assert.equal(actions.filter(({ tool }) => tool === 'npx').length, 1)
  assert.equal(JSON.parse(readFileSync(join(context.home, '.agents/.skill-lock.json'))).skills.unrelated.skillFolderHash, 'untouched')
  assert.equal(readFileSync(marker, 'utf8'), markerContent)
})

for (const scenario of [
  { name: 'non-PID Claude file', host: 'claude', path: '.in_use/payload.js', content: '{}' },
  { name: 'malformed Claude marker', host: 'claude', path: '.in_use/1234', content: 'unexpected payload' },
  { name: 'mismatched Claude PID', host: 'claude', path: '.in_use/1234', content: JSON.stringify({ pid: 5678, procStart: 'Fri Nov 7 08:00:00 2026' }) },
  { name: 'symlinked Claude marker', host: 'claude', path: '.in_use/1234', content: JSON.stringify({ pid: 1234, procStart: 'Fri Nov 7 08:00:00 2026' }), symlink: true },
  { name: 'Codex marker-shaped file', host: 'codex', path: '.in_use/1234', content: JSON.stringify({ pid: 1234, procStart: 'Fri Nov 7 08:00:00 2026' }) },
]) test(`a ${scenario.name} remains an unexpected plugin file`, (t) => {
  const context = fixture(t)
  installedTools(context)
  const path = join(context.home, `.${scenario.host}/plugins/cache/filip-stack/example/1.0.0`, scenario.path)
  if (scenario.symlink) {
    const target = join(context.root, 'marker.json')
    put(target, scenario.content)
    mkdirSync(dirname(path), { recursive: true })
    symlinkSync(target, path)
  } else put(path, scenario.content)
  const result = context.sync()
  assert.equal(result.status, 1)
  const component = JSON.parse(result.stdout).components.find(({ name }) => name === scenario.host)
  assert.equal(component.state, 'blocked')
  assert.match(component.message, /unexpected installed files/)
  assert.equal(readFileSync(path, 'utf8'), scenario.content)
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
  put(join(seed, 'scripts/updater-generation.mjs'), "import { writeFileSync } from 'node:fs'; import { homedir } from 'node:os'; import { join } from 'node:path'; writeFileSync(join(homedir(), 'updater-generation'), 'new');\n")
  writeFileSync(updater, `import './updater-generation.mjs'\n${readFileSync(updater, 'utf8').replace(/^#![^\n]*\n/u, '')}`)
  success(execute('git', ['-C', seed, 'add', '.']))
  success(execute('git', ['-C', seed, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'new upstream guidance']))
  success(execute('git', ['-C', seed, 'push', '-q', origin, 'main']))
  const commit = success(execute('git', ['-C', seed, 'rev-parse', 'HEAD']))
  const report = JSON.parse(success(sync()))
  assert.equal(existsSync(join(home, 'updater-generation')), true)
  assert.equal(readFileSync(join(home, 'updater-generation'), 'utf8'), 'new')
  assert.equal(report.components[0].commit, commit)
  assert.equal(success(execute('git', ['-C', repo, 'rev-parse', 'HEAD'])), commit)
  assert.equal(readFileSync(join(home, '.agents/CODING_STANDARDS.md'), 'utf8'), 'New upstream guidance.\n')
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

const fleetBaseline = (context, { baseline = { skills: ['example', 'extra'], plugins: ['example', 'second'] }, ...profile } = {}) => {
  const path = join(context.home, '.config/filip-stack/fleet.json')
  put(path, JSON.stringify({ version: 1, baseline, environments: [{ environmentId: 'this-machine', label: 'fixture', ...profile }] }))
  return path
}

test('a shared baseline installs missing skills and plugins in both agents and survives a repeat run', (t) => {
  const context = fixture(t)
  installedTools(context, { empty: true })
  fleetBaseline(context)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const report = JSON.parse(success(context.sync('--environment-id', 'this-machine')))
    assert.deepEqual(report.components.find(({ name }) => name === 'skills').skills.map(({ name }) => name), ['example', 'extra'])
    for (const host of ['codex', 'claude']) {
      const plugins = report.components.find(({ name }) => name === host).plugins
      assert.deepEqual(plugins.map(({ name }) => name).sort(), ['example', 'second'])
      assert.equal(plugins.every(({ version }) => version === '1.0.0'), true)
    }
    assert.equal(readFileSync(join(context.home, '.claude/skills/extra/SKILL.md'), 'utf8'), 'An installed extra skill.\n')
    assert.equal(JSON.parse(readFileSync(join(context.home, '.agents/.skill-lock.json'))).skills.unrelated.source, 'another/owner')
  }
})

test('machine exceptions exclude selected skills, plugins and agent installations', (t) => {
  const context = fixture(t)
  installedTools(context, { empty: true })
  fleetBaseline(context, { agents: ['codex'], exclude: { skills: ['extra'], plugins: ['second'] } })
  const report = JSON.parse(success(context.sync('--environment-id', 'this-machine')))
  assert.equal(report.components.find(({ name }) => name === 'claude').state, 'excluded')
  assert.equal(report.components.find(({ name }) => name === 'skills').skills.find(({ name }) => name === 'extra').state, 'excluded')
  assert.deepEqual(report.components.find(({ name }) => name === 'codex').plugins.map(({ name }) => name), ['example'])
  assert.equal(existsSync(join(context.home, '.agents/skills/extra')), false)
  assert.equal(existsSync(join(context.home, '.claude/skills')), false)
  assert.equal(existsSync(join(context.home, '.codex/plugins/cache/filip-stack/second')), false)
  const actions = readFileSync(join(context.home, 'tool-actions.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.equal(actions.some(({ tool }) => tool === 'claude'), false)
})

for (const kind of ['foreign-owned', 'unmanaged']) {
  test(`a baseline preserves ${kind === 'unmanaged' ? 'an' : 'a'} ${kind} skill with the same name`, (t) => {
    const context = fixture(t)
    installedTools(context, { empty: true })
    fleetBaseline(context, { baseline: { skills: ['example'] } })
    const path = join(context.home, '.agents/skills/example/SKILL.md')
    put(path, 'Important separately owned skill.\n')
    if (kind === 'foreign-owned') {
      const lockPath = join(context.home, '.agents/.skill-lock.json')
      const lock = JSON.parse(readFileSync(lockPath))
      lock.skills.example = { source: 'another/owner' }
      put(lockPath, JSON.stringify(lock))
    }
    const result = context.sync('--environment-id', 'this-machine')
    assert.equal(result.status, 1)
    assert.equal(JSON.parse(result.stdout).components.find(({ name }) => name === 'skills').state, 'blocked')
    assert.equal(readFileSync(path, 'utf8'), 'Important separately owned skill.\n')
    const actions = readFileSync(join(context.home, 'tool-actions.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    assert.equal(actions.some(({ tool }) => tool === 'npx'), false)
  })
}

test('a pinned marketplace blocks missing baseline plugins without changing the pin', (t) => {
  const context = fixture(t)
  installedTools(context)
  fleetBaseline(context, { baseline: { plugins: ['second'] } })
  const path = join(context.home, '.claude/plugins/known_marketplaces.json')
  const pin = JSON.stringify({ 'filip-stack': { source: { source: 'github', repo: 'filipgutica/filip-stack', ref: 'v0.9.0' } } })
  put(path, pin)
  const result = context.sync('--environment-id', 'this-machine')
  assert.equal(result.status, 1)
  const report = JSON.parse(result.stdout)
  assert.match(report.components.find(({ name }) => name === 'claude').message, /baseline plugins missing: second/)
  assert.equal(report.components.find(({ name }) => name === 'codex').state, 'current')
  assert.equal(readFileSync(path, 'utf8'), pin)
  assert.equal(existsSync(join(context.home, '.claude/plugins/cache/filip-stack/second')), false)
})

// The external design-system plugin's marketplace is the whole repository. Only
// UPSTREAM_ROOT holds it: the fixture checkout has no plugins/design-system.
const designSystemUpstream = (context, { version = '2.0.0', omit = [], edits = {} } = {}) => {
  const upstream = join(context.root, 'upstream/design-system')
  rmSync(upstream, { recursive: true, force: true })
  const files = {
    '.claude-plugin/plugin.json': JSON.stringify({ name: 'design-system', version, skills: './skills' }),
    '.codex-plugin/plugin.json': JSON.stringify({ name: 'design-system', version, skills: './skills' }),
    'skills/design-system/SKILL.md': 'Read ../../language/DESIGN.md.\n',
    'language/DESIGN.md': 'The design language.\n',
    'language/tokens.css': ':root {}\n',
    'README.md': 'Repository files outside the plugin.\n',
    ...edits,
  }
  for (const [path, content] of Object.entries(files)) if (!omit.includes(path)) put(join(upstream, path), content)
}
// A machine with no plugins yet whose baseline selects a filip-stack plugin and design-system.
const designSystemBaseline = (t, upstream) => {
  const context = fixture(t)
  installedTools(context, { empty: true })
  designSystemUpstream(context, upstream)
  fleetBaseline(context, { baseline: { plugins: ['example', 'design-system'] } })
  return context
}
const pluginHosts = ['claude', 'codex']
// Returns the client calls logged since the last drain and clears the log.
const drainToolActions = ({ home }) => {
  const path = join(home, 'tool-actions.jsonl')
  const actions = existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : []
  rmSync(path, { force: true })
  return actions
}
const hasAction = (actions, tool, args) => actions.some((action) => action.tool === tool && args.every((arg, index) => action.args[index] === arg))
const pluginResult = (report, host, name) => report.components.find((component) => component.name === host).plugins.find((plugin) => plugin.name === name)

test('a baseline installs the external design-system plugin from its own marketplace and survives a repeat run', (t) => {
  const context = designSystemBaseline(t)
  assert.equal(existsSync(join(context.repo, 'plugins/design-system')), false)
  for (const [attempt, action] of ['install', 'update'].entries()) {
    const report = JSON.parse(success(context.sync('--environment-id', 'this-machine')))
    for (const host of pluginHosts) {
      const component = report.components.find(({ name }) => name === host)
      assert.deepEqual(component.marketplaces, [{ name: 'filip-stack', state: 'current' }, { name: 'design-system', state: 'current' }])
      assert.equal(pluginResult(report, host, 'design-system').version, '2.0.0')
      assert.equal(pluginResult(report, host, 'example').files, 3)
    }
    const actions = drainToolActions(context)
    assert.equal(hasAction(actions, 'claude', ['plugin', 'marketplace', 'add', 'filipgutica/design-system']), attempt === 0)
    assert.equal(hasAction(actions, 'codex', ['plugin', 'marketplace', 'add', 'filipgutica/design-system', '--json']), attempt === 0)
    assert.equal(hasAction(actions, 'claude', ['plugin', action, 'design-system@design-system', '--scope', 'user', '-y']), true)
    assert.equal(hasAction(actions, 'codex', ['plugin', 'add', 'design-system@design-system', '--json']), true)
  }
})

test('an excluded design-system plugin leaves its marketplace untouched', (t) => {
  const context = fixture(t)
  installedTools(context, { empty: true })
  designSystemUpstream(context)
  fleetBaseline(context, { baseline: { plugins: ['example', 'design-system'] }, exclude: { plugins: ['design-system'] } })
  const report = JSON.parse(success(context.sync('--environment-id', 'this-machine')))
  for (const host of pluginHosts) {
    assert.deepEqual(report.components.find(({ name }) => name === host).marketplaces, [{ name: 'filip-stack', state: 'current' }])
  }
  assert.equal(drainToolActions(context).some(({ args }) => args.some((arg) => arg.includes('design-system'))), false)
})

test('an existing design-system installation keeps its disabled state', (t) => {
  const context = fixture(t)
  installedTools(context, { empty: true })
  designSystemUpstream(context)
  fleetBaseline(context, { baseline: { plugins: ['design-system'] } })
  success(context.sync('--environment-id', 'this-machine'))
  for (const host of pluginHosts) {
    const path = join(context.home, `${host}-plugins.json`)
    put(path, JSON.stringify(JSON.parse(readFileSync(path)).map((plugin) => ({ ...plugin, enabled: false }))))
  }
  rmSync(join(context.home, '.config/filip-stack/fleet.json'))
  drainToolActions(context)
  const report = JSON.parse(success(context.sync()))
  assert.deepEqual(pluginResult(report, 'claude', 'design-system'), { name: 'design-system', version: '2.0.0', scope: 'user', enabled: false })
  assert.deepEqual(pluginResult(report, 'codex', 'design-system'), { name: 'design-system', state: 'disabled' })
  assert.equal(hasAction(drainToolActions(context), 'codex', ['plugin', 'add', 'design-system@design-system']), false)
})

const marketplaceRecord = ({ home }, host) => host === 'claude'
  ? { path: join(home, '.claude/plugins/known_marketplaces.json'), source: (data, name) => data[name].source }
  : { path: join(home, 'codex-marketplaces.json'), source: (data, name) => data.find((item) => item.name === name).marketplaceSource }

for (const host of pluginHosts) {
  for (const scenario of [
    { name: 'a pinned design-system marketplace is preserved while filip-stack plugins progress', marketplace: 'design-system', change: (source) => { source.ref = 'v1.0.0' }, state: 'pinned', message: /design-system: Marketplace has a custom source or ref/, progressing: 'example' },
    { name: 'a design-system marketplace from another source blocks the missing plugin while filip-stack plugins progress', marketplace: 'design-system', change: (source) => { if (host === 'claude') source.repo = 'someone-else/design-system'; else source.source = 'https://github.com/someone-else/design-system.git' }, uninstall: true, state: 'blocked', message: /design-system: custom or pinned marketplace preserved; baseline plugins missing: design-system/, progressing: 'example' },
    { name: 'a pinned filip-stack marketplace is preserved while the design-system plugin progresses', marketplace: 'filip-stack', change: (source) => { source.ref = 'v0.9.0' }, state: 'pinned', message: /filip-stack: Marketplace has a custom source or ref/, progressing: 'design-system' },
  ]) test(`${host}: ${scenario.name}`, (t) => {
    const context = designSystemBaseline(t)
    success(context.sync('--environment-id', 'this-machine'))
    const record = marketplaceRecord(context, host)
    const data = JSON.parse(readFileSync(record.path))
    scenario.change(record.source(data, scenario.marketplace))
    put(record.path, JSON.stringify(data))
    if (scenario.uninstall) {
      const state = join(context.home, `${host}-plugins.json`)
      put(state, JSON.stringify(JSON.parse(readFileSync(state)).filter((plugin) => !(plugin.id || plugin.pluginId).startsWith('design-system@'))))
    }
    drainToolActions(context)
    const result = context.sync('--environment-id', 'this-machine')
    const report = JSON.parse(result.stdout)
    assert.equal(result.status, scenario.state === 'blocked' ? 1 : 0)
    const component = report.components.find(({ name }) => name === host)
    assert.equal(component.state, scenario.state)
    assert.match(component.message, scenario.message)
    assert.deepEqual(component.marketplaces.find(({ name }) => name === scenario.marketplace), { name: scenario.marketplace, state: scenario.state })
    assert.deepEqual(component.plugins.map(({ name }) => name), [scenario.progressing])
    assert.equal(report.components.find(({ name }) => name === pluginHosts.find((other) => other !== host)).state, 'current')
    assert.equal(readFileSync(record.path, 'utf8'), JSON.stringify(data))
    const actions = drainToolActions(context).filter(({ tool }) => tool === host)
    assert.equal(actions.some(({ args }) => args.includes(scenario.marketplace) || args.some((arg) => arg.endsWith(`@${scenario.marketplace}`))), false)
  })
}

for (const scenario of [
  { name: 'an installed design-system release behind its marketplace clone is blocked', update: { version: '2.1.0' }, error: /design-system: installed 2\.0\.0, expected 2\.1\.0/ },
  { name: 'an unreleased design-system development build is blocked', initial: { version: '0.0.0-development' }, error: /design-system: installed 0\.0\.0-development is not a release/ },
  { name: 'a design-system installation without a required file is blocked', initial: { omit: ['language/tokens.css'] }, error: /design-system: installed payload is missing language\/tokens\.css/ },
  { name: 'unreleased design-system edits at the installed release still verify', update: { edits: { 'language/DESIGN.md': 'Edited on main after the release.\n', 'language/unreleased.md': 'A new file on main.\n' } } },
]) test(scenario.name, (t) => {
  const context = designSystemBaseline(t, scenario.initial)
  let result = context.sync('--environment-id', 'this-machine')
  if (scenario.update) {
    assert.equal(result.status, 0, result.stdout)
    designSystemUpstream(context, scenario.update)
    // The installer keeps the cached release, as an update with no new version does.
    context.env.INSTALLER_NOOP = 'true'
    result = context.sync('--environment-id', 'this-machine')
  }
  const report = JSON.parse(result.stdout)
  assert.equal(result.status, scenario.error ? 1 : 0, result.stdout)
  for (const host of pluginHosts) {
    const component = report.components.find(({ name }) => name === host)
    if (scenario.error) {
      assert.equal(component.state, 'blocked')
      assert.match(component.message, scenario.error)
    } else assert.equal(pluginResult(report, host, 'design-system').version, '2.0.0')
    assert.equal(pluginResult(report, host, 'example').files, 3)
  }
})

test('a baseline plugin name that is neither in the checkout nor a known external plugin is rejected', (t) => {
  const context = fixture(t)
  installedTools(context, { empty: true })
  fleetBaseline(context, { baseline: { plugins: ['constructor'] } })
  const result = context.sync('--environment-id', 'this-machine')
  assert.equal(result.status, 1)
  assert.match(JSON.parse(result.stdout).components.find(({ name }) => name === 'configuration').message, /baseline plugin constructor is not available/)
})

test('a refresh with --config saves the shared policy, backing up a differing saved copy', (t) => {
  const context = fixture(t)
  installedTools(context)
  const saved = fleetBaseline(context, { label: 'stale' })
  const stale = readFileSync(saved, 'utf8')
  const shared = join(context.root, 'shared.json')
  put(shared, JSON.stringify({ version: 1, environments: [{ environmentId: 'this-machine', label: 'fixture', agents: ['codex'] }] }))
  success(context.sync('--dry-run', '--config', shared, '--environment-id', 'this-machine'))
  assert.equal(readFileSync(saved, 'utf8'), stale)

  const first = JSON.parse(success(context.sync('--config', shared, '--environment-id', 'this-machine')))
  const { savedPolicy } = first.components.find(({ name }) => name === 'configuration')
  assert.equal(savedPolicy.state, 'saved')
  assert.equal(readFileSync(saved, 'utf8'), readFileSync(shared, 'utf8'))
  assert.equal(readFileSync(savedPolicy.backup, 'utf8'), stale)

  const second = JSON.parse(success(context.sync('--config', shared, '--environment-id', 'this-machine')))
  assert.equal(second.components.find(({ name }) => name === 'configuration').savedPolicy.state, 'current')
  assert.deepEqual(readdirSync(dirname(saved)).filter((name) => name.includes('.bak-')), [basename(savedPolicy.backup)])
})

test('a refresh with --config leaves a symlinked saved policy to the tool that owns it', (t) => {
  const context = fixture(t)
  installedTools(context)
  const source = join(context.root, 'dotfiles/fleet.json')
  put(source, JSON.stringify({ version: 1, environments: [{ environmentId: 'this-machine', label: 'dotfiles' }] }))
  const saved = join(context.home, '.config/filip-stack/fleet.json')
  mkdirSync(dirname(saved), { recursive: true })
  symlinkSync(source, saved)
  const shared = join(context.root, 'shared.json')
  put(shared, JSON.stringify({ version: 1, environments: [{ environmentId: 'this-machine', label: 'fixture' }] }))
  const report = JSON.parse(success(context.sync('--config', shared, '--environment-id', 'this-machine')))
  assert.equal(report.components.find(({ name }) => name === 'configuration').savedPolicy.state, 'symlink')
  assert.match(readFileSync(source, 'utf8'), /dotfiles/)
})

test('invalid baseline names fail before touching guidance or installers', (t) => {
  const context = fixture(t)
  installedTools(context, { empty: true })
  fleetBaseline(context, { baseline: { skills: ['../outside'] } })
  const result = context.sync('--environment-id', 'this-machine')
  assert.equal(result.status, 1)
  assert.match(JSON.parse(result.stdout).components.find(({ name }) => name === 'configuration').message, /array of names/)
  assert.equal(existsSync(join(context.home, '.codex/AGENTS.md')), false)
  assert.equal(existsSync(join(context.home, 'tool-actions.jsonl')), false)
})

for (const scenario of [
  { name: 'an installed but non-executable host is blocked rather than skipped as absent', baseline: false, change: (path) => chmodSync(path, 0o644), error: /EACCES/ },
  { name: 'a required baseline client is incomplete when its executable is missing', baseline: true, change: rmSync, error: /required by the baseline/ },
]) test(scenario.name, (t) => {
  const context = fixture(t)
  installedTools(context, { empty: scenario.baseline })
  if (scenario.baseline) fleetBaseline(context, { baseline: { plugins: ['example'] }, agents: ['codex'] })
  scenario.change(join(context.root, 'bin/codex'))
  const result = context.sync(...(scenario.baseline ? ['--environment-id', 'this-machine'] : []))
  assert.equal(result.status, 1)
  const codex = JSON.parse(result.stdout).components.find(({ name }) => name === 'codex')
  assert.equal(codex.state, 'blocked')
  assert.match(codex.message, scenario.error)
})

test('a pinned but missing baseline skill remains incomplete', (t) => {
  const context = fixture(t)
  installedTools(context, { empty: true })
  fleetBaseline(context, { baseline: { skills: ['example'] }, agents: ['codex'] })
  const lockPath = join(context.home, '.agents/.skill-lock.json')
  const lock = JSON.parse(readFileSync(lockPath))
  lock.skills.example = { source: 'filipgutica/filip-stack', ref: 'v0.9.0' }
  put(lockPath, JSON.stringify(lock))
  const result = context.sync('--environment-id', 'this-machine')
  assert.equal(result.status, 1)
  assert.match(JSON.parse(result.stdout).components.find(({ name }) => name === 'skills').message, /pinned but missing/)
  assert.equal(existsSync(join(context.home, '.agents/skills/example')), false)
})

for (const mergeMode of ['--no-ff', '--squash']) {
  test(`guidance from an unmerged commit is preserved and recovers after ${mergeMode}`, (t) => {
    const context = fixture(t)
    success(execute('git', ['-C', context.repo, 'switch', '-qc', 'guidance-work']))
    put(join(context.repo, 'host-config/agents/CODING_STANDARDS.md'), 'Guidance being developed elsewhere.\n')
    success(execute('git', ['-C', context.repo, 'add', '.']))
    const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false']
    success(execute('git', ['-C', context.repo, ...identity, 'commit', '-qm', 'guidance work']))
    context.apply()
    const manifest = join(context.home, '.agents/.filip-stack-host-config.json')
    const before = readFileSync(manifest, 'utf8')
    success(execute('git', ['-C', context.repo, 'switch', '-q', 'main']))
    const result = context.sync()
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    assert.match(report.components.find(({ name }) => name === 'guidance').message, /not contained in selected source/)
    assert.equal(report.components.find(({ name }) => name === 'skills').state, 'current')
    assert.equal(readFileSync(manifest, 'utf8'), before)
    assert.equal(readFileSync(join(context.home, '.agents/CODING_STANDARDS.md'), 'utf8'), 'Guidance being developed elsewhere.\n')
    success(execute('git', ['-C', context.repo, ...identity, 'merge', mergeMode, '-qm', 'accept guidance', 'guidance-work']))
    if (mergeMode === '--squash') success(execute('git', ['-C', context.repo, ...identity, 'commit', '-qm', 'accept equivalent guidance']))
    const expected = mergeMode === '--no-ff' ? 'Accepted follow-up guidance.\n' : 'Guidance being developed elsewhere.\n'
    if (mergeMode === '--no-ff') {
      put(join(context.repo, 'host-config/agents/CODING_STANDARDS.md'), expected)
      success(execute('git', ['-C', context.repo, 'add', '.']))
      success(execute('git', ['-C', context.repo, ...identity, 'commit', '-qm', 'follow-up guidance']))
    }
    assert.equal(execute('git', ['-C', context.repo, 'merge-base', '--is-ancestor', JSON.parse(before).commit, 'HEAD']).status, mergeMode === '--no-ff' ? 0 : 1)
    success(execute('git', ['-C', context.repo, 'push', '-q', 'origin', 'main']))
    assert.equal(JSON.parse(success(context.sync())).ok, true)
    assert.equal(readFileSync(join(context.home, '.agents/CODING_STANDARDS.md'), 'utf8'), expected)
  })
}
