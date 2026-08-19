import { execFileSync, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./field-guide.mjs', import.meta.url))

const git = (repoRoot, ...args) => (
  execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim()
)

const createRepo = ({ parent, name, remote }) => {
  const repoRoot = join(parent, name)
  execFileSync('git', ['init', repoRoot], { stdio: 'ignore' })
  git(repoRoot, 'config', 'user.name', 'Field Guide Test')
  git(repoRoot, 'config', 'user.email', 'field-guide@example.test')
  writeFileSync(join(repoRoot, 'README.md'), '# Test\n')
  git(repoRoot, 'add', 'README.md')
  git(repoRoot, 'commit', '-m', 'test: initialize repository')
  git(repoRoot, 'remote', 'add', 'origin', remote)
  return repoRoot
}

const run = ({ command, repoRoot, guideRoot, args = [], expectFailure = false }) => {
  const result = spawnSync(
    process.execPath,
    [script, command, '--repo-root', repoRoot, '--guide-root', guideRoot, ...args],
    { encoding: 'utf8' },
  )

  if (expectFailure) {
    assert.notEqual(result.status, 0)
    return result
  }

  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('migrate previews and creates a versioned store without changing legacy reviews', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-migrate-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'git@github.com:example/migrated-repo.git',
  })
  const guideRoot = join(root, 'guide')
  const paths = run({ command: 'init', repoRoot, guideRoot })
  const commit = git(repoRoot, 'rev-parse', 'HEAD')
  const reviewFile = join(paths.reviewsRoot, 'legacy.md')
  const review = `# Legacy learning\n\n- Commit: \`${commit}\`\n`
  writeFileSync(reviewFile, review)
  appendFileSync(paths.projectIndex, '\n- [Legacy](reviews/legacy.md) — Evidence.\n')

  const preview = run({ command: 'migrate', repoRoot, guideRoot })
  assert.equal(preview.migration.action, 'create-memory-store')
  assert.equal(preview.migration.applied, false)
  assert.equal(existsSync(paths.memoryFile), false)

  const applied = run({ command: 'migrate', repoRoot, guideRoot, args: ['--apply'] })
  assert.equal(applied.migration.applied, true)
  assert.deepEqual(JSON.parse(readFileSync(paths.memoryFile, 'utf8')), {
    schemaVersion: 1,
    revision: 0,
    guidance: [],
    evidence: [],
  })
  assert.equal(readFileSync(reviewFile, 'utf8'), review)
  run({ command: 'validate', repoRoot, guideRoot })

  const memory = readFileSync(paths.memoryFile, 'utf8')
  const repeated = run({ command: 'migrate', repoRoot, guideRoot, args: ['--apply'] })
  assert.equal(repeated.migration.action, 'none')
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), memory)
})

test('validate rejects malformed memory state without replacing it', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-malformed-memory-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'git@github.com:example/malformed-memory.git',
  })
  const guideRoot = join(root, 'guide')
  const paths = run({ command: 'init', repoRoot, guideRoot })
  const malformed = '{"schemaVersion":1,"revision":0,"guidance":[],"evidence":[],"extra":true}\n'
  writeFileSync(paths.memoryFile, malformed)

  const result = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(result.stderr, /memory store has unsupported field: extra/)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), malformed)

  const nested = '{"schemaVersion":1,"revision":0,"guidance":[null],"evidence":[]}\n'
  writeFileSync(paths.memoryFile, nested)
  const nestedResult = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(nestedResult.stderr, /guidance records are not supported before schema expansion/)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), nested)
})

test('migrate refuses invalid legacy review evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-invalid-migration-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'git@github.com:example/invalid-migration.git',
  })
  const guideRoot = join(root, 'guide')
  const paths = run({ command: 'init', repoRoot, guideRoot })
  const reviewFile = join(paths.reviewsRoot, 'broken.md')
  writeFileSync(reviewFile, '# Broken\n\n- Commit: `0000000000000000000000000000000000000000`\n')
  appendFileSync(paths.projectIndex, '\n- [Broken](reviews/broken.md) — Evidence.\n')

  const result = run({
    command: 'migrate',
    repoRoot,
    guideRoot,
    args: ['--apply'],
    expectFailure: true,
  })
  assert.match(result.stderr, /unknown commit/)
  assert.equal(existsSync(paths.memoryFile), false)
})

test('init creates an indexed guide and preserves existing content', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-init-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'git@github.com:example/shared-repo.git',
  })
  const guideRoot = join(root, 'guide')

  const paths = run({ command: 'init', repoRoot, guideRoot })
  assert.equal(paths.projectKey, 'shared-repo')
  assert.ok(existsSync(paths.rootIndex))
  assert.ok(existsSync(paths.projectIndex))
  assert.ok(existsSync(paths.patternsFile))
  assert.ok(existsSync(paths.reviewsRoot))
  assert.match(readFileSync(paths.rootIndex, 'utf8'), /\]\(projects\/shared-repo\/init\.md\)/)
  const projectIndex = readFileSync(paths.projectIndex, 'utf8')
  assert.ok(projectIndex.indexOf('](patterns.md)') < projectIndex.indexOf('## Review evidence'))

  appendFileSync(paths.patternsFile, '\nCustom guidance.\n')
  run({ command: 'init', repoRoot, guideRoot })
  assert.match(readFileSync(paths.patternsFile, 'utf8'), /Custom guidance\./)

  const resolved = run({ command: 'paths', repoRoot, guideRoot })
  assert.equal(resolved.projectRoot, paths.projectRoot)
})

test('validate ignores optional Obsidian vault metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-obsidian-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'git@github.com:example/obsidian-repo.git',
  })
  const guideRoot = join(root, 'guide')
  run({ command: 'init', repoRoot, guideRoot })

  const obsidianRoot = join(guideRoot, '.obsidian')
  mkdirSync(join(obsidianRoot, 'plugins', 'audit-view'), { recursive: true })
  writeFileSync(join(obsidianRoot, 'workspace.json'), '{}\n')
  writeFileSync(join(obsidianRoot, 'plugins', 'audit-view', 'README.md'), '# Client metadata\n')

  run({ command: 'validate', repoRoot, guideRoot })
})

test('worktrees with the same origin resolve to one project guide', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-worktree-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'https://github.com/example/shared-repo.git',
  })
  const guideRoot = join(root, 'guide')
  const worktreeRoot = join(root, 'worktree')
  run({ command: 'init', repoRoot, guideRoot })
  git(repoRoot, 'worktree', 'add', '--detach', worktreeRoot)

  const primary = run({ command: 'paths', repoRoot, guideRoot })
  const worktree = run({ command: 'paths', repoRoot: worktreeRoot, guideRoot })
  assert.equal(worktree.projectRoot, primary.projectRoot)
  assert.equal(worktree.identity, primary.identity)
})

test('repositories with colliding slugs get stable distinct keys', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-collision-'))
  const guideRoot = join(root, 'guide')
  const firstRepo = createRepo({
    parent: root,
    name: 'first',
    remote: 'git@github.com:first/shared-repo.git',
  })
  const secondRepo = createRepo({
    parent: root,
    name: 'second',
    remote: 'git@github.com:second/shared-repo.git',
  })

  const first = run({ command: 'init', repoRoot: firstRepo, guideRoot })
  const second = run({ command: 'init', repoRoot: secondRepo, guideRoot })
  const secondAgain = run({ command: 'paths', repoRoot: secondRepo, guideRoot })

  assert.equal(first.projectKey, 'shared-repo')
  assert.match(second.projectKey, /^shared-repo-[0-9a-f]{8}$/)
  assert.equal(secondAgain.projectKey, second.projectKey)
})

test('origin normalization preserves case-sensitive repository paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-origin-case-'))
  const guideRoot = join(root, 'guide')
  const upperRepo = createRepo({
    parent: root,
    name: 'upper',
    remote: 'ssh://git@Git.EXAMPLE.test/Team/Service.git',
  })
  const lowerRepo = createRepo({
    parent: root,
    name: 'lower',
    remote: 'git@git.example.test:team/service.git',
  })

  const upper = run({ command: 'init', repoRoot: upperRepo, guideRoot })
  const lower = run({ command: 'init', repoRoot: lowerRepo, guideRoot })

  assert.notEqual(upper.identity, lower.identity)
  assert.notEqual(upper.projectKey, lower.projectKey)
})

test('validate checks index links and commit evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-validate-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'git@github.com:example/validated-repo.git',
  })
  const guideRoot = join(root, 'guide')
  const paths = run({ command: 'init', repoRoot, guideRoot })
  const commit = git(repoRoot, 'rev-parse', 'HEAD')
  const reviewFile = join(paths.reviewsRoot, `2026-07-27-${commit.slice(0, 12)}-test.md`)

  writeFileSync(
    reviewFile,
    `# Test learning\n\n- Commit: \`${commit}\`\n`,
  )
  appendFileSync(
    paths.projectIndex,
    `- [Test learning](reviews/${reviewFile.split('/').at(-1)}) — Test evidence.\n`,
  )
  run({ command: 'validate', repoRoot, guideRoot })

  writeFileSync(reviewFile, '# Broken learning\n\n- Commit: `0000000000000000000000000000000000000000`\n')
  const invalid = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(invalid.stderr, /unknown commit/)

  writeFileSync(reviewFile, `# Test learning\n\n- Commit: \`${commit}\`\n`)
  writeFileSync(paths.rootIndex, '# Field Guide\n\n## Shared guidance\n\n## Projects\n')
  const unlinked = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(unlinked.stderr, /is not linked from/)
})

test('validate checks guidance links and shared promotion evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-guidance-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'git@github.com:example/guidance-repo.git',
  })
  const guideRoot = join(root, 'guide')
  const paths = run({ command: 'init', repoRoot, guideRoot })
  const sharedFile = join(paths.sharedRoot, 'scheduling.md')

  appendFileSync(paths.patternsFile, '\n- [Missing evidence](reviews/missing.md)\n')
  const brokenLink = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(brokenLink.stderr, /links to missing file/)

  writeFileSync(paths.patternsFile, '# guidance-repo Patterns\n')
  writeFileSync(sharedFile, '# Scheduling\n')
  appendFileSync(paths.rootIndex, '\n- [Scheduling](shared/scheduling.md) — Shared preference.\n')
  const unsupported = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(unsupported.stderr, /is missing valid promotion evidence/)

  writeFileSync(
    sharedFile,
    '# Scheduling\n\n'
      + '- Promotion: `explicit-general-preference`\n'
      + '- Preference source: User stated this as a general preference.\n',
  )
  run({ command: 'validate', repoRoot, guideRoot })

  const secondRepo = createRepo({
    parent: root,
    name: 'second-repo',
    remote: 'git@github.com:example/second-guidance-repo.git',
  })
  const secondPaths = run({ command: 'init', repoRoot: secondRepo, guideRoot })
  const firstCommit = git(repoRoot, 'rev-parse', 'HEAD')
  const secondCommit = git(secondRepo, 'rev-parse', 'HEAD')
  const firstReview = join(paths.reviewsRoot, 'first.md')
  const secondReview = join(secondPaths.reviewsRoot, 'second.md')
  writeFileSync(firstReview, `# First evidence\n\n- Commit: \`${firstCommit}\`\n`)
  writeFileSync(
    secondReview,
    '# Fabricated evidence\n\n- Commit: `0000000000000000000000000000000000000000`\n',
  )
  appendFileSync(paths.projectIndex, '\n- [First evidence](reviews/first.md) — Evidence.\n')

  writeFileSync(
    sharedFile,
    '# Scheduling\n\n'
      + '- Promotion: `multi-project-evidence`\n\n'
      + '## Evidence\n\n'
      + `- [First](../projects/${paths.projectKey}/reviews/first.md)\n`,
  )
  const oneProject = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(oneProject.stderr, /is missing valid promotion evidence/)

  appendFileSync(
    sharedFile,
    `- [Second](../projects/${secondPaths.projectKey}/reviews/second.md)\n`,
  )
  const fabricated = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(fabricated.stderr, /is missing valid promotion evidence/)

  appendFileSync(secondPaths.projectIndex, '\n- [Second evidence](reviews/second.md) — Evidence.\n')
  writeFileSync(secondReview, `# Second evidence\n\n- Commit: \`${secondCommit}\`\n`)
  run({ command: 'validate', repoRoot, guideRoot })
})
