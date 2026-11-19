import assert from 'node:assert/strict'
import { join } from 'node:path'
import { memoryOf, requireResult, write } from './dream-invariants-fixture.mjs'
import { classify, describe } from './dream-invariants-oracle.mjs'

const live = 'live:claude-md'
const SUBJECT = 'worktrees'
const SHORT = 'Clean up merged worktrees.'
const example = { kind: 'pattern', language: 'sh', code: 'git worktree prune' }
const day = 86_400_000
const lookup = ({ packet, scope, key }) => packet.subjects.find((subject) => subject.scope === scope
  && (subject.subjectKey === key || (key.startsWith('sk-') && subject.subjectKey !== SUBJECT)))

export const archive = (targetId) => ({ action: 'archive', targetId, duplicateOf: live, reason: 'Global guidance says the same thing.' })
const merge = (targetIds, learning = SHORT) => ({
  action: 'consolidate', targetIds, replacement: { learning, confidence: 'high', examples: [example] }, reason: 'Both records say the same thing.',
})
const flag = (targetIds) => ({ action: 'flag', kind: 'live-edit', targetIds, source: 'claude-md', reason: 'The global guidance is ambiguous.' })
const contradiction = ([targetId, conflictingId]) => ({
  action: 'contradiction', targetId, conflictingId, reason: 'The two rules ask for opposite behavior.',
})
const row = (actions, scope = 'project', key = SUBJECT) => ({ scope, key, actions })
export const inputFor = (packet, subjects) => ({
  schemaVersion: 1,
  live: Object.fromEntries(packet.live.map(({ source, digest }) => [source, digest])),
  subjects: subjects.map(({ scope, key, actions }) => {
    const subject = lookup({ packet, scope, key })
    assert.ok(subject, `plan omitted ${scope} subject ${key.startsWith('sk-') ? '<legacy key>' : key}`)
    return { subjectId: subject.subjectId, digest: subject.digest, actions }
  }),
})

const baseApply = ({ machine, subjects }) => {
  const review = inputFor(requireResult(machine.plan()), subjects)
  const preview = requireResult(machine.apply({ review }))
  assert.equal(preview.outcome, 'preview')
  return { review, token: preview.previewToken, applied: requireResult(machine.apply({ review, token: preview.previewToken })) }
}

const outcome = {
  project: { archive: 'archive', consolidate: 'consolidate', flag: 'live-edit', contradiction: 'queued', proposal: 'proposal' },
  shared: { archive: 'shared-proposal', consolidate: 'shared-overlap', flag: 'live-edit', contradiction: 'queued', proposal: 'shared-overlap' },
}
const actions = {
  archive: ([id]) => archive(id),
  consolidate: merge,
  flag,
  contradiction,
  proposal: merge,
}

const actionScenario = ({ scope, action }) => ({
  name: `${scope}-${action}`,
  seed({ machine, confirm }) {
    const first = machine.capture({ name: 'cleanup', scope })
    const ids = action === 'archive' || action === 'flag' ? [first] : [
      first,
      machine.capture({
        name: 'second', scope,
        ...(action === 'contradiction' ? { learning: 'Keep the worktree after the merge.' } : {}),
      }),
    ]
    if (action === 'contradiction' || action === 'proposal') confirm(first)
    return {
      subjects: [row([actions[action](ids)], scope)],
      expect: outcome[scope][action],
      pair: action === 'contradiction' ? ids : undefined,
      // Retires the unconfirmed side of the queued contradiction.
      retire: action === 'contradiction' ? [row([archive(ids[1])], scope)] : undefined,
      undoGate: scope === 'project' && action === 'archive',
      deadline: scope === 'project' && (action === 'archive' || action === 'consolidate'),
      approval: action === 'proposal' && scope === 'project',
    }
  },
})

const confirmedArchive = {
  name: 'confirmed-history',
  seed({ machine, confirm }) {
    const id = machine.capture({ name: 'confirmed' })
    confirm(id)
    const subjects = [row([archive(id)])]
    assert.equal(classify(baseApply({ machine, subjects }).applied), 'confirmed-duplicate')
    machine.changeLive()
    return { subjects, expect: 'confirmed-duplicate', history: id, lag: true }
  },
}

const interruptedNeighbor = {
  name: 'interrupted-neighbor',
  seed({ machine, confirm }) {
    const kept = machine.capture({ name: 'confirmed', key: 'kept' })
    confirm(kept)
    const prior = baseApply({ machine, subjects: [row([archive(kept)], 'project', 'kept')] })
    const other = machine.capture({ name: 'unrelated' })
    return { subjects: [row([archive(other)])], expect: 'archive', history: kept, prior }
  },
}

const recorded = {
  name: 'memory-contradiction',
  seed({ machine, confirm, events }) {
    const first = machine.capture({ name: 'confirmed' })
    confirm(first)
    const opposing = machine.capture({
      name: 'opposing', learning: 'Keep worktrees after each merge.',
      relationship: { kind: 'contradicts', targetId: first },
    })
    events.push({ type: 'held', ids: [opposing, first] })
    return { subjects: [row([archive(opposing)])], expect: 'refused', recorded: [opposing, first] }
  },
}

const journalHeld = {
  name: 'journal-contradiction-after-undo',
  seed({ machine, confirm, events }) {
    const pair = [
      machine.capture({ name: 'confirmed' }),
      machine.capture({ name: 'opposing', learning: 'Keep worktrees after each merge.' }),
    ]
    confirm(pair[0])
    assert.equal(classify(baseApply({ machine, subjects: [row([contradiction(pair)])] }).applied), 'queued')
    events.push({ type: 'held', ids: pair })
    const other = machine.capture({ name: 'unrelated', key: 'other' })
    const { applied } = baseApply({ machine, subjects: [row([archive(other)], 'project', 'other')] })
    const undo = requireResult(machine.run({ command: 'undo-operation', args: ['--id', applied.operations[0].operationId] }))
    assert.equal(undo.result.outcome, 'undone')
    return { subjects: [row([archive(pair[1])])], expect: 'refused' }
  },
}

const context = {
  name: 'cross-scope-context',
  seed({ machine, confirm }) {
    const shared = machine.capture({ name: 'keep', scope: 'shared', learning: 'Keep worktrees after merging.' })
    confirm(shared)
    baseApply({ machine, subjects: [row([], 'shared')] })
    const project = machine.capture({ name: 'remove' })
    const pair = [project, shared]
    return {
      subjects: [row([contradiction(pair)]), row([], 'shared')],
      expect: 'queued', pair, counterpart: [row([archive(project)]), row([archive(shared)], 'shared')],
      retire: [row([archive(project)]), row([], 'shared')],
    }
  },
}

const hiddenShared = {
  name: 'replacement-hides-confirmed-shared',
  seed({ machine, confirm }) {
    const shared = machine.capture({ name: 'shared', learning: SHORT, scope: 'shared' })
    confirm(shared)
    const ids = [machine.capture({ name: 'project-a' }), machine.capture({ name: 'project-b' })]
    return {
      subjects: [row([merge(ids)]), row([], 'shared')],
      expect: 'confirmed-overlap', visible: shared,
    }
  },
}

const token = `sk-${'x'.repeat(24)}`
const unsafeMetadata = (field) => ({
  name: `legacy-${field}`,
  seed({ machine, confirm }) {
    const key = field === 'subject' ? token : SUBJECT
    const linkedSubjects = field === 'link' ? [token] : undefined
    const ids = ['first', 'second'].map((name) => machine.capture({ name, key, linkedSubjects }))
    if (field === 'subject') confirm(ids[0])
    return {
      subjects: [row([merge(ids)], 'project', key)],
      legacyArchive: field === 'subject' ? [row([archive(ids[1])], 'project', key)] : undefined,
      expect: 'unsafe-overlap', redact: token, allowRefusal: true,
    }
  },
})

const localOrigin = {
  name: 'file-origin',
  origin: 'file:///home/example/projects/demo.git',
  seed({ machine }) {
    const ids = ['first', 'second'].map((name) => machine.capture({ name }))
    return { subjects: [row([merge(ids)])], expect: ['consolidate', 'unsafe-overlap'], allowRefusal: true }
  },
}

const reconfirmed = (mixed) => ({
  name: mixed ? 'mixed-confirmations' : 'reconfirmation',
  seed({ machine, confirm, events }) {
    const ids = ['first', 'second'].map((name) => machine.capture({ name }))
    const id = ids[0]
    confirm(id)
    requireResult(machine.run({ command: 'unconfirm', args: ['--id', id] }))
    events.push({ type: 'unconfirm', id })
    if (mixed) confirm(ids[1])
    const action = merge(ids)
    const subjects = [row([action])]
    return { subjects, expect: 'confirmed-overlap', reconfirm: !mixed && { id, action } }
  },
})

const alteredRestore = {
  name: 'restore-borrows-operation',
  seed({ machine }) {
    const first = machine.capture({ name: 'first' })
    const second = machine.capture({ name: 'second', key: 'other' })
    const third = machine.capture({ name: 'third', key: 'unrelated' })
    const { applied } = baseApply({ machine, subjects: [row([archive(first)])] })
    const undo = requireResult(machine.run({ command: 'undo-operation', args: ['--id', applied.operations[0].operationId] }))
    return {
      subjects: [row([archive(third)], 'project', 'unrelated')],
      expect: 'archive', badRestore: { first, second, archiveId: applied.operations[0].operationId, undoId: undo.result.operationId },
    }
  },
}

const proposalWithArchive = {
  name: 'proposal-and-archive',
  seed({ machine, confirm }) {
    const ids = ['first', 'second'].map((name) => machine.capture({ name }))
    confirm(ids[0])
    const third = machine.capture({ name: 'duplicate', key: 'other' })
    return { subjects: [row([merge(ids)]), row([archive(third)], 'project', 'other')], expect: 'archive+proposal', approval: true }
  },
}

const lineage = {
  name: 'confirmed-predecessor',
  seed({ machine, confirm, events }) {
    const ids = ['first', 'second'].map((name) => machine.capture({ name }))
    confirm(ids[0])
    const { applied } = baseApply({ machine, subjects: [row([merge(ids)])] })
    const prompt = applied.proposals[0].confirmPrompt
    requireResult(machine.confirm(prompt))
    const resolved = requireResult(machine.run({ command: 'consolidate', args: ['--approval', prompt.slice('confirm fg:'.length)] }))
    const id = resolved.result.replacementId
    assert.equal(resolved.result.outcome, 'consolidated')
    events.push({ type: 'approved', ids, id })
    requireResult(machine.run({ command: 'unconfirm', args: ['--id', id] }))
    events.push({ type: 'unconfirm', id })
    machine.changeLive()
    return { subjects: [row([archive(id)])], expect: 'confirmed-duplicate', allowRefusal: true }
  },
}

export const scenarios = [
  ...Object.keys(outcome).flatMap((scope) => Object.keys(actions).map((action) => actionScenario({ scope, action }))),
  confirmedArchive, interruptedNeighbor, recorded, journalHeld, context, hiddenShared,
  unsafeMetadata('subject'), unsafeMetadata('link'), localOrigin, reconfirmed(false),
  reconfirmed(true), alteredRestore, proposalWithArchive, lineage,
]

export const alterMemory = ({ machine, edit }) => {
  const before = machine.snapshot()
  const markdown = before['memory.md'].toString()
  const start = markdown.lastIndexOf('```json\n') + 8
  const end = markdown.lastIndexOf('\n```')
  const memory = memoryOf(before)
  edit(memory)
  write(join(machine.store, 'memory.md'), markdown.slice(0, start) + JSON.stringify(memory, null, 2) + markdown.slice(end))
  write(join(machine.store, 'memory.json'), JSON.stringify(memory))
}

export const watermark = ({ machine, change }) => {
  const path = 'annotations-watermark.json'
  const content = JSON.parse(machine.snapshot()[path].toString())
  write(join(machine.store, path), JSON.stringify({ ...content, ...change(content) }))
}

export const elapsed = (report, days, fallback = Date.now()) => {
  const expiry = report?.proposals?.[0]?.expiresAt
  return expiry ? Date.parse(expiry) + 1 : fallback + days * day
}

export const restoreFault = ({ machine, info, missingId, check }) => {
  alterMemory({ machine, edit: ({ guidance }) => {
    const original = guidance.find(({ id }) => info.first === id)
    const innocent = guidance.find(({ id }) => info.second === id)
    const [archiveTransition, restore] = original.transitions.slice(-2)
    const moved = { ...restore, operationId: info.undoId }
    if (missingId) delete moved.operationId
    innocent.transitions.push(archiveTransition, moved)
    innocent.updatedAt = moved.at
  } })
  const validation = machine.run({ command: 'validate' })
  check(4, validation.status !== 0, 'validate accepted a restore that has no matching undo for its record')
  const attempt = machine.run({ command: 'undo-operation', args: ['--id', info.archiveId] })
  check(4, attempt.status !== 0, `undo accepted a borrowed restore: ${describe(attempt)}`)
}
