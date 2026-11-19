// An independent contract harness for nightly maintenance. pnpm check and CI run every scenario
// with each fault except a crash after each single write; FIELD_GUIDE_INVARIANTS=1 adds those.
// A row marked ALLOWED is the one documented limit (documentedLimit), not a passing check.
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { isDeepStrictEqual } from 'node:util'
import { fixture, journalOf, memoryOf, proposalsOf, requireResult, write } from './dream-invariants-fixture.mjs'
import {
  changedFiles, classify, contradictions, decisions, describe, everConfirmed, parity,
  privacy, prompts, readerCheck, reversible, sameFiles,
} from './dream-invariants-oracle.mjs'
import { alterMemory, archive, elapsed, inputFor, restoreFault, scenarios, watermark } from './dream-invariants-scenarios.mjs'

const crashPrefixes = process.env.FIELD_GUIDE_INVARIANTS === '1'
const storeFiles = ['annotations.json', 'operations.jsonl', 'proposals.json', 'annotations-watermark.json', 'memory.json']
const fileFaults = storeFiles.flatMap((file) => ['lost', 'truncated'].map((mode) => ({ name: `${mode}-${file}`, file, mode })))
const privacyProbes = [
  ['prompt', 'BEGIN RAW PROMPT fixture-private-prompt-payload'],
  ['transcript', '<assistant>fixture-private-transcript-payload</assistant>'],
  ['credential', `ghp_${'x'.repeat(32)}`],
  ['query', 'ssh://example.test/demo?fixture=private'],
  ['userinfo', 'https://fixture-user@example.test/demo'],
  ['unix-home', '/home/fixture'],
  ['mac-home', '/Users/fixture'],
  ['wsl-home', '/MNT/C/uSeRs/fixture'],
  ['windows-home', String.raw`C:\Users\fixture`],
]

const reverseKeys = (value) => {
  if (Array.isArray(value)) return value.map(reverseKeys)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)]))
}
const actionAt = (review, type) => review.subjects.flatMap(({ actions }) => actions).find(({ action }) => action === type)
const malformed = [
  { name: 'array-archive-action', action: 'archive', change: (action) => { action.action = ['archive'] } },
  { name: 'array-flag-kind', action: 'flag', change: (action) => { action.kind = [action.kind] } },
  { name: 'array-flag-source', action: 'flag', change: (action) => { action.source = [action.source] } },
  { name: 'null-flag-source', action: 'flag', change: (action) => { action.source = null } },
  { name: 'null-subject-digest', change: (review) => { review.subjects[0].digest = null } },
  { name: 'null-live-digest', change: (review) => { review.live.roles = null } },
  { name: 'array-live-digest', change: (review) => { review.live['claude-md'] = [review.live['claude-md']] } },
]

const removeOrTruncate = ({ machine, file, mode }) => {
  const path = join(machine.store, file)
  const contents = machine.snapshot()[file]
  if (mode === 'lost') rmSync(path)
  else write(path, contents.subarray(0, Math.floor(contents.length / 2)))
}

const changed = ({ before, after, check, result, invariant = 6 }) => {
  const files = changedFiles(before, after)
  const writes = result?.writes.filter((call) => !/^[a-z]+ memory\.lock(?:\.|$)/iu.test(call)) ?? []
  const methods = [...new Set(writes.map((call) => call.split(' ')[0]))].join(', ')
  check(invariant, !files && writes.length === 0, files ? `changed ${files}` : `store writes: ${methods}`)
}

const recordConfirmation = ({ machine, events, id }) => {
  const result = requireResult(machine.confirm(`confirm fg:${id}`))
  assert.match(result?.systemMessage ?? '', /(?:Field Guide confirmed|already confirmed)/u)
  events.push({ type: 'confirm', id })
}

const gate = (result) => result.status !== 0 && /(?:older|cannot read).*nightly run/iu.test(result.error)
const readGuide = ({ machine, at, use = 'released', key = 'worktrees' }) => machine.run({
  command: 'retrieve', args: ['--subject', key], use, at,
})

const checkAppliedRecords = ({ after, report, check }) => {
  if (report?.outcome !== 'applied') return
  const records = new Map(memoryOf(after).guidance.map(({ id, status }) => [id, status]))
  for (const { action, targetIds, replacementId } of report.operations) {
    const retired = action === 'archive' ? 'archived' : 'superseded'
    check(6, targetIds.every((id) => records.get(id) === retired), `report says ${action}, but a target is not ${retired}`)
    if (replacementId) check(6, records.get(replacementId) === 'active', 'reported replacement is not active')
  }
}

const checkNightlyWrite = ({ machine, events, before, after, result, check, old, undoGate, deadline }) => {
  everConfirmed({ before, after, events, check })
  checkAppliedRecords({ after, report: result?.json, check })
  if (before['memory.md'].equals(after['memory.md']) && !result?.json?.operations?.length) return
  reversible({ before, after, report: result?.json, machine, old, check, gate: undoGate, checkDeadline: deadline })
}

// Whether memory holds a record that the user restored with undo-operation of a journaled archive:
// the archived-to-active edge that the writer gate keeps from a store a 6.15.0 copy reads.
const archiveUndone = (snapshot) => {
  const pending = journalOf(snapshot).filter(({ type }) => type === 'pending')
  const archives = new Set(pending.filter(({ action }) => action === 'archive').map(({ operationId }) => operationId))
  const undos = new Set(pending.filter(({ action, undoes }) => action === 'undo-operation' && archives.has(undoes)).map(({ operationId }) => operationId))
  return memoryOf(snapshot).guidance.some(({ transitions }) => transitions.some(({ from, to, operationId }) => (
    from === 'archived' && to === 'active' && undos.has(operationId)
  )))
}

const tracker = ({ machine, events, check, tally, undoGate, deadline }) => {
  const outside = machine.outside()
  const old = ({ at } = {}) => readGuide({ machine, at })
  return (name, action, { storeWrite, readOnly, user, crash, permitRecovery } = {}) => {
    tally.steps += 1
    const scoped = (invariant, condition, message) => check(name, invariant, condition, message)
    const before = machine.snapshot()
    const result = action(scoped)
    const after = machine.snapshot()
    privacy({ before, after, check: scoped })
    scoped(10, sameFiles(outside, machine.outside()), 'fixture CLAUDE.md, AGENTS.md or skill bytes changed')
    contradictions({ after, events, check: scoped })
    prompts({ saved: after, report: result?.json, check: scoped })
    const refused = result?.status !== 0 && !crash && !permitRecovery
    if (readOnly || (storeWrite && refused)) changed({ before, after, check: scoped, result })
    if (storeWrite && !user) checkNightlyWrite({
      machine, events, before, after, result, check: scoped, old, undoGate, deadline: deadline && name === 'apply',
    })
    if (storeWrite && !sameFiles(before, after) && (!result?.status || crash)) {
      const read = old()
      // The contract asks that 6.15.0 still read the store. The one state it may not read is the
      // user's undo of a nightly archive with no 6.15.0 copy installed; a step after that is excused
      // only while 6.15.0 could not read the store before it either.
      const excused = archiveUndone(before) && old({ at: machine.copyOf(before) }).status !== 0
      if (read.status === 0 || !excused) readerCheck({ result: read, check: scoped })
    }
    return result
  }
}

const previewRun = ({ machine, step, review }) => step('preview', () => machine.apply({ review }), {
  readOnly: true,
})

const checkTreatment = ({ result, current, check, fault }) => {
  const expected = fault.reject ? 'refused' : current.expect
  if (fault.file || fault.crash || fault.deny || fault.post || fault.lag || fault.legacyArchive) return
  if (fault.host) {
    check('apply', 7, gate(result), `expected installed ${fault.host} copy to close the writer gate, got ${describe(result)}`)
    return
  }
  const actual = classify(result.status === 0 ? result.json : null)
  check('apply', 6, [expected].flat().includes(actual) || (current.allowRefusal && actual === 'refused'),
    `expected ${expected}, got ${actual}${result.status ? ` (${describe(result)})` : ''}`)
}

const replay = ({ machine, step, review, token, check, finished, rerun, clock, label = 'replay' }) => {
  for (const [order, candidate] of [['same', review], ['reordered', reverseKeys(review)]]) {
    const name = `${label}-${order}`
    const before = machine.snapshot()
    const result = step(name, () => machine.apply({ review: candidate, token, fault: clock && { clock } }), {
      storeWrite: true, permitRecovery: true,
    })
    if (finished || result.json?.outcome === 'already-applied') {
      changed({ before, after: machine.snapshot(), result, invariant: 3, check: (...args) => check(name, ...args) })
      if (finished) {
        check(name, 3, result.json?.outcome === 'already-applied' || result.status !== 0,
          `replay re-executed finished run: ${describe(result)}`)
      }
    } else if (result.status !== 0) {
      changed({ before, after: machine.snapshot(), result, invariant: 6, check: (...args) => check(name, ...args) })
    } else if (rerun) {
      const files = changedFiles(before, machine.snapshot()).split(', ').filter((file) => file && file !== 'operations.jsonl')
      check(name, 3, files.length === 0 && isDeepStrictEqual(decisions(result.json), decisions(rerun)),
        `replay after the journal was lost ran ${classify(result.json)} and changed ${files.join(', ') || 'only the journal'}`)
    }
  }
}

const queue = ({ current, result, check }) => {
  const expected = current.pair
  if (!expected || result.json?.outcome !== 'applied') return
  const actual = result.json.queued.some(({ targetId, conflictingId }) => expected.includes(targetId) && expected.includes(conflictingId) && targetId !== conflictingId)
  check('apply', 2, actual, 'finished run did not queue the confirmed contradiction')
}

// The documented limit (storage.md, dreaming.md): a released 6.15.0 copy that rebuilds a lost
// annotations.json leaves no trace, so no file shows a confirmation that only the lost file held.
// Only under that fault, a change to an ever-confirmed record (invariant 1), or a contradiction
// with one that no longer counts as open (invariant 2), is that limit, not a defect.
const limitReason = 'documented limit: 6.15.0 rebuilt the lost annotations.json, which alone held the confirmation'
const documentedLimit = ({ fault, failure }) => Boolean(fault.limit) && [1, 2].includes(failure.invariant)

const checkPlan = ({ machine, step, current, check, fault }) => {
  const result = step('plan', () => machine.plan(), { readOnly: true })
  if (result.status && fault.restore) return undefined
  const plan = requireResult(result)
  if (current.redact) check('plan', 5, !JSON.stringify(plan).includes(current.redact), 'plan exposed a legacy credential-shaped slug')
  // A fault that loses annotations.json hides the confirmation that keeps a recorded contradiction
  // open; apply must then refuse, which invariant 2 checks after every step.
  if (current.recorded && (!fault.file || fault.file === 'operations.jsonl') && !fault.lag?.startsWith('lost-')) {
    const pairs = plan.subjects.flatMap((subject) => subject.queuedContradictions ?? [])
    check('plan', 2, pairs.some(({ targetId, conflictingId }) => targetId === current.recorded[0] && conflictingId === current.recorded[1]),
      'plan lost a contradiction still recorded in memory')
  }
  return plan
}

// The next locked write after a lost annotations.json and a lagging watermark: a released 6.15.0
// export by default, or a capture of an unrelated record by this version.
const reconcile = ({ step, machine, lose, lag, capture }) => {
  if (lose) step('lose-annotations', () => rmSync(join(machine.store, 'annotations.json')), { user: true })
  if (lag) step('lag-watermark', () => watermark({ machine, change: (mark) => ({ memoryRevision: mark.memoryRevision - 1 }) }), { user: true })
  const result = capture
    ? step('unrelated-capture', () => machine.captureRun({ name: 'unrelated', key: 'unrelated-capture' }), { storeWrite: true, user: true })
    : step('released-export', machine.oldExport, { storeWrite: true, user: true })
  assert.equal(result.status, 0, result.error)
}

const historyProbe = ({ machine, step, current, check, mustRefuse }) => {
  const packet = requireResult(step('history-plan', () => machine.plan(), { readOnly: true }))
  const target = packet.subjects.find(({ records }) => records.some(({ id }) => id === current.history))
    ?? packet.subjects.find(({ subjectKey }) => subjectKey === (current.prior ? 'kept' : 'worktrees'))
  if (!target) return
  const review = inputFor(packet, [{ scope: 'project', key: target.subjectKey, actions: [archive(current.history)] }])
  const preview = step('history-preview', () => machine.apply({ review }), { readOnly: true })
  const result = step('history-apply', () => machine.apply({ review, token: preview.json?.previewToken ?? 'invalid-token' }), { storeWrite: true })
  if (mustRefuse) check('history-apply', 1, result.status !== 0, 'apply accepted an unrelated edit as a recoverable post-state')
  else if (!result.status) check('history-apply', 1, classify(result.json) === 'confirmed-duplicate', `confirmed record received ${classify(result.json)}`)
}

const reconfirmProbe = ({ machine, step, current, check, events }) => {
  const { id, action } = current.reconfirm
  step('reconfirm', () => recordConfirmation({ machine, events, id }), { user: true })
  const plan = requireResult(step('reconfirmed-plan', () => machine.plan(), { readOnly: true }))
  const review = inputFor(plan, current.subjects)
  const preview = step('reconfirmed-preview', () => machine.apply({ review }), { readOnly: true })
  const result = step('reconfirmed-apply', () => machine.apply({ review, token: preview.json?.previewToken ?? 'invalid-token' }), { storeWrite: true })
  const direct = step('direct-consolidate', () => machine.run({
    command: 'consolidate',
    args: machine.input({ schemaVersion: 1, targetIds: action.targetIds, replacement: action.replacement, reason: action.reason, source: 'agent' }),
  }), { storeWrite: true })
  const expected = direct.json?.result?.outcome === 'approval-required' ? 'proposal' : 'confirmed-overlap'
  check('direct-consolidate', 9, direct.json?.result?.outcome === 'approval-required', `confirmed target's direct decision was ${describe(direct)}`)
  check('reconfirmed-apply', 9, classify(result.json) === expected,
    `nightly ${classify(result.json)} differs from direct ${direct.json?.result?.outcome ?? describe(direct)}`)
}

const approveProbe = ({ machine, step, check, result }) => {
  const proposal = result.json?.proposals?.[0] ?? result.json?.result
  if (!proposal?.confirmPrompt) return
  const approved = step('released-confirm', () => machine.confirm(proposal.confirmPrompt, 'released-hook'), { storeWrite: true, user: true })
  check('released-confirm', 8, /approved/iu.test(approved.json?.systemMessage ?? ''), `released hook did not approve stored proposal: ${describe(approved)}`)
  if (!/approved/iu.test(approved.json?.systemMessage ?? '')) return
  const merged = step('released-approval', () => machine.run({
    use: 'released', command: 'consolidate', args: ['--approval', proposal.confirmPrompt.slice('confirm fg:'.length)],
  }), { storeWrite: true, user: true })
  check('released-approval', 7, merged.json?.result?.outcome === 'consolidated', `released CLI could not apply the approved proposal: ${describe(merged)}`)
}

const directApproval = ({ machine, step, current, check, baseline }) => {
  machine.restore(baseline)
  const action = current.subjects[0].actions[0]
  const proposal = step('new-consolidate', () => machine.run({
    command: 'consolidate',
    args: machine.input({ schemaVersion: 1, targetIds: action.targetIds, replacement: action.replacement, reason: action.reason, source: 'agent' }),
  }), { storeWrite: true })
  check('new-consolidate', 8, Boolean(proposal.json?.result?.confirmPrompt), `expected proposal prompt, got ${describe(proposal)}`)
  approveProbe({ machine, step, check, result: proposal })
}

const invalidAfterCrash = ({ machine, step, current, check }) => {
  const packet = requireResult(step('pending-plan', () => machine.plan(), { readOnly: true }))
  const source = current.prior.review.subjects[0]
  const subject = packet.subjects.find(({ subjectId }) => subjectId === source.subjectId)
  assert.ok(subject, 'the pending run fixture lost the distinct confirmed subject')
  const review = { ...current.prior.review, live: { ...current.prior.review.live, roles: null },
    subjects: [{ ...source, digest: subject.digest }] }
  const result = step('invalid-pending-apply', () => machine.apply({ review, token: current.prior.token }), { storeWrite: true })
  check('invalid-pending-apply', 6, result.status !== 0, 'accepted a null live digest while recovering an interrupted run')
}

// After a run queued a contradiction and changed no record, nothing but the journal shows the
// queue. Loses or empties the journal, then retires the unconfirmed side; the tracker checks that
// both sides stay live (invariant 2), unless apply refuses.
const forgetProbe = ({ machine, step, current, fault }) => {
  const path = join(machine.store, 'operations.jsonl')
  step('forget-journal', () => (fault.forget === 'lost' ? rmSync(path) : write(path, '')), { user: true })
  const packet = requireResult(step('forgotten-plan', () => machine.plan(), { readOnly: true }))
  const review = inputFor(packet, current.retire)
  const preview = step('forgotten-preview', () => machine.apply({ review }), { readOnly: true })
  step('forgotten-apply', () => machine.apply({ review, token: preview.json?.previewToken ?? 'invalid-token' }), { storeWrite: true })
}

const later = ({ machine, step, current, check, events, fault, result }) => {
  if (fault.recover === 'invalid') {
    invalidAfterCrash({ machine, step, current, check })
    return
  }
  if (fault.recover) {
    if (fault.recover === 'edited') step('edit-crash-post-state', () => alterMemory({ machine, edit: ({ guidance }) => {
      const archived = guidance.find(({ status }) => status === 'archived')
      archived.transitions.at(-1).reason = 'This edit was never part of the interrupted operation.'
    } }), { user: true })
    else reconcile({ step, machine, lose: fault.recover === 'lost' })
    historyProbe({ machine, step, current, check, mustRefuse: fault.recover === 'edited' })
  }
  if (fault.forget && result.json?.outcome === 'applied') forgetProbe({ machine, step, current, fault })
  if (current.reconfirm && fault.name === 'clean' && result.json?.outcome === 'applied') reconfirmProbe({ machine, step, current, check, events })
  if (current.approval && fault.name === 'clean') approveProbe({ machine, step, check, result })
}

const beforeApply = ({ machine, current, step, fault, baseline, check }) => {
  if (fault.host) step('install-mixed-readers', () => {
    machine.install({ host: fault.host, old: true })
    machine.install({ host: fault.host === 'codex' ? 'claude' : 'codex', old: false })
  }, { user: true })
  if (fault.oldExport) step('released-export', machine.oldExport, { storeWrite: true, user: true })
  if (['export', 'lost-export', 'lost-capture'].includes(fault.lag)) {
    reconcile({ step, machine, lose: fault.lag.startsWith('lost-'), lag: true, capture: fault.lag === 'lost-capture' })
  } else if (fault.lag) {
    step('watermark', () => watermark({ machine, change: () => ({ fingerprints: [] }) }), { user: true })
  }
  if (fault.restore) step('alter-memory', (scoped) => restoreFault({
    machine, info: current.badRestore, missingId: fault.restore === 'missing', check: scoped,
  }), { user: true })
  if (fault.file && baseline[fault.file]) {
    step('fault-store-file', () => removeOrTruncate({ machine, file: fault.file, mode: fault.mode }), { user: true })
  }
  const plan = checkPlan({ machine, step, current, check, fault })
  return plan ? inputFor(plan, fault.subjects ?? current.subjects) : current.controlReview
}

const checkFaultRefusal = ({ fault, original, current, applied, check }) => {
  if (fault.file === 'operations.jsonl' && original && current.expect === 'refused') {
    check('apply', 2, applied.status !== 0, 'apply accepted a retirement after losing recorded contradiction history')
  }
  if (fault.lag === 'empty-fingerprints') {
    check('apply', 1, applied.status !== 0, 'apply trusted an empty watermark fingerprint list over nonempty memory')
  }
}

const attempt = ({ machine, current, fault, step, check, review, original, token }) => {
  const preview = previewRun({ machine, step, review })
  const candidate = structuredClone(review)
  if (fault.change) fault.change(fault.action ? actionAt(candidate, fault.action) : candidate)
  const attemptedPreview = fault.change ? step('invalid-preview', () => machine.apply({ review: candidate }), { readOnly: true }) : preview
  if (fault.change) check('invalid-preview', 6, attemptedPreview.status !== 0, 'preview accepted invalid reviewer input')
  const applied = step('apply', () => machine.apply({
    review: fault.reorder ? reverseKeys(candidate) : candidate,
    token: attemptedPreview.json?.previewToken ?? preview.json?.previewToken ?? token ?? 'invalid-token',
    fault: fault.crash || fault.deny || fault.count ? fault : undefined,
  }), { storeWrite: true, crash: fault.crash })
  parity({ preview: preview.json, applied: applied.json, check: (...args) => check('apply', ...args) })
  if (fault.crash) check('apply', 6, applied.status === 86 && applied.writes.length === fault.crash,
    `injection expected exit at write ${fault.crash}, observed ${describe(applied)} after ${applied.writes.length} writes`)
  if (fault.deny) {
    check('apply', 6, /EACCES/u.test(applied.error), `denied journal write returned ${describe(applied)}`)
    for (const proposal of preview.json?.proposals ?? []) {
      const prior = proposalsOf(machine.snapshot()).some(({ id }) => id === proposal.proposalId)
      check('apply', 8, !prior, 'failed run published an approvable proposal')
      // A preview names a proposal by ID alone; this is the prompt a stored proposal would get.
      const prompt = `confirm fg:proposal:${proposal.proposalId.replace('proposal:v1:', '').slice(0, 12)}`
      const confirmed = step('approve-failed-run', () => machine.confirm(prompt), { readOnly: true })
      check('approve-failed-run', 8, !/approved/iu.test(confirmed.json?.systemMessage ?? ''), 'failed run proposal could be approved')
    }
  }
  checkFaultRefusal({ fault, original, current, applied, check })
  checkTreatment({ result: applied, current, check, fault })
  return { applied, preview: preview.json }
}

const checkAfterApply = ({ machine, step, current, check, fault, applied, preview, baseline, review }) => {
  const finished = applied.json?.outcome === 'applied'
  const afterApply = machine.snapshot()
  const publishedFile = fault.file && !baseline[fault.file] && afterApply[fault.file]
  if (publishedFile) step('fault-after-apply', () => removeOrTruncate({ machine, file: fault.file, mode: fault.mode }), { user: true })
  // When the fault removed or cut the journal this run created, and the run changed no other file
  // but proposals.json, which a direct consolidate also writes, no file shows that the run happened.
  // Refusing then would need a new record of runs, so a replay may run again as a first run.
  const traceless = finished && publishedFile && fault.file === 'operations.jsonl'
    && changedFiles(baseline, afterApply).split(', ').every((file) => ['operations.jsonl', 'proposals.json'].includes(file))
  if (finished || fault.crash) {
    replay({ machine, step, review, check, finished: finished && !traceless, rerun: traceless && applied.json, token: preview?.previewToken,
      clock: fault.post && elapsed(applied.json, 15) })
  }
  if (fault.post && finished) {
    const clock = elapsed(applied.json, 15)
    const packet = requireResult(step('expired-plan', () => machine.plan({ clock }), { readOnly: true }))
    check('expired-plan', 3, packet.subjects.length > 0, 'expired proposal left no subject due for a fresh review')
  }
  if (current.visible) {
    const retrieved = step('retrieve-confirmed-shared', () => readGuide({ machine, use: 'cli' }), { readOnly: true })
    check('retrieve-confirmed-shared', 1, retrieved.json?.result?.guidance?.some(({ id }) => id === current.visible), 'retrieval hid the confirmed shared rule')
  }
  if (fault.counterpart) {
    const packet = requireResult(step('next-plan', () => machine.plan(), { readOnly: true }))
    check('next-plan', 2, packet.subjects.some(({ scope, context }) => scope === 'project' && !context), 'incomplete review marked the due project subject reviewed')
  }
}

const checkUnrelatedReplay = ({ machine, step, current, check, fault }) => {
  if (!fault.crash || !current.prior) return
  const snapshot = machine.snapshot()
  const { review, token } = current.prior
  replay({ machine, step, review, token, check, finished: true, label: 'independent-finished-run' })
  machine.restore(snapshot)
}

const runCell = ({ t, machine, seed, current, fault, baseline, events: originalEvents, tally }) => {
  const events = structuredClone(originalEvents)
  if (current.pair) events.push({ type: 'held', ids: current.pair })
  const failures = []
  const check = (step, invariant, condition, observed) => {
    if (!condition) failures.push({ scenario: seed.name, fault: fault.name, step, invariant, observed })
  }
  const step = tracker({ machine, events, check, tally, undoGate: current.undoGate && fault.name === 'clean', deadline: current.deadline && fault.name === 'clean' })
  machine.restore(baseline)
  machine.clearReaders()
  const review = beforeApply({ machine, current, step, fault, baseline, check })
  const { applied, preview } = attempt({ machine, current, fault, step, check, review, original: baseline[fault.file], token: current.controlToken })
  queue({ current, result: applied, check })
  checkUnrelatedReplay({ machine, step, current, check, fault })
  if (fault.recover) later({ machine, step, current, check, events, fault, result: applied })
  else {
    checkAfterApply({ machine, step, current, check, fault, applied, preview, baseline, review })
    later({ machine, step, current, check, events, fault, result: applied })
  }
  if (fault.directApproval) directApproval({ machine, step, current, check, baseline })
  const allowed = failures.filter((failure) => documentedLimit({ fault, failure }))
  const failed = failures.filter((failure) => !allowed.includes(failure))
  for (const failure of new Set(allowed.map((item) => JSON.stringify(item)))) t.diagnostic(`ALLOWED ${failure} (${limitReason})`)
  for (const failure of new Set(failed.map((item) => JSON.stringify(item)))) t.diagnostic(`ROW ${failure}`)
  tally.cells += 1
  tally.allowed += allowed.length
  if (failed.length) tally.failed += 1
  assert.equal(failed.length, 0, `${seed.name}, ${fault.name}, ${failed[0]?.step}, invariant ${failed[0]?.invariant}: ${failed[0]?.observed}`)
}

const secondaryFaults = ({ current, input, baseline, control, events }) => {
  const mix = malformedFor({ input, current })
  const files = fileFaults.filter(({ file }) => baseline[file] || control.after[file])
  // By default, only crashes right after annotations and right after memory reach disk: the points
  // where recovery aborts or commits an operation.
  const landings = ['renameSync annotations.json', 'renameSync memory.md'].map((call) => control.applied.writes.indexOf(call) + 1).filter(Boolean)
  const projected = (crashPrefixes ? control.applied.writes.map((_, index) => index + 1) : landings).map((crash) => ({ name: `crash-${crash}`, crash }))
  const landed = control.applied.writes.indexOf('renameSync memory.md') + 1
  const reconciled = control.applied.writes.indexOf('renameSync annotations-watermark.json') + 1
  const neighbors = current.prior && landed ? ['export', 'lost', 'edited'].map((recover) => ({
    name: `crash-${landed}-${recover}`, crash: landed, recover,
  })) : []
  if (current.prior && reconciled) neighbors.push({ name: `crash-${reconciled}-invalid`, crash: reconciled, recover: 'invalid' })
  return [
    { name: 'clean' }, { name: 'reordered-keys', reorder: true }, { name: 'released-export', oldExport: true },
    ...(current.expect === 'proposal' ? [{ name: 'direct-proposal-older-approval', directApproval: true }] : []),
    ...files, ...mix, ...projected, ...neighbors, ...specialFaults(current), ...historyFaults({ current, events, baseline }),
    ...(control.applied.json?.outcome === 'applied' ? ['codex', 'claude'].map((host) => ({ name: `old-${host}-copy`, host })) : []),
  ]
}

const malformedFor = ({ input, current }) => {
  if (current.expect === 'refused') return []
  const faults = malformed.filter(({ action }) => !action || actionAt(input, action))
  const privacy = current.undoGate ? privacyProbes.map(([category, reason]) => ({
    name: `private-${category}`, action: 'archive', change: (action) => { action.reason = reason },
  })) : []
  const contradictionBatch = current.pair ? [{
    name: 'queued-then-array-archive', change: (review) => {
      const subject = review.subjects[0]
      subject.actions.push({ ...archive(subject.actions[0].targetId), action: ['archive'] })
    },
  }] : []
  return [...faults, ...privacy, ...contradictionBatch].map((fault) => ({ ...fault, reject: true }))
}

const specialFaults = (current) => [
  ...(current.legacyArchive ? [{ name: 'legacy-subject-archive', subjects: current.legacyArchive, legacyArchive: true }] : []),
  ...(current.approval ? [{ name: 'expired-proposal-replay', post: true }, { name: 'journal-denied', deny: true }] : []),
  ...(current.lag ? ['export', 'lost-export', 'empty-fingerprints'].map((lag) => ({ name: `watermark-${lag}`, lag })) : []),
  ...(current.counterpart ? [
    { name: 'omitted-counterpart', subjects: [current.counterpart[0]], counterpart: true, reject: true },
    { name: 'context-only-archive', subjects: [current.counterpart[1]], counterpart: true, reject: true },
  ] : []),
  ...(current.badRestore ? ['borrowed', 'missing'].map((restore) => ({ name: `restore-${restore}`, restore, reject: true })) : []),
]

// Losses of history that no file shows. For a scenario where the user confirmed guidance:
// annotations.json lost and the watermark lagging, then the next locked write, either a released
// 6.15.0 export (the documented limit) or a capture by this version. For a scenario that queues a
// contradiction: the journal lost or emptied after the run, then a run that retires the
// unconfirmed side. 6.15.0 cannot export a store that holds an undone archive.
const historyFaults = ({ current, events, baseline }) => [
  ...(events.some(({ type }) => type === 'confirm') ? [
    ...(current.lag || archiveUndone(baseline) ? [] : [{ name: 'lost-annotations-released-export', lag: 'lost-export', limit: true }]),
    { name: 'lost-annotations-capture', lag: 'lost-capture' },
  ] : []),
  ...(current.retire ? ['lost', 'emptied'].map((forget) => ({ name: `queued-then-${forget}-journal`, forget })) : []),
]

const countWrites = ({ machine, review, baseline }) => {
  const preview = machine.apply({ review })
  const token = preview.json?.previewToken
  const applied = machine.apply({ review, token: token ?? 'invalid-token', fault: { count: true } })
  const after = machine.snapshot()
  machine.restore(baseline)
  return { applied, after, token }
}

for (const seed of scenarios) {
  test(seed.name, async (t) => {
    const machine = fixture({ t, origin: seed.origin })
    const events = []
    const current = seed.seed({ machine, events, confirm: (id) => recordConfirmation({ machine, events, id }) })
    const baseline = machine.snapshot()
    const input = inputFor(requireResult(machine.plan()), current.subjects)
    const control = countWrites({ machine, review: input, baseline })
    current.controlToken = control.token
    current.controlReview = input
    const faults = secondaryFaults({ current, input, baseline, control, events })
    const tally = { cells: 0, failed: 0, allowed: 0, steps: 0 }
    for (const fault of faults) {
      await t.test(fault.name, (cell) => runCell({ t: cell, machine, seed, current, fault, baseline, events, tally }))
    }
    t.diagnostic(`MATRIX ${JSON.stringify({ scenario: seed.name, ...tally, writes: control.applied.writes.length })}`)
  })
}

test('the privacy oracle holds only what memory held and compares whole home paths', () => {
  const gained = (before, after) => {
    const found = []
    privacy({ before, after, check: (_invariant, ok, message) => { if (!ok) found.push(message) } })
    return found
  }
  const bytes = (text) => Buffer.from(text)
  const identity = '"repositoryIdentity":"remote:/home/example/projects/demo"'
  const memory = { 'memory.md': bytes(identity) }
  assert.deepEqual(gained({ ...memory, 'proposals.json': bytes('{}') }, { ...memory, 'proposals.json': bytes(identity) }),
    ['proposals.json gained absolute home path'], 'a value memory holds stays out of proposals.json')
  assert.deepEqual(gained(memory, { 'memory.md': bytes(`${identity} "reason":"see /home/example/secret-project/notes."`) }),
    ['memory.md gained absolute home path'], 'a new path under a held home directory is new')
  assert.deepEqual(gained({ 'memory.md': bytes('{}'), 'sessions/x.json': bytes('/home/alice/work') }, { 'memory.md': bytes('/home/alice/work'), 'sessions/x.json': bytes('/home/alice/work') }),
    ['memory.md gained absolute home path'], 'a value only another file holds is not held')
  assert.deepEqual(gained({ ...memory, 'operations.jsonl': bytes(identity) }, {
    'memory.md': bytes(`${identity}${identity}`), 'memory.json.tmp-12': bytes(identity), 'operations.jsonl': bytes(`${identity}\n`),
  }), [], 'memory and its temporary files may copy a held value, and a file keeps what it held')
})
