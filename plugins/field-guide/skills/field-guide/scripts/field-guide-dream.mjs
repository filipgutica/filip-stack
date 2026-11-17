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
import { applyDreamRun, audit, dreamState, resolvePaths, runIfEntryPoint } from './field-guide.mjs'

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

// Skill contracts are summarized as one `name: description` line each; the digest covers the
// whole files, so any change to a contract is noticed.
const skillContracts = () => {
  const root = join(homedir(), '.agents', 'skills')
  const files = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(({ name }) => join(root, name, 'SKILL.md'))
      .filter((path) => existsSync(path))
      .sort()
    : []
  if (files.length === 0) return null
  const texts = files.map((path) => readFileSync(path, 'utf8'))
  return {
    source: 'skills',
    digest: sha256(texts.join('\u0000')),
    text: texts.map((text) => `${frontmatterField({ text, field: 'name' })}: ${frontmatterField({ text, field: 'description' })}`).join('\n'),
  }
}

const readLive = () => [
  ...liveDocuments().filter(({ path }) => existsSync(path)).map(({ source, path }) => {
    const text = readFileSync(path, 'utf8')
    return { source, digest: sha256(text), text }
  }),
  skillContracts(),
].filter(Boolean)

// Current digests keyed by every known source, null for one that is missing on this machine.
const liveDigests = () => {
  const present = Object.fromEntries(readLive().map(({ source, digest }) => [source, digest]))
  return Object.fromEntries([...liveDocuments().map(({ source }) => source), 'skills'].map((source) => [source, present[source] ?? null]))
}

// Replaces the guide root and any home directory with placeholders, so no output names a local path.
export const scrubPaths = ({ text, guideRoot }) => text
  .replaceAll(guideRoot, '<guide-root>')
  .replaceAll(homedir(), '~')
  .replace(/\/(?:Users|home)\/[^/\s"]+\//gu, '~/')
  .replace(/[A-Za-z]:\\\\Users\\\\[^\\\s"]+\\\\/gu, '~\\\\')

const truncate = (text) => {
  const bytes = Buffer.from(text, 'utf8')
  return bytes.length <= maxLiveBytes ? { text } : { text: bytes.subarray(0, maxLiveBytes).toString('utf8'), truncated: true }
}

const planRecord = ({ guidance, confirmed, triggers }) => ({
  id: guidance.id,
  status: guidance.status,
  confirmed,
  triggers,
  learning: guidance.learning,
  ...(guidance.linkedSubjects?.length ? { linkedSubjects: guidance.linkedSubjects } : {}),
  updatedAt: guidance.updatedAt,
})

// Only subjects that changed since the last applied run are reviewed, unless live guidance
// changed, which can make any record a duplicate. Live text is sent only when there is
// something to review.
const plan = (paths) => {
  const state = dreamState(paths)
  const live = readLive()
  const liveChanged = live.some(({ source, digest }) => state.liveDigests[source] !== digest)
  const review = state.subjects.filter(({ subjectId, digest }) => liveChanged || state.subjectDigests[subjectId] !== digest)
  const { validationErrors, staleCandidates, unresolvedRelationships, brokenPointers, orphanEvidence, oversizedRecords } = audit(paths)
  const packet = {
    schemaVersion: 1,
    mode: 'dream-plan',
    revision: state.revision,
    pendingOperations: state.pendingOperations,
    undoWindowDays: state.undoWindowDays,
    audit: { validationErrors, staleCandidates, unresolvedRelationships, brokenPointers, orphanEvidence, oversizedRecords },
    live: live.map(({ source, digest, text }) => ({
      source,
      digest,
      changed: state.liveDigests[source] !== digest,
      ...(review.length > 0 ? truncate(text) : {}),
    })),
    subjects: [],
    skippedSubjects: state.subjects.length - review.length,
    omittedSubjects: 0,
  }
  for (const subject of review) {
    const entry = {
      subjectId: subject.subjectId,
      scope: subject.scope.kind,
      subjectKey: subject.subjectKey,
      digest: subject.digest,
      records: subject.records.map(planRecord),
      overlapGroups: subject.overlapGroups,
    }
    if (Buffer.byteLength(JSON.stringify({ ...packet, subjects: [...packet.subjects, entry] })) > maxPacketBytes) {
      packet.omittedSubjects += 1
      continue
    }
    packet.subjects.push(entry)
  }
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
    : applyDreamRun({ paths, input: readJson(options.input), liveDigests: liveDigests(), previewToken: options['preview-token'] })
  process.stdout.write(`${scrubPaths({ text: JSON.stringify(result, null, 2), guideRoot: paths.guideRoot })}\n`)
}

runIfEntryPoint({ path: scriptPath, main })
