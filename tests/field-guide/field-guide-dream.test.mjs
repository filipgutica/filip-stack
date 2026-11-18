import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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
    confirm: (reference, { mainThread = true, prompt = `confirm fg:${reference}` } = {}) => confirmFromPrompt({ guideRoot, prompt, mainThread, host: 'claude' }),
    confirmed: (learning) => {
      const injection = promptInjection({ repoRoot, guideRoot, prompt: learning, excludeIds: [], mainThread: true })
      return Boolean(injection?.text.split('\n').some((line) => line.startsWith('- [confirmed]') && line.endsWith(learning)))
    },
    validate: () => exec({ command: 'validate' }),
    // Live guidance that the plan shows its reviewer.
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

const subjectFor = (plan, subjectKey = 'git-cleanup', scope = 'project') => plan.subjects.find((subject) => subject.subjectKey === subjectKey && subject.scope === scope)

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

test('a declined set is not proposed again', () => {
  const { guide } = setup('declined-set')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const planned = subjectFor(guide.plan())
  assert.deepEqual(planned.overlapGroups, [[first, second].sort()])

  const applied = guide.consolidateApplied([first, second])
  guide.undo(applied.operationId)
  const undoEntry = guide.journal().find(({ type, action }) => type === 'pending' && action === 'undo-operation')
  assert.deepEqual(undoEntry.declined, [first, second].map((id) => id.replace('guidance', 'fingerprint')).sort())
  assert.deepEqual(subjectFor(guide.plan()).overlapGroups, [])
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

test('consolidate rejects confirmation fields', () => {
  const { guide } = setup('confirmation-fields')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const replacement = { learning: 'After a merge, clean up.', confidence: 'high' }
  for (const input of [
    { targetIds: [first, second], replacement, confirmed: true },
    { targetIds: [first, second], replacement: { ...replacement, explicitPreference: true } },
  ]) {
    assert.match(guide.consolidate(input, { expectFailure: true }).stderr, /confirmation field/)
  }
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

// Stores a proposal that replaces a confirmed record, approves it with the user's exact prompt,
// and returns its reference.
const approvedProposal = ({ guide, targetIds, learning }) => {
  const reference = guide.consolidate({ targetIds, replacement: { learning, confidence: 'high' } }).result.confirmPrompt.slice('confirm fg:'.length)
  assert.match(guide.confirm(reference).systemMessage, /approved .*the replacement will be confirmed/)
  return reference
}

// A guide with two cleanup records, the first confirmed, and an approved proposal to replace them.
const approvedSetup = (name) => {
  const { guide } = setup(name)
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  const learning = 'After a merge, remove its clean worktree and branch.'
  return { guide, first, second, learning, reference: approvedProposal({ guide, targetIds: [first, second], learning }) }
}

test('an approval binds the exact replacement text and whether the replacement is confirmed', () => {
  const { guide, first, learning, reference } = approvedSetup('approval-binding')

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
  assert.deepEqual(subjectFor(plan, 'git-cleanup', 'shared').overlapGroups, [[...shared].sort()], 'the plan groups shared overlaps too')

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

  // Every writer of version 2 checks: undo refuses too while a copy is older.
  rmSync(codexCopy, { recursive: true })
  installCopy(codexCopy, { v2: false })
  assert.match(guide.undo(applied.operationId, { expectFailure: true }).stderr, /Codex .*older/)
  assert.equal(guide.record(applied.replacementId).status, 'active')
})

// Installs a Codex Field Guide copy in the plugin cache; a v2 copy ships the version 2 schema.
const installCodexCopy = ({ guide, marketplace, version, v2 }) => {
  const path = join(guide.home, '.codex', 'plugins', 'cache', marketplace, 'field-guide', version, 'skills', 'field-guide', 'schemas')
  mkdirSync(path, { recursive: true })
  if (v2) writeFileSync(join(path, 'memory-v2.schema.json'), '{}\n')
}

test('the writer gate checks only the Codex copy that loads', () => {
  const { guide } = setup('writer-gate-newest')
  const [first, second] = cleanupTexts.map((learning) => guide.learn(learning))
  const installCopy = (options) => installCodexCopy({ guide, ...options })
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

  // consolidate still treats the records as confirmed: the crash, not the user, revoked them.
  const other = { targetIds: [first, second], replacement: { learning: 'After a merge, clean up its worktree and branch.', confidence: 'high' } }
  assert.equal(guide.consolidate(other).result.outcome, 'approval-required')
  rmSync(guide.guideRoot, { recursive: true })
  cpSync(crashed, guide.guideRoot, { recursive: true })

  const applied = guide.exec({ command: 'consolidate', args: ['--approval', reference] }).result
  assert.equal(applied.confirmed, true)
  assert.equal(guide.confirmed(learning), true)
  assert.ok(guide.journal().some(({ type }) => type === 'abort'))
  guide.validate()
})

test('a consolidation whose result the store would reject fails before it writes anything', () => {
  const { guide } = setup('invalid-result')
  // Each record links 9 subjects; their union exceeds the 16 a record may link.
  const linked = (prefix) => Array.from({ length: 9 }, (_, index) => `${prefix}-${index}`)
  const [first, second] = cleanupTexts.slice(0, 2).map((learning, index) => guide.learn(learning, { linkedSubjects: linked(`linked-${index}`) }))
  const input = { targetIds: [first, second], replacement: { learning: 'After a merge, remove its clean worktree and branch.', confidence: 'high' } }
  const before = guideFiles(guide)
  assert.match(guide.consolidate(input, { expectFailure: true }).stderr, /linkedSubjects/)
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
    scopeDigest: createHash('sha256').update(JSON.stringify('shared')).digest('hex'),
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

const canonicalMemory = (guide) => {
  const content = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')
  return JSON.parse(content.slice(content.lastIndexOf('```json\n') + '```json\n'.length, content.lastIndexOf('\n```')))
}
const rewriteJournal = (guide, entries) => writeFileSync(join(guide.guideRoot, 'operations.jsonl'), entries.map((entry) => `${JSON.stringify(entry)}\n`).join(''))

test('consolidation writes refuse an http query string that a stored record may hold', () => {
  const { guide } = setup('http-writes')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const query = 'http://example.test/guide?lookup=PrivacyFixture'
  const before = guideFiles(guide, ['memory.md'])
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

test('a crash right after a consolidation\'s canonical write rebuilds the cache on the next journaled command', () => {
  const { guide } = setup('consolidate-crash-cache')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const views = ['memory.json', 'annotations-watermark.json'].map((name) => [name, readFileSync(join(guide.guideRoot, name), 'utf8')])
  const applied = guide.consolidateApplied([first, second])
  // The crash: memory.md holds the consolidation, and the cache, the watermark, and the commit entry do not.
  for (const [name, text] of views) writeFileSync(join(guide.guideRoot, name), text)
  rewriteJournal(guide, guide.journal().filter(({ type }) => type !== 'commit'))
  // Recovery runs before the command looks the operation up, so this failing undo still commits it.
  assert.match(guide.undo(`operation:v1:${'0'.repeat(64)}`, { expectFailure: true }).stderr, /no journaled operation/)
  assert.ok(guide.journal().some(({ type, operationId, recovered }) => type === 'commit' && operationId === applied.operationId && recovered === true))
  assert.equal(guide.memory().revision, canonicalMemory(guide).revision)
  assert.equal(guide.record(first).status, 'superseded')
  guide.validate()
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

test('a version 2 store stays version 2 when no record needs it', () => {
  const { guide } = setup('monotonic-version')
  guide.learn(cleanupTexts[0])
  // Set by hand: a consolidated replacement and its predecessors refer to each other, so this
  // release never deletes the last record that needs version 2.
  for (const name of ['memory.md', 'memory.json']) {
    const path = join(guide.guideRoot, name)
    writeFileSync(path, readFileSync(path, 'utf8').replace('"schemaVersion": 1', '"schemaVersion": 2'))
  }
  guide.learn(cleanupTexts[1])
  assert.equal(guide.memory().schemaVersion, 2)
  assert.equal(canonicalMemory(guide).schemaVersion, 2)
  assert.ok(validateMemoryV2(guide.memory()), JSON.stringify(validateMemoryV2.errors))
  guide.validate()
})

test('undo-operation refuses a shared consolidation or an automated archive that an earlier build journaled', () => {
  // Earlier builds of this release could consolidate shared guidance and archive automatically;
  // this one reverses neither.
  for (const [name, change, refusal] of [
    ['shared-journal', { scope: 'shared' }, /changed shared guidance/],
    ['archive-journal', { action: 'archive' }, /\(archive\) is not a consolidation; undo-operation reverses only consolidations/],
  ]) {
    const { guide } = setup(name)
    const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
    const applied = guide.consolidateApplied([first, second])
    rewriteJournal(guide, guide.journal().map((entry) => (entry.type === 'pending' ? { ...entry, ...change } : entry)))
    const memoryBefore = readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8')
    assert.match(guide.undo(applied.operationId, { expectFailure: true }).stderr, refusal, name)
    assert.equal(readFileSync(join(guide.guideRoot, 'memory.md'), 'utf8'), memoryBefore)
  }
})

test('dream plan omits a subject that does not fit its budget and counts it', () => {
  const { guide } = setup('omitted-subject')
  // Each subject fits the packet alone, and the two together do not.
  const filler = 'Keep each cleanup step small and explain it to the reviewer. '.repeat(60)
  for (const subjectKey of ['cleanup-a', 'cleanup-b']) {
    for (let index = 0; index < 26; index += 1) guide.learn(`Rule ${index} of ${subjectKey}. ${filler}`.trim(), { subjectKey, turnId: `${subjectKey}-${index}` })
  }
  guide.writeClaudeMd()
  const plan = guide.plan()
  assert.ok(Buffer.byteLength(plan.stdout) <= 196_608, `${Buffer.byteLength(plan.stdout)} bytes`)
  assert.deepEqual([plan.subjects.length, plan.omittedSubjects], [1, 1])
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

test('the new-text guard covers every string in a consolidation input', () => {
  const { guide } = setup('new-text-every-field')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const input = { schemaVersion: 1, targetIds: [first, second], replacement: fullReplacement, reason: 'Same rule.', source: 'agent' }
  for (const path of stringPaths(input)) {
    const { stderr } = guide.consolidate(withText({ value: input, path, text: leakedQuery }), { expectFailure: true })
    assert.match(stderr, /forbidden URL query string/, path.join('.'))
  }
  assert.equal(guide.journal().length, 0)
})

test('a replacement example language must be a language name', () => {
  const { guide } = setup('example-language')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const before = guideFiles(guide)
  const withLanguage = (language) => ({ ...fullReplacement, examples: [{ kind: 'pattern', language, code: 'git worktree remove x' }] })
  for (const language of ['https://ex.test/?token=s3cret', 'sh;rm']) {
    assert.match(guide.consolidate({ targetIds: [first, second], replacement: withLanguage(language) }, { expectFailure: true }).stderr, /language/)
  }
  assert.deepEqual(guideFiles(guide), before)
})

test('a proposal refuses a bare home directory in its reason and replacement', () => {
  const { guide } = setup('proposal-home')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  const clean = { learning: 'After a merge, clean up.', confidence: 'high' }
  for (const home of ['/home/review-fixture-user', '/Users/review-fixture-user', 'C:\\Users\\review-fixture-user', '/mnt/c/Users/review-fixture-user']) {
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
  // The proposal binds the scope by a digest, so it stores no local path.
  const proposals = readFileSync(join(guide.guideRoot, 'proposals.json'), 'utf8')
  assert.ok(!proposals.includes('/home/') && !proposals.includes(root), proposals)
  const reference = refused.confirmPrompt.slice('confirm fg:'.length)
  assert.match(guide.confirm(reference).systemMessage, /approved .*the replacement will be confirmed/)
  assert.equal(guide.exec({ command: 'consolidate', args: ['--approval', reference] }).result.outcome, 'consolidated')
  assert.equal(guide.confirmed(learning), true)
  guide.validate()
})

test('a subject digest covers every record field the plan shows', () => {
  const { guide } = setup('digest-fields')
  const [first] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const before = subjectFor(guide.plan()).digest
  // Reinforcing the target adds a linked subject and changes no status.
  const status = guide.record(first).status
  guide.learn(cleanupTexts[0], { linkedSubjects: ['worktrees'], turnId: 'reinforcement' })
  assert.deepEqual([guide.record(first).linkedSubjects, guide.record(first).status], [['worktrees'], status])
  assert.notEqual(subjectFor(guide.plan()).digest, before)
})

test('dream plan shortens bare home directories and redacts audit diagnostics', () => {
  const { guide } = setup('plan-leaks')
  guide.learn('After a merge, clean up /home/review-fixture-user')
  guide.learn('After a merge, clean up /mnt/c/Users/review-fixture-user')
  guide.writeClaudeMd('# Rules\n\nNotes live in /Users/review-fixture-user\nWSL notes live in /mnt/c/Users/review-fixture-user\n')
  appendFileSync(join(guide.guideRoot, 'init.md'), '\n[Notes](api_key=synthetic-marker.md)\n')
  const plan = guide.plan()
  assert.ok(plan.audit.validationErrors.some((line) => line.includes('[redacted credential assignment]')))
  assert.doesNotMatch(plan.stdout, /review-fixture-user|synthetic-marker/)
})

test('a saved approval cannot apply a set the user declined by undoing another consolidation of it', () => {
  const { guide } = setup('approval-after-undo')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  const undone = approvedProposal({ guide, targetIds: [first, second], learning: 'After a merge, remove its clean worktree and branch.' })
  const saved = approvedProposal({ guide, targetIds: [first, second], learning: 'After a merge, clean up its worktree and branch.' })
  const applied = guide.exec({ command: 'consolidate', args: ['--approval', undone] }).result
  guide.undo(applied.operationId)
  guide.confirm(short(first))
  const fresh = { targetIds: [first, second], replacement: { learning: 'After a merge, tidy its worktree and branch.', confidence: 'high' } }
  assert.match(guide.consolidate(fresh, { expectFailure: true }).stderr, /declined/)
  const before = guideFiles(guide)
  assert.match(guide.exec({ command: 'consolidate', args: ['--approval', saved], expectFailure: true }).stderr, /declined/)
  assert.deepEqual(guideFiles(guide), before)
  assert.deepEqual([first, second].map((id) => guide.record(id).status), ['active', 'active'])
})

test('the writer gate refuses a Field Guide entry in config.toml that it cannot read', () => {
  const { guide } = setup('writer-gate-config-forms')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  installCodexCopy({ guide, marketplace: 'filip-stack', version: '6.12.0', v2: true })
  installCodexCopy({ guide, marketplace: 'older', version: '6.9.0', v2: false })
  const configFile = join(guide.home, '.codex', 'config.toml')
  const known = '[plugins."field-guide@filip-stack"]\nenabled = true\n'
  const input = { targetIds: [first, second], replacement: { learning: 'After a merge, clean up.', confidence: 'high' } }
  const preview = guide.consolidate(input).result
  const before = guideFiles(guide)
  for (const header of ['[plugins.\'field-guide@older\']', '[plugins.field-guide@older]', '[ plugins . "field-guide@older" ]', '  [plugins."field-guide@older"]']) {
    writeFileSync(configFile, `${known}\n${header}\nenabled = true\n`)
    const { stderr } = guide.consolidate({ ...input, apply: true, previewToken: preview.previewToken }, { expectFailure: true })
    assert.match(stderr, /config\.toml/, header)
    assert.deepEqual(guideFiles(guide), before, header)
  }
  writeFileSync(configFile, known)
  assert.equal(guide.consolidate({ ...input, apply: true, previewToken: preview.previewToken }).result.outcome, 'consolidated')
})

test('new text refuses URL user information and a query string in any URL, and the plan redacts both', () => {
  const { guide } = setup('url-userinfo')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.confirm(short(first))
  const replacement = { learning: 'After a merge, clean up.', confidence: 'high' }
  for (const [url, reason] of [
    ['https://user:secret-pass@host.test/path', /URL user information/],
    ['ssh://deploy@host.test/repo', /URL user information/],
    ['ftp://files.test/x?token=s3cret', /URL query string/],
    ['wss://socket.test/?session=abc', /URL query string/],
  ]) {
    for (const input of [{ replacement, reason: `Seen at ${url}` }, { replacement: { ...replacement, learning: `After a merge, clean up ${url}` } }]) {
      assert.match(guide.consolidate({ targetIds: [first, second], ...input }, { expectFailure: true }).stderr, reason, url)
    }
  }
  assert.equal(existsSync(join(guide.guideRoot, 'proposals.json')), false)

  // A stored record keeps the released guard, so it stays readable; the plan redacts it.
  guide.learn('Mirror https://user:secret-pass@host.test/path after a merge.', { subjectKey: 'mirrors' })
  guide.validate()
  guide.writeClaudeMd('# Rules\n\nMirror https://user:secret-pass@host.test/path first.\nThen fetch ftp://files.test/x?token=s3cret.\n')
  const plan = guide.plan()
  assert.equal(subjectFor(plan, 'mirrors').records[0].learning, '[redacted URL user information]')
  assert.doesNotMatch(plan.stdout, /secret-pass|token=s3cret/)
})

test('dream plan redacts a multiline audit diagnostic as a whole', () => {
  const { guide } = setup('multiline-diagnostic')
  guide.learn(cleanupTexts[0])
  appendFileSync(join(guide.guideRoot, 'init.md'), '\n[Notes](<user>\nprivate-diagnostic-line\n</user>.md)\n')
  const plan = guide.plan()
  assert.ok(plan.audit.validationErrors.length > 0)
  assert.doesNotMatch(plan.stdout, /private-diagnostic-line/)
})

test('an archive that the store would reject fails at its preview and keeps confirmations', () => {
  const { guide } = setup('archive-replacement')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  const learning = 'After a merge, remove its clean worktree and branch.'
  const { replacementId } = guide.consolidateApplied([first, second], learning)
  guide.confirm(short(replacementId))
  assert.equal(guide.confirmed(learning), true)
  const before = guideFiles(guide)
  const input = { schemaVersion: 1, action: 'archive', targetIds: [replacementId], reason: 'The user archived it.' }
  assert.match(guide.exec({ command: 'maintain', args: ['--input', guide.inputFile(input)], expectFailure: true }).stderr, /archived result would be invalid/)
  const apply = { ...input, apply: true, previewToken: 'unused' }
  assert.match(guide.exec({ command: 'maintain', args: ['--input', guide.inputFile(apply)], expectFailure: true }).stderr, /archived result would be invalid/)
  assert.deepEqual(guideFiles(guide), before)
  assert.equal(guide.confirmed(learning), true)
})

test('an aborted consolidation cancels the triggers it gave its replacement', () => {
  const { root, repoRoot, guide } = setup('aborted-triggers')
  const [first, second] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
  guide.exec({ command: 'annotate', args: ['--id', first, '--triggers', 'pr-merged'] })
  const learning = 'After a merge, remove its clean worktree and branch.'
  const snapshot = join(root, 'guide-before-consolidation')
  cpSync(guide.guideRoot, snapshot, { recursive: true })
  guide.consolidateApplied([first, second], learning)
  const journalPath = join(guide.guideRoot, 'operations.jsonl')
  const annotationsPath = join(guide.guideRoot, 'annotations.json')
  const pendingOnly = readFileSync(journalPath, 'utf8').trim().split('\n').filter((line) => JSON.parse(line).type !== 'commit')
  const annotations = readFileSync(annotationsPath, 'utf8')
  // A crash after the pending entry, with or without the annotation write, before memory.
  for (const withAnnotations of [true, false]) {
    rmSync(guide.guideRoot, { recursive: true })
    cpSync(snapshot, guide.guideRoot, { recursive: true })
    writeFileSync(journalPath, `${pendingOnly.join('\n')}\n`)
    if (withAnnotations) writeFileSync(annotationsPath, annotations)
    const { operationId } = guide.journal().find(({ type }) => type === 'pending')
    // The next journaled command recovers and aborts the operation.
    assert.match(guide.undo(operationId, { expectFailure: true }).stderr, /never applied/)
    guide.learn(learning, { turnId: 'recapture' })
    const injection = promptInjection({ repoRoot, guideRoot: guide.guideRoot, prompt: learning, excludeIds: [], mainThread: true })
    const line = injection.text.split('\n').find((each) => each.endsWith(learning))
    assert.ok(line && !line.includes('[pr-merged]'), `${withAnnotations}: ${line}`)
    guide.validate()
  }
})

test('dream plan shows an approved replacement unconfirmed while the watermark lags memory', () => {
  const { guide, learning, reference } = approvedSetup('watermark-lag')
  guide.exec({ command: 'consolidate', args: ['--approval', reference] })
  const shownConfirmed = () => subjectFor(guide.plan()).records.find((record) => record.learning === learning).confirmed
  assert.equal(shownConfirmed(), true)
  // The crash: memory.md and the cache were written, the watermark was not.
  const watermarkPath = join(guide.guideRoot, 'annotations-watermark.json')
  const watermark = JSON.parse(readFileSync(watermarkPath, 'utf8'))
  writeFileSync(watermarkPath, `${JSON.stringify({ ...watermark, memoryRevision: watermark.memoryRevision - 1 })}\n`)
  assert.equal(guide.confirmed(learning), false, 'the hook voids the confirmation')
  assert.equal(shownConfirmed(), false)
})

test('dream plan prints its packet without confirmations when annotations.json cannot be read', () => {
  for (const [name, content] of [['malformed', '{not json\n'], ['newer', `${JSON.stringify({ schemaVersion: 2, records: {} })}\n`]]) {
    const { guide } = setup(`unreadable-annotations-${name}`)
    const [first] = cleanupTexts.slice(0, 2).map((learning) => guide.learn(learning))
    guide.confirm(short(first))
    writeFileSync(join(guide.guideRoot, 'annotations.json'), content)
    const plan = guide.plan()
    assert.ok(plan.audit.validationErrors.some((line) => /annotations/.test(line)), name)
    assert.ok(subjectFor(plan).records.every(({ confirmed }) => confirmed === false), name)
  }
})

test('dream plan and the annotation export survive a journal line that is not JSON', () => {
  const { root, guide } = setup('malformed-journal')
  const project = guide.learn(cleanupTexts[0])
  const shared = guide.learn(cleanupTexts[1], { scope: 'shared' })
  for (const id of [project, shared]) guide.confirm(short(id))
  writeFileSync(join(guide.guideRoot, 'operations.jsonl'), '{not json\n')

  const plan = guide.plan()
  assert.deepEqual(plan.audit.stateErrors, ['operations.jsonl line 1 is not valid JSON'])
  assert.equal(plan.pendingOperations, undefined, 'the plan omits what it cannot read')
  assert.ok(subjectFor(plan))

  // Without the journal, only annotations of records that memory shows are shared are exported.
  const exported = join(root, 'annotations-export.json')
  guide.exec({ command: 'export', args: ['--output', join(root, 'shared-export.json'), '--annotations', exported] })
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(exported, 'utf8')).records), [guide.record(shared).fingerprint])
})