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

const submit = ({ repoRoot, guideRoot, input, expectFailure = false }) => {
  const inputFile = join(guideRoot, `submission-${Math.random().toString(16).slice(2)}.json`)
  writeFileSync(inputFile, `${JSON.stringify(input)}\n`)
  return run({
    command: 'submit',
    repoRoot,
    guideRoot,
    args: ['--input', inputFile],
    expectFailure,
  })
}

const runInputCommand = ({ command, repoRoot, guideRoot, input, expectFailure = false }) => {
  const inputFile = join(guideRoot, `${command}-${Math.random().toString(16).slice(2)}.json`)
  writeFileSync(inputFile, `${JSON.stringify(input)}\n`)
  return run({ command, repoRoot, guideRoot, args: ['--input', inputFile], expectFailure })
}

const initializeMemory = ({ repoRoot, guideRoot }) => {
  const paths = run({ command: 'init', repoRoot, guideRoot })
  run({ command: 'migrate', repoRoot, guideRoot, args: ['--apply'] })
  return paths
}

const replaceCanonicalMemoryJson = ({ paths, memory }) => {
  const marker = '<!-- field-guide-memory-json:v1 -->\n```json\n'
  const markdown = readFileSync(paths.memoryIndexFile, 'utf8')
  const start = markdown.lastIndexOf(marker) + marker.length
  const end = markdown.indexOf('\n```', start)
  const serialized = JSON.stringify(memory, null, 2)
  writeFileSync(paths.memoryIndexFile, `${markdown.slice(0, start)}${serialized}${markdown.slice(end)}`)
  writeFileSync(paths.memoryFile, `${serialized}\n`)
}

const retrieve = ({ repoRoot, guideRoot, subject = 'testing', query, evidenceFor }) => (
  run({
    command: 'retrieve',
    repoRoot,
    guideRoot,
    args: [
      ...(evidenceFor ? ['--evidence-for', evidenceFor] : ['--subject', subject]),
      ...(query ? ['--query', query] : []),
    ],
  }).result
)

const conversationSubmission = ({ learning, turnId, scope = 'project', explicitPreference, generic }) => ({
  schemaVersion: 1,
  decision: 'capture',
  confidence: 'high',
  scope,
  subjectKey: 'testing',
  learning,
  ...(explicitPreference === undefined ? {} : { explicitPreference }),
  ...(generic === undefined ? {} : { generic }),
  evidence: {
    summary: `The user repeated the testing preference in ${turnId}.`,
    pointers: [{ kind: 'conversation', client: 'codex', threadId: 'thread-1', turnId }],
  },
})

test('submit activates an explicit preference and stores sanitized examples', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-explicit-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/explicit.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const input = conversationSubmission({
    learning: 'Prefer parameter objects for configuration inputs.',
    turnId: 'turn-1',
    scope: 'shared',
    explicitPreference: true,
  })
  input.examples = [
    { kind: 'pattern', language: 'ts', code: 'const load = ({ path }: { path: string }) => path' },
    { kind: 'antipattern', language: 'ts', code: 'const load = (path: string, retry: boolean) => path' },
  ]

  const submitted = submit({ repoRoot, guideRoot, input })
  assert.equal(submitted.result.outcome, 'created')
  assert.equal(submitted.result.status, 'active')
  assert.match(submitted.result.evidenceId, /^evidence:v1:/)
  assert.match(submitted.result.sourceKeys[0], /^source:v1:[0-9a-f]{64}$/)
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  assert.equal(memory.guidance[0].examples.length, 2)
  const markdown = readFileSync(paths.memoryIndexFile, 'utf8')
  assert.match(markdown, /Prefer parameter objects/)
  assert.match(markdown, /The user repeated the testing preference/)
  assert.match(markdown, /source:v1:/)
  assert.match(markdown, /explicit-preference/)
  assert.match(readFileSync(paths.rootIndex, 'utf8'), /\]\(memory\.md\)/)
  const reinforcement = conversationSubmission({
    learning: 'Prefer parameter objects for configuration inputs.',
    turnId: 'turn-2',
    scope: 'shared',
  })
  assert.equal(submit({ repoRoot, guideRoot, input: reinforcement }).result.status, 'active')
  run({ command: 'validate', repoRoot, guideRoot })
})

test('submit recovers a stale JSON cache from canonical Markdown', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-cache-recovery-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/cache.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: 'First canonical record.', turnId: 'turn-1' }) })
  writeFileSync(paths.memoryFile, `${JSON.stringify({ schemaVersion: 1, revision: 0, guidance: [], evidence: [] }, null, 2)}\n`)

  submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: 'Second canonical record.', turnId: 'turn-2' }) })
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  assert.equal(memory.guidance.length, 2)
  run({ command: 'validate', repoRoot, guideRoot })
})

test('submit deduplicates one event and promotes a project candidate after a second event', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-reinforce-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/reinforce.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const firstInput = conversationSubmission({ learning: 'Verify keyboard behavior.', turnId: 'turn-1' })

  const first = submit({ repoRoot, guideRoot, input: firstInput })
  assert.equal(first.result.status, 'candidate')
  assert.equal(first.result.independentEvidenceCount, 1)
  const duplicate = submit({ repoRoot, guideRoot, input: firstInput })
  assert.equal(duplicate.result.outcome, 'duplicate-evidence')
  assert.equal(duplicate.result.independentEvidenceCount, 1)

  const second = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: ' verify   keyboard behavior! ', turnId: 'turn-2' }),
  })
  assert.equal(second.result.outcome, 'promoted')
  assert.equal(second.result.previousStatus, 'candidate')
  assert.equal(second.result.status, 'active')
  assert.equal(second.result.independentEvidenceCount, 2)
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  assert.equal(memory.guidance.length, 1)
  assert.equal(memory.evidence.length, 2)
})

test('manual evidence deduplicates but does not satisfy promotion thresholds', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-manual-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/manual.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const input = conversationSubmission({ learning: 'Keep helpers small.', turnId: 'unused' })
  input.evidence = { summary: 'A manual local note.', pointers: [{ kind: 'manual', sourceLabel: 'local note one' }] }
  const first = submit({ repoRoot, guideRoot, input })
  input.evidence = { summary: 'Another manual local note.', pointers: [{ kind: 'manual', sourceLabel: 'local note two' }] }
  const second = submit({ repoRoot, guideRoot, input })
  assert.equal(first.result.independentEvidenceCount, 0)
  assert.equal(second.result.independentEvidenceCount, 0)
  assert.equal(second.result.status, 'candidate')
})

test('shared inferred guidance activates only after evidence from two repositories', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-shared-'))
  const guideRoot = join(root, 'guide')
  const firstRepo = createRepo({ parent: root, name: 'first', remote: 'git@github.com:one/shared.git' })
  const secondRepo = createRepo({ parent: root, name: 'second', remote: 'git@github.com:two/shared.git' })
  initializeMemory({ repoRoot: firstRepo, guideRoot })
  run({ command: 'init', repoRoot: secondRepo, guideRoot })
  const first = submit({
    repoRoot: firstRepo,
    guideRoot,
    input: conversationSubmission({ learning: 'Keep PR descriptions concise.', turnId: 'turn-1', scope: 'shared', generic: true }),
  })
  const second = submit({
    repoRoot: secondRepo,
    guideRoot,
    input: conversationSubmission({ learning: 'Keep PR descriptions concise.', turnId: 'turn-2', scope: 'shared' }),
  })
  assert.equal(first.result.status, 'candidate')
  assert.equal(second.result.status, 'active')
  assert.equal(second.result.promotionReason, 'multi-project-evidence-threshold')
})

test('exact matching uses canonical Unicode normalization without compatibility folding', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-unicode-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/unicode.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: 'Keep the ﬀ token.', turnId: 'turn-1' }) })
  submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: 'Keep the ff token.', turnId: 'turn-2' }) })
  assert.equal(JSON.parse(readFileSync(paths.memoryFile, 'utf8')).guidance.length, 2)
})

test('submit rejects pointer fields and unsafe pointer values as a whole', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-pointer-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/pointer.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const cases = [
    [{ kind: 'conversation', client: 'codex', threadId: 'thread', turnId: 'turn', transcript: 'raw' }, /unsupported field: transcript/],
    [{ kind: 'conversation', client: 'codex', threadId: 'thread', turnId: 'turn', url: 'https://example.com/thread?secret=value' }, /query string/],
    [{ kind: 'conversation', client: 'codex', threadId: `ghp_${'a'.repeat(24)}`, turnId: 'turn' }, /forbidden credential token/],
    [{ kind: 'review', provider: 'github', repositoryIdentity: paths.identity, pullRequestNumber: 1, commentId: 'comment', url: `https://github.com/example/repo/pull/1#ghp_${'a'.repeat(24)}` }, /forbidden credential token/],
    [{ kind: 'review', provider: 'github', repositoryIdentity: paths.identity, pullRequestNumber: 1, commentId: 'comment', url: `https://sk-${'a'.repeat(24)}.example.com/pull/1#comment` }, /forbidden credential token/],
    [{ kind: 'review', provider: 'github', repositoryIdentity: paths.identity, pullRequestNumber: 1, commentId: 'comment', url: 'https://github.com/%252FUsers%252Fexample%252Fsecret/pull/1#comment' }, /must not contain percent encoding/],
    [{ kind: 'local-artifact', repositoryIdentity: paths.identity, path: '/Users/example/code.ts', contentDigest: `sha256:${'a'.repeat(64)}` }, /repository-relative/],
  ]
  for (const [pointer, expected] of cases) {
    const input = conversationSubmission({ learning: 'Reject unsafe pointers.', turnId: 'turn' })
    input.evidence.pointers = [pointer]
    const result = submit({ repoRoot, guideRoot, input, expectFailure: true })
    assert.match(result.stderr, expected)
  }
  assert.deepEqual(JSON.parse(readFileSync(paths.memoryFile, 'utf8')).guidance, [])
})

test('submit fails closed on high-signal sensitive text', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-sensitive-text-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/sensitive-text.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const initial = readFileSync(paths.memoryFile, 'utf8')
  const unsafeValues = [
    'Read /Users/example/private/notes.md before coding.',
    'Use https://example.com/thread?token=secret as evidence.',
    'api_key=not-a-real-key',
    'PASSWORD=not-a-real-secret',
    'Read https://example.com/%252FUsers%252Fexample%252Fprivate.md.',
    'User: retain this raw transcript.',
    '-----BEGIN PRIVATE KEY-----',
  ]

  for (const [index, learning] of unsafeValues.entries()) {
    const result = submit({
      repoRoot,
      guideRoot,
      input: conversationSubmission({ learning, turnId: `turn-${index}` }),
      expectFailure: true,
    })
    assert.match(result.stderr, /contains a forbidden/)
    assert.equal(readFileSync(paths.memoryFile, 'utf8'), initial)
    assert.equal(existsSync(paths.memoryIndexFile), false)
  }
})

test('submit fails closed when pointers map to different evidence events', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-source-conflict-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/source-conflict.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: 'First learning.', turnId: 'turn-1' }) })
  submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: 'Second learning.', turnId: 'turn-2' }) })
  const input = conversationSubmission({ learning: 'Third learning.', turnId: 'unused' })
  input.evidence.pointers = [
    { kind: 'conversation', client: 'codex', threadId: 'thread-1', turnId: 'turn-1' },
    { kind: 'conversation', client: 'codex', threadId: 'thread-1', turnId: 'turn-2' },
  ]
  const result = submit({ repoRoot, guideRoot, input, expectFailure: true })
  assert.match(result.stderr, /conflicting-source-events/)
})

test('submit refuses concurrent writers without changing memory', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-lock-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/lock.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const before = readFileSync(paths.memoryFile, 'utf8')
  writeFileSync(paths.memoryLockFile, 'held\n')
  const result = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Do not race writers.', turnId: 'turn-1' }),
    expectFailure: true,
  })
  assert.match(result.stderr, /locked by another writer/)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), before)
})

test('a confirmed contradiction supersedes active guidance and activates its replacement', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-supersede-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/supersede.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const original = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Extract every helper.', turnId: 'turn-1', explicitPreference: true }),
  }).result
  const replacementInput = conversationSubmission({ learning: 'Keep clear single-use code inline.', turnId: 'turn-2' })
  replacementInput.relationship = { kind: 'contradicts', targetId: original.targetId }
  const replacement = submit({ repoRoot, guideRoot, input: replacementInput }).result
  assert.equal(replacement.status, 'candidate')

  const unconfirmed = runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot,
    input: {
      schemaVersion: 1,
      action: 'supersede',
      targetId: original.targetId,
      replacementId: replacement.targetId,
      reason: 'No confirmation was recorded.',
      source: 'agent',
    },
    expectFailure: true,
  })
  assert.match(unconfirmed.stderr, /confirmed: true/)

  const unrelated = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'An unrelated candidate.', turnId: 'turn-3' }),
  }).result
  const unlinked = runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot,
    input: {
      schemaVersion: 1,
      action: 'supersede',
      targetId: original.targetId,
      replacementId: unrelated.targetId,
      confirmed: true,
      reason: 'The user confirmed a different correction.',
      source: 'user-confirmation',
    },
    expectFailure: true,
  })
  assert.match(unlinked.stderr, /linked refinement or contradiction/)

  const transitioned = runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot,
    input: {
      schemaVersion: 1,
      action: 'supersede',
      targetId: original.targetId,
      replacementId: replacement.targetId,
      confirmed: true,
      reason: 'The user confirmed the same-scope correction.',
      source: 'user-confirmation',
    },
  })
  assert.equal(transitioned.result.status, 'superseded')
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  assert.equal(memory.guidance.find(({ id }) => id === replacement.targetId).status, 'active')
  assert.equal(memory.guidance.find(({ id }) => id === original.targetId).transitions.at(-1).replacementId, replacement.targetId)
  run({ command: 'validate', repoRoot, guideRoot })
})

test('undo is reversible history and permanent deletion requires a current preview', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-delete-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/delete.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const sharedPointer = { kind: 'conversation', client: 'codex', threadId: 'thread-1', turnId: 'turn-1' }
  const firstInput = conversationSubmission({ learning: 'First preference.', turnId: 'unused', explicitPreference: true })
  firstInput.evidence.pointers = [sharedPointer]
  const secondInput = conversationSubmission({ learning: 'Second preference.', turnId: 'unused', explicitPreference: true })
  secondInput.evidence.pointers = [sharedPointer]
  const first = submit({ repoRoot, guideRoot, input: firstInput }).result
  const second = submit({ repoRoot, guideRoot, input: secondInput }).result
  assert.equal(first.evidenceId, second.evidenceId)

  runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot,
    input: {
      schemaVersion: 1,
      action: 'undo',
      targetId: first.targetId,
      reason: 'The user undid this learning.',
      source: 'user',
    },
  })
  const deleteInput = { schemaVersion: 1, targetId: first.targetId }
  const preview = runInputCommand({ command: 'delete', repoRoot, guideRoot, input: deleteInput }).result
  assert.equal(preview.applied, false)
  assert.deepEqual(preview.removedEvidenceIds, [])
  const editedMemory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  editedMemory.evidence[0].summary = 'The user edited this valid canonical summary.'
  replaceCanonicalMemoryJson({ paths, memory: editedMemory })
  const rejected = runInputCommand({
    command: 'delete',
    repoRoot,
    guideRoot,
    input: { ...deleteInput, apply: true, previewToken: preview.previewToken },
    expectFailure: true,
  })
  assert.match(rejected.stderr, /current dry-run previewToken/)
  const refreshedPreview = runInputCommand({ command: 'delete', repoRoot, guideRoot, input: deleteInput }).result
  const applied = runInputCommand({
    command: 'delete',
    repoRoot,
    guideRoot,
    input: { ...deleteInput, apply: true, previewToken: refreshedPreview.previewToken },
  }).result
  assert.equal(applied.applied, true)
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  assert.equal(memory.guidance.some(({ id }) => id === first.targetId), false)
  assert.equal(memory.guidance.some(({ id }) => id === second.targetId), true)
  assert.equal(memory.evidence.some(({ id }) => id === first.evidenceId), true)
})

test('semantic submissions reject inactive relationship targets', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-inactive-target-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/inactive.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const target = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Old preference.', turnId: 'turn-1', explicitPreference: true }),
  }).result
  runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot,
    input: { schemaVersion: 1, action: 'withdraw', targetId: target.targetId, reason: 'Retired.', source: 'user' },
  })
  const input = conversationSubmission({ learning: 'A refinement.', turnId: 'turn-2' })
  input.relationship = { kind: 'refines', targetId: target.targetId }
  const result = submit({ repoRoot, guideRoot, input, expectFailure: true })
  assert.match(result.stderr, /relationship target must be candidate or active/)
})

test('validate rejects illegal lifecycle edges before replacing canonical state', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-illegal-lifecycle-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/illegal-lifecycle.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'An active preference.', turnId: 'turn-1', explicitPreference: true }),
  })
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  memory.guidance[0].transitions.push({
    from: 'active',
    to: 'candidate',
    reason: 'Invalid manual edit.',
    source: 'manual-edit',
    at: new Date().toISOString(),
  })
  memory.guidance[0].status = 'candidate'
  replaceCanonicalMemoryJson({ paths, memory })

  const result = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(result.stderr, /illegal lifecycle transition: active->candidate/)
})

test('validate rejects superseded history without linked replacement provenance', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-unlinked-history-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/unlinked-history.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const first = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'First active preference.', turnId: 'turn-1', explicitPreference: true }),
  }).result
  const second = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Second active preference.', turnId: 'turn-2', explicitPreference: true }),
  }).result
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  const target = memory.guidance.find(({ id }) => id === first.targetId)
  target.transitions.push({
    from: 'active',
    to: 'superseded',
    reason: 'Invalid manual replacement.',
    source: 'manual-edit',
    at: new Date().toISOString(),
    replacementId: second.targetId,
  })
  target.status = 'superseded'
  replaceCanonicalMemoryJson({ paths, memory })

  const result = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(result.stderr, /requires a linked refinement or contradiction/)
})

test('retrieve ranks active project, shared, linked, and applicable guidance without evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-retrieve-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/retrieve.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const projectInput = conversationSubmission({ learning: 'Use project test helpers.', turnId: 'turn-1', explicitPreference: true })
  projectInput.linkedSubjects = ['accessibility']
  submit({ repoRoot, guideRoot, input: projectInput })
  submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Use shared test names.', turnId: 'turn-2', scope: 'shared', explicitPreference: true }),
  })
  const overriddenSharedInput = conversationSubmission({
    learning: 'Use project test helpers.',
    turnId: 'turn-3',
    scope: 'shared',
    explicitPreference: true,
  })
  overriddenSharedInput.linkedSubjects = ['security']
  submit({ repoRoot, guideRoot, input: overriddenSharedInput })
  const linkedInput = conversationSubmission({ learning: 'Check focus order.', turnId: 'turn-4', explicitPreference: true })
  linkedInput.subjectKey = 'accessibility'
  submit({ repoRoot, guideRoot, input: linkedInput })
  const applicableInput = conversationSubmission({ learning: 'Review keyboard coverage.', turnId: 'turn-5', explicitPreference: true })
  applicableInput.subjectKey = 'review'
  submit({ repoRoot, guideRoot, input: applicableInput })
  submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: 'Candidate must stay hidden.', turnId: 'turn-6' }) })
  const otherRepo = createRepo({ parent: root, name: 'other', remote: 'git@github.com:other/retrieve.git' })
  run({ command: 'init', repoRoot: otherRepo, guideRoot })
  const otherProjectInput = conversationSubmission({ learning: 'Other project guidance.', turnId: 'turn-7', explicitPreference: true })
  otherProjectInput.linkedSubjects = ['security']
  submit({ repoRoot: otherRepo, guideRoot, input: otherProjectInput })

  const result = retrieve({ repoRoot, guideRoot, query: 'keyboard behavior' })
  assert.deepEqual(result.guidance.map(({ match }) => match), [
    'project-subject',
    'shared-subject',
    'linked-subject',
    'applicability',
  ])
  assert.equal(result.guidance.some(({ learning }) => learning.includes('Candidate')), false)
  assert.equal(result.guidance.filter(({ learning }) => learning === 'Use project test helpers.').length, 1)
  assert.equal(result.routing.linkedSubjects.includes('security'), false)
  assert.equal(JSON.stringify(result.guidance).includes('evidenceId'), false)
  assert.ok(result.routingBytes <= 2048)
  assert.ok(result.bytes <= 6144)
})

test('retrieve enforces whole-record count and byte budgets', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-retrieve-budget-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/retrieve-budget.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  for (let index = 0; index < 7; index += 1) {
    submit({
      repoRoot,
      guideRoot,
      input: conversationSubmission({ learning: `Active testing preference ${index}.`, turnId: `turn-${index}`, explicitPreference: true }),
    })
  }
  const result = retrieve({ repoRoot, guideRoot })
  assert.equal(result.guidance.length, 5)
  assert.equal(result.omittedCount, 2)
  assert.ok(result.bytes <= 6144)
})

test('explicit evidence expansion returns at most two complete records within six kilobytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-evidence-retrieve-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/evidence-retrieve.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const learning = 'Keep evidence out of normal retrieval.'
  const created = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning, turnId: 'turn-1', explicitPreference: true }),
  }).result
  submit({ repoRoot, guideRoot, input: conversationSubmission({ learning, turnId: 'turn-2' }) })
  submit({ repoRoot, guideRoot, input: conversationSubmission({ learning, turnId: 'turn-3' }) })

  const result = retrieve({ repoRoot, guideRoot, evidenceFor: created.targetId })
  assert.equal(result.evidence.length, 2)
  assert.equal(result.omittedCount, 1)
  assert.ok(result.bytes <= 6144)
  assert.ok(result.evidence.every((evidence) => evidence.pointers.length === 1))
})

test('retrieve accepts version 1 records that predate linked subjects', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-retrieve-compatibility-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/retrieve-compatibility.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'A version one preference.', turnId: 'turn-1', explicitPreference: true }),
  })
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  delete memory.guidance[0].linkedSubjects
  replaceCanonicalMemoryJson({ paths, memory })
  writeFileSync(
    paths.memoryIndexFile,
    readFileSync(paths.memoryIndexFile, 'utf8').replace('- Linked subjects: none\n', ''),
  )

  run({ command: 'validate', repoRoot, guideRoot })
  const result = retrieve({ repoRoot, guideRoot })
  assert.deepEqual(result.guidance[0].linkedSubjects, [])
})

test('retrieve rejects conflicting normal and evidence modes', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-retrieve-mode-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/retrieve-mode.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const created = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'One mode per request.', turnId: 'turn-1', explicitPreference: true }),
  }).result
  const result = run({
    command: 'retrieve',
    repoRoot,
    guideRoot,
    args: ['--evidence-for', created.targetId, '--subject', 'testing'],
    expectFailure: true,
  })
  assert.match(result.stderr, /cannot be combined/)
})

test('candidates returns bounded active and candidate records for semantic matching', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-candidates-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/candidates.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: 'Candidate guidance.', turnId: 'turn-1' }) })
  submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Active guidance.', turnId: 'turn-2', explicitPreference: true }),
  })
  submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Shared guidance.', turnId: 'turn-3', scope: 'shared', explicitPreference: true }),
  })
  const result = run({
    command: 'candidates',
    repoRoot,
    guideRoot,
    args: ['--subject', 'testing', '--scope', 'project'],
  }).result
  assert.deepEqual(result.candidates.map(({ status }) => status).sort(), ['active', 'candidate'])
  assert.equal(JSON.stringify(result.candidates).includes('evidenceId'), false)
  assert.ok(result.bytes <= 6144)
})

test('audit is read-only and reports unresolved relationships and broken local pointers', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-audit-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/audit.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const originalInput = conversationSubmission({ learning: 'Keep the old rule.', turnId: 'unused', explicitPreference: true })
  originalInput.evidence = {
    summary: 'A local artifact was the preference source.',
    pointers: [{
      kind: 'local-artifact',
      repositoryIdentity: paths.identity,
      path: 'missing-preference.md',
      contentDigest: `sha256:${'a'.repeat(64)}`,
    }],
  }
  const original = submit({ repoRoot, guideRoot, input: originalInput }).result
  const contradictionInput = conversationSubmission({ learning: 'Use the new rule.', turnId: 'turn-2' })
  contradictionInput.relationship = { kind: 'contradicts', targetId: original.targetId }
  submit({ repoRoot, guideRoot, input: contradictionInput })
  const before = {
    root: readFileSync(paths.rootIndex, 'utf8'),
    markdown: readFileSync(paths.memoryIndexFile, 'utf8'),
    json: readFileSync(paths.memoryFile, 'utf8'),
  }

  const result = run({ command: 'audit', repoRoot, guideRoot }).result
  assert.equal(result.mode, 'audit')
  assert.equal(result.unresolvedRelationships.length, 1)
  assert.deepEqual(result.brokenPointers.map(({ problem }) => problem), ['missing-local-artifact'])
  assert.equal(readFileSync(paths.rootIndex, 'utf8'), before.root)
  assert.equal(readFileSync(paths.memoryIndexFile, 'utf8'), before.markdown)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), before.json)
})

test('maintain previews archive without writes and requires its current token to apply', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-maintain-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/maintain.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const candidate = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Archive this candidate.', turnId: 'turn-1' }),
  }).result
  const active = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Keep this active.', turnId: 'turn-2', explicitPreference: true }),
  }).result
  const input = {
    schemaVersion: 1,
    action: 'archive',
    targetIds: [candidate.targetId, active.targetId],
    reason: 'The user approved archival after audit.',
  }
  const before = readFileSync(paths.memoryIndexFile, 'utf8')
  const preview = runInputCommand({ command: 'maintain', repoRoot, guideRoot, input }).result
  assert.equal(preview.applied, false)
  assert.equal(readFileSync(paths.memoryIndexFile, 'utf8'), before)
  const stale = runInputCommand({
    command: 'maintain',
    repoRoot,
    guideRoot,
    input: { ...input, apply: true, previewToken: 'maintenance-preview:v1:stale' },
    expectFailure: true,
  })
  assert.match(stale.stderr, /current dry-run previewToken/)
  const changedReason = runInputCommand({
    command: 'maintain',
    repoRoot,
    guideRoot,
    input: {
      ...input,
      reason: 'A different immutable reason.',
      apply: true,
      previewToken: preview.previewToken,
    },
    expectFailure: true,
  })
  assert.match(changedReason.stderr, /current dry-run previewToken/)
  const applied = runInputCommand({
    command: 'maintain',
    repoRoot,
    guideRoot,
    input: { ...input, apply: true, previewToken: preview.previewToken },
  }).result
  assert.equal(applied.applied, true)
  assert.equal(
    JSON.parse(readFileSync(paths.memoryFile, 'utf8')).guidance.find(({ id }) => id === candidate.targetId).status,
    'archived',
  )
  assert.equal(
    JSON.parse(readFileSync(paths.memoryFile, 'utf8')).guidance.find(({ id }) => id === active.targetId).status,
    'archived',
  )
})

test('maintain previews and repairs only the derived JSON cache', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-repair-cache-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/repair-cache.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Keep canonical repair guidance.', turnId: 'turn-1', explicitPreference: true }),
  })
  const canonical = readFileSync(paths.memoryIndexFile, 'utf8')
  writeFileSync(paths.memoryFile, `${JSON.stringify({ schemaVersion: 1, revision: 0, guidance: [], evidence: [] }, null, 2)}\n`)
  const staleCache = readFileSync(paths.memoryFile, 'utf8')
  const input = {
    schemaVersion: 1,
    action: 'repair-cache',
    reason: 'Rebuild the derived cache from validated canonical memory.',
  }
  const preview = runInputCommand({ command: 'maintain', repoRoot, guideRoot, input }).result
  assert.equal(preview.cacheState, 'stale')
  assert.equal(preview.applied, false)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), staleCache)
  const applied = runInputCommand({
    command: 'maintain',
    repoRoot,
    guideRoot,
    input: { ...input, apply: true, previewToken: preview.previewToken },
  }).result
  assert.equal(applied.applied, true)
  assert.equal(JSON.parse(readFileSync(paths.memoryFile, 'utf8')).guidance.length, 1)
  assert.equal(readFileSync(paths.memoryIndexFile, 'utf8'), canonical)
  run({ command: 'validate', repoRoot, guideRoot })

  const validCache = readFileSync(paths.memoryFile, 'utf8')
  writeFileSync(paths.memoryIndexFile, canonical.replace('"schemaVersion": 1,', '"schemaVersion": 1,\n  "unexpected": true,'))
  const malformed = runInputCommand({ command: 'maintain', repoRoot, guideRoot, input, expectFailure: true })
  assert.match(malformed.stderr, /unsupported field: unexpected/)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), validCache)
})

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
  assert.match(nestedResult.stderr, /guidance record must be an object/)
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
