import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../scripts/host-config.mjs', import.meta.url))
const sourceRoot = fileURLToPath(new URL('../../host-config/', import.meta.url))
const blockStart = '<!-- filip-stack:host-config:begin'
const blockEnd = '<!-- filip-stack:host-config:end -->\n'

const run = ({ home, command, args = [], expectFailure = false }) => {
  const result = spawnSync(process.execPath, [script, command, '--home', home, ...args], { encoding: 'utf8' })
  assert.equal(result.status !== 0, expectFailure, result.stderr || result.stdout)
  return result
}

const read = (path) => readFileSync(path, 'utf8')
const states = (home) => run({ home, command: 'status' }).stdout.split('\n').slice(2).filter(Boolean)

test('apply renders both hosts into an empty home and is idempotent', () => {
  const home = mkdtempSync(join(tmpdir(), 'host-config-'))
  run({ home, command: 'apply' })

  const claude = read(join(home, '.claude/CLAUDE.md'))
  const codex = read(join(home, '.codex/AGENTS.md'))
  assert.ok(claude.startsWith(blockStart) && claude.endsWith(blockEnd))
  assert.match(claude, /## Claude read guard/)
  assert.doesNotMatch(claude, /\{\{/)
  assert.match(codex, /## Communication/)
  assert.doesNotMatch(codex, /## Claude read guard/)
  assert.match(read(join(home, '.claude/agents/critic.md')), new RegExp(`${home}/\\.agents/roles\\.md`))
  assert.ok(existsSync(join(home, '.codex/agents/critic.toml')))
  assert.ok(existsSync(join(home, '.agents/roles.md')))

  const before = read(join(home, '.agents/.filip-stack-host-config.json'))
  assert.ok(states(home).every((line) => line.startsWith('current')))
  run({ home, command: 'apply' })
  assert.equal(read(join(home, '.agents/.filip-stack-host-config.json')), before)
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

  run({ home, command: 'apply', args: ['--force'] })
  assert.match(read(`${path}.bak`), /## Local evidence/)
  assert.doesNotMatch(read(path), /## Local evidence/)
  assert.match(read(path), /^Local preface\./)
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

test('host-config sources contain no machine-specific home paths', () => {
  const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
  for (const entry of files) {
    assert.doesNotMatch(read(join(entry.parentPath, entry.name)), /\/Users\/|\/home\/[a-z]/, entry.name)
  }
})
