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

  assert.equal(paths.repositoryId, 'github.com-example-repository')
  assert.equal(paths.branch, 'feat/example')
  assert.equal(paths.ledgerFile, join(paths.workflowRoot, paths.repositoryId, 'branches', 'feat-example', 'TASKS.md'))
  assert.equal(paths.worktreeRoot, join(paths.workflowRoot, paths.repositoryId, 'worktrees', 'feat-example'))
  assert.equal(existsSync(workflowRoot), false)
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
  assert.equal(dryRun.copied[0].target, 'github.com-example-repository/branches/feat-example/TASKS.md')
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
