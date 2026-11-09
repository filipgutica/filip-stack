// How host config resolves the pinned design-system package: download, verification, offline failures, and pin bumps.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPackage, cachePath, copyHostConfig, fixturePayload, seedCache, serve, snapshot, unreachableUrl, writePin } from './design-system-fixture.mjs'

// Runs asynchronously so a fixture server in this process can answer the script's download.
const run = ({ repo, home, command, cacheHome }) => new Promise((resolve) => {
  const env = { ...process.env, XDG_CONFIG_HOME: join(home, '.config') }
  // Without XDG_CACHE_HOME the cache lives in the home directory.
  if (cacheHome) env.XDG_CACHE_HOME = cacheHome
  else delete env.XDG_CACHE_HOME
  const child = spawn(process.execPath, [join(repo, 'scripts/host-config.mjs'), command, '--home', home], { env })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.on('close', (status) => resolve({ status, stdout, stderr }))
})

const succeed = async (options) => {
  const result = await run(options)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result
}

const setup = (t) => {
  const root = mkdtempSync(join(tmpdir(), 'host-config-design-system-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = join(root, 'repo')
  const home = join(root, 'home')
  mkdirSync(home)
  const first = buildPackage({ root })
  copyHostConfig({ repo, pin: first.pin })
  return { root, repo, home, first }
}

// Applies the first package from a seeded cache outside the home directory.
const setupApplied = async (t) => {
  const context = setup(t)
  const cacheHome = join(context.root, 'cache')
  seedCache({ cacheHome, ...context.first })
  await succeed({ ...context, command: 'apply', cacheHome })
  return { ...context, cacheHome }
}

test('apply downloads, verifies, and caches the pinned package when the cache is empty', async (t) => {
  const { repo, home, first } = setup(t)
  const server = await serve(readFileSync(first.tarball))
  t.after(server.close)
  writePin({ repo, pin: { ...first.pin, tarball: server.url } })

  const result = await succeed({ repo, home, command: 'apply' })
  const cached = cachePath({ cacheHome: join(home, '.cache'), version: '1.0.0' })
  assert.ok(result.stdout.includes(`downloaded @filipgutica/design-system@1.0.0 to ${cached}`))
  assert.deepEqual(readFileSync(cached), readFileSync(first.tarball))
  for (const [file, content] of Object.entries(fixturePayload)) assert.equal(readFileSync(join(home, 'design-language', file), 'utf8'), content)
})

test('apply rejects a tampered tarball and leaves the cache and the installed files unchanged', async (t) => {
  const { root, repo, home, first } = setup(t)
  seedCache({ cacheHome: join(home, '.cache'), ...first })
  await succeed({ repo, home, command: 'apply' })
  const before = snapshot(home)

  const next = buildPackage({ root, version: '1.1.0', files: { 'DESIGN.md': '# Next\n' } })
  const server = await serve(Buffer.concat([readFileSync(next.tarball), Buffer.from('tampered')]))
  t.after(server.close)
  writePin({ repo, pin: { ...next.pin, tarball: server.url } })
  const result = await run({ repo, home, command: 'apply' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /failed the integrity check for @filipgutica\/design-system@1\.1\.0/)
  assert.deepEqual(snapshot(home), before)
})

test('apply without a cached package or a reachable registry names the version and the cache path', async (t) => {
  const { repo, home, first } = setup(t)
  writePin({ repo, pin: { ...first.pin, tarball: await unreachableUrl() } })
  const result = await run({ repo, home, command: 'apply' })
  assert.equal(result.status, 1)
  assert.ok(result.stderr.includes(`@filipgutica/design-system@1.0.0 is not cached at ${cachePath({ cacheHome: join(home, '.cache'), version: '1.0.0' })}`))
  assert.match(result.stderr, /rerun with network access/)
  assert.deepEqual(readdirSync(home), [])
})

test('apply rejects a package with a symlink before writing anything', async (t) => {
  const { root, repo, home } = setup(t)
  const linked = buildPackage({ root, version: '1.0.1', links: { 'outside.md': '/etc/hosts' } })
  seedCache({ cacheHome: join(root, 'cache'), ...linked })
  writePin({ repo, pin: linked.pin })
  const result = await run({ repo, home, command: 'apply', cacheHome: join(root, 'cache') })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /not a plain file or folder inside the package: package\/language\/outside\.md/)
  assert.deepEqual(readdirSync(home), [])
})

test('status reports an uncached pin without downloading and still reports the other targets', async (t) => {
  const { root, repo, home } = await setupApplied(t)

  const empty = join(root, 'empty-cache')
  const result = await succeed({ repo, home, command: 'status', cacheHome: empty })
  const [, header, ...states] = result.stdout.trim().split('\n')
  assert.match(header, /, design-system 1\.0\.0 \(not cached; apply downloads it\)$/)
  for (const file of Object.keys(fixturePayload)) assert.ok(states.includes(`unknown       design-language/${file}`), file)
  assert.ok(states.includes('current       .agents/roles.md'))
  assert.equal(existsSync(empty), false)
})

test('a pin bump lists each design-language change, and apply removes files the new version dropped', async (t) => {
  const { root, repo, home, cacheHome } = await setupApplied(t)

  const next = buildPackage({ root, version: '1.1.0', files: { 'DESIGN.md': '# Design language 1.1\n', 'tokens.css': fixturePayload['tokens.css'] } })
  seedCache({ cacheHome, ...next })
  writePin({ repo, pin: next.pin })
  const status = await succeed({ repo, home, command: 'status', cacheHome })
  assert.match(status.stdout, /^repository: .*, design-system 1\.0\.0 → 1\.1\.0$/m)
  assert.match(status.stdout, /^update +design-language\/DESIGN\.md$/m)
  assert.match(status.stdout, /^current +design-language\/tokens\.css$/m)
  assert.match(status.stdout, /^remove +design-language\/visualizations\/report\.css$/m)

  await succeed({ repo, home, command: 'apply', cacheHome })
  assert.equal(readFileSync(join(home, 'design-language/DESIGN.md'), 'utf8'), '# Design language 1.1\n')
  assert.equal(existsSync(join(home, 'design-language/visualizations/report.css')), false)
  const manifest = JSON.parse(readFileSync(join(home, '.agents/.filip-stack-host-config.json'), 'utf8'))
  assert.equal(manifest.designSystem.version, '1.1.0')
  assert.match((await succeed({ repo, home, command: 'status', cacheHome })).stdout, /^repository: .*, design-system 1\.1\.0$/m)
})
