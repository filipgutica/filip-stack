// How host config resolves the pinned design-system package: download, verification, offline failures, and pin bumps.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPackage, cachePath, copyHostConfig, fixturePayload, seedCache, serve, snapshot, unreachableUrl, writePin } from './design-system-fixture.mjs'

// Runs asynchronously so a fixture server in this process can answer the script's download.
const run = ({ repo, home, command, args = [], cacheHome }) => new Promise((resolve) => {
  const env = { ...process.env, XDG_CONFIG_HOME: join(home, '.config') }
  // Without XDG_CACHE_HOME the cache lives in the home directory.
  if (cacheHome) env.XDG_CACHE_HOME = cacheHome
  else delete env.XDG_CACHE_HOME
  const child = spawn(process.execPath, [join(repo, 'scripts/host-config.mjs'), command, '--home', home, ...args], { env })
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

// Turns the applied install into one made before the design system moved: the files sit in
// ~/design-language and the manifest names them there.
const moveToLegacyInstall = (home) => {
  renameSync(join(home, 'design-system'), join(home, 'design-language'))
  const path = join(home, '.agents/.filip-stack-host-config.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  manifest.files = Object.fromEntries(Object.entries(manifest.files).map(([target, hash]) => [target.replace(/^design-system\//, 'design-language/'), hash]))
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
}

// Serves body as the pinned tarball and runs apply against an empty cache in the home directory.
const applyDownload = async (t, { repo, home, pin, body }) => {
  const server = await serve(body)
  t.after(server.close)
  writePin({ repo, pin: { ...pin, tarball: server.url } })
  return run({ repo, home, command: 'apply' })
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
  for (const [file, content] of Object.entries(fixturePayload)) assert.equal(readFileSync(join(home, 'design-system', file), 'utf8'), content)
})

test('apply rejects a tampered tarball and leaves the cache and the installed files unchanged', async (t) => {
  const { root, repo, home, first } = setup(t)
  seedCache({ cacheHome: join(home, '.cache'), ...first })
  await succeed({ repo, home, command: 'apply' })
  const before = snapshot(home)

  const next = buildPackage({ root, version: '1.1.0', files: { 'DESIGN.md': '# Next\n' } })
  const result = await applyDownload(t, { repo, home, pin: next.pin, body: Buffer.concat([readFileSync(next.tarball), Buffer.from('tampered')]) })
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

test('apply rejects a downloaded package with a symlink before writing anything, cache included', async (t) => {
  const { root, repo, home } = setup(t)
  const linked = buildPackage({ root, version: '1.0.1', links: { 'outside.md': '/etc/hosts' } })
  const result = await applyDownload(t, { repo, home, pin: linked.pin, body: readFileSync(linked.tarball) })
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
  for (const file of Object.keys(fixturePayload)) assert.ok(states.includes(`unknown       design-system/${file}`), file)
  assert.ok(states.includes('current       .agents/roles.md'))
  assert.equal(existsSync(empty), false)
})

// No pin installs to ~/design-language, so status can retire those files without the package.
test('status without the package still reports old ~/design-language files for removal', async (t) => {
  const { root, repo, home } = await setupApplied(t)
  moveToLegacyInstall(home)

  const result = await succeed({ repo, home, command: 'status', cacheHome: join(root, 'empty-cache') })
  for (const file of Object.keys(fixturePayload)) assert.match(result.stdout, new RegExp(`^remove +design-language/${file}$`, 'm'))
})

test('apply moves an unchanged ~/design-language install to ~/design-system and removes the old folder', async (t) => {
  const { repo, home, cacheHome } = await setupApplied(t)
  moveToLegacyInstall(home)

  const status = await succeed({ repo, home, command: 'status', cacheHome })
  for (const file of Object.keys(fixturePayload)) {
    assert.match(status.stdout, new RegExp(`^remove +design-language/${file}$`, 'm'))
    assert.match(status.stdout, new RegExp(`^update +design-system/${file}$`, 'm'))
  }

  const result = await succeed({ repo, home, command: 'apply', cacheHome })
  assert.match(result.stdout, /^removed design-language\/$/m)
  assert.equal(existsSync(join(home, 'design-language')), false)
  for (const [file, content] of Object.entries(fixturePayload)) assert.equal(readFileSync(join(home, 'design-system', file), 'utf8'), content)
  const manifest = JSON.parse(readFileSync(join(home, '.agents/.filip-stack-host-config.json'), 'utf8'))
  assert.deepEqual(Object.keys(manifest.files).filter((target) => target.startsWith('design-language/')), [])
})

test('apply keeps an edited ~/design-language file, and keeps and names the old folder while unmanaged files remain', async (t) => {
  const { repo, home, cacheHome } = await setupApplied(t)
  moveToLegacyInstall(home)
  const edited = join(home, 'design-language/DESIGN.md')
  writeFileSync(edited, '# My notes\n')
  writeFileSync(join(home, 'design-language/.DS_Store'), '')

  const refused = await run({ repo, home, command: 'apply', cacheHome })
  assert.equal(refused.status, 1)
  assert.match(refused.stdout, /^-# My notes$/m)
  assert.equal(readFileSync(edited, 'utf8'), '# My notes\n')
  assert.equal(existsSync(join(home, 'design-system')), false)

  const forced = await succeed({ repo, home, command: 'apply', args: ['--force'], cacheHome })
  assert.equal(readFileSync(`${edited}.bak`, 'utf8'), '# My notes\n')
  assert.equal(existsSync(edited), false)
  assert.ok(existsSync(join(home, 'design-language/.DS_Store')))
  assert.ok(forced.stdout.includes(`kept ${join(home, 'design-language')}`), forced.stdout)
  for (const [file, content] of Object.entries(fixturePayload)) assert.equal(readFileSync(join(home, 'design-system', file), 'utf8'), content)
})

test('a pin bump lists each design-system change, and apply removes files the new version dropped', async (t) => {
  const { root, repo, home, cacheHome } = await setupApplied(t)

  const next = buildPackage({ root, version: '1.1.0', files: { 'DESIGN.md': '# Design language 1.1\n', 'tokens.css': fixturePayload['tokens.css'] } })
  seedCache({ cacheHome, ...next })
  writePin({ repo, pin: next.pin })
  const status = await succeed({ repo, home, command: 'status', cacheHome })
  assert.match(status.stdout, /^repository: .*, design-system 1\.0\.0 → 1\.1\.0$/m)
  assert.match(status.stdout, /^update +design-system\/DESIGN\.md$/m)
  assert.match(status.stdout, /^current +design-system\/tokens\.css$/m)
  assert.match(status.stdout, /^remove +design-system\/visualizations\/report\.css$/m)

  await succeed({ repo, home, command: 'apply', cacheHome })
  assert.equal(readFileSync(join(home, 'design-system/DESIGN.md'), 'utf8'), '# Design language 1.1\n')
  assert.equal(existsSync(join(home, 'design-system/visualizations/report.css')), false)
  const manifest = JSON.parse(readFileSync(join(home, '.agents/.filip-stack-host-config.json'), 'utf8'))
  assert.equal(manifest.designSystem.version, '1.1.0')
  assert.match((await succeed({ repo, home, command: 'status', cacheHome })).stdout, /^repository: .*, design-system 1\.1\.0$/m)
})
