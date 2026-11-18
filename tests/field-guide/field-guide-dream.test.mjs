import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
    learn: (learning, { scope = 'project', subjectKey = 'git-cleanup', turnId =learning.toLowerCase().replace(/[^a-z0-9]+/gu, '-'), cli, expectFailure = false, explicitPreference = true, linkedSubjects } = {}) => {
      const output = exec({
        cli,
        expectFailure,
        command: 'submit',
      args: ['--input', inputFile({
        schemaVersion: 1,
        decision: 'capture',
        confidence: 'high',
        scope,
        subjectKey,
        learning,
        explicitPreference,
        ...(linkedSubjects ? { linkedSubjects } : {}),
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
    // Live guidance that a dream action can name as `live:claude-md`.
    writeClaudeMd: (text = '# Rules\n\nClean up after a merge.\n') => {
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(join(home, '.claude', 'CLAUDE.md'), text)
    },
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
  // Like the consolidation, the undo journals the revocations it mints, so a crash never lowers protection.
  const undoEntry = guide.journal().find(({ type, operationId }) => type === 'pending' && operationId === undone.operationId)
  assert.equal(undoEntry.revocationIds.length, 4)
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

test('transition undo and withdraw refuse a consolidated replacement and name undo-operation', () => {
  const { guide } = setup('transition-undo-refused')
  const [first, second, third] = cleanupTexts.map((learning) => guide.learn(learning))
  const applied = guide.consolidateApplied([first, second])
  for (const action of ['undo', 'withdraw']) {
    const refused = guide.transition({ action, targetId: applied.replacementId }, { expectFailure: true })
    assert.match(refused.stderr, new RegExp(`${action} cannot retire a consolidated replacement; run undo-operation --id ${applied.operationId}`))
  }
  assert.equal(guide.record(applied.replacementId).status, 'active')
  // A replacement that still supersedes records cannot itself be consolidated.
  const refused = guide.consolidate({ targetIds: [applied.replacementId, third], replacement: { learning: 'Clean up merges.', confidence: 'high' } }, { expectFailure: true })
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

test('a crash between a dream run\'s memory commit and its run entry recovers the run', () => {
  const { root, guide } = setup('run-recovery')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const input = dreamInput(guide.plan(), [{ action: 'consolidate', targetIds: [first, second], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }, reason: 'Same rule.' }])
  const { previewToken } = guide.dreamApply(input)
  const snapshot = join(root, 'guide-before-apply')
  cpSync(guide.guideRoot, snapshot, { recursive: true })
  const applied = guide.dreamApply(input, { previewToken })
  const journalPath = join(guide.guideRoot, 'operations.jsonl')
  const lines = readFileSync(journalPath, 'utf8').trim().split('\n')

  // Memory committed and the run entry is missing: the retry records the run and returns its result.
  writeFileSync(journalPath, `${lines.filter((line) => JSON.parse(line).type !== 'run').join('\n')}\n`)
  const retried = guide.dreamApply(input, { previewToken })
  assert.equal(retried.outcome, 'already-applied')
  assert.deepEqual(retried.operations, applied.operations)
  assert.ok(guide.journal().some(({ type, runId, recovered }) => type === 'run' && runId === applied.runId && recovered === true))

  // Memory never written: recovery aborts the operation and records no run, so a new preview applies it.
  rmSync(guide.guideRoot, { recursive: true })
  cpSync(snapshot, guide.guideRoot, { recursive: true })
  writeFileSync(journalPath, `${lines.filter((line) => !['commit', 'run'].includes(JSON.parse(line).type)).join('\n')}\n`)
  const reapplied = guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  assert.equal(reapplied.outcome, 'applied')
  assert.equal(guide.record(first).status, 'superseded')
  assert.equal(guide.journal().filter(({ type, runId }) => type === 'run' && runId === applied.runId).length, 1)
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
  assert.match(rejected.stderr, /subjects\[0\]\.actions\[0\] \(consolidate\) rejected: .*declined.*; the run applied nothing/)
})

test('an undone consolidation of confirmed records is declined and not proposed again', () => {
  const { guide } = setup('declined-proposal')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  const input = { targetIds: [first, second], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' } }
  const reference = guide.consolidate(input).result.confirmPrompt.slice('confirm fg:'.length)
  guide.confirm(reference)
  const applied = guide.exec({ command: 'consolidate', args: ['--approval', reference] }).result
  guide.undo(applied.operationId)
  // A restore revokes confirmations, so the user confirms the record again. The withdrawn
  // replacement keeps its text, so a new proposal for the set needs new text.
  guide.confirm(short(first))
  const retry = { ...input, replacement: { learning: 'After a merge, clean up its worktree and branch.', confidence: 'high' } }
  assert.match(guide.consolidate(retry, { expectFailure: true }).stderr, /declined/)
  assert.equal(JSON.parse(readFileSync(join(guide.guideRoot, 'proposals.json'), 'utf8')).proposals.length, 1)
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
  const next = guide.plan()
  assert.equal(subjectFor(next), undefined, 'a subject the run resolved is not reviewed again')
  assert.equal(next.skippedSubjects, 1)
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
  assert.match(guide.confirm(reference).systemMessage, /approved .*the replacement will be confirmed/)

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
  const fourth = guide.learn('After a merge, delete its worktree and branch without asking.')
  const shared = guide.learn('After a merge, delete the remote branch.', { scope: 'shared' })
  guide.confirm(short(first))
  guide.confirm(short(second))
  guide.writeClaudeMd()
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
          { action: 'contradiction', targetId: second, conflictingId: third, reason: 'One asks first, one does not.' },
          { action: 'consolidate', targetIds: [first, fourth], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }, reason: 'Same rule.' },
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
  assert.deepEqual(applied.queued.map(({ kind, targetId }) => [kind, targetId]), [['contradiction', second]])
  assert.deepEqual(applied.flags.map(({ kind, targetIds }) => [kind, targetIds]), [['confirmed-duplicate', [first]], ['shared-proposal', [shared]]])
  assert.equal(applied.proposals.length, 1)
  assert.match(applied.proposals[0].confirmPrompt, /^confirm fg:proposal:/u)
  assert.equal(guide.confirmed(cleanupTexts[0]), true)
  // Queued decisions and flags live only in the report, so their subjects are reviewed again.
  const next = guide.plan()
  assert.ok(subjectFor(next) && subjectFor(next, 'git-cleanup', 'shared'))
})

test('dream apply archives an unconfirmed project duplicate reversibly', () => {
  const { guide } = setup('reversible-archive')
  const [first] = cleanupTexts.map((learning) => guide.learn(learning))
  guide.writeClaudeMd()
  const input = dreamInput(guide.plan(), [{ action: 'archive', targetId: first, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' }])
  const applied = guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  assert.equal(guide.record(first).status, 'archived')
  assert.equal(guide.memory().schemaVersion, 2, 'a journaled archive alone makes the store version 2')
  const undone = guide.undo(applied.operations[0].operationId).result
  assert.equal(guide.record(first).status, 'active')
  assert.match(guide.undo(undone.operationId, { expectFailure: true }).stderr, /cannot undo an undo; archive the record again/)
  guide.validate()
  // A manual archive stays final.
  guide.archive([first])
  assert.match(guide.transition({ action: 'undo', targetId: first }, { expectFailure: true }).stderr, /candidate or active target/)
})

test('an approval binds the exact replacement text and whether the replacement is confirmed', () => {
  const { guide } = setup('approval-binding')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  const learning = 'After a merge, remove its clean worktree and branch.'
  const reference = guide.consolidate({ targetIds: [first, second], replacement: { learning, confidence: 'high' } }).result.confirmPrompt.slice('confirm fg:'.length)
  assert.match(guide.confirm(reference).systemMessage, /approved .*the replacement will be confirmed/)

  const proposalsPath = join(guide.guideRoot, 'proposals.json')
  const stored = readFileSync(proposalsPath, 'utf8')
  assert.match(stored, /"confirmsReplacement": true/)
  const tampered = stored.replace('"confirmsReplacement": true', '"confirmsReplacement": false')
    .replace(/"confirmedFingerprints": \[[^\]]*\]/u, '"confirmedFingerprints": []')
  writeFileSync(proposalsPath, tampered)
  assert.match(guide.exec({ command: 'consolidate', args: ['--approval', reference], expectFailure: true }).stderr, /does not match/)
  writeFileSync(proposalsPath, stored)

  // The approval binds the exact text, not only the case-folded fingerprint.
  writeFileSync(proposalsPath, stored.replace(learning, learning.toUpperCase()))
  assert.match(guide.exec({ command: 'consolidate', args: ['--approval', reference], expectFailure: true }).stderr, /does not match/)
  writeFileSync(proposalsPath, stored)

  const result = guide.exec({ command: 'consolidate', args: ['--approval', reference] }).result
  assert.equal(result.confirmed, true)
  assert.equal(guide.record(first).status, 'superseded')
  assert.equal(guide.confirmed(learning), true)
})

test('a dream run keeps every record another action names as its duplicate', () => {
  const { guide } = setup('kept-duplicates')
  const [first, second, third] = cleanupTexts.map((learning) => guide.learn(learning))
  const plan = guide.plan()
  const archive = (targetId, duplicateOf) => ({ action: 'archive', targetId, duplicateOf, reason: 'Same as the other.' })
  for (const actions of [
    [archive(first, second), archive(second, first)],
    [archive(first, second), archive(second, third)],
    [archive(first, second), { action: 'consolidate', targetIds: [second, third], replacement: { learning: 'After a merge, clean up.', confidence: 'high' }, reason: 'Same rule.' }],
  ]) {
    const rejected = guide.dreamApply(dreamInput(plan, actions), { expectFailure: true })
    assert.match(rejected.stderr, /subjects\[0\]\.actions\[\d\] \((archive|consolidate)\) rejected: .* is kept .*; the run applied nothing/)
  }
  // A shared pair would only be flagged, but two flags that each keep the other still contradict.
  const shared = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning, { scope: 'shared' }))
  const sharedInput = dreamInput(guide.plan(), [archive(shared[0], shared[1]), archive(shared[1], shared[0])], 'git-cleanup', 'shared')
  assert.match(guide.dreamApply(sharedInput, { expectFailure: true }).stderr, /actions\[0\] \(archive\) rejected: .* is kept /)
  assert.deepEqual(guide.activeIds(), [first, second, third, ...shared].sort())
  assert.equal(guide.journal().length, 0)
})

test('a live source that is absent cannot be named as a duplicate or a live edit', () => {
  const { guide } = setup('absent-live')
  const [first] = cleanupTexts.map((learning) => guide.learn(learning))
  const plan = guide.plan()
  for (const action of [
    { action: 'archive', targetId: first, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' },
    { action: 'flag', kind: 'live-edit', targetIds: [first], source: 'claude-md', reason: 'Global guidance should say this.' },
  ]) {
    assert.match(guide.dreamApply(dreamInput(plan, [action]), { expectFailure: true }).stderr, /live guidance claude-md is not present on this machine/)
  }
  assert.equal(guide.record(first).status, 'active')
})

test('dream apply refuses to archive a consolidated replacement before it writes anything', () => {
  const { guide } = setup('archive-replacement')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const applied = guide.consolidateApplied([first, second])
  guide.writeClaudeMd()
  const files = () => ['memory.md', 'annotations.json', 'operations.jsonl'].map((name) => readFileSync(join(guide.guideRoot, name), 'utf8'))
  const before = files()
  const input = dreamInput(guide.plan(), [{ action: 'archive', targetId: applied.replacementId, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' }])
  assert.match(guide.dreamApply(input, { expectFailure: true }).stderr, /still replaces superseded guidance.*; the run applied nothing/)
  assert.deepEqual(files(), before)
  guide.validate()
})

// Time passes: the stored proposal and the run that stored it both record its expiry.
const expireProposal = (guide) => {
  const { expiresAt } = JSON.parse(readFileSync(join(guide.guideRoot, 'proposals.json'), 'utf8')).proposals[0]
  for (const name of ['proposals.json', 'operations.jsonl']) {
    const path = join(guide.guideRoot, name)
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll(expiresAt, '2020-01-01T00:00:00.000Z'))
  }
}

test('an expired proposal makes its subject reviewable again', () => {
  const { guide } = setup('expired-schedule')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  const input = dreamInput(guide.plan(), [{ action: 'consolidate', targetIds: [first, second], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }, reason: 'Same rule.' }])
  assert.equal(guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken }).proposals.length, 1)
  assert.equal(subjectFor(guide.plan()), undefined, 'a pending proposal waits for the user')

  expireProposal(guide)
  assert.ok(subjectFor(guide.plan()), 'an expired proposal is reviewed again')

  // The same review proposes it again with a new expiry, and the subject waits again.
  const again = guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  assert.equal(again.outcome, 'applied')
  assert.ok(Date.parse(again.proposals[0].expiresAt) > Date.now())
  assert.equal(subjectFor(guide.plan()), undefined)
})

test('dream plan writes nothing and its output and the journal hold no home paths or raw text', () => {
  const { root, guide } = setup('privacy')
  mkdirSync(join(guide.home, '.claude'), { recursive: true })
  mkdirSync(join(guide.home, '.agents', 'skills', 'cleanup'), { recursive: true })
  writeFileSync(join(guide.home, '.claude', 'CLAUDE.md'), '# Rules\n\nRead /home/someone/.agents/roles.md before work.\nSee https://example.test/page?ticket=4711 and set api_key = hunter2value.\nUser: keep my private plan here\n-----BEGIN PRIVATE KEY-----\nMIIBVgIBADANBgkq\n-----END PRIVATE KEY-----\nOr http://example.test/x?session=abc\n')
  writeFileSync(join(guide.home, '.agents', 'skills', 'cleanup', 'SKILL.md'), '---\nname: cleanup\ndescription: "Clean up after a merge."\n---\n\nBody text the plan leaves out.\n')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const shared = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning, { scope: 'shared' }))
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
  assert.doesNotMatch(plan.stdout, /ticket=4711|hunter2value|private plan|MIIBVgIBADANBgkq|session=abc/, 'live text is redacted like stored text')
  assert.deepEqual(plan.live.find(({ source }) => source === 'skills').text.trim(), 'cleanup: Clean up after a merge.')
  const withoutLive = { ...dreamInput(plan, [{ action: 'flag', kind: 'conflict', targetIds: [first], reason: 'Conflicts.' }]), live: {} }
  assert.match(guide.dreamApply(withoutLive, { expectFailure: true }).stderr, /live guidance claude-md changed since the plan/)

  // A run entry holds its report, here two flags, without guidance text.
  const sharedSubject = subjectFor(plan, 'git-cleanup', 'shared')
  const flagged = dreamInput(plan, [{ action: 'flag', kind: 'conflict', targetIds: [first], reason: 'Conflicts.' }])
  const run = {
    ...flagged,
    subjects: [
      ...flagged.subjects,
      { subjectId: sharedSubject.subjectId, digest: sharedSubject.digest, actions: [{ action: 'consolidate', targetIds: shared, replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }, reason: 'Same rule.' }] },
    ],
  }
  const dreamed = guide.dreamApply(run, { previewToken: guide.dreamApply(run).previewToken })
  assert.deepEqual(dreamed.flags.map(({ kind }) => kind), ['conflict', 'shared-overlap'])

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
  const applied = guide.consolidateApplied([first, second])
  assert.equal(applied.outcome, 'consolidated')

  // Every writer of version 2 checks: undo and a nightly change refuse while a copy is older.
  rmSync(codexCopy, { recursive: true })
  installCopy(codexCopy, { v2: false })
  assert.match(guide.undo(applied.operationId, { expectFailure: true }).stderr, /Codex .*older/)
  guide.writeClaudeMd()
  const third = guide.activeIds().find((id) => id !== applied.replacementId)
  const archive = dreamInput(guide.plan(), [{ action: 'archive', targetId: third, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' }])
  const preview = guide.dreamApply(archive)
  assert.match(guide.dreamApply(archive, { previewToken: preview.previewToken, expectFailure: true }).stderr, /Codex .*older/)
  assert.equal(guide.record(third).status, 'active')
})

test('the writer gate checks only the Codex copy that loads', () => {
  const { guide } = setup('writer-gate-newest')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const installCopy = ({ marketplace, version, v2 }) => {
    const path = join(guide.home, '.codex', 'plugins', 'cache', marketplace, 'field-guide', version, 'skills', 'field-guide', 'schemas')
    mkdirSync(path, { recursive: true })
    if (v2) writeFileSync(join(path, 'memory-v2.schema.json'), '{}\n')
  }
  // Codex loads the newest version of each installed plugin; an older directory is a stale leftover.
  installCopy({ marketplace: 'filip-stack', version: '6.9.0', v2: false })
  installCopy({ marketplace: 'filip-stack', version: '6.12.0', v2: true })
  // config.toml names the installed plugins, so a marketplace it does not list is ignored.
  installCopy({ marketplace: 'retired', version: '9.0.0', v2: false })
  writeFileSync(join(guide.home, '.codex', 'config.toml'), '[plugins."field-guide@filip-stack"]\nenabled = true\n')
  const input = { targetIds: [first, second], replacement: { learning: 'After a merge, clean up.', confidence: 'high' } }
  const preview = guide.consolidate(input).result
  installCopy({ marketplace: 'filip-stack', version: '6.13.0', v2: false })
  assert.match(guide.consolidate({ ...input, apply: true, previewToken: preview.previewToken }, { expectFailure: true }).stderr, /Codex .*6\.13\.0 is older/)
  rmSync(join(guide.home, '.codex', 'plugins', 'cache', 'filip-stack', 'field-guide', '6.13.0'), { recursive: true })
  assert.equal(guide.consolidate({ ...input, apply: true, previewToken: preview.previewToken }).result.outcome, 'consolidated')
})

test('the released CLI reads a store this version writes, and fails closed after a consolidation', () => {
  const { guide } = setup('released-cli')
  const released = releasedCli()
  const ids = cleanupTexts.map((learning) => guide.learn(learning))
  guide.transition({ action: 'withdraw', targetId: ids[2] })
  assert.equal(guide.memory().schemaVersion, 1)
  guide.exec({ cli: released, command: 'validate' })
  guide.exec({ cli: released, command: 'retrieve', args: ['--subject', 'git-cleanup'] })

  guide.consolidateApplied(ids.slice(0, 2))
  const memoryBefore = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')
  assert.match(guide.exec({ cli: released, command: 'validate', expectFailure: true }).stderr, /unsupported schema version: 2/)
  guide.learn('Prune remote branches after a merge.', { cli: released, expectFailure: true })
  assert.equal(readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8'), memoryBefore, 'the released CLI writes nothing to a version 2 store')
})

const guideFiles = (guide, names = ['memory.md', 'annotations.json', 'operations.jsonl', 'proposals.json']) => names.map((name) => {
  const path = join(guide.guideRoot, name)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
})

test('approval refuses a proposal whose records\' confirmation changed since it was stored', () => {
  const learning = 'After a merge, remove its clean worktree and branch.'
  const changed = /confirmation of a record in proposal [0-9a-f]+ changed since it was stored; propose it again/

  // The user confirmed a record, approved the proposal, then withdrew the confirmation.
  const { guide: withdrawn } = setup('confirmation-withdrawn')
  const [first, second] = cleanupTexts.slice(0, 2).map((text) => withdrawn.learn(text))
  withdrawn.confirm(short(first))
  const proposal = withdrawn.consolidate({ targetIds: [first, second], replacement: { learning, confidence: 'high' } }).result
  assert.equal(proposal.confirmsReplacement, true)
  const reference = proposal.confirmPrompt.slice('confirm fg:'.length)
  withdrawn.confirm(reference)
  withdrawn.exec({ command: 'unconfirm', args: ['--id', short(first)] })
  const before = guideFiles(withdrawn)
  assert.match(withdrawn.exec({ command: 'consolidate', args: ['--approval', reference], expectFailure: true }).stderr, changed)
  assert.deepEqual(guideFiles(withdrawn), before)
  assert.equal(withdrawn.confirmed(learning), false)

  // The user confirmed one record, approved the proposal, then confirmed the other record too.
  const { guide: granted } = setup('confirmation-granted')
  const pair = cleanupTexts.slice(0, 2).map((text) => granted.learn(text))
  granted.confirm(short(pair[0]))
  const grantedReference = granted.consolidate({ targetIds: pair, replacement: { learning, confidence: 'high' } }).result.confirmPrompt.slice('confirm fg:'.length)
  granted.confirm(grantedReference)
  granted.confirm(short(pair[1]))
  const grantedBefore = guideFiles(granted)
  assert.match(granted.exec({ command: 'consolidate', args: ['--approval', grantedReference], expectFailure: true }).stderr, changed)
  assert.deepEqual(guideFiles(granted), grantedBefore)
  assert.equal(granted.record(pair[1]).status, 'active')

  // The user confirmed both records, approved the proposal, then withdrew one confirmation.
  const { guide: narrowed } = setup('confirmation-narrowed')
  const both = cleanupTexts.slice(0, 2).map((text) => narrowed.learn(text))
  both.forEach((id) => narrowed.confirm(short(id)))
  const narrowedReference = narrowed.consolidate({ targetIds: both, replacement: { learning, confidence: 'high' } }).result.confirmPrompt.slice('confirm fg:'.length)
  narrowed.confirm(narrowedReference)
  narrowed.exec({ command: 'unconfirm', args: ['--id', short(both[1])] })
  const narrowedBefore = guideFiles(narrowed)
  assert.match(narrowed.exec({ command: 'consolidate', args: ['--approval', narrowedReference], expectFailure: true }).stderr, changed)
  assert.deepEqual(guideFiles(narrowed), narrowedBefore)
})

test('a crash during an approved consolidation leaves its records unconfirmed until the approval is retried', () => {
  const { root, guide } = setup('approval-crash')
  const [first, second] = cleanupTexts.slice(0, 2).map((text) => guide.learn(text))
  guide.confirm(short(first))
  const learning = 'After a merge, remove its clean worktree and branch.'
  const reference = guide.consolidate({ targetIds: [first, second], replacement: { learning, confidence: 'high' } }).result.confirmPrompt.slice('confirm fg:'.length)
  guide.confirm(reference)
  const snapshot = join(root, 'guide-before-approval')
  cpSync(guide.guideRoot, snapshot, { recursive: true })
  guide.exec({ command: 'consolidate', args: ['--approval', reference] })

  // The crash: the pending entry and annotations were written, memory and the commit were not.
  const journal = readFileSync(join(guide.guideRoot, 'operations.jsonl'), 'utf8').trim().split('\n').filter((line) => JSON.parse(line).type !== 'commit')
  const annotations = readFileSync(join(guide.guideRoot, 'annotations.json'), 'utf8')
  rmSync(guide.guideRoot, { recursive: true })
  cpSync(snapshot, guide.guideRoot, { recursive: true })
  writeFileSync(join(guide.guideRoot, 'operations.jsonl'), `${journal.join('\n')}\n`)
  writeFileSync(join(guide.guideRoot, 'annotations.json'), annotations)
  assert.equal(guide.confirmed(cleanupTexts[0]), false, 'the crash fails closed')

  const crashed = join(root, 'guide-after-crash')
  cpSync(guide.guideRoot, crashed, { recursive: true })

  // The replacement never landed, so its confirmation is project data that export leaves out.
  const { replacementFingerprint } = guide.journal().find(({ type }) => type === 'pending')
  const exportedAnnotations = join(root, 'annotations-export.json')
  guide.exec({ command: 'export', args: ['--output', join(root, 'shared-export.json'), '--annotations', exportedAnnotations] })
  assert.equal(JSON.parse(readFileSync(exportedAnnotations, 'utf8')).records[replacementFingerprint], undefined)
  rmSync(guide.guideRoot, { recursive: true })
  cpSync(crashed, guide.guideRoot, { recursive: true })

  // Only the crash's own revocation is excused: a confirmation withdrawn after it still blocks the retry.
  guide.confirm(short(first))
  guide.exec({ command: 'unconfirm', args: ['--id', short(first)] })
  assert.match(guide.exec({ command: 'consolidate', args: ['--approval', reference], expectFailure: true }).stderr, /changed since it was stored/)
  assert.equal(guide.confirmed(learning), false)
  assert.deepEqual([first, second].map((id) => guide.record(id).status), ['active', 'active'])
  rmSync(guide.guideRoot, { recursive: true })
  cpSync(crashed, guide.guideRoot, { recursive: true })

  // Automation still treats the records as confirmed: the crash, not the user, revoked them.
  const archive = dreamInput(guide.plan(), [{ action: 'archive', targetId: first, duplicateOf: second, reason: 'Same rule.' }])
  guide.dreamApply(archive, { previewToken: guide.dreamApply(archive).previewToken })
  assert.equal(guide.record(first).status, 'active')
  rmSync(guide.guideRoot, { recursive: true })
  cpSync(crashed, guide.guideRoot, { recursive: true })

  const applied = guide.exec({ command: 'consolidate', args: ['--approval', reference] }).result
  assert.equal(applied.confirmed, true)
  assert.equal(guide.confirmed(learning), true)
  assert.ok(guide.journal().some(({ type }) => type === 'abort'))
  guide.validate()
})

test('a dream archive names only an active record as its duplicate', () => {
  const { guide } = setup('duplicate-active')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const candidate = guide.learn('After a merge, tidy up the merged worktree.', { explicitPreference: false })
  assert.equal(guide.record(candidate).status, 'candidate')
  guide.transition({ action: 'withdraw', targetId: second })
  const plan = guide.plan()
  for (const [duplicateOf, status] of [[candidate, 'candidate'], [second, 'withdrawn']]) {
    const rejected = guide.dreamApply(dreamInput(plan, [{ action: 'archive', targetId: first, duplicateOf, reason: 'Same as the other.' }]), { expectFailure: true })
    assert.match(rejected.stderr, new RegExp(`actions\\[0\\] \\(archive\\) rejected: duplicateOf must name an active record: [0-9a-f]+ is ${status}; the run applied nothing`))
  }
  assert.equal(guide.record(first).status, 'active')
})

test('a consolidation whose result the store would reject fails before it writes anything', () => {
  const { guide } = setup('invalid-result')
  // Each record links 9 subjects; their union exceeds the 16 a record may link.
  const linked = (prefix) => Array.from({ length: 9 }, (_, index) => `${prefix}-${index}`)
  const [first, second] = cleanupTexts.slice(0, 2).map((learning, index) => guide.learn(learning, { linkedSubjects: linked(`linked-${index}`) }))
  const input = { targetIds: [first, second], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' } }
  const before = guideFiles(guide)
  assert.match(guide.consolidate(input, { expectFailure: true }).stderr, /linkedSubjects/)
  const dream = dreamInput(guide.plan(), [{ action: 'consolidate', ...input, reason: 'Same rule.' }])
  assert.match(guide.dreamApply(dream, { expectFailure: true }).stderr, /actions\[0\] \(consolidate\) rejected: .*linkedSubjects.*; the run applied nothing/)
  assert.deepEqual(guideFiles(guide), before)

  // A confirmed record would make it a proposal; an invalid result stores none.
  guide.confirm(short(first))
  const confirmed = guideFiles(guide)
  assert.match(guide.consolidate(input, { expectFailure: true }).stderr, /linkedSubjects/)
  assert.deepEqual(guideFiles(guide), confirmed)
})

test('dream plan digests the plugin skill contracts each host loads', () => {
  const { root, guide } = setup('plugin-skills')
  guide.learn(cleanupTexts[0])
  const writeSkill = ({ path, description }) => {
    mkdirSync(join(path, 'skills', 'engineering'), { recursive: true })
    writeFileSync(join(path, 'skills', 'engineering', 'SKILL.md'), `---\nname: engineering\ndescription: "${description}"\n---\n\nBody text the plan leaves out.\n`)
  }
  const claudeCopy = join(guide.home, '.claude', 'plugins', 'cache', 'filip-stack', 'workflow', '6.12.0')
  writeSkill({ path: claudeCopy, description: 'Use for an authorized code change.' })
  writeFileSync(join(guide.home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'workflow@filip-stack': [{ installPath: claudeCopy, version: '6.12.0' }] } }))
  // Codex loads the newest cached version; the older directory is a leftover.
  const codexCache = join(guide.home, '.codex', 'plugins', 'cache', 'filip-stack', 'workflow')
  writeSkill({ path: join(codexCache, '6.11.0'), description: 'A stale contract Codex no longer loads.' })
  writeSkill({ path: join(codexCache, '6.12.0'), description: 'Use for an authorized code change.' })
  writeFileSync(join(guide.home, '.codex', 'config.toml'), '[plugins."workflow@filip-stack"]\nenabled = true\n')

  const plan = guide.plan()
  const pluginSkills = plan.live.find(({ source }) => source === 'plugin-skills')
  assert.equal(pluginSkills.text, 'workflow:engineering: Use for an authorized code change.')
  assert.doesNotMatch(plan.stdout, homePathPattern)
  assert.ok(!plan.stdout.includes(root))
  assert.doesNotMatch(plan.stdout, /stale contract|Body text the plan leaves out/)

  // A change to a loaded contract changes the digest.
  writeSkill({ path: join(codexCache, '6.12.0'), description: 'Use for any code change.' })
  assert.notEqual(guide.plan().live.find(({ source }) => source === 'plugin-skills').digest, pluginSkills.digest)
})

test('consolidate refuses a declined set without confirmed records, and an undo cannot be undone', () => {
  const { guide } = setup('declined-unconfirmed')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const applied = guide.consolidateApplied([first, second])
  const undone = guide.undo(applied.operationId).result
  const retry = { targetIds: [first, second], replacement: { learning: 'After a merge, clean up its worktree and branch.', confidence: 'high' } }
  assert.match(guide.consolidate(retry, { expectFailure: true }).stderr, /declined/)
  assert.match(guide.undo(undone.operationId, { expectFailure: true }).stderr, /cannot undo an undo; .*declined/)
})

test('replaying a run that applied changes returns its result after its proposal lapses', () => {
  const { guide } = setup('replay-lapsed')
  const [first, second, third] = cleanupTexts.map((learning) => guide.learn(learning))
  guide.confirm(short(second))
  guide.writeClaudeMd()
  const input = dreamInput(guide.plan(), [
    { action: 'archive', targetId: first, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' },
    { action: 'consolidate', targetIds: [second, third], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }, reason: 'Same rule.' },
  ])
  const applied = guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  assert.deepEqual([applied.operations.length, applied.proposals.length], [1, 1])

  expireProposal(guide)
  const replay = guide.dreamApply(input)
  assert.equal(replay.outcome, 'already-applied')
  assert.deepEqual(replay.operations, applied.operations)
  assert.equal(guide.record(first).status, 'archived')
})

test('dream plan counts a run that a crash left without its run entry, and writes nothing', () => {
  const { guide } = setup('plan-recovery')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const input = dreamInput(guide.plan(), [{ action: 'consolidate', targetIds: [first, second], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }, reason: 'Same rule.' }])
  guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  const journalPath = join(guide.guideRoot, 'operations.jsonl')
  const lines = readFileSync(journalPath, 'utf8').trim().split('\n')
  // The crash came after the memory write: before the run entry, or before the commit entry too.
  for (const dropped of [['run'], ['commit', 'run']]) {
    writeFileSync(journalPath, `${lines.filter((line) => !dropped.includes(JSON.parse(line).type)).join('\n')}\n`)
    const journal = readFileSync(journalPath, 'utf8')
    const plan = guide.plan()
    assert.equal(subjectFor(plan), undefined, `a run recovered after dropping ${dropped.join(' and ')} is not reviewed again`)
    assert.equal(readFileSync(journalPath, 'utf8'), journal, 'dream plan writes nothing')
  }
})

test('consolidate refuses shared guidance in a preview, an apply, and an approval', () => {
  const { guide } = setup('shared-refused')
  const shared = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning, { scope: 'shared' }))
  const project = guide.learn(cleanupTexts[2])
  const replacement = { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }
  const before = guideFiles(guide, ['memory.md', 'annotations.json', 'operations.jsonl'])
  const refused = /consolidation of shared guidance is not supported yet: [0-9a-f]+ is shared/
  for (const input of [
    { targetIds: shared, replacement },
    { targetIds: shared, replacement, apply: true, previewToken: 'unused' },
    { targetIds: [project, shared[0]], replacement },
  ]) {
    assert.match(guide.consolidate(input, { expectFailure: true }).stderr, refused)
  }
  // A shared proposal that an earlier build stored, already approved, is refused before its hash is checked.
  const now = Date.now()
  const proposal = {
    id: `proposal:v1:${'a'.repeat(64)}`,
    kind: 'consolidate',
    scope: { kind: 'shared' },
    subjectKey: 'git-cleanup',
    targetFingerprints: shared.map((id) => guide.record(id).fingerprint).sort(),
    replacement,
    confirmsReplacement: false,
    confirmedFingerprints: [],
    reason: 'Same rule.',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 86_400_000).toISOString(),
    approval: { at: new Date(now).toISOString() },
  }
  writeFileSync(join(guide.guideRoot, 'proposals.json'), `${JSON.stringify({ schemaVersion: 1, proposals: [proposal] }, null, 2)}\n`)
  assert.match(guide.exec({ command: 'consolidate', args: ['--approval', 'proposal:aaaaaaaaaaaa'], expectFailure: true }).stderr, refused)
  assert.deepEqual(guideFiles(guide, ['memory.md', 'annotations.json', 'operations.jsonl']), before)
})

test('a dream run flags a shared overlap and neither proposes nor applies it', () => {
  const { guide } = setup('shared-overlap')
  const shared = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning, { scope: 'shared' }))
  const plan = guide.plan()
  assert.deepEqual(subjectFor(plan, 'git-cleanup', 'shared').overlapGroups, [[...shared].sort()], 'the plan still groups shared overlaps')
  const input = dreamInput(plan, [{ action: 'consolidate', targetIds: shared, replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' }, reason: 'Same rule.' }], 'git-cleanup', 'shared')
  const before = guideFiles(guide, ['memory.md', 'annotations.json'])
  const applied = guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  assert.deepEqual(applied.operations, [])
  assert.deepEqual(applied.proposals, [])
  assert.deepEqual(applied.flags.map(({ kind, targetIds }) => [kind, targetIds]), [['shared-overlap', shared]])
  assert.deepEqual(guideFiles(guide, ['memory.md', 'annotations.json']), before)
  assert.equal(existsSync(join(guide.guideRoot, 'proposals.json')), false)
  // A flag lives only in the report, so the subject is reviewed again.
  assert.ok(subjectFor(guide.plan(), 'git-cleanup', 'shared'))
})

test('a store the released CLI accepts with an http query string validates, and the plan redacts it', () => {
  const { guide } = setup('released-http-query')
  const id = guide.learn('Read http://example.test/help?topic=guide before a release.', { cli: releasedCli() })
  assert.equal(guide.memory().schemaVersion, 1)
  guide.validate()
  assert.deepEqual(guide.exec({ command: 'retrieve', args: ['--subject', 'git-cleanup'] }).result.guidance.map((guidance) => guidance.id), [id])
  const plan = guide.plan()
  assert.equal(subjectFor(plan).records[0].learning, '[redacted URL query string]')
  assert.doesNotMatch(plan.stdout, /topic=guide/)
})

test('a dream run keeps the records that a queued contradiction names', () => {
  const { guide } = setup('held-contradiction')
  const [first, second, third] = cleanupTexts.map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  guide.writeClaudeMd()
  const plan = guide.plan()
  const contradiction = { action: 'contradiction', targetId: first, conflictingId: second, reason: 'One asks first, one does not.' }
  for (const change of [
    { action: 'archive', targetId: second, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' },
    { action: 'consolidate', targetIds: [second, third], replacement: { learning: 'After a merge, clean up.', confidence: 'high' }, reason: 'Same rule.' },
  ]) {
    // In either order, the contradiction holds both of its records for the whole run.
    for (const actions of [[contradiction, change], [change, contradiction]]) {
      const rejected = guide.dreamApply(dreamInput(plan, actions), { expectFailure: true })
      assert.match(rejected.stderr, new RegExp(`actions\\[${actions.indexOf(change)}\\] \\(${change.action}\\) rejected: [0-9a-f]+ is kept because a contradiction queued in this run names it; the run applied nothing`))
    }
  }
  assert.deepEqual(guide.activeIds(), [first, second, third].sort())
  assert.equal(guide.journal().length, 0)
})

// Plans with these CLAUDE.md lines and checks that no payload line and every kept line reaches the packet.
const assertPlanRedacts = ({ name, lines, payload, kept }) => {
  const { guide } = setup(name)
  guide.learn(cleanupTexts[0])
  guide.writeClaudeMd([...lines, ''].join('\n'))
  const plan = guide.plan()
  const { text } = plan.live.find(({ source }) => source === 'claude-md')
  assert.doesNotMatch(plan.stdout, payload)
  for (const line of kept) assert.ok(text.includes(line), line)
}

test('dream plan removes raw prompt blocks whole, up to their closing marker', () => {
  assertPlanRedacts({
    name: 'raw-blocks',
    lines: [
      '# Rules',
      'Kept before the blocks.',
      '<user>',
      'payload-one stays private',
      '</user>',
      'Kept after the user block.',
      'BEGIN RAW PROMPT',
      'payload-two stays private',
      'END',
      'Kept after the prompt block.',
      '<assistant>',
      'payload-three stays private, and the block never closes',
    ],
    payload: /payload-(one|two|three)/,
    kept: ['Kept before the blocks.', 'Kept after the user block.', 'Kept after the prompt block.'],
  })
})

test('removing a live source makes the next plan review every subject once', () => {
  const { guide } = setup('removed-live')
  guide.learn(cleanupTexts[0])
  guide.writeClaudeMd()
  const review = () => {
    const input = dreamInput(guide.plan(), [])
    guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  }
  review()
  assert.equal(subjectFor(guide.plan()), undefined, 'a resolved subject waits for a change')
  rmSync(join(guide.home, '.claude', 'CLAUDE.md'))
  assert.ok(subjectFor(guide.plan()), 'a removed source can change what repeats live guidance')
  review()
  assert.equal(subjectFor(guide.plan()), undefined, 'a run after the removal records the source as absent')
})

test('dream plan fits large live guidance and its subjects within the packet budget', () => {
  const { guide } = setup('packet-budget')
  guide.learn(cleanupTexts[0])
  // A quote doubles in JSON, so each 32 KiB file costs 64 KiB of packet.
  const quotes = `${'"'.repeat(32 * 1024)}\n`
  guide.writeClaudeMd(quotes)
  mkdirSync(join(guide.home, '.codex'), { recursive: true })
  mkdirSync(join(guide.home, '.agents'), { recursive: true })
  for (const path of [join(guide.home, '.codex', 'AGENTS.md'), join(guide.home, '.agents', 'roles.md'), join(guide.home, '.agents', 'CODING_STANDARDS.md')]) writeFileSync(path, quotes)
  const plan = guide.plan()
  assert.ok(Buffer.byteLength(plan.stdout) <= 196_608, `${Buffer.byteLength(plan.stdout)} bytes`)
  assert.ok(subjectFor(plan), 'the subject is kept and live text is cut instead')
  assert.equal(plan.omittedSubjects, 0)
  assert.ok(plan.live.every(({ truncated }) => truncated === true))
})

const liveOf = (plan) => Object.fromEntries(plan.live.map(({ source, digest }) => [source, digest]))
// Applies a run that reviews every subject the plan lists, without actions.
const reviewPlanned = (guide, plan) => {
  const input = { schemaVersion: 1, live: liveOf(plan), subjects: plan.subjects.map(({ subjectId, digest }) => ({ subjectId, digest, actions: [] })) }
  guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
}
const canonicalMemory = (guide) => {
  const content = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')
  return JSON.parse(content.slice(content.lastIndexOf('```json\n') + '```json\n'.length, content.lastIndexOf('\n```')))
}
const rewriteJournal = (guide, entries) => writeFileSync(join(guide.guideRoot, 'operations.jsonl'), entries.map((entry) => `${JSON.stringify(entry)}\n`).join(''))

test('nightly and consolidation writes refuse an http query string that a stored record may hold', () => {
  const { guide } = setup('http-writes')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.writeClaudeMd()
  const query = 'http://example.test/guide?lookup=PrivacyFixture'
  const before = guideFiles(guide, ['memory.md'])
  const archive = dreamInput(guide.plan(), [{ action: 'archive', targetId: first, duplicateOf: 'live:claude-md', reason: `See ${query}.` }])
  assert.match(guide.dreamApply(archive, { expectFailure: true }).stderr, /reason contains a forbidden URL query string/)
  const clean = { learning: 'After a merge, clean up.', confidence: 'high' }
  for (const input of [
    { replacement: { ...clean, learning: `After a merge, read ${query}.` } },
    { replacement: { ...clean, examples: [{ kind: 'pattern', language: 'text', code: query }] } },
    { replacement: clean, reason: `See ${query}.` },
    { replacement: clean, source: query },
  ]) {
    assert.match(guide.consolidate({ targetIds: [first, second], ...input }, { expectFailure: true }).stderr, /forbidden URL query string/)
  }
  assert.deepEqual(guideFiles(guide, ['memory.md']), before)
  assert.equal(guide.journal().length, 0)
})

test('dream plan removes several raw prompt blocks on one line and nested blocks', () => {
  assertPlanRedacts({
    name: 'raw-block-markers',
    lines: [
      'Kept first.',
      '<user>one</user> <assistant>',
      'payload-a stays private',
      '</assistant>',
      'Kept second.',
      '<user>',
      '<assistant>',
      'payload-b stays private',
      '</assistant>',
      'payload-c is still inside the user block',
      '</user>',
      'Kept third.',
      'BEGIN PROMPT',
      'payload-d reaches the end of the story',
      'END',
      'Kept fourth.',
      '<system>short</system> BEGIN RAW PROMPT',
      'payload-e never closes',
    ],
    payload: /payload-[a-e]/,
    kept: ['Kept first.', 'Kept second.', 'Kept third.', 'Kept fourth.'],
  })
})

test('a crash right after a nightly archive\'s canonical write rebuilds the cache on retry', () => {
  const { guide } = setup('archive-crash-cache')
  const first = guide.learn(cleanupTexts[0])
  guide.writeClaudeMd()
  const input = dreamInput(guide.plan(), [{ action: 'archive', targetId: first, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' }])
  const { previewToken } = guide.dreamApply(input)
  const views = ['memory.json', 'annotations-watermark.json'].map((name) => [name, readFileSync(join(guide.guideRoot, name), 'utf8')])
  guide.dreamApply(input, { previewToken })
  // The crash: memory.md holds the archive, and the cache, the watermark, and the commit and run entries do not.
  for (const [name, text] of views) writeFileSync(join(guide.guideRoot, name), text)
  rewriteJournal(guide, guide.journal().filter(({ type }) => !['commit', 'run'].includes(type)))
  assert.equal(guide.dreamApply(input, { previewToken }).outcome, 'already-applied')
  assert.equal(guide.memory().revision, canonicalMemory(guide).revision)
  assert.equal(guide.record(first).status, 'archived')
  guide.validate()
  const preview = guide.exec({ command: 'delete', args: ['--input', guide.inputFile({ schemaVersion: 1, targetId: first })] }).result
  assert.equal(preview.outcome, 'delete-preview')
})

test('a contradiction between a confirmed shared record and a project record is queued and holds both', () => {
  const { guide } = setup('cross-scope-contradiction')
  const shared = guide.learn('After a merge, keep the worktree.', { scope: 'shared' })
  const project = guide.learn('After a merge, remove the worktree.')
  guide.confirm(short(shared))
  guide.writeClaudeMd()
  const plan = guide.plan()
  const [projectSubject, sharedSubject] = [subjectFor(plan), subjectFor(plan, 'git-cleanup', 'shared')]
  const contradiction = { action: 'contradiction', targetId: project, conflictingId: shared, reason: 'One keeps the worktree, one removes it.' }
  const runOf = (actions, subjects = [projectSubject, sharedSubject]) => ({
    schemaVersion: 1,
    live: liveOf(plan),
    subjects: subjects.map(({ subjectId, digest }, index) => ({ subjectId, digest, actions: index === 0 ? actions : [] })),
  })
  assert.match(guide.dreamApply(runOf([contradiction], [projectSubject]), { expectFailure: true }).stderr, /list its subject .* with its digest/)
  const archive = { action: 'archive', targetId: project, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' }
  assert.match(guide.dreamApply(runOf([contradiction, archive]), { expectFailure: true }).stderr, /is kept because a contradiction queued in this run names it/)
  const reversed = { ...contradiction, targetId: shared, conflictingId: project }
  assert.deepEqual(guide.dreamApply(runOf([reversed], [sharedSubject, projectSubject])).queued.map(({ kind }) => kind), ['contradiction'])
  const memoryBefore = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')
  const input = runOf([contradiction])
  const applied = guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  assert.deepEqual(applied.queued.map(({ kind, targetId, conflictingId }) => [kind, targetId, conflictingId]), [['contradiction', project, shared]])
  assert.equal(readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8'), memoryBefore, 'nothing changes either record')
  assert.equal(guide.confirmed('After a merge, keep the worktree.'), true)
  const next = guide.plan()
  assert.ok(subjectFor(next) && subjectFor(next, 'git-cleanup', 'shared'), 'both subjects are reviewed again')
})

test('dream plan bounds audit data and pending operations within the packet budget', () => {
  const { guide } = setup('audit-budget')
  guide.learn(cleanupTexts[0])
  appendFileSync(join(guide.guideRoot, 'init.md'), Array.from({ length: 3500 }, (_, index) => `- [Missing ${index}](missing-guide-file-${index}.md)\n`).join(''))
  const linked = guide.plan()
  assert.ok(Buffer.byteLength(linked.stdout) <= 196_608, `${Buffer.byteLength(linked.stdout)} bytes`)
  assert.ok(subjectFor(linked))
  assert.equal(linked.audit.validationErrors[0], 'Field guide validation failed:')
  assert.match(linked.audit.validationErrors[1], /missing-guide-file-0\.md/)
  assert.equal(linked.audit.validationErrors.length + linked.omittedItems.validationErrors, 3501, 'the heading and one line per missing file')
  const at = new Date().toISOString()
  appendFileSync(join(guide.guideRoot, 'operations.jsonl'), Array.from({ length: 3000 }, (_, index) => `${JSON.stringify({
    type: 'pending', operationId: `operation:v1:${index.toString(16).padStart(64, '0')}`, action: 'archive', at, revision: 1, scope: 'project', subjectKey: 'git-cleanup', fingerprints: [], reason: 'An interrupted archive.',
  })}\n`).join(''))
  const pending = guide.plan()
  assert.ok(Buffer.byteLength(pending.stdout) <= 196_608, `${Buffer.byteLength(pending.stdout)} bytes`)
  assert.ok(subjectFor(pending))
  assert.equal(pending.pendingOperations.length + pending.omittedItems.pendingOperations, 3000)
})

test('a store stays version 2 after its last journaled record is deleted', () => {
  const { guide } = setup('monotonic-version')
  const first = guide.learn(cleanupTexts[0])
  guide.writeClaudeMd()
  const input = dreamInput(guide.plan(), [{ action: 'archive', targetId: first, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' }])
  guide.dreamApply(input, { previewToken: guide.dreamApply(input).previewToken })
  assert.equal(guide.memory().schemaVersion, 2)
  const remove = (fields) => guide.exec({ command: 'delete', args: ['--input', guide.inputFile({ schemaVersion: 1, targetId: first, ...fields })] }).result
  remove({ apply: true, previewToken: remove({}).previewToken })
  assert.deepEqual(guide.memory().guidance, [])
  assert.equal(guide.memory().schemaVersion, 2)
  assert.ok(validateMemoryV2(guide.memory()), JSON.stringify(validateMemoryV2.errors))
  assert.ok(guide.journal().length > 0)
  guide.validate()
})

test('undo-operation refuses a shared operation that an earlier build journaled', () => {
  const { guide } = setup('shared-journal')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const applied = guide.consolidateApplied([first, second])
  // Earlier builds of this release could consolidate shared guidance; this one cannot reverse it.
  rewriteJournal(guide, guide.journal().map((entry) => (entry.type === 'pending' ? { ...entry, scope: 'shared' } : entry)))
  const memoryBefore = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')
  assert.match(guide.undo(applied.operationId, { expectFailure: true }).stderr, /changed shared guidance/)
  assert.equal(readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8'), memoryBefore)
})

test('a subject counts as reviewed only against the live guidance it was reviewed with', () => {
  const { guide } = setup('partial-live')
  guide.learn(cleanupTexts[0])
  guide.learn(cleanupTexts[1], { scope: 'shared' })
  guide.writeClaudeMd()
  reviewPlanned(guide, guide.plan())
  assert.equal(guide.plan().subjects.length, 0)
  guide.writeClaudeMd(`# Rules\n\n${cleanupTexts[1]}\n`)
  const changed = guide.plan()
  assert.equal(changed.subjects.length, 2)
  // The reviewer returns only the project subject.
  const partial = dreamInput(changed, [])
  guide.dreamApply(partial, { previewToken: guide.dreamApply(partial).previewToken })
  assert.deepEqual(guide.plan().subjects.map(({ scope }) => scope), ['shared'], 'the shared subject is still due against the new live guidance')
})

test('a subject the plan omitted for its budget stays due after live guidance changes', () => {
  const { guide } = setup('omitted-cursor')
  // Each subject fits the packet alone, and the two together do not.
  const filler = 'Keep each cleanup step small and explain it to the reviewer. '.repeat(60)
  for (const subjectKey of ['cleanup-a', 'cleanup-b']) {
    for (let index = 0; index < 26; index += 1) guide.learn(`Rule ${index} of ${subjectKey}. ${filler}`.trim(), { subjectKey, turnId: `${subjectKey}-${index}` })
  }
  guide.writeClaudeMd()
  const first = guide.plan()
  assert.equal(first.omittedSubjects, 1)
  reviewPlanned(guide, first)
  reviewPlanned(guide, guide.plan())
  assert.equal(guide.plan().subjects.length, 0)
  guide.writeClaudeMd('# Rules\n\nKeep cleanup steps small.\n')
  const changed = guide.plan()
  assert.equal(changed.omittedSubjects, 1)
  reviewPlanned(guide, changed)
  const next = guide.plan()
  assert.equal(next.subjects.length, 1)
  assert.notEqual(next.subjects[0].subjectKey, changed.subjects[0].subjectKey)
})

test('dream plan shortens home paths before it cuts live text', () => {
  const { guide } = setup('cut-home-path')
  guide.learn(cleanupTexts[0])
  // The 32 KiB cut falls inside the path.
  guide.writeClaudeMd(`${'a'.repeat(32 * 1024 - 10)}/home/privacyuser/notes.md\n`)
  const plan = guide.plan()
  assert.doesNotMatch(plan.stdout, /\/home\/priv/)
})

// The path of each string in a value, so a test can put text in every field, nested or not.
const stringPaths = (value, path = []) => {
  if (typeof value === 'string') return [path]
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => stringPaths(child, [...path, key]))
}
const withText = ({ value, path, text }) => {
  const copy = structuredClone(value)
  path.slice(0, -1).reduce((parent, key) => parent[key], copy)[path.at(-1)] = text
  return copy
}
const leakedQuery = 'http://ex.test/?token=s3cret'
const fullReplacement = {
  learning: 'After a merge, clean up.',
  confidence: 'high',
  examples: [{ kind: 'pattern', language: 'sh', code: 'git worktree remove x' }, { kind: 'antipattern', language: 'sh', code: 'rm -rf x' }],
}

test('the new-text guard covers every string in a consolidation input and a dream action', () => {
  const { guide } = setup('new-text-every-field')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const input = { schemaVersion: 1, targetIds: [first, second], replacement: fullReplacement, reason: 'Same rule.', source: 'agent' }
  for (const path of stringPaths(input)) {
    const { stderr } = guide.consolidate(withText({ value: input, path, text: leakedQuery }), { expectFailure: true })
    assert.match(stderr, /forbidden URL query string/, path.join('.'))
  }
  const action = { action: 'consolidate', targetIds: [first, second], replacement: fullReplacement, reason: 'Same rule.' }
  const plan = guide.plan()
  for (const path of stringPaths(action)) {
    const { stderr } = guide.dreamApply(dreamInput(plan, [withText({ value: action, path, text: leakedQuery })]), { expectFailure: true })
    assert.match(stderr, /actions\[0\] .*forbidden URL query string.*the run applied nothing/, path.join('.'))
  }
  assert.equal(guide.journal().length, 0)
})

test('a replacement example language must be a language name, on both consolidation paths', () => {
  const { guide } = setup('example-language')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const before = guideFiles(guide)
  const withLanguage = (language) => ({ ...fullReplacement, examples: [{ kind: 'pattern', language, code: 'git worktree remove x' }] })
  for (const language of ['https://ex.test/?token=s3cret', 'sh;rm']) {
    assert.match(guide.consolidate({ targetIds: [first, second], replacement: withLanguage(language) }, { expectFailure: true }).stderr, /language/)
  }
  const input = dreamInput(guide.plan(), [{ action: 'consolidate', targetIds: [first, second], replacement: withLanguage('http://ex.test/?token=s3cret'), reason: 'Same rule.' }])
  assert.match(guide.dreamApply(input, { expectFailure: true }).stderr, /language/)
  assert.deepEqual(guideFiles(guide), before)
})

test('a proposal refuses a bare home directory in its reason and replacement', () => {
  const { guide } = setup('proposal-home')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  const clean = { learning: 'After a merge, clean up.', confidence: 'high' }
  for (const home of ['/home/review-fixture-user', '/Users/review-fixture-user', 'C:\\Users\\review-fixture-user']) {
    for (const input of [{ replacement: clean, reason: `Seen in ${home}` }, { replacement: { ...clean, learning: `After a merge, clean up ${home}` } }]) {
      assert.match(guide.consolidate({ targetIds: [first, second], ...input }, { expectFailure: true }).stderr, /absolute home-directory path/, home)
    }
  }
  assert.equal(existsSync(join(guide.guideRoot, 'proposals.json')), false)
})

test('dream plan keeps a prompt block open past END inside its text', () => {
  assertPlanRedacts({
    name: 'prompt-end-word',
    lines: ['Kept first.', 'BEGIN PROMPT', 'Stop at the END of the task.', 'payload-a stays private', '  END PROMPT  ', 'Kept after.'],
    payload: /payload-a/,
    kept: ['Kept first.', 'Kept after.'],
  })
})

// The timeout turns a child that never reaches the lock into a failure instead of a hang.
test('dream apply compares live guidance read under the memory lock', { timeout: 30_000 }, async () => {
  const { repoRoot, guide } = setup('live-under-lock')
  const [first] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.writeClaudeMd()
  const input = dreamInput(guide.plan(), [{ action: 'archive', targetId: first, duplicateOf: 'live:claude-md', reason: 'CLAUDE.md says this.' }])
  const { previewToken } = guide.dreamApply(input)
  // Another writer holds the lock. Its owner data is not JSON, so the lock is stale only by age.
  const lockFile = join(guide.guideRoot, 'memory.lock')
  writeFileSync(lockFile, 'held by the test')
  const env = { ...process.env, HOME: guide.home, CODEX_HOME: undefined, CLAUDE_CONFIG_DIR: undefined, T3CODE_THREAD_ID: undefined }
  const child = spawn(process.execPath, [dreamScript, 'apply', '--repo-root', repoRoot, '--guide-root', guide.guideRoot, '--input', guide.inputFile(input), '--preview-token', previewToken], { env })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const exited = new Promise((resolveExit) => child.on('exit', resolveExit))
  // The apply waits for the lock once its owner file exists.
  while (!readdirSync(guide.guideRoot).some((name) => name.startsWith('memory.lock.') && name.endsWith('.tmp'))) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 5))
  }
  guide.writeClaudeMd('# Rules\n\nAsk before removing a worktree.\n')
  rmSync(lockFile)
  assert.notEqual(await exited, 0)
  assert.match(stderr, /live guidance claude-md changed since the plan/)
  assert.equal(guide.record(first).status, 'active')
})

test('a project proposal round-trips in a repository without a remote under a home directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-dream-no-remote-'))
  // The repository identity is its Git directory, so it holds this home path.
  const parent = join(root, 'home', 'review-fixture-user')
  mkdirSync(parent, { recursive: true })
  const repoRoot = createRepo({ parent, name: 'no-remote' })
  execFileSync('git', ['-C', repoRoot, 'remote', 'remove', 'origin'])
  const guide = machine({ root, repoRoot })
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  const learning = 'After a merge, clean up.'
  const refused = guide.consolidate({ targetIds: [first, second], replacement: { learning, confidence: 'high' } }).result
  assert.equal(refused.outcome, 'approval-required')
  const reference = refused.confirmPrompt.slice('confirm fg:'.length)
  assert.match(guide.confirm(reference).systemMessage, /approved .*the replacement will be confirmed/)
  assert.equal(guide.exec({ command: 'consolidate', args: ['--approval', reference] }).result.outcome, 'consolidated')
  assert.equal(guide.confirmed(learning), true)
  guide.validate()
})

test('a contradiction queued for the user holds both records in later runs until it is resolved', () => {
  const { guide } = setup('open-contradiction')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  guide.writeClaudeMd()
  const contradiction = { action: 'contradiction', targetId: first, conflictingId: second, reason: 'One asks first, one does not.' }
  const queuedRun = dreamInput(guide.plan(), [contradiction])
  assert.equal(guide.dreamApply(queuedRun, { previewToken: guide.dreamApply(queuedRun).previewToken }).queued.length, 1)
  // A later run that leaves the pair out reviews the subject without settling it.
  reviewPlanned(guide, guide.plan())
  assert.deepEqual(subjectFor(guide.plan()).queuedContradictions, [{ targetId: first, conflictingId: second }], 'the plan shows the open contradiction')
  const archive = { action: 'archive', targetId: second, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' }
  const rejected = guide.dreamApply(dreamInput(guide.plan(), [archive]), { expectFailure: true })
  assert.match(rejected.stderr, /actions\[0\] \(archive\) rejected: [0-9a-f]+ is kept because a contradiction queued for the user names it; the run applied nothing/)
  assert.deepEqual(guide.activeIds(), [first, second].sort())
  // Once neither record is confirmed, the contradiction is settled.
  guide.exec({ command: 'unconfirm', args: ['--id', short(first)] })
  const settled = dreamInput(guide.plan(), [archive])
  guide.dreamApply(settled, { previewToken: guide.dreamApply(settled).previewToken })
  assert.equal(guide.record(second).status, 'archived')
})

test('a subject digest covers every record field the plan shows', () => {
  const { guide } = setup('digest-fields')
  const [first] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.writeClaudeMd()
  const plan = guide.plan()
  // Reinforcing the target adds a linked subject that the reviewer never saw.
  const status = guide.record(first).status
  guide.learn(cleanupTexts[0], { linkedSubjects: ['worktrees'], turnId: 'reinforcement' })
  assert.deepEqual([guide.record(first).linkedSubjects, guide.record(first).status], [['worktrees'], status])
  const input = dreamInput(plan, [{ action: 'archive', targetId: first, duplicateOf: 'live:claude-md', reason: 'Global guidance says this.' }])
  assert.match(guide.dreamApply(input, { expectFailure: true }).stderr, /subject git-cleanup \(project\) changed since the plan/)
  assert.equal(guide.record(first).status, 'active')
})

test('dream plan shortens bare home directories and redacts audit diagnostics', () => {
  const { guide } = setup('plan-leaks')
  guide.learn('After a merge, clean up /home/review-fixture-user')
  guide.writeClaudeMd('# Rules\n\nNotes live in /Users/review-fixture-user\n')
  appendFileSync(join(guide.guideRoot, 'init.md'), '\n[Notes](api_key=synthetic-marker.md)\n')
  const plan = guide.plan()
  assert.ok(plan.audit.validationErrors.some((line) => line.includes('[redacted credential assignment]')))
  assert.doesNotMatch(plan.stdout, /review-fixture-user|synthetic-marker/)
})

test('a dream archive names live guidance only with the live: prefix', () => {
  const { guide } = setup('live-prefix')
  guide.writeClaudeMd()
  const first = guide.learn(cleanupTexts[0])
  const plan = guide.plan()
  const archiveOf = (duplicateOf) => dreamInput(plan, [{ action: 'archive', targetId: first, duplicateOf, reason: 'CLAUDE.md says this.' }])
  assert.match(guide.dreamApply(archiveOf('claude-md'), { expectFailure: true }).stderr, /duplicateOf must be a guidance ID or live:<source>/)
  assert.equal(guide.dreamApply(archiveOf('live:claude-md')).outcome, 'preview')
})

test('a subject reviewed against live guidance that returns to an earlier text is not due again', () => {
  const { guide } = setup('live-returns')
  guide.learn(cleanupTexts[0])
  const [before, after] = ['# Rules\n\nClean up after a merge.\n', '# Rules\n\nAsk before cleaning up.\n']
  guide.writeClaudeMd(before)
  reviewPlanned(guide, guide.plan())
  guide.writeClaudeMd(after)
  reviewPlanned(guide, guide.plan())
  guide.writeClaudeMd(before)
  const plan = guide.plan()
  assert.equal(plan.subjects.length, 0)
  assert.equal(plan.skippedSubjects, 1)
})
