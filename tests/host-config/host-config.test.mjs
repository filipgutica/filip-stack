import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { copyHostConfig, snapshot } from './host-config-fixture.mjs'

const sourceRoot = fileURLToPath(new URL('../../host-config/', import.meta.url))
// Tests run a copy of the script in a fixture repository.
const fixtureRoot = mkdtempSync(join(tmpdir(), 'host-config-fixture-'))
copyHostConfig({ repo: join(fixtureRoot, 'repo') })
// Field Guide needs its repository root to be a git checkout.
assert.equal(spawnSync('git', ['init', '-q', join(fixtureRoot, 'repo')]).status, 0)
const script = join(fixtureRoot, 'repo/scripts/host-config.mjs')
const blockStart = '<!-- filip-stack:host-config:begin'
const blockEnd = '<!-- filip-stack:host-config:end -->\n'

const run = ({ home, command, args = [], expectFailure = false, scriptPath = script, xdgConfigHome }) => {
  const env = { ...process.env }
  delete env.XDG_CONFIG_HOME
  if (xdgConfigHome !== undefined) env.XDG_CONFIG_HOME = xdgConfigHome
  const result = spawnSync(process.execPath, [scriptPath, command, '--home', home, ...args], { encoding: 'utf8', env })
  assert.equal(result.status !== 0, expectFailure, result.stderr || result.stdout)
  return result
}

const read = (path) => readFileSync(path, 'utf8')
const states = (home) => run({ home, command: 'status' }).stdout.split('\n').slice(2).filter(Boolean)

test('apply renders both hosts into an empty home and is idempotent', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-'))
  const result = run({ home, command: 'apply' })
  assert.ok(result.stdout.includes(`No shared Field Guide preferences were found; put them at ${join(home, '.config/filip-stack/field-guide.json')}\n`))
  assert.equal(existsSync(join(home, '.field-guide')), false)

  // Claude imports the shared guidance; Codex has no imports, so its block holds the same text.
  const shared = read(join(home, '.agents/AGENTS.md'))
  assert.match(shared, /## Host notes/)
  assert.doesNotMatch(shared, /\{\{/)
  assert.equal(read(join(home, '.claude/CLAUDE.md')), `${blockStart} (managed by filip-stack; edit host-config/ there) -->\n@${join(home, '.agents/AGENTS.md')}\n${blockEnd}`)
  assert.equal(read(join(home, '.codex/AGENTS.md')), `${blockStart} (managed by filip-stack; edit host-config/ there) -->\n${shared}${blockEnd}`)
  assert.match(read(join(home, '.claude/agents/critic.md')), new RegExp(`${home}/\\.agents/roles\\.md`))
  assert.ok(existsSync(join(home, '.codex/agents/critic.toml')))
  assert.ok(existsSync(join(home, '.agents/roles.md')))
  // The design system ships as a plugin, so apply installs no design folder and records no version.
  for (const folder of ['design-system', 'design-language']) assert.equal(existsSync(join(home, folder)), false)
  const manifest = JSON.parse(read(join(home, '.agents/.filip-stack-host-config.json')))
  assert.deepEqual(Object.keys(manifest), ['commit', 'files'])

  const before = read(join(home, '.agents/.filip-stack-host-config.json'))
  assert.ok(states(home).every((line) => line.startsWith('current')))
  const again = run({ home, command: 'apply' })
  assert.doesNotMatch(again.stdout, /^(wrote|removed) /m)
  assert.equal(read(join(home, '.agents/.filip-stack-host-config.json')), before)
})

// sync.mjs reads the target states after exactly two header lines.
test('status prints a two-line header, then one state line per target', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-status-'))
  run({ home, command: 'apply' })
  const [applied, repository, ...targets] = run({ home, command: 'status' }).stdout.trimEnd().split('\n')
  assert.match(applied, /^applied: \S+$/)
  assert.match(repository, /^repository: \S+$/)
  assert.ok(targets.length > 0)
  for (const line of targets) assert.match(line, /^current +\S+$/)
})

const portableGuidance = (learning) => ({
  schemaVersion: 1,
  active: [{ subjectKey: 'testing', linkedSubjects: [], learning, confidence: 'high', examples: [] }],
  retired: [],
})

for (const mode of ['unset', 'empty', 'custom']) {
  test(`apply imports shared preferences with XDG_CONFIG_HOME ${mode}`, () => {
    const home = mkdtempSync(join(tmpdir(), 'host-config-import-'))
    const xdgConfigHome = mode === 'custom' ? mkdtempSync(join(tmpdir(), 'host-config-xdg-')) : mode === 'empty' ? '' : undefined
    const path = join(xdgConfigHome || join(home, '.config'), 'filip-stack/field-guide.json')
    const preferences = portableGuidance('Name tests after behavior.')
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(preferences))

    const result = run({ home, command: 'apply', xdgConfigHome })
    assert.match(result.stdout, /field-guide: created 1, promoted 0, retired 0, restored 0/)
    const memory = JSON.parse(read(join(home, '.field-guide/memory.json')))
    assert.deepEqual(memory.guidance.map(({ learning }) => learning), ['Name tests after behavior.'])
    assert.equal(read(path), JSON.stringify(preferences))
  })

  test(`field-guide-sync writes the dotfile and leaves the repository unchanged with XDG_CONFIG_HOME ${mode}`, () => {
    const repo = mkdtempSync(join(tmpdir(), 'host-config-sync-repo-'))
    const initialized = spawnSync('git', ['init', '-q', repo], { encoding: 'utf8' })
    assert.equal(initialized.status, 0, initialized.stderr)
    copyHostConfig({ repo })
    // A leftover export must never be imported or overwritten.
    mkdirSync(join(repo, 'host-config/field-guide'), { recursive: true })
    writeFileSync(join(repo, 'host-config/field-guide/shared.json'), JSON.stringify(portableGuidance('Legacy guidance.')))
    const before = snapshot(repo)
    const home = mkdtempSync(join(tmpdir(), 'host-config-sync-home-'))
    const xdgConfigHome = mode === 'custom' ? mkdtempSync(join(tmpdir(), 'host-config-sync-xdg-')) : mode === 'empty' ? '' : undefined
    const path = join(xdgConfigHome || join(home, '.config'), 'filip-stack/field-guide.json')
    const options = { home, scriptPath: join(repo, 'scripts/host-config.mjs'), xdgConfigHome }

    // Seed local guidance, then remove the dotfile to exercise first-time export.
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(portableGuidance('Name tests after behavior.')))
    run({ ...options, command: 'apply' })
    rmSync(dirname(path), { recursive: true })
    const result = run({ ...options, command: 'field-guide-sync' })
    assert.ok(result.stdout.includes(`exported shared guidance to ${path}`))
    assert.match(result.stdout, /add both to your dotfile manager/)
    assert.equal(JSON.parse(read(join(dirname(path), 'field-guide-annotations.json'))).schemaVersion, 1)
    assert.deepEqual(JSON.parse(read(path)), { ...portableGuidance('Name tests after behavior.'), schemaVersion: 2 })

    // Merge another machine's guidance before exporting the combined preferences.
    writeFileSync(path, JSON.stringify(portableGuidance('Keep tests focused.')))
    run({ ...options, command: 'field-guide-sync' })
    assert.deepEqual(JSON.parse(read(path)).active.map(({ learning }) => learning), [
      'Keep tests focused.', 'Name tests after behavior.',
    ])
    assert.deepEqual(snapshot(repo), before)
    if (mode === 'custom') assert.equal(existsSync(join(home, '.config/filip-stack/field-guide.json')), false)
  })
}

test('field-guide-sync refuses an unsupported dotfile version before it exports', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-sync-version-'))
  const path = join(home, '.config/filip-stack/field-guide.json')
  const future = JSON.stringify({ ...portableGuidance('Name tests after behavior.'), schemaVersion: 99 })
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, future)

  const result = run({ home, command: 'field-guide-sync', expectFailure: true })
  assert.match(result.stderr, /unsupported shared guidance export version: 99/)
  assert.doesNotMatch(result.stdout, /exported shared guidance/)
  assert.equal(read(path), future)
})

test('field-guide-sync carries confirmations and their revocation in a second portable file', async () => {
  const fieldGuideScript = join(fixtureRoot, 'repo/plugins/field-guide/skills/field-guide/scripts/field-guide.mjs')
  const { confirmFromPrompt } = await import(fieldGuideScript)
  const xdgConfigHome = mkdtempSync(join(tmpdir(), 'host-config-annotations-xdg-'))
  const path = join(xdgConfigHome, 'filip-stack/field-guide.json')
  const annotationsPath = join(xdgConfigHome, 'filip-stack/field-guide-annotations.json')
  const [first, second] = ['first', 'second'].map((name) => mkdtempSync(join(tmpdir(), `host-config-annotations-${name}-`)))
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(portableGuidance('Remove merged worktrees without asking.')))
  run({ home: first, command: 'apply', xdgConfigHome })
  const [{ id, fingerprint }] = JSON.parse(read(join(first, '.field-guide/memory.json'))).guidance
  const outstanding = (home) => {
    const record = JSON.parse(read(join(home, '.field-guide/annotations.json'))).records[fingerprint]
    return record.confirmations.filter((entry) => !record.acknowledged.includes(entry.id) && record.revocations.every((revocation) => entry.seen.includes(revocation)))
  }

  confirmFromPrompt({ guideRoot: join(first, '.field-guide'), prompt: `confirm fg:${id}`, mainThread: true, host: 'codex' })
  run({ home: first, command: 'field-guide-sync', xdgConfigHome })
  assert.equal(JSON.parse(read(annotationsPath)).records[fingerprint].confirmations.length, 1)
  assert.doesNotMatch(read(annotationsPath), /worktrees/)
  run({ home: second, command: 'apply', xdgConfigHome })
  assert.equal(outstanding(second).length, 1)

  const unconfirmed = spawnSync(process.execPath, [fieldGuideScript, 'unconfirm', '--id', id, '--repo-root', join(fixtureRoot, 'repo'), '--guide-root', join(second, '.field-guide')], { encoding: 'utf8' })
  assert.equal(unconfirmed.status, 0, unconfirmed.stderr)
  run({ home: second, command: 'field-guide-sync', xdgConfigHome })
  run({ home: first, command: 'field-guide-sync', xdgConfigHome })
  assert.deepEqual(outstanding(first), [])

  const exported = read(path)
  writeFileSync(annotationsPath, JSON.stringify({ schemaVersion: 1, records: { [fingerprint]: { confirmations: [{ id: 'forged' }], triggers: [], acknowledged: [] } } }))
  const refused = run({ home: first, command: 'field-guide-sync', xdgConfigHome, expectFailure: true })
  assert.match(refused.stderr, /annotation/)
  assert.equal(read(path), exported)
})

test('apply keeps text outside the guidance block and refuses local edits inside it', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-edits-'))
  run({ home, command: 'apply' })
  const path = join(home, '.codex/AGENTS.md')
  writeFileSync(path, `Local preface.\n\n${read(path)}\nLocal note.\n`)
  run({ home, command: 'apply' })
  assert.match(read(path), /^Local preface\.\n\n<!-- filip-stack/)
  assert.match(read(path), /Local note\.\n$/)

  writeFileSync(path, read(path).replace('## Evidence', '## Local evidence'))
  const refused = run({ home, command: 'apply', expectFailure: true })
  assert.match(refused.stdout, /^-## Local evidence$/m)
  assert.match(read(path), /## Local evidence/)

  // A private file keeps its permissions in the backup, whatever the umask.
  chmodSync(path, 0o600)
  run({ home, command: 'apply', args: ['--force'] })
  assert.match(read(`${path}.bak`), /## Local evidence/)
  assert.equal(statSync(`${path}.bak`).mode & 0o777, 0o600)
  assert.doesNotMatch(read(path), /## Local evidence/)
  assert.match(read(path), /^Local preface\./)
})

test('apply --force never writes a backup through a symlink at the backup path', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-backup-link-'))
  run({ home, command: 'apply' })
  const path = join(home, '.codex/AGENTS.md')
  writeFileSync(path, read(path).replace('## Evidence', '## Local evidence'))
  const outside = join(home, 'outside.md')
  symlinkSync(outside, `${path}.bak`)
  run({ home, command: 'apply', args: ['--force'] })
  assert.equal(existsSync(outside), false)
  assert.equal(lstatSync(`${path}.bak`).isSymbolicLink(), true)
  assert.match(read(`${path}.bak.1`), /## Local evidence/)
})

// Only retired design-system files are left alone behind a symlink; a guidance file linked from a dotfile manager is written through the link.
test('apply writes a symlinked guidance file through its link', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-linked-guidance-'))
  const dotfile = join(mkdtempSync(join(tmpdir(), 'host-config-dotfiles-')), 'CLAUDE.md')
  writeFileSync(dotfile, 'Local note.\n')
  mkdirSync(join(home, '.claude'))
  symlinkSync(dotfile, join(home, '.claude/CLAUDE.md'))
  run({ home, command: 'apply', args: ['--force'] })
  assert.ok(lstatSync(join(home, '.claude/CLAUDE.md')).isSymbolicLink())
  assert.match(read(dotfile), /^@.*\/\.agents\/AGENTS\.md$/m)
})

test('apply treats only whole delimiter lines as block markers', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-delimiters-'))
  run({ home, command: 'apply' })
  const path = join(home, '.claude/CLAUDE.md')
  const block = read(path)
  const suffix = 'Quoted: <!-- filip-stack:host-config:end --> stays.\nNo trailing newline'
  writeFileSync(path, `${block}${suffix}`)
  writeFileSync(join(home, '.codex/AGENTS.md'), read(join(home, '.codex/AGENTS.md')).replace('## Evidence', '## Local evidence'))
  run({ home, command: 'apply', args: ['--force'] })
  assert.equal(read(path), `${block}${suffix}`)

  writeFileSync(path, `${block}${block}`)
  assert.match(run({ home, command: 'apply', expectFailure: true }).stderr, /exactly one filip-stack block/)
})

test('an interrupted apply keeps the files it wrote in the manifest', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-interrupted-'))
  writeFileSync(join(home, '.codex'), 'not a directory\n')
  run({ home, command: 'apply', expectFailure: true })
  const manifest = JSON.parse(read(join(home, '.agents/.filip-stack-host-config.json')))
  assert.ok(manifest.files['.claude/agents/critic.md'])
  assert.equal(manifest.commit, null)
})

test('apply refuses to replace a guidance file without a block unless forced', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-unmarked-'))
  mkdirSync(join(home, '.claude'), { recursive: true })
  writeFileSync(join(home, '.claude/CLAUDE.md'), '# Existing guidance\n')
  run({ home, command: 'apply', expectFailure: true })

  run({ home, command: 'apply', args: ['--force'] })
  assert.equal(read(join(home, '.claude/CLAUDE.md.bak')), '# Existing guidance\n')
  assert.ok(read(join(home, '.claude/CLAUDE.md')).startsWith(blockStart))
})

// Installs from before the shared file held the full guidance in the Claude block.
test('apply turns an unedited full Claude block into an import and keeps local text', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-upgrade-'))
  run({ home, command: 'apply' })
  const manifestPath = join(home, '.agents/.filip-stack-host-config.json')
  const oldBody = '# Global Engineering Principles\n\nOld full guidance.\n'
  writeFileSync(join(home, '.claude/CLAUDE.md'), `Local preface.\n\n${blockStart} (managed by filip-stack; edit host-config/ there) -->\n${oldBody}${blockEnd}Local note.\n`)
  rmSync(join(home, '.agents/AGENTS.md'))
  const manifest = JSON.parse(read(manifestPath))
  manifest.files['.claude/CLAUDE.md'] = createHash('sha256').update(oldBody).digest('hex')
  delete manifest.files['.agents/AGENTS.md']
  writeFileSync(manifestPath, JSON.stringify(manifest))

  run({ home, command: 'apply' })
  const claude = read(join(home, '.claude/CLAUDE.md'))
  assert.match(claude, /^Local preface\.\n\n<!-- filip-stack/)
  assert.match(claude, new RegExp(`^@${join(home, '.agents/AGENTS.md')}$`, 'm'))
  assert.match(claude, /Local note\.\n$/)
  assert.doesNotMatch(claude, /Old full guidance/)
  assert.match(read(join(home, '.agents/AGENTS.md')), /## Skills and delegation/)
  assert.ok(states(home).every((line) => line.startsWith('current')))
})

test('apply removes files it applied earlier once the repository drops them', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-removal-'))
  run({ home, command: 'apply' })
  const manifestPath = join(home, '.agents/.filip-stack-host-config.json')
  const retired = '.claude/agents/retired.md'
  writeFileSync(join(home, retired), 'retired\n')
  const manifest = JSON.parse(read(manifestPath))
  manifest.files[retired] = createHash('sha256').update('retired\n').digest('hex')
  writeFileSync(manifestPath, JSON.stringify(manifest))

  writeFileSync(join(home, retired), 'edited\n')
  run({ home, command: 'apply', expectFailure: true })
  writeFileSync(join(home, retired), 'retired\n')
  run({ home, command: 'apply' })
  assert.equal(existsSync(join(home, retired)), false)
  assert.equal(JSON.parse(read(manifestPath)).files[retired], undefined)
})

test('update refuses to pull a checkout that is not on main', () => {
  const repo = mkdtempSync(join(tmpdir(), 'host-config-branch-'))
  spawnSync('git', ['init', '-q', '-b', 'feature', repo])
  mkdirSync(join(repo, 'scripts'))
  copyFileSync(script, join(repo, 'scripts/host-config.mjs'))
  const home = mkdtempSync(join(tmpdir(), 'host-config-branch-home-'))
  const result = spawnSync(process.execPath, [join(repo, 'scripts/host-config.mjs'), 'update', '--home', home], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /update runs only on main, but .* is on feature/)
  assert.deepEqual(readdirSync(home), [])
})

test('update syncs the Field Guide dotfile only when it already exists', () => {
  const source = mkdtempSync(join(tmpdir(), 'host-config-update-source-'))
  const git = (args, cwd = source) => {
    const result = spawnSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args], { cwd, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  git(['init', '-q', '-b', 'main'])
  copyHostConfig({ repo: source })
  git(['add', '.'])
  git(['commit', '-q', '-m', 'init'])
  const checkout = join(mkdtempSync(join(tmpdir(), 'host-config-update-')), 'checkout')
  git(['clone', '-q', source, checkout])
  const options = { scriptPath: join(checkout, 'scripts/host-config.mjs') }

  // No dotfile means the machine has not opted in, so update leaves none behind.
  const fresh = mkdtempSync(join(tmpdir(), 'host-config-update-fresh-'))
  run({ ...options, home: fresh, command: 'update' })
  assert.equal(existsSync(join(fresh, '.config/filip-stack/field-guide.json')), false)

  // Guidance saved on this machine reaches the dotfile alongside another machine's.
  const home = mkdtempSync(join(tmpdir(), 'host-config-update-home-'))
  const path = join(home, '.config/filip-stack/field-guide.json')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(portableGuidance('Name tests after behavior.')))
  run({ ...options, home, command: 'apply' })
  writeFileSync(path, JSON.stringify(portableGuidance('Keep tests focused.')))
  run({ ...options, home, command: 'update' })
  assert.deepEqual(JSON.parse(read(path)).active.map(({ learning }) => learning), [
    'Keep tests focused.', 'Name tests after behavior.',
  ])
})

// A fixture repository whose models.json the test edits.
const rosterFixture = (edit) => {
  const root = mkdtempSync(join(tmpdir(), 'host-config-roster-'))
  copyHostConfig({ repo: join(root, 'repo') })
  assert.equal(spawnSync('git', ['init', '-q', join(root, 'repo')]).status, 0)
  const rosterPath = join(root, 'repo/host-config/models.json')
  const roster = JSON.parse(read(rosterPath))
  edit(roster)
  writeFileSync(rosterPath, JSON.stringify(roster))
  return join(root, 'repo/scripts/host-config.mjs')
}

test('one models.json edit renames a model in the guidance and every agent profile', () => {
  const scriptPath = rosterFixture((roster) => { roster.claude.fast = { id: 'claude-haiku-9-9', label: 'Haiku 9.9' } })
  const home = mkdtempSync(join(tmpdir(), 'host-config-roster-home-'))
  run({ home, command: 'apply', scriptPath })
  assert.match(read(join(home, '.claude/agents/explorer.md')), /^model: claude-haiku-9-9$/m)
  assert.match(read(join(home, '.claude/agents/explorer.md')), /Runs on Haiku 9\.9 /)
  assert.match(read(join(home, '.agents/AGENTS.md')), /`claude-haiku-9-9`/)
  assert.match(read(join(home, '.codex/AGENTS.md')), /`claude-haiku-9-9`/)
  for (const entry of readdirSync(home, { recursive: true, withFileTypes: true }).filter((item) => item.isFile())) {
    const text = read(join(entry.parentPath, entry.name))
    assert.doesNotMatch(text, /\{\{model:/, entry.name)
    assert.doesNotMatch(text, /claude-haiku-5-5|Haiku 5\.5/, entry.name)
  }
})

test('apply fails on a model placeholder that models.json does not define', () => {
  const scriptPath = rosterFixture((roster) => { delete roster.codex.balanced })
  const result = run({ home: mkdtempSync(join(tmpdir(), 'host-config-roster-home-')), command: 'apply', scriptPath, expectFailure: true })
  assert.match(result.stderr, /\{\{model:codex\.balanced\.id\}\}/)
})

test('host-config sources name models only in models.json', () => {
  const roster = JSON.parse(read(join(sourceRoot, 'models.json')))
  const names = Object.values(roster).flatMap((tiers) => Object.values(tiers).flatMap(({ id, label }) => [id, label]))
  const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== 'models.json')
  for (const entry of files) {
    const text = read(join(entry.parentPath, entry.name))
    for (const name of names) {
      const pattern = new RegExp(`(?<![\\w.-])${name.replaceAll('.', '\\.')}(?![\\w.-])`)
      assert.doesNotMatch(text, pattern, `${entry.name} names ${name}; use a {{model:…}} placeholder`)
    }
  }
})

test('host-config sources contain no machine-specific home paths', () => {
  const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
  for (const entry of files) {
    assert.doesNotMatch(read(join(entry.parentPath, entry.name)), /\/Users\/|\/home\/[a-z]/, entry.name)
  }
})
