import { isDeepStrictEqual } from 'node:util'
import { durable, journalOf, memoryOf, proposalsOf } from './dream-invariants-fixture.mjs'

const DAY = 86_400_000
const privacyPatterns = {
  'transcript or prompt': [
    /<(?:user|assistant|system)(?:\s[^>]*)?>/giu,
    /\bBEGIN (?:RAW )?(?:PROMPT|TRANSCRIPT)\b/giu,
    /(?:^|\n|\\n)(?:user|assistant|system):[ \t]+/gimu,
    /fixture-private-(?:prompt|transcript)-[a-z]+/giu,
  ],
  credential: [
    /\b(?:github_pat_|gh[pousr]_|AKIA|ASIA)[a-z0-9_]{12,}\b/giu,
    /\b(?:sk-|xox[baprs]-|sk_live_)[a-z0-9_-]{20,}\b/giu,
    /\b(?:eyJ[a-z0-9_-]{8,}\.){2}[a-z0-9_-]{8,}/gu,
    /-----BEGIN (?:[a-z ]+ )?PRIVATE KEY-----/giu,
    /\b(?:password|passwd|access[_-]?token|api[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s",;]+/giu,
  ],
  'URL query': [/\b[a-z][a-z0-9+.-]*:(?!:)\S*?\?[^\s"'<>]+/giu],
  'URL user information': [/\b[a-z][a-z0-9+.-]*:\/\/[^\s/?#@"'<>]+@/giu],
  // The whole path token, so a new path under a held home directory is a new value. A token stops
  // at whitespace, a quote, a backslash (Unix), or punctuation that ends a path in text, and leaves
  // out trailing sentence dots.
  'absolute home path': [
    /\/(?:mnt\/[a-z]\/users|home|users)\/[^\s"'`\\,;:?#()<>[\]{}]+?(?=\.*(?:[\s"'`\\,;:?#()<>[\]{}]|$))/giu,
    /\b[a-z]:\\{1,2}users\\{1,2}[^\s"'`,;:?#()<>[\]{}]+?(?=\.*(?:[\s"'`,;:?#()<>[\]{}]|$))/giu,
  ],
}

const matches = (bytes, patterns) => {
  const content = bytes?.toString('latin1') ?? ''
  const counts = new Map()
  for (const pattern of patterns) {
    for (const [text] of content.matchAll(pattern)) counts.set(text, (counts.get(text) ?? 0) + 1)
  }
  return counts
}

const showFile = (file) => file.replace(/(?:\.tmp-\d+|\.[a-f\d-]{36}\.tmp)$/u, '.tmp')
const baseFile = (file) => showFile(file).replace(/\.tmp$/u, '')
const memoryFiles = ['memory.md', 'memory.json']
// The user's own input reaches the store through memory, so a value counts as held only when
// memory.md or memory.json held it before the step. A step may copy a held value only into a
// memory file or its temporary file, as a merge copies its targets' repository identity. Every
// other file, proposals.json and operations.jsonl included, may keep only what it held itself.
export const privacy = ({ before, after, check }) => {
  for (const [category, patterns] of Object.entries(privacyPatterns)) {
    const heldIn = (file) => new Set(matches(before[file], patterns).keys())
    const inMemory = new Set(memoryFiles.flatMap((file) => [...heldIn(file)]))
    for (const [file, bytes] of Object.entries(after)) {
      const own = heldIn(baseFile(file))
      const allowed = (text) => own.has(text) || (memoryFiles.includes(baseFile(file)) && inMemory.has(text))
      if ([...matches(bytes, patterns).keys()].some((text) => !allowed(text))) check(5, false, `${showFile(file)} gained ${category}`)
    }
  }
}

const sorted = (values) => [...values].sort()
const same = isDeepStrictEqual
const byId = (snapshot) => new Map(memoryOf(snapshot).guidance.map((record) => [record.id, record]))
const readStoredProposal = (saved, prompt) => {
  const suffix = prompt.match(/^confirm fg:proposal:(?:v1:)?([a-f0-9]{8,64})$/u)?.[1]
  if (!suffix) return undefined
  const candidates = proposalsOf(saved).filter(({ id }) => id.startsWith(`proposal:v1:${suffix}`))
  return candidates.length === 1 ? candidates[0] : undefined
}

const reportedProposals = (value) => {
  if (!value || typeof value !== 'object') return []
  if (typeof value.confirmPrompt === 'string') return [value]
  return Object.values(value).flatMap(reportedProposals)
}

export const prompts = ({ saved, report, check }) => {
  for (const proposal of reportedProposals(report)) {
    if (!proposal.confirmPrompt) continue
    const stored = readStoredProposal(saved, proposal.confirmPrompt)
    const records = byId(saved)
    const fingerprints = (proposal.targetIds ?? []).map((id) => records.get(id)?.fingerprint)
    check(8, stored?.id === proposal.proposalId && same(sorted(stored.targetFingerprints), sorted(fingerprints)),
      stored ? 'printed proposal prompt names different stored targets' : 'printed proposal prompt has no stored proposal')
  }
}

const hasConfirmedPredecessor = (id, records, ever, seen = new Set()) => {
  if (ever.has(id)) return true
  if (seen.has(id)) return false
  seen.add(id)
  return (records.get(id)?.consolidates ?? []).some((parent) => hasConfirmedPredecessor(parent, records, ever, seen))
}

export const everConfirmed = ({ before, after, events, check }) => {
  const ever = new Set(events.filter(({ type }) => type === 'confirm').map(({ id }) => id))
  const next = byId(after)
  const previous = byId(before)
  for (const [id, record] of previous) {
    if (record.status !== 'active' || !hasConfirmedPredecessor(id, previous, ever)) continue
    const actual = next.get(id)
    check(1, same(record, actual), `ever-confirmed record changed (active → ${actual?.status ?? 'missing'})`)
  }
}

export const contradictions = ({ after, events, check }) => {
  const records = byId(after)
  for (const { ids, type } of events) {
    if (type !== 'held') continue
    const statuses = ids.map((id) => records.get(id)?.status)
    check(2, statuses.every((status) => status === 'active'), `open contradiction has sides ${statuses.join(' / ')}`)
  }
}

export const decisions = (result) => ({
  operations: (result.operations ?? []).map(({ action, targetIds, replacementId }) => ({
    action, targetIds: sorted(targetIds), replacementId,
  })),
  proposals: (result.proposals ?? []).map(({ targetIds, proposalId, confirmsReplacement }) => ({
    proposalId, targetIds: sorted(targetIds), confirmsReplacement,
  })),
  queued: result.queued ?? [],
  flags: result.flags ?? [],
})

export const parity = ({ preview, applied, check }) => {
  if (applied?.outcome !== 'applied' || preview?.outcome !== 'preview') return
  check(6, same(decisions(preview), decisions(applied)),
    `preview reported ${classify(preview)}, apply reported ${classify(applied)} (compare actions, targets and proposal IDs)`)
}

export const classify = (report) => {
  if (!report) return 'refused'
  return [
    ...(report.operations ?? []).map(({ action }) => action),
    ...(report.proposals ?? []).map(() => 'proposal'),
    ...(report.queued ?? []).map(() => 'queued'),
    ...(report.flags ?? []).map(({ kind }) => kind),
  ].sort().join('+') || 'no actions'
}

const summarize = (error) => error.split('\n').find((line) => /illegal lifecycle|journaled undo|rehash|older|invalid|refus/iu.test(line))
  ?.trim().replace(/[a-f0-9]{16,}/gu, '<id>') ?? error.split('\n')[0]
export const describe = (result) => (result.json?.outcome ?? result.json?.result?.outcome
  ?? (result.error ? summarize(result.error) : `exit ${result.status}`))
  .replace(/(?:\/tmp|~)\/field-guide-invariants-[^/\s]+/gu, '<fixture>')
export const readerCheck = ({ result, check }) => check(7, result.status === 0, `released retrieval failed: ${describe(result)}`)
export const sameFiles = (before, after) => same(durable(before), durable(after))
export const changedFiles = (before, after) => [...new Set([...Object.keys(durable(before)), ...Object.keys(durable(after))])]
  .filter((name) => !same(before[name], after[name])).map(showFile).sort().join(', ')

const guidanceContent = ({ transitions, retirements, updatedAt, status, ...record }) => record

const undoCheck = ({ machine, id, action, restored, old, check, gate, clock }) => {
  const { result, before, after, reader } = machine.checkUndo(id, { old, gate, clock })
  privacy({ before, after, check })
  if (result.status && /older.*cannot read/iu.test(result.error)) {
    check(4, sameFiles(before, after), 'undo writer gate changed store bytes')
    return
  }
  check(4, result.json?.result?.outcome === 'undone', `undo failed: ${describe(result)}`)
  if (result.status) return
  check(4, !gate, 'undo crossed a gate with a 6.15.0 copy installed')
  const records = byId(after)
  for (const [recordId, original] of restored) {
    const record = records.get(recordId)
    const actual = record?.status
    const status = original?.status
    check(4, status === undefined ? actual !== 'active' : actual === status, `undo left record ${actual ?? 'missing'}, expected ${status ?? 'retired replacement'}`)
    if (original && record) check(4, same(guidanceContent(original), guidanceContent(record)), 'undo changed the restored guidance content')
  }
  // Restoring an archive writes an edge that 6.15.0 rejects, so the writer gate refuses it while a
  // 6.15.0 copy is installed (the gate run above). Here none is, so no 6.15.0 copy reads the store.
  if (action !== 'archive') readerCheck({ result: reader, check })
}

const journaledChanges = ({ before, after, check, entries }) => {
  const original = byId(before)
  const next = byId(after)
  const changed = [...next].filter(([id, record]) => !same(record, original.get(id)))
  const removed = [...original.keys()].filter((id) => !next.has(id))
  check(4, removed.length === 0, `${removed.length} record(s) disappeared without a reversible transition`)
  const grouped = new Map()
  for (const [id, record] of changed) {
    const operationId = record.transitions.at(-1)?.operationId
    const pending = entries.find((entry) => entry.type === 'pending' && entry.operationId === operationId)
    const named = pending?.fingerprints?.includes(record.fingerprint) || pending?.replacementFingerprint === record.fingerprint
    check(4, Boolean(operationId && named), 'changed record has no journaled operation naming it')
    if (!operationId || !named) continue
    grouped.set(operationId, [...(grouped.get(operationId) ?? []), [id, original.get(id)]])
  }
  return grouped
}

const reportedUndo = ({ report, check, entries }) => {
  if (report?.outcome !== 'applied') return
  for (const operation of report.operations) {
    const entry = entries.find(({ type, operationId }) => type === 'pending' && operationId === operation.operationId)
    const correctWindow = entry && Date.parse(operation.undoUntil) - Date.parse(entry.at) === 90 * DAY
    check(4, Boolean(correctWindow && operation.undo?.includes(operation.operationId)),
      'reported operation lacks a journal entry or the advertised 90-day undo')
  }
}

export const reversible = ({ before, after, report, machine, old, check, gate, checkDeadline }) => {
  const entries = journalOf(after)
  reportedUndo({ report, check, entries })
  const grouped = journaledChanges({ before, after, check, entries })
  for (const [id, restored] of grouped) {
    const entry = entries.find(({ type, operationId }) => type === 'pending' && operationId === id)
    if (gate) undoCheck({ machine, id, action: entry.action, restored, old, check, gate })
    undoCheck({ machine, id, action: entry.action, restored, old, check, clock: checkDeadline ? Date.parse(entry.at) + 90 * DAY - 1 : undefined })
  }
}
