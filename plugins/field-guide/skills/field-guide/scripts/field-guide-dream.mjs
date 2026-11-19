#!/usr/bin/env node

// Nightly maintenance ("dreaming") for the field guide.
// - plan prints a bounded packet for a reviewer model on stdout: the audit, live subjects with
//   their records, digests, and overlap groups, and the live guidance the records must not
//   repeat. It makes no model call and writes nothing.
// - apply validates the reviewer's actions and applies them through field-guide.mjs, which owns
//   the lifecycle rules, the journal, and the preview token.
// Output never contains an absolute home or guide path.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appliesWith, applyDreamRun, audit, dreamState, installedPluginCopies, liveSources, redactUnsafeText, resolvePaths, reviewedRecord, runIfEntryPoint } from './field-guide.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const fail = (message) => {
  throw new Error(message)
}

const maxLiveBytes = 32 * 1024
const maxPacketBytes = 192 * 1024

const claudeRoot = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
const codexRoot = () => process.env.CODEX_HOME || join(homedir(), '.codex')

// The rendered global guidance and the contracts that stored guidance must not repeat. The
// nightly job reads them and never edits them; it can only flag a proposed edit.
const liveDocuments = () => [
  { source: 'claude-md', path: join(claudeRoot(), 'CLAUDE.md') },
  { source: 'agents-md', path: join(codexRoot(), 'AGENTS.md') },
  { source: 'roles', path: join(homedir(), '.agents', 'roles.md') },
  { source: 'coding-standards', path: join(homedir(), '.agents', 'CODING_STANDARDS.md') },
]

const sha256 = (text) => `sha256:${createHash('sha256').update(text).digest('hex')}`
const frontmatterField = ({ text, field }) => text.match(new RegExp(`^${field}:\\s*"?(.*?)"?\\s*$`, 'mu'))?.[1] ?? ''

const skillFiles = (root) => (existsSync(root)
  ? readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(({ name }) => join(root, name, 'SKILL.md'))
    .filter((path) => existsSync(path))
    .sort()
  : [])

// Skill contracts are summarized as one `name: description` line each, after an optional
// `<plugin>:` prefix; identical lines appear once. The digest covers the whole files, so any
// change to a contract is noticed.
const contractSource = ({ source, files }) => {
  if (files.length === 0) return null
  const texts = files.map(({ path }) => readFileSync(path, 'utf8'))
  const lines = files.map(({ prefix }, index) => `${prefix}${frontmatterField({ text: texts[index], field: 'name' })}: ${frontmatterField({ text: texts[index], field: 'description' })}`)
  return { source, digest: sha256(texts.join('\u0000')), text: [...new Set(lines)].join('\n') }
}

// `skills` holds the repository skills in ~/.agents/skills. `plugin-skills` holds the skills of
// each plugin copy that Claude Code or Codex loads, the same copies the writer gate checks.
const contractSources = ['skills', 'plugin-skills']
const skillContracts = () => [
  contractSource({ source: 'skills', files: skillFiles(join(homedir(), '.agents', 'skills')).map((path) => ({ prefix: '', path })) }),
  contractSource({
    source: 'plugin-skills',
    files: installedPluginCopies()
      .filter(({ path }) => typeof path === 'string')
      .sort((left, right) => left.path.localeCompare(right.path))
      .flatMap(({ plugin, path }) => skillFiles(join(path, 'skills')).map((file) => ({ prefix: `${plugin}:`, path: file }))),
  }),
]

const readLive = () => [
  ...liveDocuments().filter(({ path }) => existsSync(path)).map(({ source, path }) => {
    const text = readFileSync(path, 'utf8')
    return { source, digest: sha256(text), text }
  }),
  ...skillContracts(),
].filter(Boolean)

// Digests keyed by every known source, null for one that is missing on this machine. The run
// entry's reader accepts only these sources.
const digestsOf = (live) => {
  const present = Object.fromEntries(live.map(({ source, digest }) => [source, digest]))
  const read = [...liveDocuments().map(({ source }) => source), ...contractSources]
  if (JSON.stringify(read) !== JSON.stringify(liveSources)) fail('the live sources read differ from the ones a run entry may name')
  return Object.fromEntries(liveSources.map((source) => [source, present[source] ?? null]))
}

// Replaces the guide root and any home directory with placeholders, so no output names a local
// path. The text is JSON, so a bare home directory, the form the new-text guard also refuses, ends
// at a quote or an escape, and a backslash appears escaped. As in the guard, a drive-rooted home,
// such as C:\users\<name>, /mnt/c/USERS/<name>, or /mnt/c/home/<name>, matches in any case.
const scrubPaths = ({ text, guideRoot }) => text
  .replaceAll(guideRoot, '<guide-root>')
  .replaceAll(homedir(), '~')
  .replace(/(?:\/mnt\/[a-z]\/(?:users|home)|[a-z]:(?:\\\\|\/)users)(?:\\\\|\/)[^\\/\s"]+/giu, '~')
  .replace(/\/(?:Users|home)\/[^/\s"]+\//gu, '~/')
  .replace(/(?<![\w.-])\/(?:Users|home)\/[^/\s"\\]+/gu, '~')

// Redacts each string in a value on its own, so a prompt block in one item cannot hide the next.
const redactStrings = (value) => {
  if (typeof value === 'string') return redactUnsafeText(value)
  if (Array.isArray(value)) return value.map(redactStrings)
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactStrings(child)]))
  return value
}

// The packet is measured as main prints it.
const packetBytes = (packet) => Buffer.byteLength(JSON.stringify(packet, null, 2))
const jsonBytes = (text) => Buffer.byteLength(JSON.stringify(text))
// Room for each live entry's text and truncated fields beyond the text itself.
const liveFieldBytes = 64

// The longest start of text whose JSON string fits in maxBytes, never splitting a surrogate pair.
const cutToJsonBytes = ({ text, maxBytes }) => {
  if (jsonBytes(text) <= maxBytes) return text
  let [low, high] = [0, text.length]
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (jsonBytes(text.slice(0, middle)) <= maxBytes) low = middle
    else high = middle - 1
  }
  return /[\uD800-\uDBFF]$/u.test(text.slice(0, low)) ? text.slice(0, low - 1) : text.slice(0, low)
}

// Shares the bytes left in the packet among the live texts, smallest first, so a short text is
// never cut to make room for a long one. Each text is first capped at maxLiveBytes. A cut text is
// marked truncated.
const addLiveText = ({ packet, texts }) => {
  const capped = texts.map((text) => {
    const bytes = Buffer.from(text, 'utf8')
    return bytes.length <= maxLiveBytes ? text : bytes.subarray(0, maxLiveBytes).toString('utf8')
  })
  let budget = maxPacketBytes - packetBytes(packet) - liveFieldBytes * texts.length
  const order = capped.map((_, index) => index).sort((left, right) => jsonBytes(capped[left]) - jsonBytes(capped[right]))
  order.forEach((index, position) => {
    const text = cutToJsonBytes({ text: capped[index], maxBytes: Math.max(0, Math.floor(budget / (order.length - position))) })
    budget -= jsonBytes(text)
    Object.assign(packet.live[index], { text, ...(text.length < texts[index].length ? { truncated: true } : {}) })
  })
}

// The subject digest covers these same fields, unredacted. A legacy subject key or linked subject
// that the memory reader accepts can hold text the new-text guard refuses, so both are redacted too.
const planRecord = (record) => {
  const shown = reviewedRecord(record)
  return {
    ...shown,
    learning: redactUnsafeText(shown.learning),
    ...(shown.linkedSubjects ? { linkedSubjects: shown.linkedSubjects.map(redactUnsafeText) } : {}),
  }
}

// Audit lists and pending operations get fixed shares of the packet, so they never crowd out the
// subjects. Each text item is cut to maxItemBytes.
const maxAuditBytes = 32 * 1024
const maxPendingBytes = 8 * 1024
const maxItemBytes = 1024

// Replaces paths in a value the way main does, so the bytes measured are the bytes printed.
const scrubbed = ({ value, guideRoot }) => JSON.parse(scrubPaths({ text: JSON.stringify(value), guideRoot }))

const cutItem = (item) => {
  if (typeof item !== 'string') return item
  const text = cutToJsonBytes({ text: item, maxBytes: maxItemBytes })
  return text === item ? item : `${text}…`
}

// Takes items in order while they fit in the bytes left, and spends those bytes.
const fitItems = ({ items, budget }) => {
  const fitted = []
  for (const item of items.map(cutItem)) {
    const bytes = Buffer.byteLength(JSON.stringify(item))
    if (bytes > budget.left) break
    fitted.push(item)
    budget.left -= bytes
  }
  return fitted
}

// Keeps each list's items in order while all lists together fit in maxBytes. Returns the kept
// lists and, for each list that lost items, how many it lost.
const boundedLists = ({ lists, maxBytes }) => {
  const budget = { left: maxBytes }
  const entries = Object.entries(lists).map(([name, items]) => ({ name, items, kept: fitItems({ items, budget }) }))
  return {
    kept: Object.fromEntries(entries.map(({ name, kept }) => [name, kept])),
    omitted: Object.fromEntries(entries.filter(({ items, kept }) => kept.length < items.length).map(({ name, items, kept }) => [name, items.length - kept.length])),
  }
}

// Adds each subject to review that fits, in order, and counts the rest as omitted. Live text
// is added after the subjects, so its fields are reserved here.
const addSubjects = ({ packet, review, liveCount }) => {
  for (const subject of review) {
    const entry = {
      subjectId: subject.subjectId,
      scope: subject.scope.kind,
      subjectKey: redactUnsafeText(subject.subjectKey),
      digest: subject.digest,
      records: subject.records.map(planRecord),
      overlapGroups: subject.overlapGroups,
      ...(subject.queuedContradictions.length > 0 ? { queuedContradictions: subject.queuedContradictions } : {}),
      ...(subject.due ? {} : { context: true }),
    }
    if (packetBytes({ ...packet, subjects: [...packet.subjects, entry] }) > maxPacketBytes - liveFieldBytes * liveCount) {
      packet.omittedSubjects += 1
      continue
    }
    packet.subjects.push(entry)
  }
}

// A subject is reviewed when it changed since its last review or live guidance changed since
// then; a source that was added or removed counts. A due subject brings each subject that applies
// with it, marked as context when that subject is not due, so a contradiction can name a record
// there with its digest; apply counts the due subject as reviewed only when the input lists them
// all. skippedSubjects counts the rest. Live text is sent only when there is something
// to review. Every text is scrubbed of paths before it is measured or cut. Subjects come first in
// the packet's byte budget after the audit and pending operations, and live text fills what is left.
const plan = (paths) => {
  const { guideRoot } = paths
  const live = readLive()
  const state = dreamState({ paths, liveDigests: digestsOf(live) })
  const review = state.subjects.filter((subject) => subject.due || state.subjects.some((other) => other.due && appliesWith(subject, other)))
  const { validationErrors, staleCandidates, unresolvedRelationships, brokenPointers, orphanEvidence, oversizedRecords } = audit(paths)
  // audit lists each validation error on its own, so a block left open in one cannot hide the
  // next. An error can span lines; it is redacted whole, so a block that spans lines hides all of
  // them, then split so that the budget counts each line it drops.
  const errorLines = validationErrors.flatMap((message) => redactUnsafeText(message).split('\n'))
  const audited = boundedLists({
    lists: scrubbed({ value: redactStrings({ validationErrors: errorLines, stateErrors: state.stateErrors, staleCandidates, unresolvedRelationships, brokenPointers, orphanEvidence, oversizedRecords }), guideRoot }),
    maxBytes: maxAuditBytes,
  })
  // A journal that cannot be read has no pending operations to show; stateErrors names it.
  const pending = boundedLists({ lists: { pendingOperations: state.pendingOperations ?? [] }, maxBytes: maxPendingBytes })
  const packet = {
    schemaVersion: 1,
    mode: 'dream-plan',
    revision: state.revision,
    ...(state.pendingOperations ? { pendingOperations: pending.kept.pendingOperations } : {}),
    undoWindowDays: state.undoWindowDays,
    audit: audited.kept,
    omittedItems: { ...audited.omitted, ...pending.omitted },
    live: live.map(({ source, digest }) => ({ source, digest })),
    subjects: [],
    skippedSubjects: state.subjects.length - review.length,
    omittedSubjects: 0,
  }
  addSubjects({ packet, review, liveCount: live.length })
  if (review.length > 0) addLiveText({ packet, texts: live.map(({ text }) => scrubbed({ value: redactUnsafeText(text), guideRoot })) })
  return packet
}

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'))
  } catch (error) {
    fail(`input is not valid JSON: ${error.message}`)
  }
}

const optionNames = new Map([
  ['--repo-root', 'repo-root'],
  ['--guide-root', 'guide-root'],
  ['--input', 'input'],
  ['--preview-token', 'preview-token'],
])

const parseArgs = (argv) => {
  const [command, ...rest] = argv
  if (!['plan', 'apply'].includes(command)) {
    fail('Usage: field-guide-dream.mjs <plan|apply> --repo-root <path> [--guide-root <path>] [--input <json-file> [--preview-token <token>]]')
  }
  const options = {}
  for (let index = 0; index < rest.length; index += 2) {
    const name = optionNames.get(rest[index])
    if (!name || Object.hasOwn(options, name)) fail(`Invalid or repeated argument: ${rest[index]}`)
    if (!rest[index + 1] || rest[index + 1].startsWith('--')) fail(`Missing value for ${rest[index]}`)
    options[name] = rest[index + 1]
  }
  if (!options['repo-root']) fail('--repo-root is required')
  if (command === 'apply' && !options.input) fail('apply requires --input')
  if (command === 'plan' && (options.input || options['preview-token'])) fail('plan takes no input')
  return { command, options, paths: resolvePaths({ repoRoot: options['repo-root'], guideRoot: options['guide-root'] }) }
}

const main = () => {
  const { command, options, paths } = parseArgs(process.argv.slice(2))
  const result = command === 'plan'
    ? plan(paths)
    : applyDreamRun({ paths, input: readJson(options.input), readLiveDigests: () => digestsOf(readLive()), previewToken: options['preview-token'] })
  process.stdout.write(`${scrubPaths({ text: JSON.stringify(result, null, 2), guideRoot: paths.guideRoot })}\n`)
}

runIfEntryPoint({ path: scriptPath, main })
