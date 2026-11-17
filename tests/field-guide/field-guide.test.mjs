import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { fieldGuideSkillRoot } from './plugin-paths.mjs'

const skillRoot = fieldGuideSkillRoot
const script = fileURLToPath(new URL('scripts/field-guide.mjs', skillRoot))
const launcher = fileURLToPath(new URL('scripts/field-guide.sh', skillRoot))
const memorySchema = JSON.parse(readFileSync(fileURLToPath(new URL('schemas/memory-v1.schema.json', skillRoot)), 'utf8'))
const retrievalSchema = JSON.parse(readFileSync(fileURLToPath(new URL('schemas/retrieval-v1.schema.json', skillRoot)), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false })
ajv.addSchema(memorySchema)
const validateRetrieval = ajv.compile(retrievalSchema)
// The UserPromptSubmit hook is the only caller that confirms guidance; tests call it directly.
const { confirmFromPrompt, promptInjection } = await import(new URL('scripts/field-guide.mjs', skillRoot))

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

// T3CODE_THREAD_ID is unset unless a test sets it, so the CLI sees a main thread.
const run = ({ command, repoRoot, guideRoot, args = [], expectFailure = false, env = {}, cli = script }) => {
  const result = spawnSync(
    process.execPath,
    [cli, command, '--repo-root', repoRoot, '--guide-root', guideRoot, ...args],
    { encoding: 'utf8', env: { ...process.env, T3CODE_THREAD_ID: undefined, ...env } },
  )

  if (expectFailure) {
    assert.notEqual(result.status, 0)
    return result
  }

  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

const submit = ({ repoRoot, guideRoot, input, expectFailure = false, cli }) => {
  const inputFile = join(guideRoot, `submission-${Math.random().toString(16).slice(2)}.json`)
  writeFileSync(inputFile, `${JSON.stringify(input)}\n`)
  return run({
    command: 'submit',
    repoRoot,
    guideRoot,
    args: ['--input', inputFile],
    expectFailure,
    cli,
  })
}

const runInputCommand = ({ command, repoRoot, guideRoot, input, expectFailure = false, cli }) => {
  const inputFile = join(guideRoot, `${command}-${Math.random().toString(16).slice(2)}.json`)
  writeFileSync(inputFile, `${JSON.stringify(input)}\n`)
  return run({ command, repoRoot, guideRoot, args: ['--input', inputFile], expectFailure, cli })
}

const initializeMemory = ({ repoRoot, guideRoot }) => {
  return run({ command: 'init', repoRoot, guideRoot })
}

test('the shell launcher resolves the standalone plugin Node runner', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-launcher-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'git@github.com:example/launcher-repo.git',
  })
  const guideRoot = join(root, 'guide')
  const result = spawnSync('/bin/sh', [
    launcher,
    'init',
    '--repo-root',
    repoRoot,
    '--guide-root',
    guideRoot,
  ], { encoding: 'utf8' })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).guideRoot, guideRoot)
})

const replaceCanonicalMemoryJson = ({ paths, memory }) => {
  const marker = '<!-- field-guide-memory-json:v1 -->\n```json\n'
  const markdown = readFileSync(paths.memoryIndexFile, 'utf8')
  const start = markdown.lastIndexOf(marker) + marker.length
  const end = markdown.indexOf('\n```', start)
  const serialized = JSON.stringify(memory, null, 2)
  writeFileSync(paths.memoryIndexFile, `${markdown.slice(0, start)}${serialized}${markdown.slice(end)}`)
  writeFileSync(paths.memoryFile, `${serialized}\n`)
}

const retrieve = ({ repoRoot, guideRoot, subject, query, evidenceFor }) => (
  run({
    command: 'retrieve',
    repoRoot,
    guideRoot,
    args: [
      ...(evidenceFor ? ['--evidence-for', evidenceFor] : []),
      ...(subject ? ['--subject', subject] : []),
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

// Submits active guidance and a contradicting replacement, then supersedes the first with the second.
const supersedeWithContradiction = ({ repoRoot, guideRoot, scope = 'project', replacementExplicitPreference }) => {
  const original = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Extract every helper.', turnId: 'turn-1', scope, explicitPreference: true }),
  }).result
  const replacementInput = conversationSubmission({
    learning: 'Keep single-use code inline.',
    turnId: 'turn-2',
    scope,
    explicitPreference: replacementExplicitPreference,
  })
  replacementInput.relationship = { kind: 'contradicts', targetId: original.targetId }
  const replacement = submit({ repoRoot, guideRoot, input: replacementInput }).result
  runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot,
    input: {
      schemaVersion: 1,
      action: 'supersede',
      targetId: original.targetId,
      replacementId: replacement.targetId,
      confirmed: true,
      reason: 'The user confirmed the correction.',
      source: 'user-confirmation',
    },
  })
  return { original, replacement }
}

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

test('submit accepts inline JSON without a temporary input file', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-inline-submit-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/inline-submit.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const input = conversationSubmission({
    learning: 'Run focused tests before broad suites.',
    turnId: 'turn-inline',
    explicitPreference: true,
  })

  const result = run({
    command: 'submit',
    repoRoot,
    guideRoot,
    args: ['--input-json', JSON.stringify(input)],
  }).result

  assert.equal(result.status, 'active')
  const memory = JSON.parse(readFileSync(join(guideRoot, 'memory.json'), 'utf8'))
  assert.equal(memory.guidance.find(({ id }) => id === result.targetId).learning, input.learning)
})

test('commands reject duplicate options instead of overriding fixed paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-duplicate-options-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/duplicates.git' })
  const guideRoot = join(root, 'guide')

  const result = run({
    command: 'paths',
    repoRoot,
    guideRoot,
    args: ['--guide-root', join(root, 'alternate-guide')],
    expectFailure: true,
  })

  assert.match(result.stderr, /Duplicate option: --guide-root/)
})

test('commands reject conflicting or unsupported inline input options', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-input-options-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/input-options.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const input = conversationSubmission({ learning: 'Use one input source.', turnId: 'turn-options' })
  const inputJson = JSON.stringify(input)
  const inputFile = join(root, 'submission.json')
  writeFileSync(inputFile, `${inputJson}\n`)

  const conflicting = run({
    command: 'submit',
    repoRoot,
    guideRoot,
    args: ['--input', inputFile, '--input-json', inputJson],
    expectFailure: true,
  })
  assert.match(conflicting.stderr, /use either --input or --input-json/)

  const duplicateInline = run({
    command: 'submit',
    repoRoot,
    guideRoot,
    args: ['--input-json', inputJson, '--input-json', inputJson],
    expectFailure: true,
  })
  assert.match(duplicateInline.stderr, /Duplicate option: --input-json/)

  const unsupported = run({
    command: 'paths',
    repoRoot,
    guideRoot,
    args: ['--input-json', inputJson],
    expectFailure: true,
  })
  assert.match(unsupported.stderr, /--input-json is supported only for submit/)
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
  const initialCanonical = readFileSync(paths.memoryIndexFile, 'utf8')
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
    assert.equal(readFileSync(paths.memoryIndexFile, 'utf8'), initialCanonical)
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

test('undoing a replacement withdraws it and restores the guidance it superseded', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-undo-replacement-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/undo-replacement.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const { original, replacement } = supersedeWithContradiction({ repoRoot, guideRoot, replacementExplicitPreference: true })

  const undone = runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot,
    input: { schemaVersion: 1, action: 'undo', targetId: replacement.targetId, reason: 'The user undid this learning.', source: 'user' },
  }).result
  assert.equal(undone.status, 'withdrawn')
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  const restored = memory.guidance.find(({ id }) => id === original.targetId)
  assert.equal(restored.status, 'active')
  assert.deepEqual(
    restored.transitions.map(({ from, to }) => `${from}->${to}`),
    ['null->active', 'active->superseded', 'superseded->active'],
  )
  assert.equal(memory.guidance.find(({ id }) => id === replacement.targetId).status, 'withdrawn')
  run({ command: 'validate', repoRoot, guideRoot })
  assert.deepEqual(retrieve({ repoRoot, guideRoot, subject: 'testing' }).guidance.map(({ id }) => id), [original.targetId])
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

test('validate rejects restoring superseded guidance while its replacement stays active', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-restore-without-withdrawal-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/restore-without-withdrawal.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const { original } = supersedeWithContradiction({ repoRoot, guideRoot, replacementExplicitPreference: true })
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  const superseded = memory.guidance.find(({ id }) => id === original.targetId)
  superseded.transitions.push({
    from: 'superseded',
    to: 'active',
    reason: 'Invalid manual edit.',
    source: 'manual-edit',
    at: new Date().toISOString(),
  })
  superseded.status = 'active'
  replaceCanonicalMemoryJson({ paths, memory })

  const result = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(result.stderr, /restoration requires its replacement to be withdrawn/)
})

test('validate guards moving superseded guidance to withdrawn', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-superseded-withdrawn-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/superseded-withdrawn.git' })
  const superseded = ({ name, undo }) => {
    const guideRoot = join(root, name)
    const paths = initializeMemory({ repoRoot, guideRoot })
    const { original, replacement } = supersedeWithContradiction({ repoRoot, guideRoot, scope: 'shared', replacementExplicitPreference: true })
    if (undo) {
      runInputCommand({
        command: 'transition',
        repoRoot,
        guideRoot,
        input: { schemaVersion: 1, action: 'undo', targetId: replacement.targetId, reason: 'The user undid this learning.', source: 'user' },
      })
    }
    const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
    return { guideRoot, paths, memory, guidance: memory.guidance.find(({ id }) => id === original.targetId) }
  }
  const moveToWithdrawn = ({ paths, memory, guidance }) => {
    if (guidance.status === 'active') guidance.transitions.pop()
    guidance.transitions.push({ from: 'superseded', to: 'withdrawn', reason: 'Invalid manual edit.', source: 'manual-edit', at: new Date().toISOString() })
    guidance.status = 'withdrawn'
    replaceCanonicalMemoryJson({ paths, memory })
  }

  // The replacement is still active.
  const replacementActive = superseded({ name: 'replacement-active', undo: false })
  moveToWithdrawn(replacementActive)
  assert.match(run({ command: 'validate', repoRoot, guideRoot: replacementActive.guideRoot, expectFailure: true }).stderr, /superseded->withdrawn requires its replacement to be withdrawn/)

  // The undo acknowledged the only retirement, so the record had to return to active.
  const nothingOutstanding = superseded({ name: 'nothing-outstanding', undo: true })
  moveToWithdrawn(nothingOutstanding)
  assert.match(run({ command: 'validate', repoRoot, guideRoot: nothingOutstanding.guideRoot, expectFailure: true }).stderr, /superseded->withdrawn requires an outstanding retirement/)
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

  const result = retrieve({ repoRoot, guideRoot, subject: 'testing', query: 'keyboard coverage' })
  assert.equal(validateRetrieval(result), true, JSON.stringify(validateRetrieval.errors))
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

test('retrieve uses a concrete query without requiring a subject hint', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-query-only-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/query-only.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const preferredInput = conversationSubmission({
    learning: 'Prefer destructured object parameters for configuration-style inputs.',
    turnId: 'turn-1',
    scope: 'shared',
    explicitPreference: true,
  })
  preferredInput.subjectKey = 'code-clarity'
  submit({ repoRoot, guideRoot, input: preferredInput })
  const unrelatedInput = conversationSubmission({
    learning: 'Keep corrections separate from task summaries.',
    turnId: 'turn-2',
    scope: 'shared',
    explicitPreference: true,
  })
  unrelatedInput.subjectKey = 'walkthrough-logs'
  submit({ repoRoot, guideRoot, input: unrelatedInput })
  const projectDuplicate = conversationSubmission({
    learning: preferredInput.learning,
    turnId: 'turn-3',
    explicitPreference: true,
  })
  projectDuplicate.subjectKey = preferredInput.subjectKey
  submit({ repoRoot, guideRoot, input: projectDuplicate })

  const result = retrieve({
    repoRoot,
    guideRoot,
    query: 'function signatures and destructured object parameters',
  })

  assert.equal(validateRetrieval(result), true, JSON.stringify(validateRetrieval.errors))
  assert.equal(result.routing.subjectKey, null)
  assert.deepEqual(result.guidance.map(({ learning }) => learning), [preferredInput.learning])
  assert.equal(result.guidance[0].scope.kind, 'project')
  assert.equal(result.guidance[0].match, 'applicability')

  const subjectResult = retrieve({ repoRoot, guideRoot, query: 'reorganize walkthrough formatting' })
  assert.deepEqual(subjectResult.guidance, [])

  const singleLearningTermResult = retrieve({ repoRoot, guideRoot, query: 'reorganize object formatting' })
  assert.deepEqual(singleLearningTermResult.guidance, [])

  const genericResult = retrieve({
    repoRoot,
    guideRoot,
    query: 'durable preference and correction guidance',
  })
  assert.deepEqual(genericResult.guidance, [])

  const functionWordsInput = conversationSubmission({
    learning: 'Explain what each function does before you change it.',
    turnId: 'turn-4',
    scope: 'shared',
    explicitPreference: true,
  })
  functionWordsInput.subjectKey = 'explanations'
  submit({ repoRoot, guideRoot, input: functionWordsInput })
  // Shared function words alone are not a topic match.
  assert.deepEqual(retrieve({ repoRoot, guideRoot, query: 'what does each test cover' }).guidance, [])
})

test('retrieve requires a subject hint or a concrete query', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-retrieve-input-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/retrieve-input.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })

  const result = run({ command: 'retrieve', repoRoot, guideRoot, expectFailure: true })
  assert.match(result.stderr, /requires --subject or --query/)
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
  const result = retrieve({ repoRoot, guideRoot, subject: 'testing' })
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

test('retrieve accepts version 1 records that predate linked subjects and examples', () => {
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
  delete memory.guidance[0].examples
  replaceCanonicalMemoryJson({ paths, memory })
  writeFileSync(
    paths.memoryIndexFile,
    readFileSync(paths.memoryIndexFile, 'utf8').replace('- Linked subjects: none\n', ''),
  )

  run({ command: 'validate', repoRoot, guideRoot })
  const result = retrieve({ repoRoot, guideRoot, subject: 'testing' })
  assert.deepEqual(result.guidance[0].linkedSubjects, [])
  assert.deepEqual(result.guidance[0].examples, [])
  assert.equal(validateRetrieval(result), true, JSON.stringify(validateRetrieval.errors))

  const queryResult = retrieve({ repoRoot, guideRoot, query: 'version one' })
  assert.equal(queryResult.guidance[0].learning, 'A version one preference.')
  assert.deepEqual(queryResult.guidance[0].examples, [])
  assert.equal(validateRetrieval(queryResult), true, JSON.stringify(validateRetrieval.errors))
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

test('validate refuses invalid review evidence without changing memory', () => {
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

  const canonicalMemory = readFileSync(paths.memoryIndexFile, 'utf8')
  const cachedMemory = readFileSync(paths.memoryFile, 'utf8')
  const result = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(result.stderr, /unknown commit/)
  assert.equal(readFileSync(paths.memoryIndexFile, 'utf8'), canonicalMemory)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), cachedMemory)
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
  assert.ok(existsSync(paths.memoryIndexFile))
  assert.ok(existsSync(paths.memoryFile))
  assert.match(readFileSync(paths.rootIndex, 'utf8'), /\]\(projects\/shared-repo\/init\.md\)/)
  assert.match(readFileSync(paths.rootIndex, 'utf8'), /\]\(memory\.md\)/)
  assert.match(readFileSync(paths.memoryIndexFile, 'utf8'), /field-guide-memory-json:v1/)
  assert.deepEqual(JSON.parse(readFileSync(paths.memoryFile, 'utf8')), {
    schemaVersion: 1,
    revision: 0,
    guidance: [],
    evidence: [],
  })
  const projectIndex = readFileSync(paths.projectIndex, 'utf8')
  assert.ok(projectIndex.indexOf('](patterns.md)') < projectIndex.indexOf('## Review evidence'))

  const canonicalMemory = readFileSync(paths.memoryIndexFile, 'utf8')
  const memoryCache = readFileSync(paths.memoryFile, 'utf8')
  appendFileSync(paths.patternsFile, '\nCustom guidance.\n')
  run({ command: 'init', repoRoot, guideRoot })
  assert.match(readFileSync(paths.patternsFile, 'utf8'), /Custom guidance\./)
  assert.equal(readFileSync(paths.memoryIndexFile, 'utf8'), canonicalMemory)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), memoryCache)

  const resolved = run({ command: 'paths', repoRoot, guideRoot })
  assert.equal(resolved.projectRoot, paths.projectRoot)
})

test('init refuses partial or mismatched memory views without replacing them', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-json-only-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'git@github.com:example/json-only.git',
  })
  const guideRoot = join(root, 'guide')
  const paths = run({ command: 'init', repoRoot, guideRoot })
  const canonical = readFileSync(paths.memoryIndexFile, 'utf8')
  const cache = readFileSync(paths.memoryFile, 'utf8')
  if (existsSync(paths.memoryIndexFile)) unlinkSync(paths.memoryIndexFile)

  const missingCanonical = run({ command: 'init', repoRoot, guideRoot, expectFailure: true })
  assert.match(missingCanonical.stderr, /without canonical memory\.md/)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), cache)
  assert.equal(existsSync(paths.memoryIndexFile), false)

  writeFileSync(paths.memoryIndexFile, canonical)
  unlinkSync(paths.memoryFile)
  const missingCache = run({ command: 'init', repoRoot, guideRoot, expectFailure: true })
  assert.match(missingCache.stderr, /without a JSON cache/)
  assert.equal(readFileSync(paths.memoryIndexFile, 'utf8'), canonical)

  const staleCache = cache.replace('"revision": 0', '"revision": 1')
  writeFileSync(paths.memoryFile, staleCache)
  const mismatched = run({ command: 'init', repoRoot, guideRoot, expectFailure: true })
  assert.match(mismatched.stderr, /memory\.json does not match canonical memory\.md/)
  assert.equal(readFileSync(paths.memoryIndexFile, 'utf8'), canonical)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), staleCache)
})

test('validate rejects a missing canonical or cache memory view', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-missing-memory-view-'))
  const repoRoot = createRepo({
    parent: root,
    name: 'repo',
    remote: 'git@github.com:example/missing-memory-view.git',
  })
  const guideRoot = join(root, 'guide')
  const paths = run({ command: 'init', repoRoot, guideRoot })
  const canonical = readFileSync(paths.memoryIndexFile, 'utf8')
  const cache = readFileSync(paths.memoryFile, 'utf8')

  unlinkSync(paths.memoryFile)
  const missingCache = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(missingCache.stderr, /memory\.json does not match canonical memory\.md/)
  writeFileSync(paths.memoryFile, cache)

  unlinkSync(paths.memoryIndexFile)
  const missingCanonical = run({ command: 'validate', repoRoot, guideRoot, expectFailure: true })
  assert.match(missingCanonical.stderr, /memory\.md is missing or invalid/)
  assert.equal(readFileSync(paths.memoryFile, 'utf8'), cache)
  writeFileSync(paths.memoryIndexFile, canonical)
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

test('opt-in analytics records retrieval and capture metadata without task text', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-analytics-integration-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/analytics.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const eventFile = join(guideRoot, 'analytics', 'events.jsonl')

  const beforeEnable = retrieve({ repoRoot, guideRoot, query: 'unique-private-task-text' })
  assert.equal(beforeEnable.analyticsEventId, undefined)
  assert.equal(existsSync(eventFile), false)

  assert.equal(run({ command: 'analytics-enable', repoRoot, guideRoot }).result.enabled, true)
  const submission = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({
      learning: 'Use focused verification for small changes.',
      turnId: 'turn-analytics',
      explicitPreference: true,
    }),
  }).result
  const retrieval = retrieve({ repoRoot, guideRoot, subject: 'testing', query: 'unique-private-task-text' })
  assert.match(retrieval.analyticsEventId, /^[0-9a-f-]{36}$/)
  assert.equal(retrieval.guidance[0].id, submission.targetId)

  const events = readFileSync(eventFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.deepEqual(events.map(({ type }) => type), ['submission', 'retrieval'])
  assert.deepEqual(events[1].guidanceIds, [submission.targetId])
  assert.doesNotMatch(readFileSync(eventFile, 'utf8'), /unique-private-task-text|Use focused verification/)

  const impact = run({
    command: 'analytics-impact',
    repoRoot,
    guideRoot,
    args: ['--input-json', JSON.stringify({
      schemaVersion: 1,
      retrievalEventId: retrieval.analyticsEventId,
      guidanceId: submission.targetId,
      effect: 'decision_changed',
    })],
  }).result
  run({
    command: 'analytics-review',
    repoRoot,
    guideRoot,
    args: ['--input-json', JSON.stringify({
      schemaVersion: 1,
      kind: 'impact',
      impactEventId: impact.id,
      verdict: 'confirmed',
    })],
  })
  run({
    command: 'analytics-review',
    repoRoot,
    guideRoot,
    args: ['--input-json', JSON.stringify({
      schemaVersion: 1,
      kind: 'capture',
      caseId: '00000000-0000-4000-8000-000000000001',
      verdict: 'eligible_captured',
    })],
  })
  const report = run({ command: 'analytics-report', repoRoot, guideRoot }).result
  assert.equal(report.retrievals.hits, 1)
  assert.equal(report.submissions.outcomes.created, 1)
  assert.equal(report.impacts.decisionChanged, 1)
  assert.equal(report.impacts.reviews.confirmed, 1)
  assert.equal(report.impacts.reviewConfirmationRate, 1)
  assert.equal(report.capture.captureRate, 1)
  const emptyReport = run({ command: 'analytics-report', repoRoot, guideRoot, args: ['--since', '2999-01-01'] }).result
  assert.equal(emptyReport.retrievals.total, 0)
  assert.equal(emptyReport.capture.captureRate, null)

  assert.equal(run({ command: 'analytics-disable', repoRoot, guideRoot }).result.enabled, false)
  const beforeDisabledRetrieval = readFileSync(eventFile, 'utf8')
  assert.equal(retrieve({ repoRoot, guideRoot, subject: 'testing' }).analyticsEventId, undefined)
  assert.equal(readFileSync(eventFile, 'utf8'), beforeDisabledRetrieval)
})

test('export and import sync shared guidance between machines', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-shared-sync-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/shared-sync.git' })
  const first = join(root, 'first')
  const second = join(root, 'second')
  const exported = join(root, 'shared.json')
  initializeMemory({ repoRoot, guideRoot: first })
  initializeMemory({ repoRoot, guideRoot: second })
  const shared = ({ guideRoot, learning, turnId, explicitPreference }) => submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning, turnId, scope: 'shared', explicitPreference }),
  }).result

  shared({ guideRoot: first, learning: 'Prefer small pull requests.', turnId: 'turn-1', explicitPreference: true })
  shared({ guideRoot: first, learning: 'Name tests after behavior.', turnId: 'turn-2', explicitPreference: true })
  const withdrawn = shared({ guideRoot: first, learning: 'Squash every commit.', turnId: 'turn-3', explicitPreference: true })
  submit({ repoRoot, guideRoot: first, input: conversationSubmission({ learning: 'Project-only rule.', turnId: 'turn-4', explicitPreference: true }) })
  runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot: first,
    input: { schemaVersion: 1, action: 'withdraw', targetId: withdrawn.targetId, reason: 'Retired.', source: 'user' },
  })
  const candidate = shared({ guideRoot: second, learning: 'Name tests after behavior.', turnId: 'turn-5' })
  assert.equal(candidate.status, 'candidate')
  const stillActive = shared({ guideRoot: second, learning: 'Squash every commit.', turnId: 'turn-6', explicitPreference: true })

  run({ command: 'export', repoRoot, guideRoot: first, args: ['--output', exported] })
  const firstExport = readFileSync(exported, 'utf8')
  const portable = JSON.parse(firstExport)
  assert.deepEqual(portable.active.map(({ learning }) => learning), ['Name tests after behavior.', 'Prefer small pull requests.'])
  assert.equal(portable.retired.length, 1)
  assert.doesNotMatch(firstExport, /evidence|repositoryIdentity|Project-only|Squash/)

  const imported = run({ command: 'import', repoRoot, guideRoot: second, args: ['--input', exported] }).result
  assert.equal(imported.created.length, 1)
  assert.deepEqual(imported.promoted, [candidate.targetId])
  assert.deepEqual(imported.retired, [stillActive.targetId])
  run({ command: 'validate', repoRoot, guideRoot: second })
  const repeated = run({ command: 'import', repoRoot, guideRoot: second, args: ['--input', exported] }).result
  assert.deepEqual(repeated, { created: [], promoted: [], retired: [], restored: [] })

  run({ command: 'export', repoRoot, guideRoot: second, args: ['--output', exported] })
  assert.equal(readFileSync(exported, 'utf8'), firstExport)

  const fresh = join(root, 'fresh')
  initializeMemory({ repoRoot, guideRoot: fresh })
  run({ command: 'import', repoRoot, guideRoot: fresh, args: ['--input', exported] })
  const freshMemory = JSON.parse(readFileSync(join(fresh, 'memory.json'), 'utf8'))
  assert.ok(ajv.getSchema(memorySchema.$id)(freshMemory), 'imported records match the memory schema')
  const retrieved = retrieve({ repoRoot, guideRoot: fresh, subject: 'testing' })
  assert.ok(validateRetrieval(retrieved), JSON.stringify(validateRetrieval.errors))
  assert.deepEqual(retrieved.guidance.map(({ learning }) => learning).sort(), ['Name tests after behavior.', 'Prefer small pull requests.'])
  const audited = run({ command: 'audit', repoRoot, guideRoot: fresh }).result
  assert.deepEqual([audited.validationErrors, audited.orphanEvidence, audited.brokenPointers], [[], [], []])
  run({ command: 'export', repoRoot, guideRoot: fresh, args: ['--output', exported] })
  assert.equal(readFileSync(exported, 'utf8'), firstExport, 'a machine without the record keeps its retirement')

  assert.match(run({ command: 'retrieve', repoRoot, guideRoot: first, args: ['--output', exported], expectFailure: true }).stderr, /only for export/)
  assert.match(run({ command: 'export', repoRoot, guideRoot: first, expectFailure: true }).stderr, /--output is required/)
})

test('import does not create a record that the same export retires', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-shared-sync-overlap-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/shared-sync-overlap.git' })
  const record = { subjectKey: 'testing', linkedSubjects: [], learning: 'Prefer small pull requests.', confidence: 'high', examples: [] }
  const probe = join(root, 'probe')
  initializeMemory({ repoRoot, guideRoot: probe })
  const created = runInputCommand({ command: 'import', repoRoot, guideRoot: probe, input: { schemaVersion: 1, active: [record], retired: [] } })
  const fingerprint = created.result.created[0].replace('guidance', 'fingerprint')

  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const result = runInputCommand({ command: 'import', repoRoot, guideRoot, input: { schemaVersion: 1, active: [record], retired: [fingerprint] } })
  assert.deepEqual(result.result.created, [])
})


test('an imported retirement withdraws the active replacement of superseded guidance', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-shared-sync-conflict-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/shared-sync-conflict.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const { original, replacement } = supersedeWithContradiction({ repoRoot, guideRoot, scope: 'shared' })
  const fingerprint = replacement.targetId.replace('guidance', 'fingerprint')
  const exported = join(root, 'shared.json')
  writeFileSync(exported, `${JSON.stringify({ schemaVersion: 1, active: [], retired: [fingerprint] })}\n`)

  const result = run({ command: 'import', repoRoot, guideRoot, args: ['--input', exported] }).result
  // Withdrawing the replacement moves the original straight to withdrawn: its own supersede is
  // still outstanding, because only a user undo acknowledges a retirement.
  assert.deepEqual(result.retired.sort(), [original.targetId, replacement.targetId].sort())
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  assert.equal(memory.guidance.find(({ id }) => id === replacement.targetId).status, 'withdrawn')
  assert.deepEqual(
    memory.guidance.find(({ id }) => id === original.targetId).transitions.map(({ from, to }) => `${from}->${to}`),
    ['null->active', 'active->superseded', 'superseded->withdrawn'],
  )
  run({ command: 'validate', repoRoot, guideRoot })
})

test('import ignores a repository-scoped record that matches a retired fingerprint', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-shared-sync-project-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/shared-sync-project.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const project = submit({
    repoRoot,
    guideRoot,
    input: conversationSubmission({ learning: 'Project-only rule.', turnId: 'turn-1', explicitPreference: true }),
  }).result
  const fingerprint = project.targetId.replace('guidance', 'fingerprint')

  runInputCommand({ command: 'import', repoRoot, guideRoot, input: { schemaVersion: 1, active: [], retired: [fingerprint] } })
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  assert.equal(memory.guidance.find(({ id }) => id === project.targetId).status, 'active')
})

// Stands in for host-config's field-guide-sync: import the dotfile when it exists, then export to it.
const syncMachine = ({ repoRoot, guideRoot, dotfile }) => {
  if (existsSync(dotfile)) run({ command: 'import', repoRoot, guideRoot, args: ['--input', dotfile] })
  run({ command: 'export', repoRoot, guideRoot, args: ['--output', dotfile] })
}

// A temporary root with one repository and the path of the dotfile its machines share.
const syncFixture = (name) => {
  const root = mkdtempSync(join(tmpdir(), `field-guide-${name}-`))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: `git@github.com:example/${name}.git` })
  return { root, repoRoot, dotfile: join(root, 'field-guide.json') }
}

// Two temporary guide roots stand in for two machines that share one dotfile. Both learn
// shared guidance A; then the first supersedes A with B and syncs, and the second has not
// synced since, so it still holds A as active.
const sharedCorrection = (name) => {
  const { root, repoRoot, dotfile } = syncFixture(name)
  const machine = (guideRoot) => {
    initializeMemory({ repoRoot, guideRoot })
    return {
      guideRoot,
      sync: () => syncMachine({ repoRoot, guideRoot, dotfile }),
      learn: (input) => submit({ repoRoot, guideRoot, input }).result.targetId,
      revision: () => JSON.parse(readFileSync(join(guideRoot, 'memory.json'), 'utf8')).revision,
      record: (id) => JSON.parse(readFileSync(join(guideRoot, 'memory.json'), 'utf8')).guidance.find((guidance) => guidance.id === id),
      transition: (input) => runInputCommand({
        command: 'transition',
        repoRoot,
        guideRoot,
        input: { schemaVersion: 1, reason: 'The user changed this learning.', source: 'user', ...input },
      }).result,
      validate: () => run({ command: 'validate', repoRoot, guideRoot }),
    }
  }
  const first = machine(join(root, 'first'))
  const second = machine(join(root, 'second'))
  const original = submit({
    repoRoot,
    guideRoot: first.guideRoot,
    input: conversationSubmission({ learning: 'Extract every helper.', turnId: 'turn-1', scope: 'shared', explicitPreference: true }),
  }).result.targetId
  first.sync()
  second.sync()
  const replacementInput = conversationSubmission({ learning: 'Keep single-use code inline.', turnId: 'turn-2', scope: 'shared', explicitPreference: true })
  replacementInput.relationship = { kind: 'contradicts', targetId: original }
  const replacement = submit({ repoRoot, guideRoot: first.guideRoot, input: replacementInput }).result.targetId
  first.transition({ action: 'supersede', targetId: original, replacementId: replacement, confirmed: true })
  first.sync()
  return { root, repoRoot, dotfile, first, second, original, replacement }
}

test('undo survives the restoring machine\'s own import-then-export sync', () => {
  const { first, original, replacement } = sharedCorrection('sync-undo-survives')
  first.transition({ action: 'undo', targetId: replacement })
  first.sync()
  assert.equal(first.record(original).status, 'active')
  assert.equal(first.record(replacement).status, 'withdrawn')
  first.validate()
})

for (const order of ['restoring machine first', 'other machine first']) {
  test(`two machines converge after undo when the ${order} syncs`, () => {
    const { dotfile, first, second, original, replacement } = sharedCorrection(`sync-converge-${order.split(' ')[0]}`)
    second.sync()
    assert.equal(second.record(original).status, 'withdrawn')
    first.transition({ action: 'undo', targetId: replacement })
    const machines = order === 'restoring machine first' ? [first, second, first] : [second, first, second, first]
    for (const machine of machines) machine.sync()

    for (const machine of [first, second]) {
      assert.equal(machine.record(original).status, 'active')
      machine.validate()
    }
    const restored = second.record(original).transitions.at(-1)
    assert.deepEqual([restored.from, restored.to, restored.source], ['withdrawn', 'active', 'shared-sync'])
    assert.equal(first.record(replacement).status, 'withdrawn')
    assert.notEqual(second.record(replacement)?.status, 'active')
    const secondMemory = JSON.parse(readFileSync(join(second.guideRoot, 'memory.json'), 'utf8'))
    assert.ok(ajv.getSchema(memorySchema.$id)(secondMemory), 'retirement sets match the memory schema')
    const exported = readFileSync(dotfile, 'utf8')
    assert.equal(JSON.parse(exported).schemaVersion, 2)
    assert.doesNotMatch(exported, /Keep single-use code inline|evidence|repositoryIdentity|relationship|replacementId/)

    const revisions = [first, second].map(({ guideRoot }) => JSON.parse(readFileSync(join(guideRoot, 'memory.json'), 'utf8')).revision)
    first.sync()
    second.sync()
    assert.equal(readFileSync(dotfile, 'utf8'), exported)
    assert.deepEqual([first, second].map(({ guideRoot }) => JSON.parse(readFileSync(join(guideRoot, 'memory.json'), 'utf8')).revision), revisions)
  })
}

test('a retirement that the restoring undo has not seen wins', () => {
  const { first, second, original, replacement } = sharedCorrection('sync-concurrent-retirement')
  first.transition({ action: 'undo', targetId: replacement })
  first.sync()
  // The second machine still holds A as active from before the supersede and retires it unsynced.
  second.transition({ action: 'withdraw', targetId: original })
  second.sync()
  first.sync()
  second.sync()
  assert.equal(first.record(original).status, 'withdrawn')
  assert.equal(second.record(original).status, 'withdrawn')
  first.validate()
  second.validate()
})

test('undo acknowledges only its own supersession, so a withdrawal it has seen stays final', () => {
  const { first, second, original, replacement } = sharedCorrection('sync-undo-own-supersession')
  // The second machine retires A before it learns of the supersede, and the first machine sees
  // that retirement while A is still superseded there.
  second.transition({ action: 'withdraw', targetId: original })
  second.sync()
  first.sync()
  assert.equal(first.record(original).status, 'superseded')
  assert.equal(first.record(original).retirements.length, 2)
  const ownRetirement = first.record(original).transitions.at(-1).retirementId
  first.transition({ action: 'undo', targetId: replacement })

  const undone = first.record(original)
  assert.deepEqual(undone.acknowledged, [ownRetirement])
  assert.deepEqual([undone.status, undone.transitions.at(-1).from], ['withdrawn', 'superseded'])
  for (const machine of [first, second]) {
    machine.sync()
    assert.equal(machine.record(original).status, 'withdrawn')
    machine.validate()
  }
})

test('concurrent replacements of one record converge after one is undone', () => {
  const { dotfile, first, second, original, replacement } = sharedCorrection('sync-concurrent-replacements')
  // The second machine supersedes A with its own replacement C before it learns of B.
  const otherInput = conversationSubmission({ learning: 'Inline helpers used once.', turnId: 'turn-3', scope: 'shared', explicitPreference: true })
  otherInput.relationship = { kind: 'refines', targetId: original }
  const other = second.learn(otherInput)
  second.transition({ action: 'supersede', targetId: original, replacementId: other, confirmed: true })
  second.sync()
  first.sync()
  assert.equal(first.record(other).status, 'active')
  // The second machine undoes C after it has seen both retirements of A.
  second.transition({ action: 'undo', targetId: other })
  for (const machine of [first, second, first, second, first, second]) machine.sync()

  for (const machine of [first, second]) {
    assert.notEqual(machine.record(original).status, 'active')
    assert.equal(machine.record(replacement).status, 'active')
    assert.equal(machine.record(other).status, 'withdrawn')
    machine.validate()
  }
  const exported = readFileSync(dotfile, 'utf8')
  const revisions = [first.revision(), second.revision()]
  first.sync()
  second.sync()
  assert.equal(readFileSync(dotfile, 'utf8'), exported)
  assert.deepEqual([first.revision(), second.revision()], revisions)

  // Undoing B as well acknowledges the last supersession of A, so A comes back everywhere,
  // including on the second machine, whose history still holds superseded->withdrawn.
  first.transition({ action: 'undo', targetId: replacement })
  first.sync()
  second.sync()
  for (const machine of [first, second]) {
    assert.equal(machine.record(original).status, 'active')
    machine.validate()
  }
})

for (const order of ['first', 'second']) {
  test(`restoring a replacement keeps its own replacement retired when the ${order} machine syncs first`, () => {
    const { first, second, original, replacement } = sharedCorrection(`sync-restored-replacement-${order}`)
    second.sync()
    // The second machine supersedes B with C, while the first machine undoes B and restores A.
    const otherInput = conversationSubmission({ learning: 'Extract helpers used twice.', turnId: 'turn-3', scope: 'shared', explicitPreference: true })
    otherInput.relationship = { kind: 'contradicts', targetId: replacement }
    const other = second.learn(otherInput)
    second.transition({ action: 'supersede', targetId: replacement, replacementId: other, confirmed: true })
    first.transition({ action: 'undo', targetId: replacement })
    first.sync()
    second.sync()
    first.sync()
    assert.equal(first.record(other).status, 'active')
    // The second machine undoes C after it has seen B's retirement on the first machine.
    second.transition({ action: 'undo', targetId: other })
    const [leader, follower] = order === 'first' ? [first, second] : [second, first]
    for (let round = 0; round < 2; round += 1) {
      leader.sync()
      follower.sync()
    }

    for (const machine of [first, second]) {
      assert.equal(machine.record(original).status, 'active')
      assert.equal(machine.record(replacement).status, 'withdrawn')
      assert.equal(machine.record(other).status, 'withdrawn')
      machine.validate()
    }
  })
}

test('export leaves out active text that the existing dotfile retires', () => {
  const { repoRoot, dotfile, second, original } = sharedCorrection('sync-export-retired-text')
  // The first machine superseded A and exported. The second still holds A as active and exports
  // without importing first.
  assert.equal(second.record(original).status, 'active')
  run({ command: 'export', repoRoot, guideRoot: second.guideRoot, args: ['--output', dotfile] })
  const exported = readFileSync(dotfile, 'utf8')
  assert.doesNotMatch(exported, /Extract every helper/)
  assert.ok(JSON.parse(exported).retired.some(({ fingerprint }) => fingerprint === original.replace('guidance', 'fingerprint')))
})

test('a stale v2 dotfile neither brings back retired guidance nor withdraws restored guidance', () => {
  const { dotfile, first, second, original, replacement } = sharedCorrection('sync-stale-dotfile')
  const staleV2 = readFileSync(dotfile, 'utf8')
  first.transition({ action: 'undo', targetId: replacement })
  first.sync()
  second.sync()

  // A dotfile manager restores the copy from before the undo: B active, A retired.
  writeFileSync(dotfile, staleV2)
  first.sync()
  second.sync()
  for (const machine of [first, second]) {
    assert.equal(machine.record(original).status, 'active')
    // The second machine never had B, and the stale copy does not create it.
    assert.notEqual(machine.record(replacement)?.status, 'active')
  }
})

// Rewrites the store as one written before retirement sets existed.
const dropRetirementSets = (paths) => {
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  for (const guidance of memory.guidance) {
    delete guidance.retirements
    delete guidance.acknowledged
    for (const transition of guidance.transitions) delete transition.retirementId
  }
  replaceCanonicalMemoryJson({ paths, memory })
}

test('a stale v1 dotfile neither brings back retired guidance nor withdraws guidance restored from v1-era history', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-sync-v1-history-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/sync-v1-history.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const { original, replacement } = supersedeWithContradiction({ repoRoot, guideRoot, scope: 'shared', replacementExplicitPreference: true })
  dropRetirementSets(paths)
  runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot,
    input: { schemaVersion: 1, action: 'undo', targetId: replacement.targetId, reason: 'The user undid this learning.', source: 'user' },
  })

  const dotfile = join(root, 'field-guide.json')
  // The v1 dotfile from before the undo names A as a tombstone and B as active.
  const portableReplacement = { subjectKey: 'testing', linkedSubjects: [], learning: 'Keep single-use code inline.', confidence: 'high', examples: [] }
  writeFileSync(dotfile, JSON.stringify({ schemaVersion: 1, active: [portableReplacement], retired: [original.targetId.replace('guidance', 'fingerprint')] }))
  syncMachine({ repoRoot, guideRoot, dotfile })
  const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  assert.equal(memory.guidance.find(({ id }) => id === original.targetId).status, 'active')
  assert.equal(memory.guidance.find(({ id }) => id === replacement.targetId).status, 'withdrawn')
  run({ command: 'validate', repoRoot, guideRoot })
})

test('a v1 tombstone and a v1-era local retirement export the same baseline ID', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-sync-baseline-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/sync-baseline.git' })
  const local = join(root, 'local')
  const paths = initializeMemory({ repoRoot, guideRoot: local })
  const retired = submit({
    repoRoot,
    guideRoot: local,
    input: conversationSubmission({ learning: 'Squash every commit.', turnId: 'turn-1', scope: 'shared', explicitPreference: true }),
  }).result.targetId
  runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot: local,
    input: { schemaVersion: 1, action: 'withdraw', targetId: retired, reason: 'Retired.', source: 'user' },
  })
  dropRetirementSets(paths)
  const localExport = join(root, 'local.json')
  run({ command: 'export', repoRoot, guideRoot: local, args: ['--output', localExport] })

  const imported = join(root, 'imported')
  initializeMemory({ repoRoot, guideRoot: imported })
  const dotfile = join(root, 'field-guide.json')
  const fingerprint = retired.replace('guidance', 'fingerprint')
  writeFileSync(dotfile, JSON.stringify({ schemaVersion: 1, active: [], retired: [fingerprint] }))
  syncMachine({ repoRoot, guideRoot: imported, dotfile })

  const [fromLocal, fromV1] = [localExport, dotfile].map((path) => JSON.parse(readFileSync(path, 'utf8')).retired)
  assert.equal(fromLocal.length, 1)
  assert.equal(fromLocal[0].fingerprint, fingerprint)
  assert.equal(fromLocal[0].retirements.length, 1)
  assert.deepEqual(fromV1, fromLocal)
})

test('validate guards restores from shared sync and unacknowledged retirements', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-sync-restore-guard-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/sync-restore-guard.git' })
  const retiredMemory = ({ scope }) => {
    const guideRoot = join(root, `guide-${Math.random().toString(16).slice(2)}`)
    const paths = initializeMemory({ repoRoot, guideRoot })
    const { targetId } = submit({
      repoRoot,
      guideRoot,
      input: conversationSubmission({ learning: 'Squash every commit.', turnId: 'turn-1', scope, explicitPreference: true }),
    }).result
    runInputCommand({
      command: 'transition',
      repoRoot,
      guideRoot,
      input: { schemaVersion: 1, action: 'withdraw', targetId, reason: 'Retired.', source: 'user' },
    })
    const memory = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
    return { guideRoot, paths, memory, guidance: memory.guidance.find(({ id }) => id === targetId) }
  }
  const restore = ({ guidance, source }) => {
    guidance.transitions.push({ from: 'withdrawn', to: 'active', reason: 'Restored.', source, at: new Date().toISOString() })
    guidance.status = 'active'
  }

  const unacknowledged = retiredMemory({ scope: 'shared' })
  restore({ guidance: unacknowledged.guidance, source: 'shared-sync' })
  replaceCanonicalMemoryJson(unacknowledged)
  assert.match(run({ command: 'validate', repoRoot, guideRoot: unacknowledged.guideRoot, expectFailure: true }).stderr, /unacknowledged retirement/)

  const byHand = retiredMemory({ scope: 'shared' })
  restore({ guidance: byHand.guidance, source: 'manual-edit' })
  byHand.guidance.acknowledged = [...byHand.guidance.retirements]
  replaceCanonicalMemoryJson(byHand)
  assert.match(run({ command: 'validate', repoRoot, guideRoot: byHand.guideRoot, expectFailure: true }).stderr, /withdrawn->active requires shared scope and source shared-sync/)

  const project = retiredMemory({ scope: 'project' })
  restore({ guidance: project.guidance, source: 'shared-sync' })
  replaceCanonicalMemoryJson(project)
  assert.match(run({ command: 'validate', repoRoot, guideRoot: project.guideRoot, expectFailure: true }).stderr, /withdrawn->active requires shared scope and source shared-sync/)
})

const cleanupLearning = 'After a merge, remove its worktrees and branches without asking.'
const fingerprintOf = (guidanceId) => guidanceId.replace('guidance', 'fingerprint')
const readAnnotations = (guideRoot) => JSON.parse(readFileSync(join(guideRoot, 'annotations.json'), 'utf8'))
// Confirmation IDs that still count, by the storage.md rule: not acknowledged, and having seen
// every revocation of the record.
const outstandingConfirmations = ({ guideRoot, guidanceId }) => {
  if (!existsSync(join(guideRoot, 'annotations.json'))) return []
  const record = readAnnotations(guideRoot).records[fingerprintOf(guidanceId)]
  return (record?.confirmations ?? [])
    .filter(({ id, seen }) => !record.acknowledged.includes(id) && record.revocations.every((revocation) => seen.includes(revocation)))
    .map(({ id }) => id)
}
// Reads confirmation the way a main-thread hook renders it; the CLI never reports confirmation.
const renderedConfirmed = ({ repoRoot, guideRoot, learning }) => {
  const injection = promptInjection({ repoRoot, guideRoot, prompt: learning, excludeIds: [], mainThread: true })
  return Boolean(injection?.text.split('\n').some((line) => line.startsWith('- [confirmed]') && line.endsWith(learning)))
}
const confirmByHook = ({ guideRoot, guidanceId, mainThread = true }) => confirmFromPrompt({
  guideRoot,
  prompt: `confirm fg:${guidanceId.slice('guidance:v1:'.length, 'guidance:v1:'.length + 8)}`,
  mainThread,
  host: 'claude',
})
const retrieved = ({ repoRoot, guideRoot, args, env }) => run({ command: 'retrieve', repoRoot, guideRoot, args, env }).result

test('annotate tags triggers and retrieve --event returns tagged active guidance, project first', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-event-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/event.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const learn = (input) => submit({ repoRoot, guideRoot, input }).result.targetId
  const shared = learn(conversationSubmission({ learning: cleanupLearning, turnId: 'turn-1', scope: 'shared', explicitPreference: true }))
  const project = learn(conversationSubmission({ learning: 'Run the release check after a merge.', turnId: 'turn-2', explicitPreference: true }))
  learn(conversationSubmission({ learning: 'Name tests after behavior.', turnId: 'turn-3', explicitPreference: true }))
  const annotate = (args, expectFailure = false) => run({ command: 'annotate', repoRoot, guideRoot, args, expectFailure })
  const event = (name, env) => retrieved({ repoRoot, guideRoot, args: ['--event', name], env })

  assert.deepEqual(annotate(['--id', shared, '--triggers', 'pr-merged,handoff']).result, {
    outcome: 'annotated', targetId: shared, triggers: ['handoff', 'pr-merged'],
  })
  assert.equal(annotate(['--id', shared, '--triggers', 'handoff']).result.outcome, 'unchanged')
  annotate(['--id', project.slice('guidance:v1:'.length, 'guidance:v1:'.length + 10), '--triggers', 'pr-merged'])
  const merged = event('pr-merged')
  assert.equal(validateRetrieval(merged), true, JSON.stringify(validateRetrieval.errors))
  assert.equal(merged.mode, 'event')
  assert.deepEqual(merged.guidance.map(({ id }) => id), [project, shared])
  assert.deepEqual(merged.guidance.map(({ triggers }) => triggers), [['pr-merged'], ['handoff', 'pr-merged']])
  assert.ok(merged.guidance.every((record) => !('confirmed' in record)))

  annotate(['--id', shared, '--remove-trigger', 'pr-merged'])
  assert.deepEqual(event('pr-merged').guidance.map(({ id }) => id), [project])
  assert.deepEqual(event('handoff').guidance.map(({ id }) => id), [shared])
  assert.deepEqual(event('pr-created').guidance, [])

  // A delegate retrieves the same records without annotation markers.
  const delegated = event('pr-merged', { T3CODE_THREAD_ID: 'thread:delegated-task:1234' })
  assert.deepEqual(delegated.guidance.map(({ id }) => id), [project])
  assert.ok(!('triggers' in delegated.guidance[0]))

  assert.match(annotate(['--id', shared, '--triggers', 'pr-closed'], true).stderr, /trigger must be one of/)
  assert.match(annotate(['--id', shared], true).stderr, /--triggers or --remove-trigger/)
  assert.match(annotate(['--id', 'abc1234', '--triggers', 'handoff'], true).stderr, /guidance ID or a hex prefix of at least 8/)
  assert.match(run({ command: 'retrieve', repoRoot, guideRoot, args: ['--event', 'pr-merged', '--query', 'merge cleanup'], expectFailure: true }).stderr, /--event cannot be combined/)
  assert.match(run({ command: 'retrieve', repoRoot, guideRoot, args: ['--event', 'deploy'], expectFailure: true }).stderr, /trigger must be one of/)
  run({ command: 'validate', repoRoot, guideRoot })
})

test('no agent command can confirm guidance', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-no-agent-confirm-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/no-agent-confirm.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const original = submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: 'Extract every helper.', turnId: 'turn-1', explicitPreference: true }) }).result.targetId

  const submission = { ...conversationSubmission({ learning: cleanupLearning, turnId: 'turn-2', explicitPreference: true }), confirmed: true }
  assert.match(submit({ repoRoot, guideRoot, input: submission, expectFailure: true }).stderr, /unsupported field: confirmed/)
  const withdrawal = { schemaVersion: 1, action: 'withdraw', targetId: original, reason: 'Retired.', source: 'user', confirmations: [] }
  assert.match(runInputCommand({ command: 'transition', repoRoot, guideRoot, input: withdrawal, expectFailure: true }).stderr, /unsupported field: confirmations/)
  const archive = { schemaVersion: 1, action: 'archive', targetIds: [original], reason: 'Archive.', confirmed: true }
  assert.match(runInputCommand({ command: 'maintain', repoRoot, guideRoot, input: archive, expectFailure: true }).stderr, /unsupported field: confirmed/)
  const exported = { schemaVersion: 2, active: [{ subjectKey: 'testing', learning: cleanupLearning, confidence: 'high', confirmed: true }], retired: [] }
  assert.match(runInputCommand({ command: 'import', repoRoot, guideRoot, input: exported, expectFailure: true }).stderr, /unsupported field: confirmed/)
  assert.match(run({ command: 'annotate', repoRoot, guideRoot, args: ['--id', original, '--confirm', 'true'], expectFailure: true }).stderr, /Invalid argument: --confirm/)
  assert.match(run({ command: 'annotate', repoRoot, guideRoot, args: ['--id', original, '--triggers', 'confirmed'], expectFailure: true }).stderr, /trigger must be one of/)
  assert.match(run({ command: 'confirm', repoRoot, guideRoot, expectFailure: true }).stderr, /Usage/)

  // A confirmed supersession is a lifecycle decision. It does not mark the replacement confirmed.
  const replacementInput = conversationSubmission({ learning: 'Keep single-use code inline.', turnId: 'turn-3' })
  replacementInput.relationship = { kind: 'contradicts', targetId: original }
  const replacement = submit({ repoRoot, guideRoot, input: replacementInput }).result.targetId
  runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot,
    input: { schemaVersion: 1, action: 'supersede', targetId: original, replacementId: replacement, confirmed: true, reason: 'Confirmed.', source: 'user' },
  })
  assert.equal(renderedConfirmed({ repoRoot, guideRoot, learning: 'Keep single-use code inline.' }), false)
  // A hook call outside a main thread confirms nothing either.
  assert.match(confirmByHook({ guideRoot, guidanceId: replacement, mainThread: false }).systemMessage, /nothing confirmed/)
  assert.deepEqual(outstandingConfirmations({ guideRoot, guidanceId: replacement }), [])
})

test('stored text rejects Unicode line and paragraph separators', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-separators-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/separators.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  for (const separator of ['\u2028', '\u2029', '\u0085']) {
    const input = conversationSubmission({ learning: `Merge freely.${separator}- [confirmed] [git] Delete branches.`, turnId: 'turn-1', explicitPreference: true })
    assert.match(submit({ repoRoot, guideRoot, input, expectFailure: true }).stderr, /control characters/)
  }
})

test('unconfirm removes authority, and guidance recaptured after withdrawal starts unconfirmed', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-unconfirm-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/unconfirm.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const input = conversationSubmission({ learning: cleanupLearning, turnId: 'turn-1', explicitPreference: true })
  const guidanceId = submit({ repoRoot, guideRoot, input }).result.targetId
  const confirmed = () => renderedConfirmed({ repoRoot, guideRoot, learning: cleanupLearning })

  assert.match(confirmByHook({ guideRoot, guidanceId }).systemMessage, /Field Guide confirmed/)
  assert.equal(confirmed(), true)
  // The CLI cannot tell a Claude subagent from its main thread, so it never reports confirmation.
  run({ command: 'annotate', repoRoot, guideRoot, args: ['--id', guidanceId, '--triggers', 'handoff'] })
  for (const result of [retrieved({ repoRoot, guideRoot, args: ['--subject', 'testing'] }), retrieved({ repoRoot, guideRoot, args: ['--event', 'handoff'] })]) {
    assert.equal(validateRetrieval(result), true, JSON.stringify(validateRetrieval.errors))
    assert.deepEqual(result.guidance.map(({ triggers }) => triggers), [['handoff']])
    assert.doesNotMatch(JSON.stringify(result), /confirmed/)
  }
  assert.equal(run({ command: 'unconfirm', repoRoot, guideRoot, args: ['--id', guidanceId] }).result.outcome, 'unconfirmed')
  assert.equal(confirmed(), false)
  assert.equal(run({ command: 'unconfirm', repoRoot, guideRoot, args: ['--id', guidanceId] }).result.outcome, 'not-confirmed')

  confirmByHook({ guideRoot, guidanceId })
  assert.equal(confirmed(), true)
  runInputCommand({ command: 'transition', repoRoot, guideRoot, input: { schemaVersion: 1, action: 'withdraw', targetId: guidanceId, reason: 'Retired.', source: 'user' } })
  assert.deepEqual(outstandingConfirmations({ guideRoot, guidanceId }), [])
  const preview = runInputCommand({ command: 'delete', repoRoot, guideRoot, input: { schemaVersion: 1, targetId: guidanceId } }).result
  runInputCommand({ command: 'delete', repoRoot, guideRoot, input: { schemaVersion: 1, targetId: guidanceId, apply: true, previewToken: preview.previewToken } })
  // Project annotations never sync, so delete drops them instead of leaving them for export.
  assert.equal(readAnnotations(guideRoot).records[fingerprintOf(guidanceId)], undefined)
  assert.equal(submit({ repoRoot, guideRoot, input: { ...input, evidence: { ...input.evidence, pointers: [{ kind: 'conversation', client: 'codex', threadId: 'thread-1', turnId: 'turn-2' }] } } }).result.targetId, guidanceId)
  assert.equal(confirmed(), false)
  run({ command: 'validate', repoRoot, guideRoot })
})

test('a changed fingerprint is unconfirmed: supersession and archive revoke confirmations', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-fingerprint-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/fingerprint.git' })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const original = submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: cleanupLearning, turnId: 'turn-1', explicitPreference: true }) }).result.targetId
  confirmByHook({ guideRoot, guidanceId: original })
  const replacementInput = conversationSubmission({ learning: 'After a merge, remove its clean worktrees without asking.', turnId: 'turn-2' })
  replacementInput.relationship = { kind: 'refines', targetId: original }
  const replacement = submit({ repoRoot, guideRoot, input: replacementInput }).result.targetId
  runInputCommand({
    command: 'transition',
    repoRoot,
    guideRoot,
    input: { schemaVersion: 1, action: 'supersede', targetId: original, replacementId: replacement, confirmed: true, reason: 'Refined.', source: 'user' },
  })
  assert.equal(renderedConfirmed({ repoRoot, guideRoot, learning: 'After a merge, remove its clean worktrees without asking.' }), false)
  assert.deepEqual(outstandingConfirmations({ guideRoot, guidanceId: original }), [])

  // Undoing the replacement restores the original, which stays unconfirmed until the user confirms again.
  runInputCommand({ command: 'transition', repoRoot, guideRoot, input: { schemaVersion: 1, action: 'undo', targetId: replacement, reason: 'Undo.', source: 'user' } })
  assert.equal(renderedConfirmed({ repoRoot, guideRoot, learning: cleanupLearning }), false)

  confirmByHook({ guideRoot, guidanceId: original })
  const archive = { schemaVersion: 1, action: 'archive', targetIds: [original], reason: 'Archive.' }
  const preview = runInputCommand({ command: 'maintain', repoRoot, guideRoot, input: archive }).result
  runInputCommand({ command: 'maintain', repoRoot, guideRoot, input: { ...archive, apply: true, previewToken: preview.previewToken } })
  assert.deepEqual(outstandingConfirmations({ guideRoot, guidanceId: original }), [])
  run({ command: 'validate', repoRoot, guideRoot })
})

// Three temporary guide roots stand in for three machines that share the two portable files.
const threeMachines = (name) => {
  const { root, repoRoot, dotfile } = syncFixture(name)
  const annotationsFile = join(root, 'field-guide-annotations.json')
  const machine = (label) => {
    const guideRoot = join(root, label)
    initializeMemory({ repoRoot, guideRoot })
    return {
      guideRoot,
      sync: () => {
        if (existsSync(dotfile)) {
          run({ command: 'import', repoRoot, guideRoot, args: ['--input', dotfile, ...(existsSync(annotationsFile) ? ['--annotations', annotationsFile] : [])] })
        }
        run({ command: 'export', repoRoot, guideRoot, args: ['--output', dotfile, '--annotations', annotationsFile] })
      },
      unconfirm: (guidanceId) => run({ command: 'unconfirm', repoRoot, guideRoot, args: ['--id', guidanceId] }),
      withdraw: (guidanceId) => runInputCommand({ command: 'transition', repoRoot, guideRoot, input: { schemaVersion: 1, action: 'withdraw', targetId: guidanceId, reason: 'Retired.', source: 'user' } }),
      validate: () => run({ command: 'validate', repoRoot, guideRoot }),
    }
  }
  const machines = ['a', 'b', 'c'].map(machine)
  const guidanceId = submit({
    repoRoot,
    guideRoot: machines[0].guideRoot,
    input: conversationSubmission({ learning: cleanupLearning, turnId: 'turn-1', scope: 'shared', explicitPreference: true }),
  }).result.targetId
  for (const each of machines) each.sync()
  return { repoRoot, annotationsFile, machines, guidanceId }
}

for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
  test(`a revocation converges across three machines when they sync in order ${order.join('-')}`, () => {
    const { repoRoot, annotationsFile, machines, guidanceId } = threeMachines(`revoke-${order.join('')}`)
    confirmByHook({ guideRoot: machines[0].guideRoot, guidanceId })
    for (const each of machines) each.sync()
    for (const { guideRoot } of machines) assert.equal(outstandingConfirmations({ guideRoot, guidanceId }).length, 1)
    assert.doesNotMatch(readFileSync(annotationsFile, 'utf8'), /worktrees|repositoryIdentity|\/home\//)

    // The second machine revokes; the others still hold the synced confirmation until they sync.
    machines[1].unconfirm(guidanceId)
    for (const index of [...order, ...order]) machines[index].sync()
    for (const { guideRoot } of machines) {
      assert.deepEqual(outstandingConfirmations({ guideRoot, guidanceId }), [])
      assert.equal(renderedConfirmed({ repoRoot, guideRoot, learning: cleanupLearning }), false)
    }
    const exported = readFileSync(annotationsFile, 'utf8')
    for (const each of machines) each.sync()
    assert.equal(readFileSync(annotationsFile, 'utf8'), exported)
    for (const each of machines) each.validate()
  })
}

test('a confirmation that reaches a machine after it withdrew the record stays revoked', () => {
  const { machines, guidanceId } = threeMachines('confirm-after-withdraw')
  const [first, second, third] = machines
  // The second machine confirms, and the first withdraws before it sees that confirmation.
  confirmByHook({ guideRoot: second.guideRoot, guidanceId })
  first.withdraw(guidanceId)
  for (const each of [second, first, third, second, first, third]) each.sync()
  for (const { guideRoot } of machines) assert.deepEqual(outstandingConfirmations({ guideRoot, guidanceId }), [])
  for (const each of machines) each.validate()
})

// Two machines that exchange their own export files, so a test controls when each copy arrives.
const machinePair = (name) => {
  const { root, repoRoot } = syncFixture(name)
  let turn = 0
  const machine = (label) => {
    const guideRoot = join(root, label)
    const files = { dotfile: join(root, `${label}.json`), annotations: join(root, `${label}-annotations.json`) }
    initializeMemory({ repoRoot, guideRoot })
    const transition = (input) => runInputCommand({ command: 'transition', repoRoot, guideRoot, input: { schemaVersion: 1, reason: 'The user changed this learning.', source: 'user', ...input } })
    const previewed = (command, input) => {
      const { previewToken } = runInputCommand({ command, repoRoot, guideRoot, input }).result
      runInputCommand({ command, repoRoot, guideRoot, input: { ...input, apply: true, previewToken } })
    }
    return {
      guideRoot,
      files,
      learn: (input = {}) => {
        turn += 1
        return submit({ repoRoot, guideRoot, input: { ...conversationSubmission({ learning: cleanupLearning, turnId: `turn-${turn}`, scope: 'shared', explicitPreference: true }), ...input } }).result.targetId
      },
      exportFiles: () => run({ command: 'export', repoRoot, guideRoot, args: ['--output', files.dotfile, '--annotations', files.annotations] }),
      importFrom: (other) => run({ command: 'import', repoRoot, guideRoot, args: ['--input', other.files.dotfile, '--annotations', other.files.annotations] }),
      importFiles: ({ dotfile, annotations }) => run({ command: 'import', repoRoot, guideRoot, args: ['--input', dotfile, ...(annotations ? ['--annotations', annotations] : [])] }),
      transition,
      retire: (action, guidanceId) => (action === 'archive'
        ? previewed('maintain', { schemaVersion: 1, action: 'archive', targetIds: [guidanceId], reason: 'Archive.' })
        : transition({ action, targetId: guidanceId })),
      remove: (guidanceId) => previewed('delete', { schemaVersion: 1, targetId: guidanceId }),
      unconfirm: (guidanceId) => run({ command: 'unconfirm', repoRoot, guideRoot, args: ['--id', guidanceId] }),
      confirmed: () => renderedConfirmed({ repoRoot, guideRoot, learning: cleanupLearning }),
    }
  }
  const first = machine('first')
  const second = machine('second')
  const guidanceId = first.learn()
  first.exportFiles()
  second.importFrom(first)
  return { first, second, guidanceId, machine, repoRoot }
}

for (const action of ['withdraw', 'archive']) {
  test(`a confirmation in transit stays revoked after ${action}, delete, and recapture`, () => {
    const { first, second, guidanceId } = machinePair(`revoke-in-transit-${action}`)
    confirmByHook({ guideRoot: second.guideRoot, guidanceId })
    second.exportFiles()
    first.retire(action, guidanceId)
    first.exportFiles()
    first.remove(guidanceId)
    assert.equal(first.learn(), guidanceId)
    first.importFrom(second)
    assert.equal(first.confirmed(), false)
  })
}

test('an unconfirm revokes a confirmation it has not seen, whatever its clock says', () => {
  const { first, second, guidanceId } = machinePair('revoke-unseen')
  confirmByHook({ guideRoot: first.guideRoot, guidanceId })
  // The first machine's clock runs a year ahead.
  const annotationsFile = join(first.guideRoot, 'annotations.json')
  const skewed = readAnnotations(first.guideRoot)
  skewed.records[fingerprintOf(guidanceId)].confirmations[0].at = new Date(Date.now() + 31_536_000_000).toISOString()
  writeFileSync(annotationsFile, JSON.stringify(skewed))
  confirmByHook({ guideRoot: second.guideRoot, guidanceId })
  second.unconfirm(guidanceId)
  second.exportFiles()
  first.importFrom(second)
  first.exportFiles()
  second.importFrom(first)
  assert.equal(first.confirmed(), false)
  assert.equal(second.confirmed(), false)
})

for (const staleFirst of [true, false]) {
  test(`a stale retirement snapshot keeps a newer confirmation when it arrives ${staleFirst ? 'first' : 'last'}`, () => {
    const { first, second, guidanceId } = machinePair(`stale-snapshot-${staleFirst}`)
    const snapshot = () => Object.values(first.files).map((path) => [path, readFileSync(path, 'utf8')])
    const replacement = first.learn({ learning: 'After a merge, remove its clean worktrees without asking.', relationship: { kind: 'refines', targetId: guidanceId } })
    first.transition({ action: 'supersede', targetId: guidanceId, replacementId: replacement, confirmed: true })
    first.exportFiles()
    const stale = snapshot()
    first.transition({ action: 'undo', targetId: replacement })
    confirmByHook({ guideRoot: first.guideRoot, guidanceId })
    first.exportFiles()
    const fresh = snapshot()
    for (const files of staleFirst ? [stale, fresh] : [fresh, stale]) {
      for (const [path, text] of files) writeFileSync(path, text)
      second.importFrom(first)
    }
    assert.equal(second.confirmed(), true)
  })
}

test('a supersession and undo by a plugin without annotations revoke a confirmation', () => {
  const { first, second, guidanceId } = machinePair('older-plugin')
  confirmByHook({ guideRoot: first.guideRoot, guidanceId })
  first.exportFiles()
  second.importFrom(first)
  // The older plugin keeps retirement IDs in memory but leaves annotations as they were.
  const sidecar = join(second.guideRoot, 'annotations.json')
  const untouched = readFileSync(sidecar, 'utf8')
  const replacement = second.learn({ learning: 'After a merge, remove its clean worktrees without asking.', relationship: { kind: 'refines', targetId: guidanceId } })
  second.transition({ action: 'supersede', targetId: guidanceId, replacementId: replacement, confirmed: true })
  second.transition({ action: 'undo', targetId: replacement })
  writeFileSync(sidecar, untouched)
  second.exportFiles()
  first.importFrom(second)
  assert.equal(first.confirmed(), false)
})

// The dd51bb9 CLI predates annotations. CI checks out full history, so the commit is present.
let olderCli
const olderScript = () => {
  if (olderCli) return olderCli
  const directory = mkdtempSync(join(tmpdir(), 'field-guide-older-cli-'))
  for (const name of ['field-guide.mjs', 'field-guide-analytics.mjs']) {
    const source = execFileSync('git', ['show', `dd51bb9:plugins/field-guide/skills/field-guide/scripts/${name}`], { cwd: dirname(script) })
    writeFileSync(join(directory, name), source)
  }
  olderCli = join(directory, 'field-guide.mjs')
  return olderCli
}

// A guide with one confirmed record, and a learn helper that can run either CLI.
const confirmedGuide = (name, scope) => {
  const root = mkdtempSync(join(tmpdir(), `field-guide-older-${name}-`))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: `git@github.com:example/${name}.git` })
  const guideRoot = join(root, 'guide')
  initializeMemory({ repoRoot, guideRoot })
  const learn = (learning, turnId, { cli, ...fields } = {}) => (
    submit({ repoRoot, guideRoot, cli, input: { ...conversationSubmission({ learning, turnId, scope, explicitPreference: true }), ...fields } }).result.targetId
  )
  const guidanceId = learn(cleanupLearning, 'turn-1')
  confirmByHook({ guideRoot, guidanceId })
  const confirmed = () => renderedConfirmed({ repoRoot, guideRoot, learning: cleanupLearning })
  assert.equal(confirmed(), true)
  const older = (command, input) => runInputCommand({ command, repoRoot, guideRoot, cli: olderScript(), input: { schemaVersion: 1, ...input } }).result
  return { guideRoot, guidanceId, learn, confirmed, older }
}

test('an older plugin that supersedes and undoes a confirmed project record voids the confirmation', () => {
  const { guideRoot, guidanceId, learn, confirmed, older } = confirmedGuide('project', 'project')
  const replacement = learn('After a merge, remove its clean worktrees without asking.', 'turn-2', { cli: olderScript(), relationship: { kind: 'refines', targetId: guidanceId } })
  older('transition', { action: 'supersede', targetId: guidanceId, replacementId: replacement, confirmed: true, reason: 'Refined.', source: 'user' })
  older('transition', { action: 'undo', targetId: replacement, reason: 'Undo.', source: 'user' })
  assert.equal(confirmed(), false)
  // The next current write revokes the old confirmation, and the user confirms again.
  learn('Name tests after behavior.', 'turn-3')
  assert.equal(confirmed(), false)
  confirmByHook({ guideRoot, guidanceId })
  assert.equal(confirmed(), true)
})

test('an older plugin that withdraws, deletes, and recaptures a confirmed shared record voids the confirmation', () => {
  const { guidanceId, learn, confirmed, older } = confirmedGuide('shared', 'shared')
  older('transition', { action: 'withdraw', targetId: guidanceId, reason: 'Retired.', source: 'user' })
  const { previewToken } = older('delete', { targetId: guidanceId })
  older('delete', { targetId: guidanceId, apply: true, previewToken })
  assert.equal(learn(cleanupLearning, 'turn-2', { cli: olderScript() }), guidanceId)
  assert.equal(confirmed(), false)
})

for (const retirementFirst of [true, false]) {
  test(`an older plugin's retirement revokes a confirmation when its export arrives ${retirementFirst ? 'first' : 'last'}`, () => {
    const { first, second, guidanceId, machine, repoRoot } = machinePair(`older-retirement-${retirementFirst}`)
    confirmByHook({ guideRoot: first.guideRoot, guidanceId })
    first.exportFiles()
    // The second machine runs the older plugin: it withdraws the record and exports no annotations.
    runInputCommand({ command: 'transition', repoRoot, guideRoot: second.guideRoot, cli: olderScript(), input: { schemaVersion: 1, action: 'withdraw', targetId: guidanceId, reason: 'Retired.', source: 'user' } })
    run({ command: 'export', repoRoot, guideRoot: second.guideRoot, cli: olderScript(), args: ['--output', second.files.dotfile] })
    const fresh = machine('fresh')
    const exports = [{ dotfile: second.files.dotfile }, first.files]
    for (const files of retirementFirst ? exports : exports.reverse()) fresh.importFiles(files)
    assert.equal(fresh.confirmed(), false)
  })
}

test('a store from before the watermark voids its confirmations until the user confirms again', () => {
  const { first, guidanceId } = machinePair('watermark-upgrade')
  const watermark = join(first.guideRoot, 'annotations-watermark.json')
  confirmByHook({ guideRoot: first.guideRoot, guidanceId })
  rmSync(watermark)
  assert.equal(first.confirmed(), false)
  first.learn({ learning: 'Name tests after behavior.' })
  assert.equal(first.confirmed(), false)
  confirmByHook({ guideRoot: first.guideRoot, guidanceId })
  assert.equal(first.confirmed(), true)
  // Without annotations there is nothing to void, so the first confirmation counts.
  rmSync(watermark)
  rmSync(join(first.guideRoot, 'annotations.json'))
  confirmByHook({ guideRoot: first.guideRoot, guidanceId })
  assert.equal(first.confirmed(), true)
})

test('current plugins never void a confirmation through capture, export, and import', () => {
  const { first, second, guidanceId } = machinePair('current-only')
  confirmByHook({ guideRoot: first.guideRoot, guidanceId })
  first.learn({ learning: 'Name tests after behavior.' })
  first.exportFiles()
  second.importFrom(first)
  second.exportFiles()
  first.importFrom(second)
  assert.equal(first.confirmed(), true)
  assert.equal(second.confirmed(), true)
})

test('a supersession that is undone keeps a delayed confirmation revoked', () => {
  const { first, second, guidanceId } = machinePair('revoke-supersede-undo')
  confirmByHook({ guideRoot: second.guideRoot, guidanceId })
  second.exportFiles()
  const replacement = first.learn({ learning: 'After a merge, remove its clean worktrees without asking.', relationship: { kind: 'refines', targetId: guidanceId } })
  first.transition({ action: 'supersede', targetId: guidanceId, replacementId: replacement, confirmed: true })
  first.transition({ action: 'undo', targetId: replacement })
  first.importFrom(second)
  assert.equal(first.confirmed(), false)
})

test('a local recapture revokes a confirmation that a plugin without annotations left behind', () => {
  const { first, guidanceId } = machinePair('revoke-recapture')
  const annotationsFile = join(first.guideRoot, 'annotations.json')
  confirmByHook({ guideRoot: first.guideRoot, guidanceId })
  const confirmedSidecar = readFileSync(annotationsFile, 'utf8')
  // A plugin that predates annotations withdraws and deletes the record without touching them.
  first.retire('withdraw', guidanceId)
  first.remove(guidanceId)
  writeFileSync(annotationsFile, confirmedSidecar)
  assert.equal(first.learn(), guidanceId)
  assert.equal(first.confirmed(), false)
})

test('validate accepts a version 1 store with an annotations file and rejects a malformed one', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-annotations-validate-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/annotations-validate.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const guidanceId = submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: cleanupLearning, turnId: 'turn-1', explicitPreference: true }) }).result.targetId
  const memoryBefore = readFileSync(paths.memoryIndexFile, 'utf8')
  confirmByHook({ guideRoot, guidanceId })
  run({ command: 'annotate', repoRoot, guideRoot, args: ['--id', guidanceId, '--triggers', 'pr-merged'] })
  assert.equal(readFileSync(paths.memoryIndexFile, 'utf8'), memoryBefore)
  assert.equal(JSON.parse(readFileSync(paths.memoryFile, 'utf8')).schemaVersion, 1)
  const annotationsSchema = JSON.parse(readFileSync(fileURLToPath(new URL('schemas/annotations-v1.schema.json', skillRoot)), 'utf8'))
  const validateAnnotationsSchema = ajv.compile(annotationsSchema)
  assert.equal(validateAnnotationsSchema(readAnnotations(guideRoot)), true, JSON.stringify(validateAnnotationsSchema.errors))
  run({ command: 'validate', repoRoot, guideRoot })

  writeFileSync(join(guideRoot, 'annotations.json'), JSON.stringify({ schemaVersion: 1, records: { 'not-a-fingerprint': {} } }))
  assert.equal(validateAnnotationsSchema(JSON.parse(readFileSync(join(guideRoot, 'annotations.json'), 'utf8'))), false)
  assert.match(run({ command: 'validate', repoRoot, guideRoot, expectFailure: true }).stderr, /annotations/)
})

test('a writer waits for a live lock and recovers a lock whose owner died or that is stale', { skip: process.platform !== 'linux' }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-lock-recovery-'))
  const repoRoot = createRepo({ parent: root, name: 'repo', remote: 'git@github.com:example/lock-recovery.git' })
  const guideRoot = join(root, 'guide')
  const paths = initializeMemory({ repoRoot, guideRoot })
  const pidNamespace = readlinkSync('/proc/self/ns/pid')
  const lockedBy = (owner) => writeFileSync(paths.memoryLockFile, JSON.stringify({ createdAt: Date.now(), ...owner }))
  const learn = (turnId) => submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: `Lock case ${turnId}.`, turnId }) })

  const exitedPid = spawnSync(process.execPath, ['-e', '']).pid
  lockedBy({ pid: exitedPid, pidNamespace })
  learn('turn-1')
  assert.equal(existsSync(paths.memoryLockFile), false)

  writeFileSync(paths.memoryLockFile, 'held\n')
  const old = new Date(Date.now() - 10 * 60 * 1000)
  utimesSync(paths.memoryLockFile, old, old)
  // An owner file that a dead writer left behind is removed once it is stale.
  const orphan = `${paths.memoryLockFile}.orphan.tmp`
  writeFileSync(orphan, '{}')
  utimesSync(orphan, old, old)
  learn('turn-2')
  assert.equal(existsSync(orphan), false)

  // A dead PID in another PID namespace proves nothing, so a fresh lock still blocks.
  lockedBy({ pid: exitedPid, pidNamespace: 'pid:[1]' })
  const blocked = submit({ repoRoot, guideRoot, input: conversationSubmission({ learning: 'Lock case blocked.', turnId: 'turn-4' }), expectFailure: true })
  assert.match(blocked.stderr, /locked by another writer/)
  unlinkSync(paths.memoryLockFile)

  // A live owner that releases the lock during the wait lets the writer continue.
  lockedBy({ pid: process.pid, pidNamespace })
  const inputFile = join(guideRoot, 'waiting-submission.json')
  writeFileSync(inputFile, JSON.stringify(conversationSubmission({ learning: 'Lock case waited.', turnId: 'turn-5' })))
  const child = spawn(process.execPath, [script, 'submit', '--repo-root', repoRoot, '--guide-root', guideRoot, '--input', inputFile])
  setTimeout(() => unlinkSync(paths.memoryLockFile), 300)
  const status = await new Promise((resolve) => child.on('exit', resolve))
  assert.equal(status, 0)
  run({ command: 'validate', repoRoot, guideRoot })
  // Each writer removes its own owner file, including the one that timed out.
  assert.deepEqual(readdirSync(guideRoot).filter((name) => name.startsWith('memory.lock')), [])
})
