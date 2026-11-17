import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { fieldGuideSkillRoot } from './plugin-paths.mjs'

const script = fileURLToPath(new URL('scripts/field-guide.mjs', fieldGuideSkillRoot))
const dreamScript = fileURLToPath(new URL('scripts/field-guide-dream.mjs', fieldGuideSkillRoot))
const readSchema = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`schemas/${name}`, fieldGuideSkillRoot)), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false })
const validateMemoryV2 = ajv.compile(readSchema('memory-v2.schema.json'))
ajv.addSchema(readSchema('consolidation-v1.schema.json'))
const validateDreamInput = ajv.compile(readSchema('dream-apply-v1.schema.json'))
// The UserPromptSubmit hook is the only caller that confirms guidance or approves a proposal.
const { confirmFromPrompt, promptInjection } = await import(new URL('scripts/field-guide.mjs', fieldGuideSkillRoot))

// The last released CLI before memory version 2.
const releasedCommit = '347cdfd5a7b9f1d8c411964d406f638eb98c6514'
const releasedCli = (() => {
  let path
  return () => {
    if (path) return path
    const directory = mkdtempSync(join(tmpdir(), 'field-guide-released-cli-'))
    for (const name of ['field-guide.mjs', 'field-guide-analytics.mjs']) {
      const shown = spawnSync('git', ['show', `${releasedCommit}:plugins/field-guide/skills/field-guide/scripts/${name}`], { cwd: dirname(script) })
      assert.equal(shown.status, 0, `commit ${releasedCommit} is missing; run git fetch --unshallow`)
      writeFileSync(join(directory, name), shown.stdout)
    }
    path = join(directory, 'field-guide.mjs')
    return path
  }
})()

const homePathPattern = /\/(?:Users|home)\/[^/\s]+\/|[A-Za-z]:\\Users\\/u

const createRepo = ({ parent, name }) => {
  const repoRoot = join(parent, name)
  const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { stdio: 'ignore' })
  execFileSync('git', ['init', repoRoot], { stdio: 'ignore' })
  git('config', 'user.name', 'Field Guide Test')
  git('config', 'user.email', 'field-guide@example.test')
  writeFileSync(join(repoRoot, 'README.md'), '# Test\n')
  git('add', 'README.md')
  git('commit', '-m', 'test: initialize repository')
  git('remote', 'add', 'origin', `git@github.com:example/${name}.git`)
  return repoRoot
}

// One machine: a guide, a repository, and a HOME of its own, so the writer gate never reads
// the real installed plugins.
const machine = ({ root, name = 'machine', repoRoot }) => {
  const guideRoot = join(root, `${name}-guide`)
  const home = join(root, `${name}-home`)
  mkdirSync(home, { recursive: true })
  const env = { ...process.env, HOME: home, CODEX_HOME: undefined, CLAUDE_CONFIG_DIR: undefined, T3CODE_THREAD_ID: undefined }
  // Runs a CLI and returns its parsed output, plus the raw text as stdout.
  const exec = ({ cli = script, command, args = [], expectFailure = false }) => {
    const result = spawnSync(process.execPath, [cli, command, '--repo-root', repoRoot, '--guide-root', guideRoot, ...args], { encoding: 'utf8', env })
    if (expectFailure) {
      assert.notEqual(result.status, 0, result.stdout)
      return result
    }
    assert.equal(result.status, 0, result.stderr)
    return { ...JSON.parse(result.stdout), stdout: result.stdout }
  }
  const inputFile = (value) => {
    const path = join(root, `input-${Math.random().toString(16).slice(2)}.json`)
    writeFileSync(path, `${JSON.stringify(value)}\n`)
    return path
  }
  const self = {
    guideRoot,
    home,
    exec,
    inputFile,
    learn: (learning, { scope = 'project', turnId = learning.toLowerCase().replace(/[^a-z0-9]+/gu, '-'), cli, expectFailure = false } = {}) => {
      const output = exec({
        cli,
        expectFailure,
        command: 'submit',
      args: ['--input', inputFile({
        schemaVersion: 1,
        decision: 'capture',
        confidence: 'high',
        scope,
        subjectKey: 'git-cleanup',
        learning,
        explicitPreference: true,
        evidence: { summary: 'The user stated a cleanup preference.', pointers: [{ kind: 'conversation', client: 'codex', threadId: 'thread-1', turnId }] },
      })],
      })
      return expectFailure ? output : output.result.targetId
    },
    memory: () => JSON.parse(readFileSync(join(guideRoot, 'memory.json'), 'utf8')),
    record: (id) => self.memory().guidance.find((guidance) => guidance.id === id),
    activeIds: () => self.memory().guidance.filter(({ status }) => status === 'active').map(({ id }) => id).sort(),
    journal: () => (existsSync(join(guideRoot, 'operations.jsonl'))
      ? readFileSync(join(guideRoot, 'operations.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
      : []),
    consolidate: (input, { expectFailure, args = [] } = {}) => exec({
      command: 'consolidate',
      args: ['--input', inputFile({ schemaVersion: 1, reason: 'The records say the same thing.', source: 'agent', ...input }), ...args],
      expectFailure,
    }),
    // Previews, then applies with the preview token.
    consolidateApplied: (targetIds, learning = 'After a merge, remove its clean worktree and branch.') => {
      const input = { targetIds, replacement: { learning, confidence: 'high' } }
      const preview = self.consolidate(input).result
      assert.equal(preview.outcome, 'consolidate-preview')
      return self.consolidate({ ...input, apply: true, previewToken: preview.previewToken }).result
    },
    undo: (operationId, { expectFailure } = {}) => exec({ command: 'undo-operation', args: ['--id', operationId], expectFailure }),
    transition: (input, { expectFailure } = {}) => exec({
      command: 'transition',
      args: ['--input', inputFile({ schemaVersion: 1, reason: 'The user changed this learning.', source: 'user', ...input })],
      expectFailure,
    }),
    archive: (targetIds) => {
      const input = { schemaVersion: 1, action: 'archive', targetIds, reason: 'The user archived it.' }
      const preview = exec({ command: 'maintain', args: ['--input', inputFile(input)] }).result
      return exec({ command: 'maintain', args: ['--input', inputFile({ ...input, apply: true, previewToken: preview.previewToken })] }).result
    },
    dream: ({ subcommand, args, expectFailure }) => exec({ cli: dreamScript, command: subcommand, args, expectFailure }),
    plan: () => self.dream({ subcommand: 'plan' }),
    dreamApply: (input, { previewToken, expectFailure } = {}) => self.dream({
      subcommand: 'apply',
      args: ['--input', inputFile(input), ...(previewToken ? ['--preview-token', previewToken] : [])],
      expectFailure,
    }),
    confirm: (reference, { mainThread = true, prompt = `confirm fg:${reference}` } = {}) => confirmFromPrompt({ guideRoot, prompt, mainThread, host: 'claude' }),
    confirmed: (learning) => {
      const injection = promptInjection({ repoRoot, guideRoot, prompt: learning, excludeIds: [], mainThread: true })
      return Boolean(injection?.text.split('\n').some((line) => line.startsWith('- [confirmed]') && line.endsWith(learning)))
    },
    validate: () => exec({ command: 'validate' }),
  }
  exec({ command: 'init' })
  return self
}

const setup = (name) => {
  const root = mkdtempSync(join(tmpdir(), `field-guide-dream-${name}-`))
  const repoRoot = createRepo({ parent: root, name })
  return { root, repoRoot, guide: machine({ root, repoRoot }) }
}

const short = (id) => id.replace(/^\w+:v1:/u, '').slice(0, 8)
const cleanupTexts = [
  'After a merge, remove the merged worktree without asking.',
  'After a merge, remove the merged branch and worktree without asking.',
  'After a merge, delete the merged worktree and its branch without asking.',
]

// Every dream action names the subject state it was planned against.
const subjectFor = (plan, subjectKey = 'git-cleanup', scope = 'project') => plan.subjects.find((subject) => subject.subjectKey === subjectKey && subject.scope === scope)
const dreamInput = (plan, actions, subjectKey, scope) => {
  const subject = subjectFor(plan, subjectKey, scope)
  return {
    schemaVersion: 1,
    live: Object.fromEntries(plan.live.map(({ source, digest }) => [source, digest])),
    subjects: [{ subjectId: subject.subjectId, digest: subject.digest, actions }],
  }
}

test('consolidating three records into one and undoing it restores the prior active set', () => {
  const { guide } = setup('consolidate-undo')
  const [first, second, third] = cleanupTexts.map((learning) => guide.learn(learning))
  const unrelated = guide.learn('Name tests after the behavior they check.')
  guide.exec({ command: 'annotate', args: ['--id', first, '--triggers', 'pr-merged'] })
  guide.exec({ command: 'annotate', args: ['--id', second, '--triggers', 'handoff'] })
  const before = guide.activeIds()
  const revision = guide.memory().revision

  const preview = guide.consolidate({ targetIds: [first, second, third], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' } }).result
  assert.equal(guide.memory().revision, revision, 'a preview writes nothing')
  const applied = guide.consolidate({
    targetIds: [first, second, third],
    replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' },
    apply: true,
    previewToken: preview.previewToken,
  }).result
  assert.equal(applied.outcome, 'consolidated')
  assert.equal(applied.undo, `undo-operation --id ${applied.operationId}`)
  const memory = guide.memory()
  assert.equal(memory.schemaVersion, 2)
  assert.ok(validateMemoryV2(memory), JSON.stringify(validateMemoryV2.errors))
  const replacement = guide.record(applied.replacementId)
  assert.deepEqual(replacement.consolidates, [first, second, third].sort())
  assert.equal(replacement.status, 'active')
  // Evidence carries over by reference; consolidation creates no evidence of its own.
  assert.equal(memory.evidence.length, 4)
  assert.deepEqual(replacement.evidenceIds.sort(), [first, second, third].flatMap((id) => guide.record(id).evidenceIds).sort())
  for (const id of [first, second, third]) {
    const last = guide.record(id).transitions.at(-1)
    assert.deepEqual([last.to, last.replacementId, last.operationId], ['superseded', applied.replacementId, applied.operationId])
  }
  const tagged = guide.exec({ command: 'retrieve', args: ['--event', 'handoff'] }).result.guidance.map(({ id }) => id)
  assert.deepEqual(tagged, [applied.replacementId], 'triggers move to the replacement')
  assert.deepEqual(guide.activeIds(), [applied.replacementId, unrelated].sort())
  guide.validate()

  const undone = guide.undo(applied.operationId).result
  assert.equal(undone.outcome, 'undone')
  assert.deepEqual(undone.restoredIds.sort(), [first, second, third].sort())
  assert.deepEqual(guide.activeIds(), before)
  assert.equal(guide.record(applied.replacementId).status, 'withdrawn')
  guide.validate()
  const afterUndo = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')
  assert.equal(guide.undo(applied.operationId).result.outcome, 'already-undone')
  assert.equal(readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8'), afterUndo, 'a repeated undo changes nothing')
})

test('undo leaves a record retired that something else retired after the consolidation', () => {
  const { guide } = setup('independent-retirement')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const applied = guide.consolidateApplied([first, second])
  guide.archive([first])
  const deletion = guide.exec({ command: 'delete', args: ['--input', guide.inputFile({ schemaVersion: 1, targetId: first })], expectFailure: true })
  assert.match(deletion.stderr, /referenced by another guidance record/)

  const undone = guide.undo(applied.operationId).result
  assert.deepEqual(undone.restoredIds, [second])
  assert.deepEqual(undone.keptRetiredIds, [first])
  assert.equal(guide.record(first).status, 'archived')
  assert.equal(guide.record(second).status, 'active')
  guide.validate()
})

test('transition undo refuses a consolidated replacement and names undo-operation', () => {
  const { guide } = setup('transition-undo-refused')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const applied = guide.consolidateApplied([first, second])
  const refused = guide.transition({ action: 'undo', targetId: applied.replacementId }, { expectFailure: true })
  assert.match(refused.stderr, /undo-operation/)
  assert.equal(guide.record(applied.replacementId).status, 'active')
})

// Two machines that sync shared guidance through one exported file.
const sharedPair = (name) => {
  const root = mkdtempSync(join(tmpdir(), `field-guide-dream-${name}-`))
  const repoRoot = createRepo({ parent: root, name })
  const dotfile = join(root, 'shared.json')
  const pair = [machine({ root, name: 'first', repoRoot }), machine({ root, name: 'second', repoRoot })]
  for (const guide of pair) {
    guide.sync = () => {
      if (existsSync(dotfile)) guide.exec({ command: 'import', args: ['--input', dotfile] })
      guide.exec({ command: 'export', args: ['--output', dotfile] })
    }
  }
  return { root, repoRoot, dotfile, first: pair[0], second: pair[1] }
}

test('a shared consolidation and its undo converge without reviving a record withdrawn elsewhere', () => {
  const { first, second } = sharedPair('shared-converge')
  const ids = cleanupTexts.map((learning) => first.learn(learning, { scope: 'shared' }))
  first.sync()
  second.sync()
  // The second machine withdraws one record while the first consolidates all three.
  second.transition({ action: 'withdraw', targetId: ids[2] })
  const applied = first.consolidateApplied(ids)
  for (const guide of [second, first, second]) guide.sync()
  assert.equal(second.record(applied.replacementId).status, 'active')

  const undone = first.undo(applied.operationId).result
  assert.deepEqual(undone.restoredIds.sort(), ids.slice(0, 2).sort())
  assert.deepEqual(undone.keptRetiredIds, [ids[2]])
  for (const guide of [first, second, first, second]) guide.sync()
  for (const guide of [first, second]) {
    assert.deepEqual(ids.map((id) => guide.record(id).status), ['active', 'active', 'withdrawn'])
    assert.notEqual(guide.record(applied.replacementId)?.status, 'active')
    guide.validate()
  }
})

test('undo acknowledges only the retirement IDs its own operation created', () => {
  const { first, second } = sharedPair('own-retirements')
  const ids = cleanupTexts.map((learning) => first.learn(learning, { scope: 'shared' }))
  first.sync()
  second.sync()
  // Both machines consolidate the middle record before they sync.
  const firstOperation = first.consolidateApplied(ids.slice(0, 2), 'After a merge, remove the merged worktree and branch.')
  const secondOperation = second.consolidateApplied(ids.slice(1))
  for (const guide of [first, second, first]) guide.sync()

  const middle = () => first.record(ids[1])
  assert.equal(middle().retirements.length, 2)
  // Each journal is local, so this machine cannot undo the other machine's operation.
  assert.match(first.undo(secondOperation.operationId, { expectFailure: true }).stderr, /no journaled operation/)
  first.undo(firstOperation.operationId)
  const own = first.journal().find(({ type, operationId }) => type === 'pending' && operationId === firstOperation.operationId).retirementIds
  assert.deepEqual(middle().acknowledged, own.filter((id) => middle().retirements.includes(id)))
  assert.equal(middle().status, 'withdrawn', 'the other machine\'s retirement still stands')
  assert.equal(first.record(ids[0]).status, 'active')
  first.validate()

  // A replacement that still supersedes records cannot itself be consolidated.
  const third = first.consolidateApplied([ids[0], first.learn('After a merge, remove the merged worktree and its branch.', { scope: 'shared' })], 'After a merge, clean the worktree.')
  const refused = first.consolidate({ targetIds: [third.replacementId, secondOperation.replacementId], replacement: { learning: 'Clean up merges.', confidence: 'high' } }, { expectFailure: true })
  assert.match(refused.stderr, /still replaces superseded guidance/)
})

test('a crash between the journal and the store recovers', () => {
  const { guide } = setup('crash-recovery')
  const [first, second, third] = cleanupTexts.map((learning) => guide.learn(learning))
  const journalPath = join(guide.guideRoot, 'operations.jsonl')

  // Crash after the store write and before the commit line: recovery commits it.
  const applied = guide.consolidateApplied([first, second])
  const withoutCommit = readFileSync(journalPath, 'utf8').trim().split('\n').filter((line) => !(JSON.parse(line).type === 'commit' && line.includes(applied.operationId)))
  writeFileSync(journalPath, `${withoutCommit.join('\n')}\n`)
  guide.undo(applied.operationId)
  assert.ok(guide.journal().some(({ type, operationId, recovered }) => type === 'commit' && operationId === applied.operationId && recovered === true))
  assert.equal(guide.record(first).status, 'active')

  // Crash after the pending line and before the store write: recovery aborts it.
  const pending = { ...guide.journal().find(({ type, operationId }) => type === 'pending' && operationId === applied.operationId), operationId: `operation:v1:${'f'.repeat(64)}`, fingerprints: [third.replace('guidance', 'fingerprint')] }
  appendFileSync(journalPath, `${JSON.stringify(pending)}\n`)
  const memoryBefore = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')
  const aborted = guide.undo(pending.operationId, { expectFailure: true })
  assert.match(aborted.stderr, /never applied/)
  assert.ok(guide.journal().some(({ type, operationId }) => type === 'abort' && operationId === pending.operationId))
  assert.equal(readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8'), memoryBefore)
  guide.validate()
})

test('a declined set is not proposed again', () => {
  const { guide } = setup('declined-set')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const planned = subjectFor(guide.plan())
  assert.deepEqual(planned.overlapGroups, [[first, second].sort()])

  const applied = guide.consolidateApplied([first, second])
  guide.undo(applied.operationId)
  const undoEntry = guide.journal().find(({ type, action }) => type === 'pending' && action === 'undo-operation')
  assert.deepEqual(undoEntry.declined, [first, second].map((id) => id.replace('guidance', 'fingerprint')).sort())
  const plan = guide.plan()
  assert.deepEqual(subjectFor(plan).overlapGroups, [])
  const rejected = guide.dreamApply(dreamInput(plan, [{ action: 'consolidate', targetIds: [first, second], replacement: { learning: 'After a merge, clean up.', confidence: 'high' }, reason: 'Same rule.' }]), { expectFailure: true })
  assert.match(rejected.stderr, /declined/)
})

test('dream apply rejects a stale preview and a changed subject digest', () => {
  const { guide } = setup('stale-preview')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const input = dreamInput(guide.plan(), [{ action: 'consolidate', targetIds: [first, second], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }, reason: 'Same rule.' }])
  assert.ok(validateDreamInput(input), JSON.stringify(validateDreamInput.errors))
  const preview = guide.dreamApply(input)
  assert.equal(preview.outcome, 'preview')

  guide.exec({ command: 'submit', args: ['--input', guide.inputFile({ schemaVersion: 1, decision: 'capture', confidence: 'low', scope: 'project', subjectKey: 'naming', learning: 'Name tests after behavior.', evidence: { summary: 'A naming note.', pointers: [{ kind: 'manual', sourceLabel: 'Direct request' }] } })] })
  assert.match(guide.dreamApply(input, { previewToken: preview.previewToken, expectFailure: true }).stderr, /current dry-run previewToken/)

  guide.learn('After a merge, prune remote branches too.')
  assert.match(guide.dreamApply(input, { expectFailure: true }).stderr, /subject .* changed since the plan/)
  assert.equal(guide.record(first).status, 'active')
})

test('replaying a finished dream run changes nothing', () => {
  const { guide } = setup('replay')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const input = dreamInput(guide.plan(), [{ action: 'consolidate', targetIds: [first, second], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }, reason: 'Same rule.' }])
  const applied = guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  assert.equal(applied.outcome, 'applied')
  assert.equal(applied.operations.length, 1)
  assert.equal(applied.undoWindowDays, 90)
  assert.equal(guide.record(first).status, 'superseded')

  const files = ['memory.md', 'operations.jsonl'].map((name) => readFileSync(join(guide.guideRoot, name), 'utf8'))
  assert.equal(guide.dreamApply(input).outcome, 'already-applied')
  assert.equal(guide.dreamApply(input, { previewToken: 'anything' }).outcome, 'already-applied')
  assert.deepEqual(['memory.md', 'operations.jsonl'].map((name) => readFileSync(join(guide.guideRoot, name), 'utf8')), files)
})

test('dream apply and consolidate reject confirmation fields', () => {
  const { guide } = setup('confirmation-fields')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const plan = guide.plan()
  const action = { action: 'consolidate', targetIds: [first, second], replacement: { learning: 'After a merge, clean up.', confidence: 'high' }, reason: 'Same rule.' }
  for (const input of [
    dreamInput(plan, [{ ...action, confirmed: true }]),
    dreamInput(plan, [{ ...action, replacement: { ...action.replacement, explicitPreference: true } }]),
    { ...dreamInput(plan, [action]), approval: 'proposal:v1:abc' },
    dreamInput(plan, [{ action: 'flag', kind: 'conflict', targetIds: [first], reason: 'Conflicts.', confirmations: [] }]),
  ]) {
    assert.match(guide.dreamApply(input, { expectFailure: true }).stderr, /confirmation field/)
  }
  const consolidation = guide.consolidate({ targetIds: [first, second], replacement: { learning: 'After a merge, clean up.', confidence: 'high' }, confirmed: true }, { expectFailure: true })
  assert.match(consolidation.stderr, /confirmation field/)
  assert.equal(guide.journal().length, 0)
})

test('consolidating confirmed guidance needs the user\'s exact approval of the stored proposal', () => {
  const { guide } = setup('confirmed-approval')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  assert.match(guide.confirm(short(first)).systemMessage, /confirmed/)
  const learning = 'After a merge, remove its clean worktree and branch.'
  const memoryBefore = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')

  const refused = guide.consolidate({ targetIds: [first, second], replacement: { learning, confidence: 'high' }, apply: true, previewToken: 'unused' }).result
  assert.equal(refused.outcome, 'approval-required')
  assert.match(refused.confirmPrompt, /^confirm fg:proposal:[0-9a-f]{12}$/u)
  assert.equal(readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8'), memoryBefore, 'confirmed records are not rewritten')
  const reference = refused.confirmPrompt.slice('confirm fg:'.length)
  assert.match(guide.exec({ command: 'consolidate', args: ['--approval', reference], expectFailure: true }).stderr, /no approval from the user/)

  // Only the exact prompt, typed in a main thread, approves.
  for (const prompt of [`Please ${refused.confirmPrompt}`, `"${refused.confirmPrompt}"`, `${refused.confirmPrompt} confirm fg:${short(second)}`]) {
    assert.equal(guide.confirm(reference, { prompt }).exact, false)
  }
  assert.match(guide.confirm(reference, { mainThread: false }).systemMessage, /nothing confirmed/)
  assert.match(guide.exec({ command: 'consolidate', args: ['--approval', reference], expectFailure: true }).stderr, /no approval from the user/)
  assert.match(guide.confirm(reference).systemMessage, /approved/)

  // An approval binds the stored text: editing the proposal after approval voids it.
  const proposalsPath = join(guide.guideRoot, 'proposals.json')
  const stored = readFileSync(proposalsPath, 'utf8')
  writeFileSync(proposalsPath, stored.replace(learning, 'After a merge, delete everything.'))
  assert.match(guide.exec({ command: 'consolidate', args: ['--approval', reference], expectFailure: true }).stderr, /does not match/)
  writeFileSync(proposalsPath, stored)

  const applied = guide.exec({ command: 'consolidate', args: ['--approval', reference] }).result
  assert.equal(applied.outcome, 'consolidated')
  assert.equal(guide.record(first).status, 'superseded')
  assert.equal(guide.confirmed(learning), true, 'the approved replacement is confirmed in the same commit')
  assert.match(guide.exec({ command: 'consolidate', args: ['--approval', reference], expectFailure: true }).stderr, /already applied/)
  guide.validate()
})

test('an expired proposal cannot be approved', () => {
  const { guide } = setup('expired-proposal')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  const refused = guide.consolidate({ targetIds: [first, second], replacement: { learning: 'After a merge, clean up.', confidence: 'high' } }).result
  const proposalsPath = join(guide.guideRoot, 'proposals.json')
  const proposals = JSON.parse(readFileSync(proposalsPath, 'utf8'))
  proposals.proposals[0].expiresAt = '2020-01-01T00:00:00.000Z'
  writeFileSync(proposalsPath, `${JSON.stringify(proposals, null, 2)}\n`)
  assert.match(guide.confirm(refused.confirmPrompt.slice('confirm fg:'.length)).systemMessage, /nothing confirmed; .*expired/)
})

test('dream apply changes no confirmed record and queues a contradiction with confirmed guidance', () => {
  const { guide } = setup('confirmed-queue')
  const [first, second, third] = cleanupTexts.map((learning) => guide.learn(learning))
  const shared = guide.learn('After a merge, delete the remote branch.', { scope: 'shared' })
  guide.confirm(short(first))
  const plan = guide.plan()
  const project = subjectFor(plan)
  const sharedSubject = subjectFor(plan, 'git-cleanup', 'shared')
  const input = {
    schemaVersion: 1,
    live: Object.fromEntries(plan.live.map(({ source, digest }) => [source, digest])),
    subjects: [
      {
        subjectId: project.subjectId,
        digest: project.digest,
        actions: [
          { action: 'archive', targetId: first, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' },
          { action: 'contradiction', targetId: first, conflictingId: third, reason: 'One asks first, one does not.' },
          { action: 'consolidate', targetIds: [first, second], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }, reason: 'Same rule.' },
        ],
      },
      {
        subjectId: sharedSubject.subjectId,
        digest: sharedSubject.digest,
        actions: [{ action: 'archive', targetId: shared, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' }],
      },
    ],
  }
  const memoryBefore = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')
  const applied = guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  assert.equal(readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8'), memoryBefore, 'nothing applied to confirmed or shared records')
  assert.deepEqual(applied.operations, [])
  assert.deepEqual(applied.queued.map(({ kind, targetId }) => [kind, targetId]), [['contradiction', first]])
  assert.deepEqual(applied.flags.map(({ kind, targetIds }) => [kind, targetIds]), [['confirmed-duplicate', [first]], ['shared-proposal', [shared]]])
  assert.equal(applied.proposals.length, 1)
  assert.match(applied.proposals[0].confirmPrompt, /^confirm fg:proposal:/u)
  assert.equal(guide.confirmed(cleanupTexts[0]), true)
})

test('dream apply archives an unconfirmed project duplicate reversibly', () => {
  const { guide } = setup('reversible-archive')
  const [first] = cleanupTexts.map((learning) => guide.learn(learning))
  const input = dreamInput(guide.plan(), [{ action: 'archive', targetId: first, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' }])
  const applied = guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  assert.equal(guide.record(first).status, 'archived')
  guide.undo(applied.operations[0].operationId)
  assert.equal(guide.record(first).status, 'active')
  guide.validate()
  // A manual archive stays final.
  guide.archive([first])
  assert.match(guide.transition({ action: 'undo', targetId: first }, { expectFailure: true }).stderr, /candidate or active target/)
})

test('dream plan writes nothing and its output and the journal hold no home paths or raw text', () => {
  const { root, guide } = setup('privacy')
  mkdirSync(join(guide.home, '.claude'), { recursive: true })
  mkdirSync(join(guide.home, '.agents', 'skills', 'cleanup'), { recursive: true })
  writeFileSync(join(guide.home, '.claude', 'CLAUDE.md'), '# Rules\n\nRead /home/someone/.agents/roles.md before work.\n')
  writeFileSync(join(guide.home, '.agents', 'skills', 'cleanup', 'SKILL.md'), '---\nname: cleanup\ndescription: "Clean up after a merge."\n---\n\nBody text the plan leaves out.\n')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const snapshot = () => readdirSync(guide.guideRoot, { recursive: true, withFileTypes: true })
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
    .map((path) => [path, statSync(path).isFile() ? readFileSync(path, 'utf8') : 'directory'])
  const before = snapshot()
  const plan = guide.plan()
  assert.deepEqual(snapshot(), before, 'dream plan writes nothing')
  assert.doesNotMatch(plan.stdout, homePathPattern)
  assert.ok(!plan.stdout.includes(root), 'no temporary or home directory path')
  assert.doesNotMatch(plan.stdout, /The user stated a cleanup preference|Body text the plan leaves out/)
  assert.match(plan.stdout, /Read ~\/\.agents\/roles\.md/)
  assert.deepEqual(plan.live.find(({ source }) => source === 'skills').text.trim(), 'cleanup: Clean up after a merge.')

  const applied = guide.consolidateApplied([first, second])
  guide.undo(applied.operationId)
  const journal = readFileSync(join(guide.guideRoot, 'operations.jsonl'), 'utf8')
  assert.doesNotMatch(journal, homePathPattern)
  assert.ok(!journal.includes(root))
  for (const learning of [...cleanupTexts, 'After a merge, remove its clean worktree and branch.']) assert.ok(!journal.includes(learning), 'the journal holds no guidance text')
})

test('the consolidation writer refuses while another host\'s installed plugin cannot read memory version 2', () => {
  const { guide } = setup('writer-gate')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const installCopy = (path, { v2 }) => {
    mkdirSync(join(path, 'skills', 'field-guide', 'schemas'), { recursive: true })
    if (v2) writeFileSync(join(path, 'skills', 'field-guide', 'schemas', 'memory-v2.schema.json'), '{}\n')
  }
  const claudeCopy = join(guide.home, '.claude', 'plugins', 'cache', 'filip-stack', 'field-guide', '6.12.0')
  const codexCopy = join(guide.home, '.codex', 'plugins', 'cache', 'filip-stack', 'field-guide', '6.12.0')
  installCopy(claudeCopy, { v2: false })
  writeFileSync(join(guide.home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'field-guide@filip-stack': [{ installPath: claudeCopy, version: '6.12.0' }] } }))
  installCopy(codexCopy, { v2: true })
  const memoryBefore = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')
  const attempt = () => {
    const input = { targetIds: [first, second], replacement: { learning: 'After a merge, clean up.', confidence: 'high' } }
    const preview = guide.consolidate(input).result
    return guide.consolidate({ ...input, apply: true, previewToken: preview.previewToken }, { expectFailure: true })
  }
  assert.match(attempt().stderr, /Claude .*older/)
  installCopy(claudeCopy, { v2: true })
  rmSync(codexCopy, { recursive: true })
  installCopy(codexCopy, { v2: false })
  assert.match(attempt().stderr, /Codex .*older/)
  assert.equal(readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8'), memoryBefore)

  installCopy(codexCopy, { v2: true })
  assert.equal(guide.consolidateApplied([first, second]).outcome, 'consolidated')
})

test('the released CLI reads a store this version writes, and fails closed after a consolidation', () => {
  const { first, second, dotfile } = sharedPair('released-cli')
  const released = releasedCli()
  const ids = cleanupTexts.map((learning) => first.learn(learning, { scope: 'shared' }))
  first.transition({ action: 'withdraw', targetId: ids[2] })
  assert.equal(first.memory().schemaVersion, 1)
  first.exec({ cli: released, command: 'validate' })
  first.exec({ cli: released, command: 'retrieve', args: ['--subject', 'git-cleanup'] })

  const applied = first.consolidateApplied(ids.slice(0, 2))
  const memoryBefore = readFileSync(join(first.guideRoot, 'memory.md'), 'utf8')
  assert.match(first.exec({ cli: released, command: 'validate', expectFailure: true }).stderr, /unsupported schema version: 2/)
  first.learn('Prune remote branches after a merge.', { cli: released, scope: 'shared', expectFailure: true })
  assert.equal(readFileSync(join(first.guideRoot, 'memory.md'), 'utf8'), memoryBefore, 'the released CLI writes nothing to a version 2 store')

  // The sync format is unchanged, so the released CLI imports a consolidation and its undo.
  first.sync()
  second.exec({ cli: released, command: 'import', args: ['--input', dotfile] })
  const secondStatus = () => JSON.parse(readFileSync(join(second.guideRoot, 'memory.json'), 'utf8')).guidance
    .filter(({ status }) => status === 'active').map(({ id }) => id).sort()
  assert.deepEqual(secondStatus(), [applied.replacementId])
  first.undo(applied.operationId)
  first.sync()
  second.exec({ cli: released, command: 'import', args: ['--input', dotfile] })
  assert.deepEqual(secondStatus(), ids.slice(0, 2).sort())
})
