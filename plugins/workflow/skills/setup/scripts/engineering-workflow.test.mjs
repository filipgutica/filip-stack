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

test('init creates external directories, reuses matching configuration, and rejects explicit conflicts', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-init-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const args = [
    '--repo-root', repoRoot,
    '--workflow-root', workflowRoot,
    '--ticket-backend', 'jira',
    '--project', 'MA',
    '--base-url', 'https://example.atlassian.net',
  ]

  const paths = run({ command: 'init', args })
  const config = JSON.parse(readFileSync(paths.configFile, 'utf8'))
  assert.equal(config.ticketBackend, 'jira')
  assert.deepEqual(config.externalTicketSystem, {
    system: 'jira',
    project: 'MA',
    baseUrl: 'https://example.atlassian.net',
  })
  assert.equal(config.repository.identity, 'remote:github.com/example/repository')
  assert.ok(existsSync(paths.specsRoot))
  assert.ok(existsSync(paths.ticketsRoot))
  assert.ok(existsSync(paths.branchesRoot))
  assert.ok(existsSync(paths.worktreesRoot))
  const configured = readFileSync(paths.configFile, 'utf8')

  run({ command: 'init', args })
  assert.equal(readFileSync(paths.configFile, 'utf8'), configured)

  run({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })
  assert.equal(readFileSync(paths.configFile, 'utf8'), configured)

  run({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--project', 'MA'],
  })
  assert.equal(readFileSync(paths.configFile, 'utf8'), configured)

  run({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--base-url', 'https://example.atlassian.net/'],
  })
  assert.equal(readFileSync(paths.configFile, 'utf8'), configured)

  const backendConflict = runRaw({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--ticket-backend', 'local'],
  })
  assert.equal(backendConflict.status, 1)
  assert.match(backendConflict.stderr, /ticket backend conflicts with the existing jira configuration/)
  assert.equal(readFileSync(paths.configFile, 'utf8'), configured)

  const projectConflict = runRaw({
    command: 'init',
    args: args.map((value, index) => args[index - 1] === '--project' ? 'OTHER' : value),
  })
  assert.equal(projectConflict.status, 1)
  assert.match(projectConflict.stderr, /external ticket system conflicts with the existing project configuration/)
  assert.equal(readFileSync(paths.configFile, 'utf8'), configured)

  const baseUrlConflict = runRaw({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--base-url', 'https://jira.example.test'],
  })
  assert.equal(baseUrlConflict.status, 1)
  assert.match(baseUrlConflict.stderr, /external ticket system conflicts with the existing project configuration/)
  assert.equal(readFileSync(paths.configFile, 'utf8'), configured)
})

test('workflow commands preserve optional Obsidian metadata at storage roots', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-obsidian-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  const sharedVaultConfig = join(workflowRoot, '.obsidian', 'workspace.json')
  const projectVaultConfig = join(paths.projectRoot, '.obsidian', 'workspace.json')
  mkdirSync(join(workflowRoot, '.obsidian'), { recursive: true })
  mkdirSync(join(paths.projectRoot, '.obsidian'), { recursive: true })
  writeFileSync(sharedVaultConfig, '{"scope":"shared"}\n')
  writeFileSync(projectVaultConfig, '{"scope":"project"}\n')

  run({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--topic-id', 'obsidian-audit',
      '--title', 'Obsidian audit',
    ],
  })
  run({
    command: 'topics',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })

  assert.equal(readFileSync(sharedVaultConfig, 'utf8'), '{"scope":"shared"}\n')
  assert.equal(readFileSync(projectVaultConfig, 'utf8'), '{"scope":"project"}\n')
})

test('init-topic rejects Obsidian metadata inside a ticket topic', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-ticket-vault-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  const ticketVaultRoot = join(paths.ticketsRoot, 'topic-one', '.obsidian')
  mkdirSync(ticketVaultRoot, { recursive: true })
  writeFileSync(join(ticketVaultRoot, 'workspace.json'), '{}\n')

  const result = runRaw({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one',
      '--title', 'Topic one',
    ],
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /unexpected ticket topic entry \.obsidian/)
  assert.equal(existsSync(paths.topicsFile), false)
  assert.equal(readFileSync(join(ticketVaultRoot, 'workspace.json'), 'utf8'), '{}\n')
})

test('init accepts github and rejects unsupported ticket backends', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-github-backend-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')

  const missingBackendRoot = join(root, 'missing-backend-workflow')
  const missingBackend = runRaw({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', missingBackendRoot],
  })
  assert.equal(missingBackend.status, 1)
  assert.match(missingBackend.stderr, /--ticket-backend is required; choose local, jira, or github/)
  assert.equal(existsSync(missingBackendRoot), false)

  const paths = run({
    command: 'init',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--ticket-backend', 'github',
      '--project', 'example/repository',
      '--base-url', 'https://github.com',
    ],
  })
  const githubConfig = JSON.parse(readFileSync(paths.configFile, 'utf8'))
  assert.equal(githubConfig.ticketBackend, 'github')
  assert.deepEqual(githubConfig.externalTicketSystem, {
    system: 'github',
    project: 'example/repository',
    baseUrl: 'https://github.com',
  })

  const incompleteRoot = join(root, 'incomplete-workflow')
  const incomplete = runRaw({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', incompleteRoot, '--ticket-backend', 'jira'],
  })
  assert.equal(incomplete.status, 1)
  assert.match(incomplete.stderr, /jira backend requires --project and --base-url/)
  assert.equal(existsSync(incompleteRoot), false)

  const mismatchedAssociation = runRaw({
    command: 'configure-ticket-system',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--system', 'jira',
      '--project', 'MA',
      '--base-url', 'https://example.atlassian.net',
    ],
  })
  assert.equal(mismatchedAssociation.status, 1)
  assert.match(mismatchedAssociation.stderr, /github backend requires a matching github external ticket system/)
  assert.deepEqual(JSON.parse(readFileSync(paths.configFile, 'utf8')), githubConfig)

  const incompleteConfig = { ...githubConfig }
  delete incompleteConfig.externalTicketSystem
  const incompleteContent = `${JSON.stringify(incompleteConfig, null, 2)}\n`
  writeFileSync(paths.configFile, incompleteContent)
  const persistedIncomplete = runRaw({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })
  assert.equal(persistedIncomplete.status, 1)
  assert.match(persistedIncomplete.stderr, /not a valid Engineering Workflow configuration/)
  assert.equal(readFileSync(paths.configFile, 'utf8'), incompleteContent)
  writeFileSync(paths.configFile, `${JSON.stringify(githubConfig, null, 2)}\n`)

  const mismatchedConfig = JSON.parse(readFileSync(paths.configFile, 'utf8'))
  mismatchedConfig.externalTicketSystem = {
    system: 'jira',
    project: 'MA',
    baseUrl: 'https://example.atlassian.net',
  }
  const mismatchedContent = `${JSON.stringify(mismatchedConfig, null, 2)}\n`
  writeFileSync(paths.configFile, mismatchedContent)
  const persistedMismatch = runRaw({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })
  assert.equal(persistedMismatch.status, 1)
  assert.match(persistedMismatch.stderr, /not a valid Engineering Workflow configuration/)
  assert.equal(readFileSync(paths.configFile, 'utf8'), mismatchedContent)

  const unsupportedRoot = join(root, 'unsupported-workflow')
  const unsupported = runRaw({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', unsupportedRoot, '--ticket-backend', 'gitlab'],
  })
  assert.equal(unsupported.status, 1)
  assert.match(unsupported.stderr, /--ticket-backend must be local, jira, or github/)
  assert.equal(existsSync(unsupportedRoot), false)
})

test('init rejects a workflow root inside the repository', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-repo-root-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(repoRoot, 'artifacts')
  const result = runRaw({
    command: 'init',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--ticket-backend', 'local'],
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
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--ticket-backend', 'local'],
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /belongs to remote:example\.test\/other\/repo/)
  assert.equal(existsSync(paths.specsRoot), false)
  assert.equal(existsSync(paths.ticketsRoot), false)
  assert.equal(existsSync(paths.branchesRoot), false)
  assert.equal(existsSync(paths.worktreesRoot), false)
})

test('configure-ticket-system adds one idempotent project association and rejects conflicts', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-ticket-system-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  const args = [
    '--repo-root', repoRoot,
    '--workflow-root', workflowRoot,
    '--system', 'jira',
    '--project', 'MA',
    '--base-url', 'https://example.atlassian.net',
  ]

  const initialConfig = readFileSync(paths.configFile, 'utf8')
  for (const replacement of [
    ['--system', 'Jira'],
    ['--project', ''],
    ['--base-url', 'http://example.atlassian.net'],
  ]) {
    const invalid = runRaw({
      command: 'configure-ticket-system',
      args: args.map((value, index) => replacement[0] === args[index - 1] ? replacement[1] : value),
    })
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /--system must be a lowercase slug/)
    assert.equal(readFileSync(paths.configFile, 'utf8'), initialConfig)
  }

  const result = run({ command: 'configure-ticket-system', args })
  const configured = readFileSync(paths.configFile, 'utf8')

  assert.deepEqual(result.externalTicketSystem, {
    system: 'jira',
    project: 'MA',
    baseUrl: 'https://example.atlassian.net',
  })
  assert.deepEqual(JSON.parse(configured).externalTicketSystem, result.externalTicketSystem)

  run({ command: 'configure-ticket-system', args })
  assert.equal(readFileSync(paths.configFile, 'utf8'), configured)

  const reorderedConfig = JSON.parse(configured)
  reorderedConfig.externalTicketSystem = {
    project: 'MA',
    baseUrl: 'https://example.atlassian.net/',
    system: 'jira',
  }
  const reordered = `${JSON.stringify(reorderedConfig, null, 2)}\n`
  writeFileSync(paths.configFile, reordered)
  run({ command: 'configure-ticket-system', args })
  assert.equal(readFileSync(paths.configFile, 'utf8'), reordered)
  writeFileSync(paths.configFile, configured)

  mkdirSync(`${paths.configFile}.lock`)
  const locked = runRaw({ command: 'configure-ticket-system', args })
  assert.equal(locked.status, 1)
  assert.match(locked.stderr, /project configuration is being updated/)
  assert.equal(readFileSync(paths.configFile, 'utf8'), configured)
  execFileSync('rmdir', [`${paths.configFile}.lock`])

  const conflict = runRaw({
    command: 'configure-ticket-system',
    args: args.map((value, index) => args[index - 1] === '--project' ? 'OTHER' : value),
  })
  assert.equal(conflict.status, 1)
  assert.match(conflict.stderr, /conflicts with the existing project configuration/)
  assert.equal(readFileSync(paths.configFile, 'utf8'), configured)

  const malformedConfig = JSON.parse(configured)
  malformedConfig.externalTicketSystem.project = ' MA '
  writeFileSync(paths.configFile, `${JSON.stringify(malformedConfig, null, 2)}\n`)
  const malformed = runRaw({ command: 'configure-ticket-system', args })
  assert.equal(malformed.status, 1)
  assert.match(malformed.stderr, /not a valid Engineering Workflow configuration/)
  assert.equal(readFileSync(paths.configFile, 'utf8'), `${JSON.stringify(malformedConfig, null, 2)}\n`)
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

const initializeWorkflow = ({ repoRoot, workflowRoot }) => run({
  command: 'init',
  args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--ticket-backend', 'local'],
})

test('topics lists registered topics and immediate unregistered spec and ticket directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-topics-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  writeFileSync(join(paths.projectRoot, 'topics.json'), `${JSON.stringify({
    schemaVersion: 1,
    topics: [
      {
        id: 'registered-topic',
        title: 'Registered topic',
        status: 'active',
        createdAt: '2026-08-17T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
      },
      {
        id: 'earlier-topic',
        title: 'Earlier topic',
        status: 'archived',
        createdAt: '2026-08-16T17:00:00-07:00',
        updatedAt: '2026-08-16T17:00:00-07:00',
      },
    ],
  }, null, 2)}\n`)
  mkdirSync(join(paths.specsRoot, 'spec-only'), { recursive: true })
  mkdirSync(join(paths.specsRoot, 'shared-topic'), { recursive: true })
  mkdirSync(join(paths.ticketsRoot, 'shared-topic'), { recursive: true })
  mkdirSync(join(paths.ticketsRoot, 'Not valid'), { recursive: true })
  writeFileSync(join(paths.specsRoot, 'ignored.md'), '# ignored\n')

  const result = run({
    command: 'topics',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })

  assert.deepEqual(result.topics.map((topic) => topic.id), ['earlier-topic', 'registered-topic'])
  assert.deepEqual(result.unregisteredTopics, [
    { id: 'Not valid', locations: ['tickets'], validId: false },
    { id: 'shared-topic', locations: ['specs', 'tickets'], validId: true },
    { id: 'spec-only', locations: ['specs'], validId: true },
  ])
})

test('topic commands require an existing valid matching configuration without initializing storage', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-topic-config-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')

  const result = runRaw({
    command: 'topics',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /config\.json does not exist/)
  assert.equal(existsSync(workflowRoot), false)

  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  const config = JSON.parse(readFileSync(paths.configFile, 'utf8'))
  config.repository.identity = 'remote:example.test/other/repository'
  writeFileSync(paths.configFile, `${JSON.stringify(config, null, 2)}\n`)

  const conflicting = runRaw({
    command: 'topics',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })

  assert.equal(conflicting.status, 1)
  assert.match(conflicting.stderr, /belongs to remote:example\.test\/other\/repository/)
  assert.equal(existsSync(paths.topicsFile), false)
})

test('init-topic rejects invalid input and conflicting metadata without changing the registry', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-topic-input-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })

  for (const args of [
    ['--topic-id', 'Invalid Topic', '--title', 'Topic'],
    ['--topic-id', 'valid-topic', '--title', '   '],
  ]) {
    const result = runRaw({
      command: 'init-topic',
      args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, ...args],
    })
    assert.equal(result.status, 1)
    assert.equal(existsSync(paths.topicsFile), false)
  }

  const validArgs = [
    '--repo-root', repoRoot,
    '--workflow-root', workflowRoot,
    '--topic-id', 'valid-topic',
    '--title', 'Valid topic',
  ]
  run({ command: 'init-topic', args: validArgs })
  const original = readFileSync(paths.topicsFile, 'utf8')

  const conflict = runRaw({
    command: 'init-topic',
    args: [...validArgs.slice(0, -1), 'Different title'],
  })

  assert.equal(conflict.status, 1)
  assert.match(conflict.stderr, /conflicts with the existing registry entry/)
  assert.equal(readFileSync(paths.topicsFile, 'utf8'), original)
})

test('init-topic creates a trimmed active topic and its expected directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-init-topic-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })

  const result = run({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one',
      '--title', '  Topic one  ',
    ],
  })
  const registry = JSON.parse(readFileSync(paths.topicsFile, 'utf8'))

  assert.equal(result.topic.id, 'topic-one')
  assert.equal(result.topic.title, 'Topic one')
  assert.equal(result.topic.status, 'active')
  assert.match(result.topic.createdAt, /^\d{4}-\d{2}-\d{2}T.*Z$/)
  assert.equal(result.topic.updatedAt, result.topic.createdAt)
  assert.deepEqual(registry.topics, [result.topic])
  assert.ok(existsSync(join(paths.specsRoot, 'topic-one')))
  assert.ok(existsSync(join(paths.ticketsRoot, 'topic-one', 'todo')))
  assert.ok(existsSync(join(paths.ticketsRoot, 'topic-one', 'in-progress')))
  assert.ok(existsSync(join(paths.ticketsRoot, 'topic-one', 'done')))
})

test('init-topic is byte-idempotent while repairing missing expected directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-idempotent-topic-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  const args = [
    '--repo-root', repoRoot,
    '--workflow-root', workflowRoot,
    '--topic-id', 'topic-one',
    '--title', 'Topic one',
  ]
  run({ command: 'init-topic', args })
  const original = readFileSync(paths.topicsFile, 'utf8')
  const missingDirectory = join(paths.ticketsRoot, 'topic-one', 'done')
  execFileSync('rmdir', [missingDirectory])

  run({ command: 'init-topic', args })

  assert.equal(readFileSync(paths.topicsFile, 'utf8'), original)
  assert.ok(existsSync(missingDirectory))
})

test('init-topic validates registry and ticket adoption before writing', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-topic-conflicts-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  const topicRoot = join(paths.ticketsRoot, 'topic-one')
  mkdirSync(topicRoot, { recursive: true })
  const unexpected = join(topicRoot, 'TICKET-100-topic-one.md')
  writeFileSync(unexpected, '# flat ticket\n')

  const result = runRaw({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one',
      '--title', 'Topic one',
    ],
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /unexpected ticket topic entry/)
  assert.equal(existsSync(paths.topicsFile), false)
  assert.equal(readFileSync(unexpected, 'utf8'), '# flat ticket\n')
  assert.equal(existsSync(join(paths.specsRoot, 'topic-one')), false)
})

test('init-topic safely adopts lifecycle directories with unique Markdown ticket IDs', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-topic-adoption-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  const topicRoot = join(paths.ticketsRoot, 'topic-one')
  mkdirSync(join(topicRoot, 'todo'), { recursive: true })
  writeFileSync(join(topicRoot, 'todo', 'TICKET-100-topic-one.md'), '# ticket\n')

  run({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one',
      '--title', 'Topic one',
    ],
  })

  assert.equal(readFileSync(join(topicRoot, 'todo', 'TICKET-100-topic-one.md'), 'utf8'), '# ticket\n')
  assert.ok(existsSync(join(topicRoot, 'in-progress')))
  assert.ok(existsSync(join(topicRoot, 'done')))
})

test('init-topic rejects local ticket files for an external backend without changing them', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-external-ticket-adoption-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = run({
    command: 'init',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--ticket-backend', 'github',
      '--project', 'example/repository',
      '--base-url', 'https://github.com',
    ],
  })
  const topicRoot = join(paths.ticketsRoot, 'topic-one')
  const ticketFile = join(topicRoot, 'todo', 'TICKET-100-topic-one.md')
  mkdirSync(join(topicRoot, 'todo'), { recursive: true })
  writeFileSync(ticketFile, '# ticket\n')

  const result = runRaw({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one',
      '--title', 'Topic one',
    ],
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /github backend cannot adopt local ticket file/)
  assert.equal(readFileSync(ticketFile, 'utf8'), '# ticket\n')
  assert.equal(existsSync(paths.topicsFile), false)
  assert.equal(existsSync(join(paths.specsRoot, 'topic-one')), false)
})

test('init-topic preserves unrelated topics and sorts new topics by ID', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-topic-registry-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  const existingTopic = {
    id: 'z-topic',
    title: 'Z topic',
    status: 'archived',
    createdAt: '2026-08-17T00:00:00.000Z',
    updatedAt: '2026-08-17T00:00:00.000Z',
  }
  writeFileSync(paths.topicsFile, `${JSON.stringify({
    schemaVersion: 1,
    topics: [existingTopic],
  }, null, 2)}\n`)

  run({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--topic-id', 'a-topic',
      '--title', 'A topic',
    ],
  })

  const registry = JSON.parse(readFileSync(paths.topicsFile, 'utf8'))
  assert.deepEqual(registry.topics.map((topic) => topic.id), ['a-topic', 'z-topic'])
  assert.deepEqual(registry.topics[1], existingTopic)
})

test('init-topic stops when another registry writer holds the lock', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-topic-lock-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  mkdirSync(`${paths.topicsFile}.lock`)

  const result = runRaw({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one',
      '--title', 'Topic one',
    ],
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /topic registry is being updated/)
  assert.equal(existsSync(paths.topicsFile), false)
  assert.equal(existsSync(join(paths.specsRoot, 'topic-one')), false)
})

test('topic commands reject malformed registries and duplicate lifecycle ticket IDs', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-invalid-topic-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  writeFileSync(paths.topicsFile, '{"schemaVersion":1,"topics":[{"id":"invalid ID"}]}\n')

  const malformed = runRaw({
    command: 'topics',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
  })

  assert.equal(malformed.status, 1)
  assert.match(malformed.stderr, /contains an invalid topic/)

  writeFileSync(paths.topicsFile, '{"schemaVersion":1,"topics":[]}\n')
  const topicRoot = join(paths.ticketsRoot, 'topic-one')
  mkdirSync(join(topicRoot, 'todo'), { recursive: true })
  mkdirSync(join(topicRoot, 'done'), { recursive: true })
  writeFileSync(join(topicRoot, 'todo', 'TICKET-100-topic-one.md'), '# todo\n')
  writeFileSync(join(topicRoot, 'done', 'TICKET-100-topic-two.md'), '# done\n')

  const duplicate = runRaw({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot,
      '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one',
      '--title', 'Topic one',
    ],
  })

  assert.equal(duplicate.status, 1)
  assert.match(duplicate.stderr, /duplicate ticket ID TICKET-100/)
  assert.equal(readFileSync(paths.topicsFile, 'utf8'), '{"schemaVersion":1,"topics":[]}\n')
})

test('topics rejects malformed registry shapes, duplicates, and invalid timestamps', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-invalid-registry-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  const topic = {
    id: 'valid-topic',
    title: 'Valid topic',
    status: 'active',
    createdAt: '2026-08-17T00:00:00.000Z',
    updatedAt: '2026-08-17T00:00:00.000Z',
  }
  const malformedRegistries = [
    '{',
    JSON.stringify([]),
    JSON.stringify({ schemaVersion: 2, topics: [] }),
    JSON.stringify({ schemaVersion: 1, topics: {} }),
    JSON.stringify({ schemaVersion: 1, topics: [], source: 'manual' }),
    JSON.stringify({ schemaVersion: 1, topics: [topic, topic] }),
    JSON.stringify({
      schemaVersion: 1,
      topics: [{ ...topic, owner: 'workflow' }],
    }),
    JSON.stringify({
      schemaVersion: 1,
      topics: [{ ...topic, updatedAt: 'not-a-timestamp' }],
    }),
    JSON.stringify({
      schemaVersion: 1,
      topics: [{
        ...topic,
        createdAt: '2026-02-31T00:00:00Z',
        updatedAt: '2026-02-31T00:00:00Z',
      }],
    }),
    JSON.stringify({
      schemaVersion: 1,
      topics: [{ ...topic, updatedAt: '2026-08-16T00:00:00.000Z' }],
    }),
  ]

  for (const registry of malformedRegistries) {
    writeFileSync(paths.topicsFile, `${registry}\n`)
    const result = runRaw({
      command: 'topics',
      args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot],
    })
    assert.equal(result.status, 1, registry)
    assert.equal(readFileSync(paths.topicsFile, 'utf8'), `${registry}\n`)
  }
})
