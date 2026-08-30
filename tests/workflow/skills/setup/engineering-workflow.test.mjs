import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, sep } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { workflowSkillRoot } from '../../plugin-paths.mjs'

const script = fileURLToPath(new URL('scripts/engineering-workflow.mjs', workflowSkillRoot('setup')))
const git = (repoRoot, ...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim()
const markdownPath = (value) => value.split(sep).join('/')

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

const initializeWorkflow = ({ repoRoot, workflowRoot, backend = 'local' }) => run({
  command: 'init',
  args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--ticket-backend', backend],
})

const createTopic = ({ repoRoot, workflowRoot, id = 'topic-one', title = 'Topic one' }) => run({
  command: 'init-topic',
  args: [
    '--repo-root', repoRoot, '--workflow-root', workflowRoot,
    '--topic-id', id, '--title', title, '--confirm',
  ],
})

const readManifest = (file) => {
  const content = readFileSync(file, 'utf8')
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  assert.ok(match)
  return {
    manifest: Object.fromEntries(match[1].split('\n').map((line) => {
      const field = line.match(/^([^:]+): (.+)$/)
      return [field[1], JSON.parse(field[2])]
    })),
    body: match[2],
  }
}

const writeManifest = ({ file, manifest, body }) => {
  const frontmatter = Object.entries(manifest)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')
  writeFileSync(file, `---\n${frontmatter}\n---\n${body}`)
}

const topicLink = ({ artifact, topicFile }) => markdownPath(relative(dirname(artifact), topicFile))
const walkthroughSlices = (...entries) => JSON.stringify(
  entries.map(([slice, description]) => ({ slice, description })),
)

test('paths resolves topic-owned branch ledger locations', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-paths-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = run({
    command: 'paths',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot,
      '--topic-id', 'workflow-storage', '--topic-state', 'open',
    ],
  })

  assert.match(paths.repositoryId, /^github\.com-example-repository-[0-9a-f]{8}$/)
  assert.equal(paths.branch, 'feat/example')
  assert.match(paths.branchId, /^feat-example-[0-9a-f]{8}$/)
  assert.equal(
    paths.ledgerFile,
    join(
      paths.workflowRoot, 'repositories', paths.repositoryId, 'topics', 'open',
      'workflow-storage', 'branches', paths.branchId, 'TASKS.md',
    ),
  )
  assert.equal(existsSync(workflowRoot), false)
})

test('paths keeps repository and branch collision hashes', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-collisions-'))
  const workflowRoot = join(root, 'workflow')
  const firstRepo = createRepo({ parent: root, name: 'first', remote: 'git@github.com:example/a-b/c.git' })
  const secondRepo = createRepo({ parent: root, name: 'second', remote: 'git@github.com:example/a/b-c.git' })
  git(firstRepo, 'branch', '-m', 'feat/a-b')
  git(secondRepo, 'branch', '-m', 'feat/a/b')
  const args = ['--workflow-root', workflowRoot, '--topic-id', 'topic', '--topic-state', 'open']
  const first = run({ command: 'paths', args: ['--repo-root', firstRepo, ...args] })
  const second = run({ command: 'paths', args: ['--repo-root', secondRepo, ...args] })
  assert.notEqual(first.repositoryId, second.repositoryId)
  assert.notEqual(first.branchId, second.branchId)
  assert.notEqual(first.ledgerFile, second.ledgerFile)
})

test('init creates the topic-first roots and one repository configuration', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-init-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const args = [
    '--repo-root', repoRoot, '--workflow-root', workflowRoot, '--ticket-backend', 'jira',
    '--project', 'MA', '--base-url', 'https://example.atlassian.net',
  ]
  const paths = run({ command: 'init', args })
  const config = JSON.parse(readFileSync(paths.configFile, 'utf8'))

  assert.equal(paths.projectRoot, join(paths.workflowRoot, 'repositories', paths.repositoryId))
  assert.equal(config.ticketBackend, 'jira')
  assert.equal(config.repository.identity, 'remote:github.com/example/repository')
  assert.deepEqual(config.externalTicketSystem, {
    system: 'jira', project: 'MA', baseUrl: 'https://example.atlassian.net',
  })
  for (const state of ['open', 'complete', 'abandoned']) {
    assert.ok(existsSync(join(workflowRoot, 'topics', state)))
    assert.ok(existsSync(join(paths.repositoryTopicsRoot, state)))
  }
  const original = readFileSync(paths.configFile, 'utf8')
  run({ command: 'init', args })
  assert.equal(readFileSync(paths.configFile, 'utf8'), original)
})

test('topics can list an empty workflow root before repository initialization', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-empty-topics-'))
  const workflowRoot = join(root, 'workflow')
  const result = run({ command: 'topics', args: ['--workflow-root', workflowRoot] })
  assert.deepEqual(result, { topics: [], unregisteredTopics: [], unregisteredRepositoryTopics: [] })
  assert.equal(existsSync(workflowRoot), false)
})

test('init-topic requires confirmation and creates a strict open manifest', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-init-topic-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const base = initializeWorkflow({ repoRoot, workflowRoot })
  const unconfirmed = runRaw({
    command: 'init-topic',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one', '--title', 'Topic one'],
  })
  assert.equal(unconfirmed.status, 1)
  assert.match(unconfirmed.stderr, /requires --confirm/)

  const result = createTopic({ repoRoot, workflowRoot })
  const { manifest, body } = readManifest(result.paths.topicFile)
  assert.equal(manifest.id, 'topic-one')
  assert.equal(manifest.state, 'open')
  assert.deepEqual(manifest.repositories, [base.repositoryId])
  assert.equal(manifest.transitions.at(-1).to, 'open')
  assert.match(body, /## Notes/)
  assert.ok(existsSync(join(result.paths.ticketsRoot, 'todo')))
  assert.ok(existsSync(join(result.paths.ticketsRoot, 'in-progress')))
  assert.ok(existsSync(join(result.paths.ticketsRoot, 'done')))
  assert.ok(existsSync(result.paths.grillsRoot))
  assert.ok(existsSync(result.paths.walkthroughsRoot))
  assert.ok(existsSync(result.paths.branchesRoot))
})

test('init-topic is idempotent and rejects conflicting titles', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-topic-idempotent-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const first = createTopic({ repoRoot, workflowRoot })
  const original = readFileSync(first.paths.topicFile, 'utf8')
  createTopic({ repoRoot, workflowRoot })
  assert.equal(readFileSync(first.paths.topicFile, 'utf8'), original)

  const conflict = runRaw({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--title', 'Different title', '--confirm',
    ],
  })
  assert.equal(conflict.status, 1)
  assert.match(conflict.stderr, /conflicts with the existing manifest/)
})

test('topics reports unregistered directories and rejects state mismatches', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-topic-validation-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  mkdirSync(join(workflowRoot, 'topics', 'open', 'missing-manifest'))
  const listed = run({ command: 'topics', args: ['--workflow-root', workflowRoot] })
  assert.deepEqual(listed.unregisteredTopics.map(({ id }) => id), ['missing-manifest'])

  const parsed = readManifest(topic.paths.topicFile)
  parsed.manifest.state = 'complete'
  writeManifest({ file: topic.paths.topicFile, ...parsed })
  const mismatch = runRaw({ command: 'topics', args: ['--workflow-root', workflowRoot] })
  assert.equal(mismatch.status, 1)
  assert.match(mismatch.stderr, /state does not match its directory/)
})

test('topics rejects a noncontiguous or illegal transition history', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-transition-history-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  const parsed = readManifest(topic.paths.topicFile)
  parsed.manifest.transitions.push({
    from: 'complete', to: 'abandoned', at: parsed.manifest.updatedAt,
    actor: 'User', reason: 'Invalid transition', warnings: [],
  })
  parsed.manifest.state = 'abandoned'
  writeManifest({ file: topic.paths.topicFile, ...parsed })
  const result = runRaw({ command: 'topics', args: ['--workflow-root', workflowRoot] })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /not a valid topic manifest/)
})

test('attach-topic registers multiple repositories and verified external work', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-attach-'))
  const firstRepo = createRepo({ parent: root, name: 'first' })
  const secondRepo = createRepo({
    parent: root, name: 'second', remote: 'git@github.com:example/second.git',
  })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot: firstRepo, workflowRoot })
  const topic = createTopic({ repoRoot: firstRepo, workflowRoot })
  writeFileSync(topic.paths.topicFile, `${readFileSync(topic.paths.topicFile, 'utf8')}Keep this note.\n`)
  const second = initializeWorkflow({ repoRoot: secondRepo, workflowRoot })
  const args = [
    '--repo-root', secondRepo, '--workflow-root', workflowRoot,
    '--topic-id', 'topic-one', '--external-url', 'https://github.com/example/work/issues/1', '--confirm',
  ]
  const attached = run({ command: 'attach-topic', args })
  assert.equal(attached.changed, true)
  assert.deepEqual(attached.manifest.repositories.sort(), [topic.paths.repositoryId, second.repositoryId].sort())
  assert.deepEqual(attached.manifest.externalWork, ['https://github.com/example/work/issues/1'])
  assert.ok(existsSync(attached.paths.branchesRoot))
  assert.match(readFileSync(topic.paths.topicFile, 'utf8'), /Keep this note\./)
  const repeated = run({ command: 'attach-topic', args })
  assert.equal(repeated.changed, false)
})

test('attach-topic rejects invalid URLs and repository state conflicts', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-attach-conflict-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  createTopic({ repoRoot, workflowRoot })
  const invalid = runRaw({
    command: 'attach-topic',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--external-url', 'file:///tmp/ticket', '--confirm',
    ],
  })
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /absolute HTTPS URL/)

  mkdirSync(join(paths.repositoryTopicsRoot, 'complete', 'topic-one'), { recursive: true })
  const conflict = runRaw({
    command: 'attach-topic',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one', '--confirm'],
  })
  assert.equal(conflict.status, 1)
  assert.match(conflict.stderr, /state conflicts/)
})

test('attach-topic requires confirmation and an open topic', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-attach-state-'))
  const firstRepo = createRepo({ parent: root, name: 'first' })
  const secondRepo = createRepo({ parent: root, name: 'second', remote: 'git@github.com:example/second.git' })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot: firstRepo, workflowRoot })
  createTopic({ repoRoot: firstRepo, workflowRoot })
  initializeWorkflow({ repoRoot: secondRepo, workflowRoot })
  const attachArgs = [
    '--repo-root', secondRepo, '--workflow-root', workflowRoot, '--topic-id', 'topic-one',
  ]
  const unconfirmed = runRaw({ command: 'attach-topic', args: attachArgs })
  assert.equal(unconfirmed.status, 1)
  assert.match(unconfirmed.stderr, /requires --confirm/)
  run({
    command: 'abandon-topic',
    args: [
      '--repo-root', firstRepo, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--reason', 'Paused',
    ],
  })
  const closed = runRaw({ command: 'attach-topic', args: [...attachArgs, '--confirm'] })
  assert.equal(closed.status, 1)
  assert.match(closed.stderr, /must be reopened/)
})

test('attach-topic leaves no repository directory when manifest validation fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-attach-rollback-'))
  const firstRepo = createRepo({ parent: root, name: 'first' })
  const secondRepo = createRepo({ parent: root, name: 'second', remote: 'git@github.com:example/second.git' })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot: firstRepo, workflowRoot })
  const topic = createTopic({ repoRoot: firstRepo, workflowRoot })
  const second = initializeWorkflow({ repoRoot: secondRepo, workflowRoot })
  const parsed = readManifest(topic.paths.topicFile)
  parsed.body = parsed.body.replace(
    /<!-- engineering-workflow:generated-links:start -->[\s\S]*?<!-- engineering-workflow:generated-links:end -->/,
    '## Artifacts\n\nBroken generated section',
  )
  writeManifest({ file: topic.paths.topicFile, ...parsed })

  const result = runRaw({
    command: 'attach-topic',
    args: [
      '--repo-root', secondRepo, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--confirm',
    ],
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /missing its generated links section/)
  assert.equal(existsSync(join(second.repositoryTopicsRoot, 'open', 'topic-one')), false)
})

test('sync-topic refreshes generated links and reports missing artifact links', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-sync-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  writeFileSync(topic.paths.specFile, '# Spec without topic link\n')
  mkdirSync(dirname(topic.paths.ledgerFile), { recursive: true })
  writeFileSync(
    topic.paths.ledgerFile,
    `# Tasks\n\nTopic: [TOPIC.md](${topicLink({ artifact: topic.paths.ledgerFile, topicFile: topic.paths.topicFile })})\n`,
  )
  const result = run({
    command: 'sync-topic',
    args: ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one'],
  })
  const content = readFileSync(topic.paths.topicFile, 'utf8')
  assert.match(content, /Specification: \[SPEC\.md\]\(SPEC\.md\)/)
  assert.match(content, /Branch ledger:/)
  assert.deepEqual(result.warnings, ['topics/open/topic-one/SPEC.md does not link to TOPIC.md'])
})

test('topic mutations reject an unconfigured or unregistered repository', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-sync-membership-'))
  const firstRepo = createRepo({ parent: root, name: 'first' })
  const secondRepo = createRepo({ parent: root, name: 'second', remote: 'git@github.com:example/second.git' })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot: firstRepo, workflowRoot })
  const topic = createTopic({ repoRoot: firstRepo, workflowRoot })
  writeFileSync(topic.paths.planFile, '# Plan\n\nTopic: [TOPIC.md](TOPIC.md)\n')

  const unconfigured = runRaw({
    command: 'sync-topic',
    args: ['--repo-root', secondRepo, '--workflow-root', workflowRoot, '--topic-id', 'topic-one'],
  })
  assert.equal(unconfigured.status, 1)
  assert.match(unconfigured.stderr, /does not exist/)

  initializeWorkflow({ repoRoot: secondRepo, workflowRoot })
  const unregistered = runRaw({
    command: 'sync-topic',
    args: ['--repo-root', secondRepo, '--workflow-root', workflowRoot, '--topic-id', 'topic-one'],
  })
  assert.equal(unregistered.status, 1)
  assert.match(unregistered.stderr, /not registered in topic/)
  assert.doesNotMatch(readFileSync(topic.paths.topicFile, 'utf8'), /Plan: \[PLAN\.md\]/)

  run({
    command: 'abandon-topic',
    args: [
      '--repo-root', firstRepo, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--reason', 'Work stopped',
    ],
  })
  const lifecycleNoop = runRaw({
    command: 'abandon-topic',
    args: [
      '--repo-root', secondRepo, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--reason', 'Already stopped',
    ],
  })
  assert.equal(lifecycleNoop.status, 1)
  assert.match(lifecycleNoop.stderr, /not registered in topic/)
})

test('mark-spec-implemented is explicit and idempotent', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-spec-state-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  writeFileSync(
    topic.paths.specFile,
    `# Spec\n\nTopic: [TOPIC.md](TOPIC.md)\n\n| Field | Value |\n|---|---|\n| Status | Ready |\n`,
  )
  const args = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const changed = run({ command: 'mark-spec-implemented', args })
  assert.deepEqual(changed, { changed: true, previousStatus: 'Ready', status: 'Implemented' })
  assert.match(readFileSync(topic.paths.specFile, 'utf8'), /^\| Status \| Implemented \|$/m)
  assert.equal(run({ command: 'mark-spec-implemented', args }).changed, false)
})

test('complete-topic audits warnings before a confirmed transition', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-complete-warning-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  writeFileSync(topic.paths.specFile, '# Spec\n\nTopic: [TOPIC.md](TOPIC.md)\n\n| Status | Ready |\n')
  mkdirSync(dirname(topic.paths.ledgerFile), { recursive: true })
  writeFileSync(
    topic.paths.ledgerFile,
    `# Tasks\n\nTopic: [TOPIC.md](${topicLink({ artifact: topic.paths.ledgerFile, topicFile: topic.paths.topicFile })})\n\n- [ ] Ship it\n`,
  )
  const args = [
    '--repo-root', repoRoot, '--workflow-root', workflowRoot,
    '--topic-id', 'topic-one', '--reason', 'Delivered with follow-up work',
  ]
  const audit = run({ command: 'complete-topic', args, expectStatus: 2 })
  assert.equal(audit.confirmationRequired, true)
  assert.match(audit.warnings.join('\n'), /SPEC\.md is not Implemented/)
  assert.match(audit.warnings.join('\n'), /incomplete tasks/)
  assert.ok(existsSync(topic.paths.topicRoot))

  const completed = run({ command: 'complete-topic', args: [...args, '--confirm-warnings'] })
  const completeTopicFile = join(workflowRoot, 'topics', 'complete', 'topic-one', 'TOPIC.md')
  const completeLedger = join(
    workflowRoot, 'repositories', topic.paths.repositoryId, 'topics', 'complete',
    'topic-one', 'branches', topic.paths.branchId, 'TASKS.md',
  )
  assert.equal(completed.topic.state, 'complete')
  assert.ok(existsSync(completeTopicFile))
  assert.ok(existsSync(completeLedger))
  assert.equal(readManifest(completeTopicFile).manifest.transitions.at(-1).warnings.length, 2)
  assert.ok(readFileSync(completeLedger, 'utf8').includes(`](${topicLink({ artifact: completeLedger, topicFile: completeTopicFile })})`))
})

test('a clean completion keeps specification and topic state independent', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-complete-clean-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  writeFileSync(topic.paths.specFile, '# Spec\n\nTopic: [TOPIC.md](TOPIC.md)\n\n| Status | Ready |\n')
  const commonArgs = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  run({ command: 'mark-spec-implemented', args: commonArgs })
  const result = run({ command: 'complete-topic', args: [...commonArgs, '--reason', 'Delivered and verified'] })
  assert.deepEqual(result.warnings, [])
  assert.equal(result.topic.state, 'complete')
  assert.match(
    readFileSync(join(workflowRoot, 'topics', 'complete', 'topic-one', 'SPEC.md'), 'utf8'),
    /^\| Status \| Implemented \|$/m,
  )
})

test('completion can acknowledge a missing registered repository directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-complete-missing-repository-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  const parsed = readManifest(topic.paths.topicFile)
  parsed.manifest.repositories.push('github.com-missing-repository-0123abcd')
  writeManifest({ file: topic.paths.topicFile, ...parsed })
  const args = [
    '--repo-root', repoRoot, '--workflow-root', workflowRoot,
    '--topic-id', 'topic-one', '--reason', 'Complete with missing historical work',
  ]
  const audit = run({ command: 'complete-topic', args, expectStatus: 2 })
  assert.match(audit.warnings.join('\n'), /has no repository topic directory/)
  const completed = run({ command: 'complete-topic', args: [...args, '--confirm-warnings'] })
  assert.equal(completed.topic.state, 'complete')
  assert.ok(existsSync(join(workflowRoot, 'topics', 'complete', 'topic-one', 'TOPIC.md')))
})

test('abandon-topic and reopen-topic move all registered topic directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-reopen-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  const commonArgs = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  run({ command: 'abandon-topic', args: [...commonArgs, '--reason', 'Direction changed'] })
  assert.ok(existsSync(join(workflowRoot, 'topics', 'abandoned', 'topic-one', 'TOPIC.md')))
  assert.ok(existsSync(join(topic.paths.projectRoot, 'topics', 'abandoned', 'topic-one')))
  run({ command: 'reopen-topic', args: [...commonArgs, '--reason', 'Work resumed'] })
  assert.ok(existsSync(topic.paths.topicFile))
  assert.ok(existsSync(topic.paths.repositoryTopicRoot))
  assert.equal(readManifest(topic.paths.topicFile).manifest.transitions.length, 3)
})

test('topic transitions stop before moving when a target path conflicts', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-transition-conflict-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  mkdirSync(join(workflowRoot, 'topics', 'abandoned', 'topic-one'))
  const result = runRaw({
    command: 'abandon-topic',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--reason', 'Stopped',
    ],
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /conflicting directory/)
  assert.ok(existsSync(topic.paths.topicFile))
  assert.ok(existsSync(topic.paths.repositoryTopicRoot))
})

test('a failed link rewrite rolls back moved directories and earlier ledger edits', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-transition-rollback-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  const branchRoots = ['a-branch', 'b-branch'].map((branch) => (
    join(topic.paths.repositoryTopicRoot, 'branches', branch)
  ))
  const originals = branchRoots.map((branchRoot) => {
    const ledger = join(branchRoot, 'TASKS.md')
    mkdirSync(branchRoot, { recursive: true })
    const content = `# Tasks\n\nTopic: [TOPIC.md](${topicLink({ artifact: ledger, topicFile: topic.paths.topicFile })})\n`
    writeFileSync(ledger, content)
    return { ledger, content }
  })
  chmodSync(branchRoots[1], 0o555)
  const result = runRaw({
    command: 'abandon-topic',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--reason', 'Test rollback',
    ],
  })
  chmodSync(branchRoots[1], 0o755)
  assert.equal(result.status, 1)
  assert.ok(existsSync(topic.paths.topicRoot))
  assert.ok(existsSync(topic.paths.repositoryTopicRoot))
  assert.equal(existsSync(join(workflowRoot, 'topics', 'abandoned', 'topic-one')), false)
  for (const { ledger, content } of originals) assert.equal(readFileSync(ledger, 'utf8'), content)
})

test('topics rejects duplicate IDs across lifecycle directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-duplicate-topic-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  const duplicateRoot = join(workflowRoot, 'topics', 'complete', 'topic-one')
  mkdirSync(duplicateRoot)
  writeFileSync(join(duplicateRoot, 'TOPIC.md'), readFileSync(topic.paths.topicFile))
  const result = runRaw({ command: 'topics', args: ['--workflow-root', workflowRoot] })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /duplicate topic ID topic-one/)
})

test('grill commands create unique logs, support resume, and persist curated decisions', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-grill-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const first = run({ command: 'start-grill', args: [...common, '--slug', 'storage-shape'] })
  const second = run({ command: 'start-grill', args: [...common, '--slug', 'lifecycle'] })
  assert.notEqual(first.logFile, second.logFile)
  assert.match(basename(first.logFile), /^\d{4}-\d{2}-\d{2}-01-storage-shape\.md$/)
  assert.match(basename(second.logFile), /^\d{4}-\d{2}-\d{2}-02-lifecycle\.md$/)
  assert.equal(run({
    command: 'start-grill', args: [...common, '--log-file', basename(first.logFile)],
  }).resumed, true)

  run({
    command: 'update-grill',
    args: [
      ...common, '--log-file', basename(first.logFile),
      '--question', 'Where does the manifest live?',
      '--recommendation', 'Use the topic root.',
      '--decision', 'Use TOPIC.md.',
      '--rationale', 'It gives one navigation target.',
      '--next-question', 'How do lifecycle moves work?',
    ],
  })
  run({
    command: 'update-grill',
    args: [
      ...common, '--log-file', basename(first.logFile),
      '--question', 'How do lifecycle moves work?',
      '--recommendation', 'Move the topic and repository directories together.',
      '--decision', 'Use one atomic lifecycle transition.',
      '--rationale', 'It keeps topic and repository state consistent.',
      '--next-question', 'How are incomplete tasks reported?',
    ],
  })
  const log = readFileSync(first.logFile, 'utf8')
  assert.match(log, /### Decision 1/)
  assert.match(log, /- Decision: Use TOPIC\.md\./)
  assert.match(log, /### Decision 2/)
  assert.match(log, /- Decision: Use one atomic lifecycle transition\./)
  assert.match(log, /## Next unresolved question\n\nHow are incomplete tasks reported\?/)
  assert.match(readFileSync(topic.paths.topicFile, 'utf8'), /Grill log:/)
})

test('grill resume and update reject malformed or wrongly linked logs', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-grill-validation-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const grill = run({ command: 'start-grill', args: [...common, '--slug', 'ownership'] })
  writeFileSync(grill.logFile, '# Grill: ownership\n\n## Next unresolved question\n\nTBD\n')
  const resumed = runRaw({
    command: 'start-grill', args: [...common, '--log-file', basename(grill.logFile)],
  })
  assert.equal(resumed.status, 1)
  assert.match(resumed.stderr, /not a valid grill log for this topic/)
  const updated = runRaw({
    command: 'update-grill',
    args: [
      ...common, '--log-file', basename(grill.logFile),
      '--question', 'Who owns state?', '--recommendation', 'The component.',
      '--decision', 'The component owns state.', '--rationale', 'One owner.',
      '--next-question', 'What updates it?',
    ],
  })
  assert.equal(updated.status, 1)
  assert.match(updated.stderr, /not a valid grill log for this topic/)
})

test('grill commands reject closed topics and multiline fields', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-grill-boundaries-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const grill = run({ command: 'start-grill', args: [...common, '--slug', 'field-shape'] })
  const original = readFileSync(grill.logFile, 'utf8')
  const multiline = runRaw({
    command: 'update-grill',
    args: [
      ...common, '--log-file', basename(grill.logFile),
      '--question', 'Who owns state?', '--recommendation', 'The component.',
      '--decision', 'First line\nSecond line', '--rationale', 'One owner.',
      '--next-question', 'What updates it?',
    ],
  })
  assert.equal(multiline.status, 1)
  assert.match(multiline.stderr, /decision must be a single line/)
  assert.equal(readFileSync(grill.logFile, 'utf8'), original)

  run({ command: 'abandon-topic', args: [...common, '--reason', 'Work stopped'] })
  const closed = runRaw({ command: 'start-grill', args: [...common, '--slug', 'closed-topic'] })
  assert.equal(closed.status, 1)
  assert.match(closed.stderr, /must be reopened before changing grill logs/)
})

test('walkthrough commands create unique logs, resume them, and register manifest links', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-walkthrough-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const topic = createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const first = run({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'field-guide', '--source', 'working-tree',
      '--slices', walkthroughSlices(
        ['Storage design', 'Review the topic-owned storage model.'],
        ['Validation', 'Review deterministic validation and failure behavior.'],
      ),
    ],
  })
  const second = run({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'release-path', '--source', 'last-turn',
      '--slices', walkthroughSlices(['Packaging', 'Review plugin packaging and release behavior.']),
    ],
  })

  assert.match(basename(first.logFile), /^\d{4}-\d{2}-\d{2}-01-field-guide\.md$/)
  assert.match(basename(second.logFile), /^\d{4}-\d{2}-\d{2}-02-release-path\.md$/)
  const log = readFileSync(first.logFile, 'utf8')
  assert.match(log, /Topic: \[TOPIC\.md\]\(\.\.\/TOPIC\.md\)/)
  assert.match(log, /- Source: working-tree/)
  assert.match(log, /- Reviewer: user/)
  assert.match(log, /- Repository: github\.com-example-repository-[0-9a-f]{8}/)
  assert.doesNotMatch(log, new RegExp(repoRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(log, /- Base: none/)
  assert.match(log, /- Range: working-tree@[0-9a-f]{40}/)
  assert.match(log, /\| Slice \| Description \| Status \|/)
  assert.match(log, /\| Storage design \| Review the topic-owned storage model\. \| unresolved \|/)
  assert.match(log, /\| Validation \| Review deterministic validation and failure behavior\. \| unresolved \|/)
  assert.match(log, /## Corrections\n\n\| ID \| Slice \| Correction \| Status \|/)
  assert.match(log, /## Running log\n\n## Next slice\n\nStorage design/)
  assert.equal(run({
    command: 'start-walkthrough', args: [...common, '--log-file', basename(first.logFile)],
  }).resumed, true)
  assert.match(readFileSync(topic.paths.topicFile, 'utf8'), /Walkthrough log:/)
})

test('walkthrough records an agent reviewer mode and rejects unknown reviewers', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-walkthrough-reviewer-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const base = git(repoRoot, 'rev-parse', 'HEAD')
  const walkthrough = run({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'agent-review', '--source', 'branch', '--base-ref', base,
      '--reviewer', 'agent',
      '--slices', walkthroughSlices(['Integration', 'Review the complete integration path.']),
    ],
  })
  const original = readFileSync(walkthrough.logFile, 'utf8')
  assert.match(original, /- Reviewer: agent/)
  assert.equal(run({
    command: 'start-walkthrough', args: [...common, '--log-file', basename(walkthrough.logFile)],
  }).resumed, true)

  const invalid = runRaw({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'invalid-reviewer', '--source', 'working-tree',
      '--reviewer', 'critic',
      '--slices', walkthroughSlices(['Anything', 'Review anything.']),
    ],
  })
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /reviewer must be user or agent/)
  assert.equal(readFileSync(walkthrough.logFile, 'utf8'), original)

  const workingTree = run({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'working-tree-review', '--source', 'working-tree',
      '--reviewer', 'agent',
      '--slices', walkthroughSlices(['Integration', 'Review the current working tree.']),
    ],
  })
  const workingTreeOriginal = readFileSync(workingTree.logFile, 'utf8')
  const invalidRefresh = runRaw({
    command: 'start-walkthrough',
    args: [
      ...common, '--log-file', basename(workingTree.logFile), '--refresh-range',
      '--base-ref', base,
    ],
  })
  assert.equal(invalidRefresh.status, 1)
  assert.match(invalidRefresh.stderr, /refresh-range requires a branch walkthrough/)
  assert.equal(readFileSync(workingTree.logFile, 'utf8'), workingTreeOriginal)
})

test('walkthrough branch provenance records the merge base and comparison range', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-walkthrough-branch-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  createTopic({ repoRoot, workflowRoot })
  const base = git(repoRoot, 'rev-parse', 'HEAD')
  writeFileSync(join(repoRoot, 'README.md'), '# Updated\n')
  git(repoRoot, 'add', 'README.md')
  git(repoRoot, 'commit', '-m', 'test: add walkthrough change')
  const head = git(repoRoot, 'rev-parse', 'HEAD')
  const result = run({
    command: 'start-walkthrough',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one',
      '--slug', 'branch-change', '--source', 'branch', '--base-ref', base,
      '--slices', walkthroughSlices(['Hook behavior', 'Review the packaged hook lifecycle.']),
    ],
  })
  const log = readFileSync(result.logFile, 'utf8')
  assert.equal(result.base, base)
  assert.equal(result.head, head)
  assert.equal(result.range, `${base}...${head}`)
  assert.match(log, new RegExp(`- Base: ${base}`))
  assert.match(log, new RegExp(`- Range: ${base}\\.\\.\\.${head}`))

  writeFileSync(join(repoRoot, 'CHANGELOG.md'), '# More changes\n')
  git(repoRoot, 'add', 'CHANGELOG.md')
  git(repoRoot, 'commit', '-m', 'test: add correction change')
  const refreshedHead = git(repoRoot, 'rev-parse', 'HEAD')
  const refreshed = run({
    command: 'start-walkthrough',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one',
      '--log-file', basename(result.logFile), '--refresh-range', '--base-ref', base,
    ],
  })
  assert.equal(refreshed.resumed, true)
  assert.equal(refreshed.refreshed, true)
  assert.equal(refreshed.base, base)
  assert.equal(refreshed.head, refreshedHead)
  assert.equal(refreshed.range, `${base}...${refreshedHead}`)
  const refreshedLog = readFileSync(result.logFile, 'utf8')
  assert.match(refreshedLog, new RegExp(`- Head: ${refreshedHead}`))
  assert.match(refreshedLog, new RegExp(`- Range: ${base}\\.\\.\\.${refreshedHead}`))
  assert.doesNotMatch(refreshedLog, new RegExp(`- Head: ${head}`))

  git(repoRoot, 'checkout', '-b', 'feat/other')
  const beforeSpoof = readFileSync(result.logFile, 'utf8')
  const spoofedBranch = runRaw({
    command: 'start-walkthrough',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one',
      '--branch', 'feat/example', '--log-file', basename(result.logFile),
      '--refresh-range', '--base-ref', base,
    ],
  })
  assert.equal(spoofedBranch.status, 1)
  assert.match(spoofedBranch.stderr, /refresh-range requires the walkthrough branch checkout/)
  assert.equal(readFileSync(result.logFile, 'utf8'), beforeSpoof)

  git(repoRoot, 'checkout', '--detach')
  const detached = runRaw({
    command: 'start-walkthrough',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one',
      '--slug', 'detached-branch', '--source', 'branch', '--base-ref', base,
      '--slices', walkthroughSlices(['Anything', 'Review anything.']),
    ],
  })
  assert.equal(detached.status, 1)
  assert.match(detached.stderr, /branch walkthrough requires a named branch checkout/)

  const forbidden = runRaw({
    command: 'start-walkthrough',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one',
      '--slug', 'invalid', '--source', 'last-turn', '--base-ref', base,
      '--slices', walkthroughSlices(['Anything', 'Review anything.']),
    ],
  })
  assert.equal(forbidden.status, 1)
  assert.match(forbidden.stderr, /base-ref is only valid/)

  const legacyTopic = createTopic({
    repoRoot, workflowRoot, id: 'legacy-topic', title: 'Legacy topic',
  })
  execFileSync('rmdir', [legacyTopic.paths.walkthroughsRoot])
  const unsafeBranch = runRaw({
    command: 'start-walkthrough',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'legacy-topic',
      '--branch', '/private/tmp/repository', '--slug', 'unsafe-branch',
      '--source', 'last-turn', '--slices', walkthroughSlices(['Anything', 'Review anything.']),
    ],
  })
  assert.equal(unsafeBranch.status, 1)
  assert.match(unsafeBranch.stderr, /not a valid branch name/)
  assert.equal(existsSync(legacyTopic.paths.walkthroughsRoot), false)
})

test('walkthrough updates the summary table, appends entries, and derives the next slice', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-walkthrough-update-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const walkthrough = run({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'automatic-learning', '--source', 'last-turn',
      '--slices', walkthroughSlices(
        ['Lifecycle contract', 'Review the end-of-task evaluation contract.'],
        ['Hook safety', 'Review privacy and failure boundaries.'],
      ),
    ],
  })
  const updated = run({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile), '--slice', 'Lifecycle contract', '--status', 'covered',
      '--summary', 'The hook requests one evaluation.', '--evidence', 'hooks.json and its adapter.',
      '--decision', 'Do not show a skip notice.',
    ],
  })
  assert.equal(updated.slice, 1)
  const log = readFileSync(walkthrough.logFile, 'utf8')
  assert.match(log, /\| Lifecycle contract \| Review the end-of-task evaluation contract\. \| covered \|/)
  assert.match(log, /\| Hook safety \| Review privacy and failure boundaries\. \| unresolved \|/)
  assert.match(log, /## Running log\n\n### Entry 1\n\n- Slice: Lifecycle contract\n- Status: covered/)
  assert.match(log, /- Decision: Do not show a skip notice\./)
  assert.match(log, /- Corrections: none/)
  assert.match(log, /## Next slice\n\nHook safety/)

  const completed = run({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile), '--slice', 'Hook safety', '--status', 'changed',
      '--summary', 'The adapter omits sensitive input.', '--evidence', 'The lifecycle adapter tests.',
      '--decision', 'Keep the privacy boundary.',
    ],
  })
  assert.equal(completed.slice, 2)
  assert.equal(completed.nextSlice, 'complete')
  const completeLog = readFileSync(walkthrough.logFile, 'utf8')
  assert.match(completeLog, /\| Hook safety \| Review privacy and failure boundaries\. \| changed \|/)
  assert.match(completeLog, /### Entry 2\n\n- Slice: Hook safety\n- Status: changed/)
  assert.match(completeLog, /## Next slice\n\ncomplete/)
})

test('walkthrough logs corrections and updates their status', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-walkthrough-corrections-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const walkthrough = run({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'corrections', '--source', 'working-tree',
      '--slices', walkthroughSlices(['Error handling', 'Review failure behavior.']),
    ],
  })

  assert.match(
    readFileSync(walkthrough.logFile, 'utf8'),
    /## Corrections\n\n\| ID \| Slice \| Correction \| Status \|/,
  )

  const terminalCreation = runRaw({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Error handling', '--status', 'unresolved',
      '--summary', 'The error path drops context.', '--evidence', 'The catch block.',
      '--decision', 'Correct the error message.',
      '--correction', 'Preserve the original error context.', '--correction-status', 'resolved',
    ],
  })
  assert.equal(terminalCreation.status, 1)
  assert.match(terminalCreation.stderr, /correction-status must be open when creating a correction/)

  const identified = run({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Error handling', '--status', 'covered',
      '--summary', 'The error path drops context.', '--evidence', 'The catch block.',
      '--decision', 'Correct the error message.',
      '--correction', 'Preserve the original error context.', '--correction-status', 'open',
    ],
  })
  assert.equal(identified.correctionId, 'C1')
  assert.equal(identified.nextSlice, 'Error handling')
  const identifiedLog = readFileSync(walkthrough.logFile, 'utf8')
  assert.match(
    identifiedLog,
    /\| C1 \| Error handling \| Preserve the original error context\. \| open \|/,
  )
  assert.match(identifiedLog, /- Corrections: C1/)

  const openUpdate = runRaw({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Error handling', '--status', 'unresolved',
      '--summary', 'The correction remains open.', '--evidence', 'No implementation exists.',
      '--decision', 'Keep the correction open.',
      '--correction-id', 'C1', '--correction-status', 'open',
    ],
  })
  assert.equal(openUpdate.status, 1)
  assert.match(openUpdate.stderr, /correction-status must be resolved or deferred when updating a correction/)

  const resolved = run({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Error handling', '--status', 'changed',
      '--summary', 'The error now keeps its context.', '--evidence', 'The focused error-path test.',
      '--decision', 'Accept the correction.',
      '--correction-id', 'C1', '--correction-status', 'resolved',
    ],
  })
  assert.equal(resolved.correctionId, 'C1')
  assert.equal(resolved.nextSlice, 'complete')
  const log = readFileSync(walkthrough.logFile, 'utf8')
  assert.match(log, /\| C1 \| Error handling \| Preserve the original error context\. \| resolved \|/)
  assert.equal((log.match(/- Corrections: C1/g) || []).length, 2)
  assert.doesNotMatch(log, /\| C1 .+ \| open \|/)
  assert.equal((log.match(/^\| C1 /gm) || []).length, 1)

  const terminalUpdate = runRaw({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Error handling', '--status', 'changed',
      '--summary', 'The correction remains resolved.', '--evidence', 'The focused error-path test.',
      '--decision', 'Keep the correction resolved.',
      '--correction-id', 'C1', '--correction-status', 'deferred',
    ],
  })
  assert.equal(terminalUpdate.status, 1)
  assert.match(terminalUpdate.stderr, /correction-id must name an open correction/)
  assert.equal(readFileSync(walkthrough.logFile, 'utf8'), log)
})

test('walkthrough rejects a correction update from a different slice without writing', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-walkthrough-cross-slice-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const walkthrough = run({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'cross-slice-correction', '--source', 'working-tree',
      '--slices', walkthroughSlices(
        ['Error handling', 'Review failure behavior.'],
        ['Persistence', 'Review stored state.'],
      ),
    ],
  })
  run({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Error handling', '--status', 'covered',
      '--summary', 'The error path drops context.', '--evidence', 'The catch block.',
      '--decision', 'Correct the error message.',
      '--correction', 'Preserve the original error context.', '--correction-status', 'open',
    ],
  })
  const original = readFileSync(walkthrough.logFile, 'utf8')
  const crossSlice = runRaw({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Persistence', '--status', 'covered',
      '--summary', 'Persistence is correct.', '--evidence', 'The storage test.',
      '--decision', 'Keep the implementation.',
      '--correction-id', 'C1', '--correction-status', 'resolved',
    ],
  })
  assert.equal(crossSlice.status, 1)
  assert.match(crossSlice.stderr, /correction-id must belong to the selected slice/)
  assert.equal(readFileSync(walkthrough.logFile, 'utf8'), original)
})

test('walkthrough resumes legacy logs and adds corrections on the next update', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-walkthrough-legacy-corrections-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const walkthrough = run({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'legacy', '--source', 'last-turn',
      '--slices', walkthroughSlices(['Compatibility', 'Review stored log compatibility.']),
    ],
  })
  const current = readFileSync(walkthrough.logFile, 'utf8')
  const legacy = current
    .replace('\n- Reviewer: user', '')
    .replace(
      '\n## Corrections\n\n| ID | Slice | Correction | Status |\n| --- | --- | --- | --- |\n',
      '',
    )
  writeFileSync(walkthrough.logFile, legacy)

  assert.equal(run({
    command: 'start-walkthrough', args: [...common, '--log-file', basename(walkthrough.logFile)],
  }).resumed, true)

  run({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Compatibility', '--status', 'covered',
      '--summary', 'The legacy log remains valid.', '--evidence', 'The compatibility test.',
      '--decision', 'Keep backward compatibility.',
    ],
  })
  assert.match(readFileSync(walkthrough.logFile, 'utf8'), /## Corrections\n\n\| ID \|/)
})

test('walkthrough accepts the previous next-slice order and normalizes it on update', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-walkthrough-legacy-next-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const walkthrough = run({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'legacy-next', '--source', 'working-tree',
      '--slices', walkthroughSlices(
        ['Error handling', 'Review failure behavior.'],
        ['Persistence', 'Review stored state.'],
      ),
    ],
  })
  run({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Error handling', '--status', 'covered',
      '--summary', 'The error path drops context.', '--evidence', 'The catch block.',
      '--decision', 'Correct the error message.',
      '--correction', 'Preserve the original error context.', '--correction-status', 'open',
    ],
  })
  const legacy = readFileSync(walkthrough.logFile, 'utf8')
    .replace('## Next slice\n\nError handling\n', '## Next slice\n\nPersistence\n')
  writeFileSync(walkthrough.logFile, legacy)

  assert.equal(run({
    command: 'start-walkthrough', args: [...common, '--log-file', basename(walkthrough.logFile)],
  }).resumed, true)

  const normalized = run({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Error handling', '--status', 'changed',
      '--summary', 'The error now keeps context.', '--evidence', 'The focused error-path test.',
      '--decision', 'Accept the correction.',
      '--correction-id', 'C1', '--correction-status', 'resolved',
    ],
  })
  assert.equal(normalized.nextSlice, 'Persistence')
  assert.match(readFileSync(walkthrough.logFile, 'utf8'), /## Next slice\n\nPersistence\n$/)
})

test('walkthrough resume normalizes legacy completion with an open correction', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-walkthrough-legacy-complete-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  createTopic({ repoRoot, workflowRoot })
  const common = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const walkthrough = run({
    command: 'start-walkthrough',
    args: [
      ...common, '--slug', 'legacy-complete', '--source', 'working-tree',
      '--slices', walkthroughSlices(['Error handling', 'Review failure behavior.']),
    ],
  })
  run({
    command: 'update-walkthrough',
    args: [
      ...common, '--log-file', basename(walkthrough.logFile),
      '--slice', 'Error handling', '--status', 'covered',
      '--summary', 'The error path drops context.', '--evidence', 'The catch block.',
      '--decision', 'Correct the error message.',
      '--correction', 'Preserve the original error context.', '--correction-status', 'open',
    ],
  })
  const legacy = readFileSync(walkthrough.logFile, 'utf8')
    .replace('## Next slice\n\nError handling\n', '## Next slice\n\ncomplete\n')
  writeFileSync(walkthrough.logFile, legacy)

  const resumed = run({
    command: 'start-walkthrough', args: [...common, '--log-file', basename(walkthrough.logFile)],
  })
  assert.equal(resumed.resumed, true)
  assert.equal(resumed.normalized, true)
  assert.equal(resumed.nextSlice, 'Error handling')
  assert.match(readFileSync(walkthrough.logFile, 'utf8'), /## Next slice\n\nError handling\n$/)
})

test('walkthrough commands reject malformed, wrong-topic, unsafe, closed, and multiline updates without writes', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-walkthrough-boundaries-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  const firstTopic = createTopic({ repoRoot, workflowRoot })
  const secondTopic = createTopic({ repoRoot, workflowRoot, id: 'topic-two', title: 'Topic two' })
  const first = ['--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-one']
  const walkthrough = run({
    command: 'start-walkthrough',
    args: [
      ...first, '--slug', 'boundaries', '--source', 'last-turn',
      '--slices', walkthroughSlices(['Safety', 'Review validation boundaries.']),
    ],
  })
  const original = readFileSync(walkthrough.logFile, 'utf8')
  const multiline = runRaw({
    command: 'update-walkthrough',
    args: [
      ...first, '--log-file', basename(walkthrough.logFile), '--slice', 'Safety', '--status', 'covered',
      '--summary', 'First line\nSecond line', '--evidence', 'The parser.', '--decision', 'none',
    ],
  })
  assert.equal(multiline.status, 1)
  assert.match(multiline.stderr, /summary must be a single line/)
  assert.equal(readFileSync(walkthrough.logFile, 'utf8'), original)

  const unknownSlice = runRaw({
    command: 'update-walkthrough',
    args: [
      ...first, '--log-file', basename(walkthrough.logFile), '--slice', 'Unknown', '--status', 'covered',
      '--summary', 'Nothing changed.', '--evidence', 'The table.', '--decision', 'none',
    ],
  })
  assert.equal(unknownSlice.status, 1)
  assert.match(unknownSlice.stderr, /slice must match a slice in the walkthrough table/)
  assert.equal(readFileSync(walkthrough.logFile, 'utf8'), original)

  writeFileSync(
    walkthrough.logFile,
    original.replace('Review validation boundaries.', 'Read /Users/example/private/file.md.'),
  )
  const unsafeStoredLog = runRaw({
    command: 'start-walkthrough', args: [...first, '--log-file', basename(walkthrough.logFile)],
  })
  assert.equal(unsafeStoredLog.status, 1)
  assert.match(unsafeStoredLog.stderr, /description contains unsafe walkthrough content/)
  writeFileSync(walkthrough.logFile, original)

  for (const unsafeSummary of [
    'Read /Users/example/private/file.md.',
    'Bearer abcdefghijklmnopqrstuvwxyz',
    'User: copy this transcript line.',
    'Use ```secret code``` here.',
  ]) {
    const unsafe = runRaw({
      command: 'update-walkthrough',
      args: [
        ...first, '--log-file', basename(walkthrough.logFile), '--slice', 'Safety', '--status', 'covered',
        '--summary', unsafeSummary, '--evidence', 'The parser.', '--decision', 'none',
      ],
    })
    assert.equal(unsafe.status, 1)
    assert.match(unsafe.stderr, /summary contains unsafe walkthrough content/)
    assert.equal(readFileSync(walkthrough.logFile, 'utf8'), original)
  }

  const unsafeCorrection = runRaw({
    command: 'update-walkthrough',
    args: [
      ...first, '--log-file', basename(walkthrough.logFile), '--slice', 'Safety', '--status', 'unresolved',
      '--summary', 'A correction is needed.', '--evidence', 'The parser.', '--decision', 'Correct it.',
      '--correction', 'Read /Users/example/private/file.md.', '--correction-status', 'open',
    ],
  })
  assert.equal(unsafeCorrection.status, 1)
  assert.match(unsafeCorrection.stderr, /correction contains unsafe walkthrough content/)
  assert.equal(readFileSync(walkthrough.logFile, 'utf8'), original)

  const missingCorrectionStatus = runRaw({
    command: 'update-walkthrough',
    args: [
      ...first, '--log-file', basename(walkthrough.logFile), '--slice', 'Safety', '--status', 'unresolved',
      '--summary', 'A correction is needed.', '--evidence', 'The parser.', '--decision', 'Correct it.',
      '--correction', 'Preserve the error context.',
    ],
  })
  assert.equal(missingCorrectionStatus.status, 1)
  assert.match(missingCorrectionStatus.stderr, /correction-status is required/)
  assert.equal(readFileSync(walkthrough.logFile, 'utf8'), original)

  const unknownCorrection = runRaw({
    command: 'update-walkthrough',
    args: [
      ...first, '--log-file', basename(walkthrough.logFile), '--slice', 'Safety', '--status', 'unresolved',
      '--summary', 'Nothing changed.', '--evidence', 'The parser.', '--decision', 'none',
      '--correction-id', 'C99', '--correction-status', 'resolved',
    ],
  })
  assert.equal(unknownCorrection.status, 1)
  assert.match(unknownCorrection.stderr, /correction-id must match a correction/)
  assert.equal(readFileSync(walkthrough.logFile, 'utf8'), original)

  const originalFiles = readdirSync(firstTopic.paths.walkthroughsRoot)
  const unsafeBranch = runRaw({
    command: 'start-walkthrough',
    args: [
      ...first, '--branch', '/Users/example/private-branch', '--slug', 'unsafe-branch',
      '--source', 'last-turn', '--slices', walkthroughSlices(['Safety', 'Review validation boundaries.']),
    ],
  })
  assert.equal(unsafeBranch.status, 1)
  assert.match(unsafeBranch.stderr, /branch contains unsafe walkthrough content/)
  assert.deepEqual(readdirSync(firstTopic.paths.walkthroughsRoot), originalFiles)

  for (const invalidSlices of [
    'not-json',
    '[]',
    walkthroughSlices(['Duplicate', 'First description.'], ['Duplicate', 'Second description.']),
    walkthroughSlices(['complete', 'Reserved terminal value.']),
    walkthroughSlices(['Unsafe', 'Read /Users/example/private/file.md.']),
    walkthroughSlices(['Unsafe link', '[local file](/Users/example/private/file.md)']),
    walkthroughSlices(['Unsafe assignment', 'path=/home/example/private/file.md']),
    walkthroughSlices(['Broken | table', 'Review the table.']),
  ]) {
    const invalid = runRaw({
      command: 'start-walkthrough',
      args: [...first, '--slug', 'invalid-slices', '--source', 'last-turn', '--slices', invalidSlices],
    })
    assert.equal(invalid.status, 1)
    assert.deepEqual(readdirSync(firstTopic.paths.walkthroughsRoot), originalFiles)
  }

  const traversal = runRaw({
    command: 'start-walkthrough', args: [...first, '--log-file', `../${basename(walkthrough.logFile)}`],
  })
  assert.equal(traversal.status, 1)
  assert.match(traversal.stderr, /log-file must name an existing walkthrough log/)

  writeFileSync(
    walkthrough.logFile,
    original.replace('- Branch: feat/example', '- Branch: /Users/example/private-branch'),
  )
  const unsafeStoredBranch = runRaw({
    command: 'start-walkthrough', args: [...first, '--log-file', basename(walkthrough.logFile)],
  })
  assert.equal(unsafeStoredBranch.status, 1)
  assert.match(unsafeStoredBranch.stderr, /branch contains unsafe walkthrough content/)
  writeFileSync(walkthrough.logFile, original)

  writeFileSync(
    walkthrough.logFile,
    original.replace('- Branch: feat/example', '- Branch: invalid branch'),
  )
  const invalidStoredBranch = runRaw({
    command: 'start-walkthrough', args: [...first, '--log-file', basename(walkthrough.logFile)],
  })
  assert.equal(invalidStoredBranch.status, 1)
  assert.match(invalidStoredBranch.stderr, /not a valid branch name/)
  writeFileSync(walkthrough.logFile, original)

  const malformedName = basename(walkthrough.logFile).replace('-01-', '-99-')
  writeFileSync(join(firstTopic.paths.walkthroughsRoot, malformedName), '# Walkthrough: malformed\n')
  const malformed = runRaw({
    command: 'start-walkthrough', args: [...first, '--log-file', malformedName],
  })
  assert.equal(malformed.status, 1)
  assert.match(malformed.stderr, /not a valid walkthrough log for this topic/)
  unlinkSync(join(firstTopic.paths.walkthroughsRoot, malformedName))

  const secondLog = join(secondTopic.paths.walkthroughsRoot, basename(walkthrough.logFile))
  writeFileSync(secondLog, original)
  const wrongTopic = runRaw({
    command: 'update-walkthrough',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot, '--topic-id', 'topic-two',
      '--log-file', basename(secondLog), '--slice', 'Safety', '--status', 'covered',
      '--summary', 'Works.', '--evidence', 'The parser.', '--decision', 'none',
    ],
  })
  assert.equal(wrongTopic.status, 1)
  assert.match(wrongTopic.stderr, /not a valid walkthrough log for this topic/)

  const secondRepo = createRepo({
    parent: root, name: 'second-repo', remote: 'git@github.com:example/second-repository.git',
  })
  initializeWorkflow({ repoRoot: secondRepo, workflowRoot })
  run({
    command: 'attach-topic',
    args: [
      '--repo-root', secondRepo, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--confirm',
    ],
  })
  const wrongRepository = runRaw({
    command: 'update-walkthrough',
    args: [
      '--repo-root', secondRepo, '--workflow-root', workflowRoot, '--topic-id', 'topic-one',
      '--log-file', basename(walkthrough.logFile), '--slice', 'Safety', '--status', 'covered',
      '--summary', 'Works.', '--evidence', 'The parser.', '--decision', 'none',
    ],
  })
  assert.equal(wrongRepository.status, 1)
  assert.match(wrongRepository.stderr, /not a valid walkthrough log for this topic/)

  run({ command: 'abandon-topic', args: [...first, '--reason', 'Work stopped'] })
  const closed = runRaw({
    command: 'start-walkthrough',
    args: [
      ...first, '--slug', 'closed-topic', '--source', 'last-turn',
      '--slices', walkthroughSlices(['Anything', 'Review anything.']),
    ],
  })
  assert.equal(closed.status, 1)
  assert.match(closed.stderr, /must be reopened before changing walkthrough logs/)
})

test('configure-ticket-system stays idempotent and rejects conflicts', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-ticket-system-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  const paths = initializeWorkflow({ repoRoot, workflowRoot })
  const args = [
    '--repo-root', repoRoot, '--workflow-root', workflowRoot,
    '--system', 'jira', '--project', 'MA', '--base-url', 'https://example.atlassian.net',
  ]
  const result = run({ command: 'configure-ticket-system', args })
  assert.equal(result.externalTicketSystem.system, 'jira')
  const original = readFileSync(paths.configFile, 'utf8')
  run({ command: 'configure-ticket-system', args })
  assert.equal(readFileSync(paths.configFile, 'utf8'), original)
  const conflict = runRaw({
    command: 'configure-ticket-system',
    args: args.map((value) => value === 'MA' ? 'OTHER' : value),
  })
  assert.equal(conflict.status, 1)
  assert.match(conflict.stderr, /conflicts with the existing project configuration/)
})

test('topic mutations respect the shared lock and clean it after failures', () => {
  const root = mkdtempSync(join(tmpdir(), 'engineering-workflow-lock-'))
  const repoRoot = createRepo({ parent: root })
  const workflowRoot = join(root, 'workflow')
  initializeWorkflow({ repoRoot, workflowRoot })
  mkdirSync(join(workflowRoot, '.topics.lock'))
  const locked = runRaw({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--title', 'Topic one', '--confirm',
    ],
  })
  assert.equal(locked.status, 1)
  assert.match(locked.stderr, /topics are being updated/)
  execFileSync('rmdir', [join(workflowRoot, '.topics.lock')])
  const invalid = runRaw({
    command: 'init-topic',
    args: [
      '--repo-root', repoRoot, '--workflow-root', workflowRoot,
      '--topic-id', 'topic-one', '--title', ' ', '--confirm',
    ],
  })
  assert.equal(invalid.status, 1)
  assert.equal(existsSync(join(workflowRoot, '.topics.lock')), false)
})

test('the utility does not expose repository migration logic', () => {
  const result = runRaw({ command: 'migrate-ledgers' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Usage:/)
})
