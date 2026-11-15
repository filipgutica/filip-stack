// How apply retires the files host config installed before the design system became the
// design-system plugin: ~/design-system, and the older ~/design-language.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { copyHostConfig, snapshot } from './host-config-fixture.mjs'

const repo = join(mkdtempSync(join(tmpdir(), 'host-config-migration-repo-')), 'repo')
copyHostConfig({ repo })

// What the old installer copied from the design-system package.
const installed = {
  'DESIGN.md': '# Design language\n\nRead tokens.css first.\n',
  'tokens.css': ':root { --accent: #4f46e5; }\n',
  'visualizations/report.css': '.report { color: var(--accent); }\n',
}

const run = ({ home, args }) => spawnSync(process.execPath, [join(repo, 'scripts/host-config.mjs'), ...args, '--home', home], {
  encoding: 'utf8',
  env: { ...process.env, XDG_CONFIG_HOME: join(home, '.config') },
})
const succeed = (options) => {
  const result = run(options)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout
}
const status = (home) => succeed({ home, args: ['status'] })
const manifestPath = (home) => join(home, '.agents/.filip-stack-host-config.json')
const readManifest = (home) => JSON.parse(readFileSync(manifestPath(home), 'utf8'))
const line = (text) => new RegExp(`^${text}$`, 'm')
// Runs status, then apply, and checks that each reports every installed file in `folder` with the
// expected line, such as `remove +<target>` and `removed <target>`. Returns apply's output.
const applyAndExpect = ({ home, folder, statusLine, applyLine }) => {
  const lines = (text, describe) => {
    for (const file of Object.keys(installed)) assert.match(text, line(describe(`${folder}/${file}`)))
  }
  lines(status(home), statusLine)
  const result = succeed({ home, args: ['apply'] })
  lines(result, applyLine)
  return result
}

// Applies today's host config, then adds what the old installer left: the package files in
// `folder`, and a manifest that tracks them and records the package version.
const setupOldInstall = (t, folder) => {
  const root = mkdtempSync(join(tmpdir(), 'host-config-migration-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const home = join(root, 'home')
  mkdirSync(home)
  succeed({ home, args: ['apply'] })
  const manifest = readManifest(home)
  for (const [file, content] of Object.entries(installed)) {
    const path = join(home, folder, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
    manifest.files[`${folder}/${file}`] = createHash('sha256').update(content).digest('hex')
  }
  manifest.designSystem = { version: '1.0.15', integrity: 'sha512-fixture' }
  writeFileSync(manifestPath(home), `${JSON.stringify(manifest, null, 2)}\n`)
  return { root, home }
}

// After the migration apply, the manifest tracks no design file and has no `designSystem` key,
// status reports every target current, and a repeat apply changes and reports nothing.
const assertMigrated = (home) => {
  const manifest = readManifest(home)
  assert.equal('designSystem' in manifest, false)
  assert.deepEqual(Object.keys(manifest.files).filter((target) => /^design-(system|language)\//.test(target)), [])
  const targets = status(home).trimEnd().split('\n').slice(2)
  assert.ok(targets.every((state) => state.startsWith('current ')), targets.join('\n'))
  const before = snapshot(home)
  const again = succeed({ home, args: ['apply'] })
  assert.doesNotMatch(again, /^(wrote|removed|kept|backed up) /m)
  assert.doesNotMatch(again, /design-system plugin/)
  assert.deepEqual(snapshot(home), before)
}

const pluginNotice = /design-system plugin.*claude plugin install design-system@design-system.*codex plugin add design-system@design-system.*filip-stack sync/

for (const folder of ['design-system', 'design-language']) {
  test(`apply removes an unchanged ~/${folder} install, its empty folders, and the version record`, (t) => {
    const { home } = setupOldInstall(t, folder)
    const result = applyAndExpect({ home, folder, statusLine: (target) => `remove +${target}`, applyLine: (target) => `removed ${target}` })
    assert.match(result, line(`removed ${folder}/`))
    assert.equal(existsSync(join(home, folder)), false)
    assert.equal(result.match(new RegExp(pluginNotice, 'g'))?.length, 1)
    assertMigrated(home)
  })

  test(`apply keeps files in ~/${folder} that it did not install, and the folder that holds them`, (t) => {
    const { home } = setupOldInstall(t, folder)
    writeFileSync(join(home, folder, 'notes.md'), '# My notes\n')

    const result = succeed({ home, args: ['apply'] })
    for (const file of Object.keys(installed)) assert.equal(existsSync(join(home, folder, file)), false, file)
    assert.equal(readFileSync(join(home, folder, 'notes.md'), 'utf8'), '# My notes\n')
    assert.ok(result.includes(`kept ${join(home, folder)}: `), result)
    assertMigrated(home)
  })

  test(`an edited ~/${folder} file stops the whole apply, and --force backs it up before removing it`, (t) => {
    const { home } = setupOldInstall(t, folder)
    const edited = join(home, folder, 'DESIGN.md')
    writeFileSync(edited, '# My notes\n')
    writeFileSync(`${edited}.bak`, '# An older backup\n')
    const before = snapshot(home)

    const refused = run({ home, args: ['apply'] })
    assert.equal(refused.status, 1)
    assert.match(refused.stdout, /^-# My notes$/m)
    assert.match(refused.stderr, /--force/)
    assert.deepEqual(snapshot(home), before)

    const forced = succeed({ home, args: ['apply', '--force'] })
    assert.equal(readFileSync(`${edited}.bak`, 'utf8'), '# An older backup\n')
    assert.equal(readFileSync(`${edited}.bak.1`, 'utf8'), '# My notes\n')
    assert.ok(forced.includes(`backed up ${edited} to ${edited}.bak.1`), forced)
    for (const file of Object.keys(installed)) assert.equal(existsSync(join(home, folder, file)), false, file)
    assert.ok(forced.includes(`kept ${join(home, folder)}: `), forced)
    assertMigrated(home)
  })

  // The folders were filip-stack's, so a symlink in one points at something the user owns. Apply stops
  // tracking what sits behind the link and touches neither the link nor its target.
  test(`apply forgets ~/${folder} files behind a symlinked folder and leaves the link and its target alone`, (t) => {
    const { root, home } = setupOldInstall(t, folder)
    const outside = join(root, 'outside')
    renameSync(join(home, folder), outside)
    symlinkSync(outside, join(home, folder))
    const before = snapshot(outside)
    const result = applyAndExpect({
      home, folder, statusLine: (target) => `symlink +${target}`, applyLine: (target) => `kept ${target}: .*no longer tracks it`,
    })
    assert.match(result, pluginNotice)
    assert.ok(lstatSync(join(home, folder)).isSymbolicLink())
    assert.deepEqual(snapshot(outside), before)
    assertMigrated(home)
    assert.deepEqual(snapshot(outside), before)
  })

  test(`apply removes ~/${folder} files but only forgets those behind a symlinked subfolder`, (t) => {
    const { root, home } = setupOldInstall(t, folder)
    const outside = join(root, 'outside-visualizations')
    renameSync(join(home, folder, 'visualizations'), outside)
    symlinkSync(outside, join(home, folder, 'visualizations'))
    const before = snapshot(outside)

    const result = succeed({ home, args: ['apply'] })
    assert.match(result, line(`removed ${folder}/DESIGN.md`))
    assert.match(result, line(`removed ${folder}/tokens.css`))
    assert.match(result, line(`kept ${folder}/visualizations/report.css: .*`))
    assert.ok(lstatSync(join(home, folder, 'visualizations')).isSymbolicLink())
    assert.ok(result.includes(`kept ${join(home, folder)}: `), result)
    assert.deepEqual(snapshot(outside), before)
    assertMigrated(home)
  })

  test(`apply forgets a dangling symlink in ~/${folder} and leaves it in place`, (t) => {
    const { root, home } = setupOldInstall(t, folder)
    const link = join(home, folder, 'DESIGN.md')
    const missing = join(root, 'missing.md')
    rmSync(link)
    symlinkSync(missing, link)
    assert.match(status(home), line(`symlink +${folder}/DESIGN.md`))

    const result = succeed({ home, args: ['apply'] })
    assert.match(result, line(`kept ${folder}/DESIGN.md: .*`))
    assert.ok(lstatSync(link).isSymbolicLink())
    assert.equal(existsSync(missing), false)
    assert.equal(existsSync(join(home, folder, 'tokens.css')), false)
    assertMigrated(home)
  })
}

// A design-system clone or an empty folder at that path is the user's when the manifest never tracked it.
test('apply leaves a ~/design-system folder it never installed alone, even an empty one', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'host-config-migration-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const home = join(root, 'home')
  mkdirSync(join(home, 'design-system/language'), { recursive: true })

  const result = succeed({ home, args: ['apply'] })
  assert.ok(existsSync(join(home, 'design-system/language')))
  assert.doesNotMatch(result, /design-system/)
})
