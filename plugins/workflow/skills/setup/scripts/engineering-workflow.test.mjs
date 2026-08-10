import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./engineering-workflow.mjs', import.meta.url))

const git = (repoRoot, ...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim()

const createRepo = ({ parent, name = 'repo', remote = 'git@github.com:example/repository.git' }) => {
  const repoRoot = join(parent, name)
  execFileSync('git', ['init', repoRoot], { stdio: 'ignore' })
  git(repoRoot, 'config', 'user.name', 'Engineering Workflow Test')
  git(repoRoot, 'config', 'user.email', 'workflow@example.test')
  writeFileSync(join(repoRoot, 'README.md'), '# Test\n')
  git(repoRoot, 'add', 'README.md')
  git(repoRoot, 'commit', '-m', 'test: initialize repository')
  git(repoRoot, 'branch', '-m', 'feat/example')
  if (remote) git(repoRoot, 'remote', 'add', 'origin', remote)
  return repoRoot
}

const runRaw = ({ command, args = [] }) => (
  spawnSync(process.execPath, [script, command, ...args], { encoding: 'utf8' })
)

const run = ({ command, args = [], expectStatus = 0 }) => {
  const result = runRaw({ command, args })
  assert.equal(result.status, expectStatus, result.stderr)
  return JSON.parse(result.stdout)
}

test('paths resolves external project, ledger, and worktree locations', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-paths-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = run({
    command: 'paths',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })

  assert.match(paths.repositoryId, /^github\.com-example-repository-[0-9a-f]{8}$/)
  assert.equal(paths.branch, 'feat/example')
  assert.match(paths.branchId, /^feat-example-[0-9a-f]{8}$/)
  assert.equal(paths.ledgerFile, join(paths.workflowRoot, paths.repositoryId, 'branches', paths.branchId, 'TASKS.md'))
  assert.equal(paths.worktreeRoot, join(paths.workflowRoot, paths.repositoryId, 'worktrees', paths.branchId))
  assert.equal(existsSync(workflowRoot), false)
})

test('paths disambiguates repository and branch slug collisions', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-collisions-'))
  const workflowRoot = join(root, 'workflow')
  const firstRepoRoot = createRepo({
    parent: root,
    name: 'first',
    remote: 'git@github.com:example/a-b/c.git',
  })
  const secondRepoRoot = createRepo({
    parent: root,
    name: 'second',
    remote: 'git@github.com:example/a/b-c.git',
  })
  git(firstRepoRoot, 'branch', '-m', 'feat/a-b')
  git(secondRepoRoot, 'branch', '-m', 'feat/a/b')

  const first = run({
    command: 'paths',
    args: ['--repo-root', firstRepoRoot, '--workflow-root', workflowRoot],
  })
  const second = run({
    command: 'paths',
    args: ['--repo-root', secondRepoRoot, '--workflow-root', workflowRoot],
  })

  assert.notEqual(first.repositoryId, second.repositoryId)
  assert.notEqual(first.branchId, second.branchId)
  assert.notEqual(first.ledgerFile, second.ledgerFile)
})

test('init creates external directories and preserves an existing configuration', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-init-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const args = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--ticket-backend', 'jira']

  const paths = run({ command: 'init', args })
  const config = JSON.parse(readFileSync(paths.configFile, 'utf8'))
  assert.equal(config.ticketBackend, 'jira')
  assert.equal(config.repository.identity, 'remote:github.com/example/repository')
  assert.ok(existsSync(paths.specsRoot))
  assert.ok(existsSync(paths.ticketsRoot))
  assert.ok(existsSync(paths.branchesRoot))
  assert.ok(existsSync(paths.worktreesRoot))

  run({ command: 'init', args: [...args.slice(0, -1), 'local'] })
  assert.equal(JSON.parse(readFileSync(paths.configFile, 'utf8')).ticketBackend, 'jira')
})

test('init rejects a workflow root inside the repository', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-repo-root-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(repoRoot, 'artifacts')
  const result = runRaw({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /must be outside the repository/)
  assert.equal(existsSync(workflowRoot), false)
})

test('init validates project ownership before creating artifact directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-ownership-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = run({
    command: 'paths',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })
  mkdirSync(paths.projectRoot, { recursive: true })
  writeFileSync(paths.configFile, '{"repository":{"identity":"remote:example.test/other/repo"}}\n')

  const result = runRaw({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /belongs to remote:example\.test\/other\/repo/)
  assert.equal(existsSync(paths.specsRoot), false)
  assert.equal(existsSync(paths.ticketsRoot), false)
  assert.equal(existsSync(paths.branchesRoot), false)
  assert.equal(existsSync(paths.worktreesRoot), false)
})

test('legacy migration is dry-run by default and verifies copied ledgers', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-migrate-'))
  const repoRoot = createRepo({ parent: root })
  const otherRepoRoot = createRepo({
    parent: root,
    name: 'other-repo',
    remote: 'git@github.com:example/other-repository.git',
  })
  const sourceRoot = join(root, 'legacy')
  const workflowRoot = join(root, 'workflow')
  const source = join(sourceRoot, 'legacy-name', 'feat-example', 'TASKS.md')
  const otherSource = join(sourceRoot, 'other-name', 'feat-example', 'TASKS.md')
  mkdirSync(join(sourceRoot, 'legacy-name', 'feat-example'), { recursive: true })
  mkdirSync(join(sourceRoot, 'other-name', 'feat-example'), { recursive: true })
  writeFileSync(source, `# Tasks\n\n- Git root: \`${repoRoot}\`\n- Branch: \`feat/example\`\n`)
  writeFileSync(otherSource, `# Other\n\nGit root: ${otherRepoRoot}\nBranch: feat/example\n`)
  const args = [
    '--source-root', sourceRoot,
    '--workflow-root', workflowRoot,
    '--repo-root', repoRoot,
    '--branch', 'feat/example',
  ]

  const dryRun = run({ command: 'migrate-ledgers', args })
  assert.equal(dryRun.mode, 'dry-run')
  assert.equal(dryRun.copied.length, 1)
  assert.match(
    dryRun.copied[0].target,
    /^github\.com-example-repository-[0-9a-f]{8}\/branches\/feat-example-[0-9a-f]{8}\/TASKS\.md$/,
  )
  assert.equal(existsSync(join(workflowRoot, dryRun.copied[0].target)), false)

  const applied = run({ command: 'migrate-ledgers', args: [...args, '--apply'] })
  assert.equal(applied.copied.length, 1)
  const target = join(workflowRoot, applied.copied[0].target)
  assert.ok(readFileSync(target).equals(readFileSync(source)))

  const repeated = run({ command: 'migrate-ledgers', args: [...args, '--apply'] })
  assert.equal(repeated.matching.length, 1)
  assert.equal(repeated.copied.length, 0)

  writeFileSync(target, '# Different\n')
  const conflict = run({ command: 'migrate-ledgers', args: [...args, '--apply'], expectStatus: 2 })
  assert.equal(conflict.conflicts.length, 1)
  assert.equal(conflict.copied.length, 0)
  assert.equal(existsSync(join(workflowRoot, 'github.com-example-other-repository')), false)
})

test('legacy migration dry-run reports valid candidates alongside conflicts', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-mixed-migrate-'))
  const repoRoot = createRepo({ parent: root })
  const sourceRoot = join(root, 'legacy')
  const workflowRoot = join(root, 'workflow')
  const candidateSource = join(sourceRoot, 'candidate', 'feat-example', 'TASKS.md')
  const staleSource = join(sourceRoot, 'stale', 'feat-stale', 'TASKS.md')
  mkdirSync(join(sourceRoot, 'candidate', 'feat-example'), { recursive: true })
  mkdirSync(join(sourceRoot, 'stale', 'feat-stale'), { recursive: true })
  writeFileSync(candidateSource, `# Candidate\n\nGit root: ${repoRoot}\nBranch: feat/example\n`)
  writeFileSync(staleSource, `# Stale\n\nGit root: ${join(root, 'missing')}\nBranch: feat/stale\n`)
  const args = ['--source-root', sourceRoot, '--workflow-root', workflowRoot]

  const dryRun = run({ command: 'migrate-ledgers', args, expectStatus: 2 })
  assert.equal(dryRun.copied.length, 1)
  assert.equal(dryRun.conflicts.length, 1)
  assert.equal(existsSync(join(workflowRoot, dryRun.copied[0].target)), false)

  const applied = run({
    command: 'migrate-ledgers',
    args: [...args, '--repo-root', repoRoot, '--branch', 'feat/example', '--apply'],
    expectStatus: 2,
  })
  assert.equal(applied.copied.length, 0)
  assert.equal(applied.conflicts.length, 1)
  assert.equal(existsSync(join(workflowRoot, dryRun.copied[0].target)), false)
})

test('legacy migration rejects an unscoped apply', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-unscoped-migrate-'))
  const repoRoot = createRepo({ parent: root })
  const sourceRoot = join(root, 'legacy')
  const workflowRoot = join(root, 'workflow')
  const source = join(sourceRoot, 'candidate', 'feat-example', 'TASKS.md')
  mkdirSync(join(sourceRoot, 'candidate', 'feat-example'), { recursive: true })
  writeFileSync(source, `# Candidate\n\nGit root: ${repoRoot}\nBranch: feat/example\n`)

  const result = runRaw({
    command: 'migrate-ledgers',
    args: ['--source-root', sourceRoot, '--workflow-root', workflowRoot, '--apply'],
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /--apply requires --repo-root and --branch/)
  assert.equal(existsSync(workflowRoot), false)
})

test('legacy migration rejects duplicate target ledgers before apply', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-duplicate-migrate-'))
  const repoRoot = createRepo({ parent: root })
  const sourceRoot = join(root, 'legacy')
  const workflowRoot = join(root, 'workflow')
  const firstSource = join(sourceRoot, 'first', 'feat-example', 'TASKS.md')
  const secondSource = join(sourceRoot, 'second', 'feat-example', 'TASKS.md')
  mkdirSync(join(sourceRoot, 'first', 'feat-example'), { recursive: true })
  mkdirSync(join(sourceRoot, 'second', 'feat-example'), { recursive: true })
  writeFileSync(firstSource, `# First\n\nGit root: ${repoRoot}\nBranch: feat/example\n`)
  writeFileSync(secondSource, `# Second\n\nGit root: ${repoRoot}\nBranch: feat/example\n`)
  const args = [
    '--source-root', sourceRoot,
    '--workflow-root', workflowRoot,
    '--repo-root', repoRoot,
    '--branch', 'feat/example',
  ]

  const dryRun = run({ command: 'migrate-ledgers', args, expectStatus: 2 })
  assert.equal(dryRun.copied.length, 0)
  assert.equal(dryRun.conflicts.length, 1)
  assert.match(dryRun.conflicts[0].reason, /same target/)

  const applied = run({ command: 'migrate-ledgers', args: [...args, '--apply'], expectStatus: 2 })
  assert.equal(applied.copied.length, 0)
  assert.equal(applied.conflicts.length, 1)
  assert.equal(existsSync(join(workflowRoot, dryRun.conflicts[0].target)), false)
})
