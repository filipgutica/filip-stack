#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { isIP } from 'node:net'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  appendAnalyticsEvent,
  configureAnalytics,
  isAnalyticsEnabled,
  recordImpact,
  recordReview,
  reportAnalytics,
} from './field-guide-analytics.mjs'

const scriptPath = fileURLToPath(import.meta.url)

const fail = (message) => {
  throw new Error(message)
}

const git = ({ repoRoot, args, optional = false }) => {
  const result = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' })
  if (result.status === 0) return result.stdout.trim()
  if (optional) return ''

  const detail = result.stderr.trim()
  fail(detail.length > 0 ? detail : `git ${args.join(' ')} failed in ${repoRoot}`)
}

const optionNames = new Map([
  ['--repo-root', 'repo-root'],
  ['--guide-root', 'guide-root'],
  ['--input', 'input'],
  ['--input-json', 'input-json'],
  ['--subject', 'subject'],
  ['--query', 'query'],
  ['--evidence-for', 'evidence-for'],
  ['--event', 'event'],
  ['--scope', 'scope'],
  ['--since', 'since'],
  ['--output', 'output'],
  ['--annotations', 'annotations'],
  ['--id', 'id'],
  ['--triggers', 'triggers'],
  ['--remove-trigger', 'remove-trigger'],
  ['--approval', 'approval'],
])
// Options that only some commands accept.
const commandOptions = {
  event: ['retrieve'],
  annotations: ['export', 'import'],
  id: ['annotate', 'unconfirm', 'undo-operation'],
  triggers: ['annotate'],
  'remove-trigger': ['annotate'],
  approval: ['consolidate'],
}
const parseOptions = (args) => {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    const optionName = optionNames.get(flag)
    if (!optionName) fail(`Invalid argument: ${flag}`)
    if (Object.hasOwn(options, optionName)) fail(`Duplicate option: ${flag}`)
    const value = args[index + 1]
    if (!value || value.startsWith('--')) fail(`Missing value for ${flag}`)
    options[optionName] = value
    index += 1
  }
  return options
}

const validateCommandOptions = ({ command, options }) => {
  for (const [option, allowed] of Object.entries(commandOptions)) {
    if (options[option] && !allowed.includes(command)) fail(`--${option} is supported only for ${allowed.join(' and ')}`)
  }
  if (commandOptions.id.includes(command) && !options.id) fail('--id is required')
  if (command === 'annotate' && Boolean(options.triggers) === Boolean(options['remove-trigger'])) {
    fail('annotate requires exactly one of --triggers or --remove-trigger')
  }
  if (command === 'consolidate' && Boolean(options.input) === Boolean(options.approval)) {
    fail('consolidate requires exactly one of --input or --approval')
  }
}

const parseArgs = (argv) => {
  const [command, ...rest] = argv
  if (!Object.hasOwn(commandHandlers, command ?? '')) {
    fail('Usage: field-guide.mjs <analytics-disable|analytics-enable|analytics-impact|analytics-report|analytics-review|annotate|audit|candidates|consolidate|delete|export|import|init|maintain|paths|retrieve|submit|transition|unconfirm|undo-operation|validate> --repo-root <path> [--guide-root <path>] [--input <json-file> | --input-json <json>] [--subject <key>] [--scope <project|shared>] [--query <text>] [--evidence-for <guidance-id>] [--event <trigger>] [--since <YYYY-MM-DD>] [--output <json-file>] [--annotations <json-file>] [--id <guidance-id|operation-id>] [--triggers <list> | --remove-trigger <trigger>] [--approval <proposal-id>]')
  }
  const options = parseOptions(rest)
  if (!options['repo-root']) fail('--repo-root is required')
  validateCommandOptions({ command, options })
  if (options['input-json'] && !['submit', 'analytics-impact', 'analytics-review'].includes(command)) {
    fail('--input-json is supported only for submit, analytics-impact, and analytics-review')
  }
  if (options.input && options['input-json']) fail('use either --input or --input-json, not both')
  if (options.since && command !== 'analytics-report') fail('--since is supported only for analytics-report')
  if (options.output && command !== 'export') fail('--output is supported only for export')
  if (command === 'export' && !options.output) fail('--output is required for export')
  return { command, options }
}

const normalizeRemote = (remote) => {
  if (!remote) return ''

  const scpStyle = remote.match(/^[^@]+@([^:]+):(.+)$/)
  if (scpStyle) {
    return `${scpStyle[1].toLowerCase()}/${scpStyle[2]}`
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '')
  }

  const withoutTransport = remote
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^.*@/, '')
  const firstSlash = withoutTransport.indexOf('/')
  const normalized = firstSlash > 0
    ? `${withoutTransport.slice(0, firstSlash).toLowerCase()}${withoutTransport.slice(firstSlash)}`
    : withoutTransport

  return normalized
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
}

const slugify = (value) => (
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'repository'
)

const resolveCommonDir = ({ repoRoot, commonDir }) => {
  const resolved = isAbsolute(commonDir) ? commonDir : resolve(repoRoot, commonDir)
  return realpathSync(resolved)
}

const identityFor = ({ normalizedRemote, commonDir }) => (
  normalizedRemote ? `remote:${normalizedRemote}` : `common-dir:${commonDir}`
)

const repositoryNameFor = ({ normalizedRemote, gitRoot }) => (
  normalizedRemote ? normalizedRemote.split('/').at(-1) : basename(gitRoot)
)

const guideRootFor = (inputGuideRoot) => (
  resolve(inputGuideRoot ? inputGuideRoot : join(homedir(), '.field-guide'))
)

// Store files that need no repository, so the confirm hook can use them outside Git.
const guideFilesFor = (guideRoot) => ({
  memoryFile: join(guideRoot, 'memory.json'),
  memoryIndexFile: join(guideRoot, 'memory.md'),
  memoryLockFile: join(guideRoot, 'memory.lock'),
  annotationsFile: join(guideRoot, 'annotations.json'),
  annotationsWatermarkFile: join(guideRoot, 'annotations-watermark.json'),
  operationsFile: join(guideRoot, 'operations.jsonl'),
  proposalsFile: join(guideRoot, 'proposals.json'),
})

const readIdentity = (projectIndex) => {
  if (!existsSync(projectIndex)) return ''
  return readFileSync(projectIndex, 'utf8').match(/^- Identity: `(.+)`$/m)?.[1] ?? ''
}

const projectKeyFor = ({ guideRoot, repositoryName, identity }) => {
  const projectsRoot = join(guideRoot, 'projects')
  const baseKey = slugify(repositoryName)
  const baseIndex = join(projectsRoot, baseKey, 'init.md')

  if (!existsSync(join(projectsRoot, baseKey)) || readIdentity(baseIndex) === identity) {
    return baseKey
  }

  const suffix = createHash('sha256').update(identity).digest('hex').slice(0, 8)
  return `${baseKey}-${suffix}`
}

export const resolvePaths = ({ repoRoot: inputRoot, guideRoot: inputGuideRoot }) => {
  const requestedRoot = resolve(inputRoot)
  const gitRoot = realpathSync(git({ repoRoot: requestedRoot, args: ['rev-parse', '--show-toplevel'] }))
  const remote = git({ repoRoot: gitRoot, args: ['remote', 'get-url', 'origin'], optional: true })
  const normalizedRemote = normalizeRemote(remote)
  const commonDir = resolveCommonDir({
    repoRoot: gitRoot,
    commonDir: git({ repoRoot: gitRoot, args: ['rev-parse', '--git-common-dir'] }),
  })
  const identity = identityFor({ normalizedRemote, commonDir })
  const repositoryName = repositoryNameFor({ normalizedRemote, gitRoot })
  const guideRoot = guideRootFor(inputGuideRoot)
  const projectKey = projectKeyFor({ guideRoot, repositoryName, identity })
  const projectRoot = join(guideRoot, 'projects', projectKey)

  return {
    guideRoot,
    rootIndex: join(guideRoot, 'init.md'),
    sharedRoot: join(guideRoot, 'shared'),
    projectsRoot: join(guideRoot, 'projects'),
    projectKey,
    projectRoot,
    projectIndex: join(projectRoot, 'init.md'),
    patternsFile: join(projectRoot, 'patterns.md'),
    reviewsRoot: join(projectRoot, 'reviews'),
    ...guideFilesFor(guideRoot),
    repositoryName,
    repositoryRoot: gitRoot,
    origin: remote.length > 0 ? remote : null,
    identity,
  }
}

/** Returns the repository's normalized `origin` remote, such as `github.com/owner/repo`, or ''. */
export const originOf = ({ repoRoot }) => normalizeRemote(git({ repoRoot, args: ['remote', 'get-url', 'origin'], optional: true }))

const emptyMemory = () => ({
  schemaVersion: 1,
  revision: 0,
  guidance: [],
  evidence: [],
})

const assertObject = ({ value, label }) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`)
  }
}

const assertClosedFields = ({ value, fields, label }) => {
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) fail(`${label} has unsupported field: ${key}`)
  }
}

const byteLength = (value) => Buffer.byteLength(value, 'utf8')
const hasControlCharacters = ({ value, allowNewlines }) => (
  allowNewlines
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    : /[\u0000-\u001f\u007f]/u.test(value)
)
const portableKey = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const sourceKeyPattern = /^source:v1:[0-9a-f]{64}$/
const fingerprintPattern = /^fingerprint:v1:[0-9a-f]{64}$/
const evidenceIdPattern = /^evidence:v1:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const guidanceIdPattern = /^guidance:v1:[0-9a-f]{64}$/
const retirementIdPattern = /^retirement:v1:[0-9a-f]{64}$/
const operationIdPattern = /^operation:v1:[0-9a-f]{64}$/

const requireString = ({ value, label, maxBytes, nonEmpty = true, noWhitespace = false, allowNewlines = false }) => {
  if (typeof value !== 'string' || (nonEmpty && value.trim().length === 0)) {
    fail(`${label} must be a non-empty string`)
  }
  if (hasControlCharacters({ value, allowNewlines })) fail(`${label} must not contain control characters`)
  if (noWhitespace && /\s/u.test(value)) fail(`${label} must not contain whitespace`)
  if (maxBytes && byteLength(value) > maxBytes) fail(`${label} exceeds ${maxBytes} UTF-8 bytes`)
  return value
}

const unsafePersistedTextPatterns = [
  { pattern: /\/(?:Users|home)\/[^/\s]+\//u, reason: 'absolute home-directory path' },
  { pattern: /[A-Za-z]:\\Users\\[^\\\s]+\\/u, reason: 'absolute home-directory path' },
  { pattern: /https:\/\/[^\s?]+\?[^\s]*/iu, reason: 'URL query string' },
  { pattern: /%[0-9a-f]{2}/iu, reason: 'percent-encoded source text' },
  { pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/u, reason: 'private key' },
  { pattern: /\b(?:github_pat_|gh[pousr]_|AKIA)[A-Za-z0-9_]{12,}\b/u, reason: 'credential token' },
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/u, reason: 'credential token' },
  { pattern: /\b(?:password|passwd|access[_-]?token|api[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s,;]+/iu, reason: 'credential assignment' },
  { pattern: /^(?:user|assistant|system):\s+/imu, reason: 'raw transcript marker' },
  { pattern: /<(?:user|assistant|system)>|BEGIN (?:RAW )?PROMPT/iu, reason: 'raw prompt marker' },
]

// Text that this version writes for the first time, such as a consolidation's replacement, an
// operation's reason, or a proposal, also refuses a query string or user information in a URL of
// any scheme, and a home directory without a trailing separator. A query is a `?` and more text
// in a token that starts with a scheme and a colon, with or without `//`, as in `mailto:a?b`.
// Windows ignores the case of Users, so a drive-rooted home, such as C:\users\<name>, WSL's
// /mnt/c/USERS/<name>, or /mnt/c/home/<name>, matches in any case. Stored records keep the
// patterns above, which released versions wrote, so their stores stay valid.
const unsafeNewTextPatterns = [
  ...unsafePersistedTextPatterns,
  { pattern: /[a-z][a-z0-9+.-]*:[^\s?]*\?\S/iu, reason: 'URL query string' },
  { pattern: /[a-z][a-z0-9+.-]*:\/\/[^\s/?#@]*@/iu, reason: 'URL user information' },
  { pattern: /(?<![\w.-])\/(?:Users|home)\/[^/\s]+/u, reason: 'absolute home-directory path' },
  { pattern: /(?:\/mnt\/[a-z]\/(?:users|home)|[a-z]:[\\/]users)[\\/][^\\/\s]+/iu, reason: 'absolute home-directory path' },
]

// Output that reaches a model but is never stored. Home paths are left to the caller, which
// shortens them to ~.
const unsafeOutputTextPatterns = unsafeNewTextPatterns.filter(({ reason }) => reason !== 'absolute home-directory path')

// Every marker that opens a raw prompt block or closes a tag block.
const rawBlockMarker = /<(\/?)(user|assistant|system)>|BEGIN (?:RAW )?PROMPT/giu
const rawBlockEvent = ([, slash, tag]) => {
  if (tag) return slash ? { closes: tag.toLowerCase() } : { opens: tag.toLowerCase() }
  return { opens: 'prompt' }
}
// A prompt block closes only at a line of its own that holds END, in capitals.
const promptBlockEnd = /^END(?: (?:RAW )?PROMPT)?$/u

// Drops each line that starts inside a raw prompt block. The markers are read in order across
// lines, and a block closes only at the closing marker of the innermost open block, so a block
// that never closes runs to the end of the text. A line where a block opens stays, and the line
// redaction replaces it.
const withoutRawBlockBodies = (lines) => {
  const open = []
  return lines.filter((line) => {
    const outside = open.length === 0
    // The END line starts inside the block, so it is dropped too.
    if (open.at(-1) === 'prompt' && promptBlockEnd.test(line.trim())) {
      open.pop()
      return false
    }
    for (const match of line.matchAll(rawBlockMarker)) {
      const { opens, closes } = rawBlockEvent(match)
      if (opens) open.push(opens)
      else if (closes && open.at(-1) === closes) open.pop()
    }
    return outside
  })
}

// Removes each private key block and each raw prompt block whole, and replaces each other line
// that holds unsafe text, for output that reaches a model but is never stored.
export const redactUnsafeText = (text) => withoutRawBlockBodies(text
  .replace(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z ]+ )?PRIVATE KEY-----|$)/gu, '[redacted private key]')
  .split('\n'))
  .map((line) => {
    const unsafe = unsafeOutputTextPatterns.find(({ pattern }) => pattern.test(line))
    return unsafe ? `[redacted ${unsafe.reason}]` : line
  })
  .join('\n')

const assertSafePersistedText = ({ value, label, patterns = unsafePersistedTextPatterns }) => {
  for (const { pattern, reason } of patterns) {
    if (pattern.test(value)) fail(`${label} contains a forbidden ${reason}`)
  }
}

const requireSafePersistedString = (options) => {
  const value = requireString(options)
  assertSafePersistedText({ value, label: options.label })
  return value
}

// Checks every string in a value that this version writes for the first time, however deeply it
// is nested, so a field added later needs no wiring of its own.
const assertSafeNewValue = ({ value, label }) => {
  if (typeof value === 'string') assertSafePersistedText({ value, label, patterns: unsafeNewTextPatterns })
  else if (Array.isArray(value)) value.forEach((item, index) => assertSafeNewValue({ value: item, label: `${label}[${index}]` }))
  else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertSafeNewValue({ value: child, label: `${label}.${key}` })
  }
}

const requireTimestamp = ({ value, label }) => {
  requireString({ value, label, maxBytes: 64 })
  if (Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail(`${label} must be an ISO timestamp`)
  }
}

const validateSafeUrl = ({ value, kind }) => {
  requireString({ value, label: `${kind} URL`, maxBytes: 2048 })
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    fail(`${kind} URL must be an absolute HTTPS URL`)
  }
  if (parsed.protocol !== 'https:') fail(`${kind} URL must use HTTPS`)
  if (parsed.username || parsed.password) fail(`${kind} URL must not contain user information`)
  if (parsed.search) fail(`${kind} URL must not contain a query string`)
  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || isIP(host) !== 0) {
    fail(`${kind} URL has a forbidden host`)
  }
  const labels = host.split('.')
  if (labels.length < 2 || labels.some((label) => (
    !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label)
  ))) fail(`${kind} URL host must be a DNS name`)
  assertSafePersistedText({ value: host, label: `${kind} URL host` })
  if (kind !== 'review' && parsed.hash) fail(`${kind} URL must not contain a fragment`)
  if (parsed.hash && byteLength(parsed.hash.slice(1)) > 256) fail('review URL fragment exceeds 256 UTF-8 bytes')
  const pathAndFragment = `${parsed.pathname}${parsed.hash}`
  if (/%[0-9a-f]{2}/iu.test(pathAndFragment)) {
    fail(`${kind} URL must not contain percent encoding`)
  }
  assertSafePersistedText({ value: pathAndFragment, label: `${kind} URL` })
  return parsed.href
}

const pointerFields = {
  conversation: ['kind', 'client', 'threadId', 'messageId', 'turnId', 'url'],
  review: ['kind', 'provider', 'repositoryIdentity', 'pullRequestNumber', 'commentId', 'url'],
  commit: ['kind', 'repositoryIdentity', 'commit'],
  'local-artifact': ['kind', 'repositoryIdentity', 'path', 'heading', 'contentDigest'],
  manual: ['kind', 'sourceLabel'],
}

const validatePointer = (pointer) => {
  assertObject({ value: pointer, label: 'evidence pointer' })
  const fields = pointerFields[pointer.kind]
  if (!fields) fail(`unsupported evidence pointer kind: ${pointer.kind}`)
  assertClosedFields({ value: pointer, fields, label: `${pointer.kind} pointer` })

  if (pointer.kind === 'conversation') {
    requireSafePersistedString({ value: pointer.client, label: 'conversation client', maxBytes: 256, noWhitespace: true })
    requireSafePersistedString({ value: pointer.threadId, label: 'conversation threadId', maxBytes: 256, noWhitespace: true })
    if (pointer.messageId !== undefined && pointer.turnId !== undefined) {
      fail('conversation pointer must use only one of messageId or turnId')
    }
    for (const field of ['messageId', 'turnId']) {
      if (pointer[field] !== undefined) {
        requireSafePersistedString({ value: pointer[field], label: `conversation ${field}`, maxBytes: 256, noWhitespace: true })
      }
    }
    if (pointer.url !== undefined) pointer.url = validateSafeUrl({ value: pointer.url, kind: 'conversation' })
  }

  if (pointer.kind === 'review') {
    requireSafePersistedString({ value: pointer.provider, label: 'review provider', maxBytes: 256, noWhitespace: true })
    requireSafePersistedString({ value: pointer.repositoryIdentity, label: 'review repositoryIdentity', maxBytes: 1024, noWhitespace: true })
    if (!Number.isSafeInteger(pointer.pullRequestNumber) || pointer.pullRequestNumber <= 0) {
      fail('review pullRequestNumber must be a positive integer')
    }
    requireSafePersistedString({ value: pointer.commentId, label: 'review commentId', maxBytes: 256, noWhitespace: true })
    if (pointer.url !== undefined) pointer.url = validateSafeUrl({ value: pointer.url, kind: 'review' })
  }

  if (pointer.kind === 'commit') {
    requireSafePersistedString({ value: pointer.repositoryIdentity, label: 'commit repositoryIdentity', maxBytes: 1024, noWhitespace: true })
    if (!/^[0-9a-f]{40}$/.test(pointer.commit)) fail('commit pointer requires a full lowercase commit hash')
  }

  if (pointer.kind === 'local-artifact') {
    requireSafePersistedString({ value: pointer.repositoryIdentity, label: 'artifact repositoryIdentity', maxBytes: 1024, noWhitespace: true })
    requireString({ value: pointer.path, label: 'artifact path', maxBytes: 1024 })
    if (isAbsolute(pointer.path) || pointer.path.split('/').includes('..')) {
      fail('artifact path must be repository-relative without .. segments')
    }
    assertSafePersistedText({ value: pointer.path, label: 'artifact path' })
    if (pointer.heading !== undefined) {
      requireString({ value: pointer.heading, label: 'artifact heading', maxBytes: 256 })
      assertSafePersistedText({ value: pointer.heading, label: 'artifact heading' })
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(pointer.contentDigest)) {
      fail('artifact contentDigest must be a lowercase SHA-256 digest')
    }
  }

  if (pointer.kind === 'manual') {
    requireString({ value: pointer.sourceLabel, label: 'manual sourceLabel', maxBytes: 512 })
    assertSafePersistedText({ value: pointer.sourceLabel, label: 'manual sourceLabel' })
  }
  return pointer
}

const validateScope = (scope) => {
  assertObject({ value: scope, label: 'guidance scope' })
  const fields = scope.kind === 'project' ? ['kind', 'repositoryIdentity'] : ['kind']
  assertClosedFields({ value: scope, fields, label: 'guidance scope' })
  if (!['project', 'shared'].includes(scope.kind)) fail(`unsupported guidance scope: ${scope.kind}`)
  if (scope.kind === 'project') {
    requireString({ value: scope.repositoryIdentity, label: 'scope repositoryIdentity', maxBytes: 1024, noWhitespace: true })
  }
}

const validateExamples = (examples = []) => {
  if (!Array.isArray(examples) || examples.length > 2) fail('guidance examples must contain at most two entries')
  let totalBytes = 0
  const kinds = new Set()
  for (const example of examples) {
    assertObject({ value: example, label: 'guidance example' })
    assertClosedFields({ value: example, fields: ['kind', 'language', 'code'], label: 'guidance example' })
    if (!['pattern', 'antipattern'].includes(example.kind) || kinds.has(example.kind)) {
      fail('guidance examples must use unique pattern or antipattern kinds')
    }
    kinds.add(example.kind)
    requireString({ value: example.language, label: 'example language', maxBytes: 64, noWhitespace: true })
    requireString({ value: example.code, label: 'example code', maxBytes: 6144, allowNewlines: true })
    assertSafePersistedText({ value: example.code, label: 'example code' })
    if (example.code.split('\n').length > 40) fail('guidance example exceeds 40 lines')
    totalBytes += byteLength(example.code)
  }
  if (totalBytes > 6144) fail('guidance examples exceed 6144 UTF-8 bytes combined')
}

const validateEvidenceRecord = (evidence) => {
  assertObject({ value: evidence, label: 'evidence record' })
  assertClosedFields({
    value: evidence,
    fields: ['id', 'summary', 'pointers', 'sourceKeys', 'countsForPromotion', 'repositoryIdentity', 'createdAt'],
    label: 'evidence record',
  })
  if (!evidenceIdPattern.test(evidence.id)) fail('evidence record has invalid id')
  requireString({ value: evidence.summary, label: 'evidence summary', maxBytes: 512 })
  assertSafePersistedText({ value: evidence.summary, label: 'evidence summary' })
  if (!Array.isArray(evidence.pointers) || evidence.pointers.length === 0) fail('evidence pointers must be a non-empty array')
  evidence.pointers.forEach(validatePointer)
  if (!Array.isArray(evidence.sourceKeys) || new Set(evidence.sourceKeys).size !== evidence.sourceKeys.length) {
    fail('evidence sourceKeys must be a unique array')
  }
  if (evidence.sourceKeys.some((key) => !sourceKeyPattern.test(key))) fail('evidence record has invalid sourceKey')
  if (typeof evidence.countsForPromotion !== 'boolean') fail('evidence countsForPromotion must be boolean')
  if (evidence.repositoryIdentity !== undefined) {
    requireString({ value: evidence.repositoryIdentity, label: 'evidence repositoryIdentity', maxBytes: 1024, noWhitespace: true })
  }
  requireTimestamp({ value: evidence.createdAt, label: 'evidence createdAt' })
}

// A shared supersede records the retirement ID it added, so an undo can acknowledge only that ID.
// A journaled transition names the operation that made it, so recovery and undo can find it.
const validateTransitionIds = ({ guidance, transition }) => {
  if (transition.operationId !== undefined && !operationIdPattern.test(transition.operationId)) fail('invalid transition operationId')
  if (transition.retirementId === undefined) return
  if (transition.to !== 'superseded' || !retirementIdPattern.test(transition.retirementId)) fail('retirementId is valid only on a superseded transition')
  if (!guidance.retirements?.includes(transition.retirementId)) fail('a superseded transition names an unknown retirement')
}

// Only undo-operation restores archived guidance, and only an archive that an operation made. The
// restore names its own undo operation, which is how recovery finds it. Memory alone checks only
// the shape, two operation IDs as strings; the journal links the undo to that archive, and
// undo-operation and validate check that link (unlinkedRestores).
const requireJournaledRestore = ({ guidance, index }) => {
  const [archive, restore] = guidance.transitions.slice(index - 1, index + 1)
  if (restore.source !== 'undo-operation' || !isOperationId(restore.operationId) || !isOperationId(archive.operationId)) {
    fail(`${guidance.id} archived->active requires undo-operation of a journaled archive`)
  }
}

const validateGuidanceRecord = (guidance) => {
  assertObject({ value: guidance, label: 'guidance record' })
  assertClosedFields({
    value: guidance,
    fields: ['id', 'fingerprint', 'scope', 'subjectKey', 'linkedSubjects', 'learning', 'status', 'confidence', 'generic', 'relationship', 'consolidates', 'examples', 'evidenceIds', 'independentEvidenceCount', 'transitions', 'retirements', 'acknowledged', 'createdAt', 'updatedAt'],
    label: 'guidance record',
  })
  if (!guidanceIdPattern.test(guidance.id)) fail('guidance record has invalid id')
  if (!fingerprintPattern.test(guidance.fingerprint)) fail('guidance record has invalid fingerprint')
  validateScope(guidance.scope)
  if (!portableKey.test(guidance.subjectKey)) fail('guidance subjectKey must be a portable slug')
  if (byteLength(guidance.subjectKey) > 128) fail('guidance subjectKey exceeds 128 UTF-8 bytes')
  const linkedSubjects = guidance.linkedSubjects ?? []
  if (!Array.isArray(linkedSubjects)
    || linkedSubjects.length > 16
    || new Set(linkedSubjects).size !== linkedSubjects.length
    || linkedSubjects.some((subject) => !portableKey.test(subject) || byteLength(subject) > 128)) {
    fail('guidance linkedSubjects must be unique portable slugs')
  }
  requireString({ value: guidance.learning, label: 'guidance learning', maxBytes: 4096 })
  assertSafePersistedText({ value: guidance.learning, label: 'guidance learning' })
  if (!['candidate', 'active', 'superseded', 'withdrawn', 'archived'].includes(guidance.status)) {
    fail(`guidance record has invalid status: ${guidance.status}`)
  }
  if (!['low', 'medium', 'high'].includes(guidance.confidence)) fail('guidance record has invalid confidence')
  if (guidance.generic !== undefined && typeof guidance.generic !== 'boolean') fail('guidance generic must be boolean')
  if (guidance.relationship !== undefined) {
    assertObject({ value: guidance.relationship, label: 'guidance relationship' })
    assertClosedFields({ value: guidance.relationship, fields: ['kind', 'targetId'], label: 'guidance relationship' })
    if (!['reinforces', 'refines', 'contradicts'].includes(guidance.relationship.kind)) fail('invalid relationship kind')
    if (!guidanceIdPattern.test(guidance.relationship.targetId)) fail('invalid relationship targetId')
  }
  if (guidance.consolidates !== undefined) requireTargetIds({ value: guidance.consolidates, label: 'guidance consolidates' })
  validateExamples(guidance.examples)
  if (!Array.isArray(guidance.evidenceIds) || new Set(guidance.evidenceIds).size !== guidance.evidenceIds.length) {
    fail('guidance evidenceIds must be a unique array')
  }
  if (guidance.evidenceIds.some((id) => !evidenceIdPattern.test(id))) fail('guidance record has invalid evidenceId')
  if (!Number.isSafeInteger(guidance.independentEvidenceCount) || guidance.independentEvidenceCount < 0) {
    fail('guidance independentEvidenceCount must be a non-negative integer')
  }
  if (!Array.isArray(guidance.transitions) || guidance.transitions.length === 0) {
    fail('guidance transitions must be a non-empty array')
  }
  for (const transition of guidance.transitions) {
    assertObject({ value: transition, label: 'guidance transition' })
    assertClosedFields({ value: transition, fields: ['from', 'to', 'reason', 'source', 'at', 'replacementId', 'retirementId', 'operationId'], label: 'guidance transition' })
    if (transition.from !== null && !['candidate', 'active', 'superseded', 'withdrawn', 'archived'].includes(transition.from)) fail('invalid transition from status')
    if (!['candidate', 'active', 'superseded', 'withdrawn', 'archived'].includes(transition.to)) fail('invalid transition to status')
    requireString({ value: transition.reason, label: 'transition reason', maxBytes: 512 })
    requireString({ value: transition.source, label: 'transition source', maxBytes: 128, noWhitespace: true })
    assertSafePersistedText({ value: transition.reason, label: 'transition reason' })
    assertSafePersistedText({ value: transition.source, label: 'transition source' })
    requireTimestamp({ value: transition.at, label: 'transition at' })
    if (transition.replacementId !== undefined && !guidanceIdPattern.test(transition.replacementId)) fail('invalid transition replacementId')
    if ((transition.to === 'superseded') !== Boolean(transition.replacementId)) {
      fail('replacementId is required only for a superseded transition')
    }
    validateTransitionIds({ guidance, transition })
  }
  if (guidance.retirements !== undefined || guidance.acknowledged !== undefined) {
    if (guidance.scope.kind !== 'shared') fail('only shared guidance has retirement sets')
    validateRetirementSets({ ...guidance, label: 'guidance' })
  }
  requireTimestamp({ value: guidance.createdAt, label: 'guidance createdAt' })
  requireTimestamp({ value: guidance.updatedAt, label: 'guidance updatedAt' })
}

const validateMemory = (memory) => {
  assertObject({ value: memory, label: 'memory store' })
  assertClosedFields({ value: memory, fields: ['schemaVersion', 'revision', 'guidance', 'evidence'], label: 'memory store' })
  if (!memorySchemaVersions.includes(memory.schemaVersion)) fail(`memory store has unsupported schema version: ${memory.schemaVersion}`)
  if (!Number.isSafeInteger(memory.revision) || memory.revision < 0) fail('memory store revision must be a non-negative integer')
  if (!Array.isArray(memory.guidance)) fail('memory store guidance must be an array')
  if (!Array.isArray(memory.evidence)) fail('memory store evidence must be an array')
  memory.guidance.forEach(validateGuidanceRecord)
  memory.evidence.forEach(validateEvidenceRecord)
  if (memory.schemaVersion < requiredSchemaVersion(memory)) fail(`memory store schema version ${memory.schemaVersion} does not match its content`)
  if (new Set(memory.guidance.map(({ id }) => id)).size !== memory.guidance.length) fail('memory store has duplicate guidance IDs')
  if (new Set(memory.guidance.map(({ fingerprint }) => fingerprint)).size !== memory.guidance.length) fail('memory store has duplicate guidance fingerprints')
  if (new Set(memory.evidence.map(({ id }) => id)).size !== memory.evidence.length) fail('memory store has duplicate evidence IDs')
  const sourceOwners = new Map()
  for (const evidence of memory.evidence) {
    for (const sourceKey of evidence.sourceKeys) {
      if (sourceOwners.has(sourceKey)) fail(`memory store sourceKey belongs to multiple evidence records: ${sourceKey}`)
      sourceOwners.set(sourceKey, evidence.id)
    }
  }
  const evidenceIds = new Set(memory.evidence.map(({ id }) => id))
  for (const evidence of memory.evidence) {
    const derivedKeys = [...new Set(evidence.pointers.map(sourceKeyFor).filter(Boolean))].sort()
    if (JSON.stringify(derivedKeys) !== JSON.stringify(evidence.sourceKeys)) {
      fail(`${evidence.id} sourceKeys do not match its pointers`)
    }
    const countsForPromotion = evidence.pointers.some(pointerCountsForPromotion)
    if (evidence.countsForPromotion !== countsForPromotion) {
      fail(`${evidence.id} has an invalid countsForPromotion value`)
    }
    if (countsForPromotion !== Boolean(evidence.repositoryIdentity)) {
      fail(`${evidence.id} has inconsistent repository identity metadata`)
    }
  }
  for (const guidance of memory.guidance) {
    if (guidance.evidenceIds.some((id) => !evidenceIds.has(id))) fail(`${guidance.id} references missing evidence`)
    const expectedFingerprint = fingerprintFor(guidance)
    if (guidance.fingerprint !== expectedFingerprint || guidance.id !== expectedFingerprint.replace('fingerprint', 'guidance')) {
      fail(`${guidance.id} does not match its scope, subject, and learning fingerprint`)
    }
    const independentEvidenceCount = guidance.evidenceIds
      .map((id) => memory.evidence.find((evidence) => evidence.id === id))
      .filter((evidence) => evidence.countsForPromotion)
      .length
    if (guidance.independentEvidenceCount !== independentEvidenceCount) {
      fail(`${guidance.id} has an invalid independentEvidenceCount`)
    }
    for (let index = 0; index < guidance.transitions.length; index += 1) {
      const expectedFrom = index === 0 ? null : guidance.transitions[index - 1].to
      if (guidance.transitions[index].from !== expectedFrom) fail(`${guidance.id} has a broken transition chain`)
      const edge = `${expectedFrom ?? 'null'}->${guidance.transitions[index].to}`
      const allowedEdges = new Set([
        'null->candidate',
        'null->active',
        'candidate->active',
        'candidate->withdrawn',
        'candidate->archived',
        'active->superseded',
        'active->withdrawn',
        'active->archived',
        'superseded->active',
        'superseded->withdrawn',
        'superseded->archived',
        'withdrawn->active',
        'withdrawn->archived',
        'archived->active',
      ])
      if (!allowedEdges.has(edge)) fail(`${guidance.id} has an illegal lifecycle transition: ${edge}`)
      if (edge === 'archived->active') requireJournaledRestore({ guidance, index })
      // Only shared sync restores withdrawn guidance, after another machine's undo acknowledged its retirements.
      if (edge === 'withdrawn->active' && (guidance.scope.kind !== 'shared' || guidance.transitions[index].source !== 'shared-sync')) {
        fail(`${guidance.id} withdrawn->active requires shared scope and source shared-sync`)
      }
      // Superseded guidance leaves that status only as the second half of withdrawing its replacement.
      if (edge === 'superseded->active' || edge === 'superseded->withdrawn') {
        const replacement = memory.guidance.find(({ id }) => id === guidance.transitions[index - 1].replacementId)
        if (!replacement?.transitions.some(({ to }) => to === 'withdrawn')) fail(`${guidance.id} ${edge === 'superseded->active' ? 'restoration' : edge} requires its replacement to be withdrawn`)
      }
      // It moves to withdrawn, not active, only because another retirement is outstanding. Sets only
      // grow, so a later restore through shared sync may acknowledge that retirement.
      if (edge === 'superseded->withdrawn' && index === guidance.transitions.length - 1 && !hasUnacknowledgedRetirement(retirementSetsOf(guidance))) {
        fail(`${guidance.id} superseded->withdrawn requires an outstanding retirement`)
      }
    }
    if (guidance.transitions.at(-1).to !== guidance.status) fail(`${guidance.id} status does not match its transition history`)
    if (guidance.status === 'active' && hasUnacknowledgedRetirement(retirementSetsOf(guidance))) {
      fail(`${guidance.id} is active with an unacknowledged retirement`)
    }
    for (const transition of guidance.transitions.filter(({ to }) => to === 'superseded')) {
      const replacement = memory.guidance.find(({ id }) => id === transition.replacementId)
      if (!replacement
        || !sameScope(guidance.scope, replacement.scope)
        || guidance.subjectKey !== replacement.subjectKey
        || !replacesRecord({ replacement, guidance })) {
        fail(`${guidance.id} superseded transition requires a linked refinement or contradiction, or a consolidation`)
      }
    }
    if (guidance.status === 'superseded') {
      const replacementId = guidance.transitions.at(-1).replacementId
      const replacement = memory.guidance.find(({ id }) => id === replacementId)
      if (!replacement) {
        fail(`${guidance.id} superseded transition requires an existing replacement`)
      }
      if (replacement.status !== 'active' || !sameScope(guidance.scope, replacement.scope) || guidance.subjectKey !== replacement.subjectKey) {
        fail(`${guidance.id} superseded replacement must be active with the same scope and subject`)
      }
    }
    if (guidance.relationship) {
      const target = memory.guidance.find(({ id }) => id === guidance.relationship.targetId)
      if (!target) fail(`${guidance.id} references missing relationship target`)
      if (!sameScope(guidance.scope, target.scope) || guidance.subjectKey !== target.subjectKey) {
        fail(`${guidance.id} relationship target has a different scope or subject`)
      }
    }
    for (const id of guidance.consolidates ?? []) {
      const predecessor = memory.guidance.find((each) => each.id === id)
      if (!predecessor || !sameScope(guidance.scope, predecessor.scope) || guidance.subjectKey !== predecessor.subjectKey) {
        fail(`${guidance.id} consolidates a missing record or one with a different scope or subject`)
      }
    }
  }
  return memory
}

// A replacement names what it replaces through its relationship, or, after a consolidation,
// through its consolidates list.
const replacesRecord = ({ replacement, guidance }) => (
  (['refines', 'contradicts'].includes(replacement.relationship?.kind) && replacement.relationship.targetId === guidance.id)
    || Boolean(replacement.consolidates?.includes(guidance.id))
)

// Version 2 adds consolidation links and journaled transitions. A store is first written as
// version 2 when it holds one, so plugins that read only version 1 keep working until then. It
// stays version 2 after that, even when no such record remains, so it never moves back to a
// version that an older plugin would write over the journal.
const memorySchemaVersions = [1, 2]
const requiredSchemaVersion = (memory) => (
  memory.guidance.some(({ consolidates, transitions }) => consolidates || transitions.some(({ operationId }) => operationId)) ? 2 : 1
)
const schemaVersionFor = (memory) => Math.max(memory.schemaVersion ?? 1, requiredSchemaVersion(memory))

const readJsonMemory = (paths) => {
  if (!existsSync(paths.memoryFile)) return null
  let parsed
  try {
    parsed = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  } catch (error) {
    fail(`memory store is not valid JSON: ${error.message}`)
  }
  return validateMemory(parsed)
}

// Returns the unvalidated JSON block of canonical memory.md, or null when there is none.
const readMemoryBlock = (paths) => {
  if (!existsSync(paths.memoryIndexFile)) return null
  const content = readFileSync(paths.memoryIndexFile, 'utf8')
  const marker = '<!-- field-guide-memory-json:v1 -->\n```json\n'
  const start = content.lastIndexOf(marker)
  if (start === -1) return null
  const jsonStart = start + marker.length
  const jsonEnd = content.indexOf('\n```', jsonStart)
  if (jsonEnd === -1) fail('memory.md has an unterminated machine-readable record')
  try {
    return JSON.parse(content.slice(jsonStart, jsonEnd))
  } catch (error) {
    fail(`memory.md machine-readable record is not valid JSON: ${error.message}`)
  }
}

const readMarkdownMemory = (paths) => {
  const parsed = readMemoryBlock(paths)
  return parsed === null ? null : validateMemory(parsed)
}

const readMemory = (paths) => readMarkdownMemory(paths)

const ensureFile = (path, content) => {
  if (!existsSync(path)) writeFileSync(path, content)
}

const insertEntryIntoSection = ({ content, marker, entry }) => {
  const sectionStart = content.indexOf(marker) + marker.length
  const nextSection = content.indexOf('\n## ', sectionStart)
  const insertionPoint = nextSection === -1 ? content.length : nextSection
  const before = content.slice(0, insertionPoint).trimEnd()
  const after = content.slice(insertionPoint).replace(/^\n+/, '')
  const suffix = after.length > 0 ? `\n${after}` : ''
  return `${before}\n\n${entry}${suffix}`
}

const ensureIndexEntry = ({ indexPath, heading, linkPath, label, description }) => {
  const relativeLink = relative(dirname(indexPath), linkPath).replaceAll('\\', '/')
  const content = readFileSync(indexPath, 'utf8')
  if (content.includes(`](${relativeLink})`)) return

  const entry = `- [${label}](${relativeLink}) — ${description}\n`
  const marker = `## ${heading}`
  if (!content.includes(marker)) {
    writeTextAtomically({ path: indexPath, content: `${content.trimEnd()}\n\n## ${heading}\n\n${entry}` })
    return
  }

  writeTextAtomically({ path: indexPath, content: insertEntryIntoSection({ content, marker, entry }) })
}

const writeMemoryAtomically = ({ paths, memory }) => {
  validateMemory(memory)
  const temporaryPath = `${paths.memoryFile}.tmp-${process.pid}`
  writeFileSync(temporaryPath, `${JSON.stringify(memory, null, 2)}\n`, { flag: 'wx' })
  renameSync(temporaryPath, paths.memoryFile)
}

const readJsonInput = (inputPath) => {
  if (!inputPath) fail('--input is required')
  try {
    return JSON.parse(readFileSync(resolve(inputPath), 'utf8'))
  } catch (error) {
    fail(`input is not valid JSON: ${error.message}`)
  }
}

const readSubmissionInput = ({ inputPath, inputJson }) => {
  if (inputPath) return readJsonInput(inputPath)
  if (!inputJson) fail('--input or --input-json is required')
  try {
    return JSON.parse(inputJson)
  } catch (error) {
    fail(`input is not valid JSON: ${error.message}`)
  }
}

const normalizeLearning = (learning) => (
  learning
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[.!?]+$/u, '')
)

const hashIdentity = ({ prefix, values }) => (
  `${prefix}:v1:${createHash('sha256').update(JSON.stringify(values)).digest('hex')}`
)

const scopeFromSubmission = ({ scope, paths }) => (
  scope === 'project'
    ? { kind: 'project', repositoryIdentity: paths.identity }
    : { kind: 'shared' }
)

const scopeIdentity = (scope) => (
  scope.kind === 'project' ? `project:${scope.repositoryIdentity}` : 'shared'
)

const fingerprintFor = ({ scope, subjectKey, learning }) => (
  hashIdentity({
    prefix: 'fingerprint',
    values: [1, scopeIdentity(scope), subjectKey, normalizeLearning(learning)],
  })
)

const sourceIdentityFor = (pointer) => {
  if (pointer.kind === 'conversation') {
    const occurrenceId = pointer.messageId ?? pointer.turnId
    const occurrenceField = pointer.messageId ? 'messageId' : 'turnId'
    return occurrenceId ? [pointer.client, pointer.threadId, occurrenceField, occurrenceId] : null
  }
  if (pointer.kind === 'review') {
    return [pointer.provider, pointer.repositoryIdentity, pointer.pullRequestNumber, pointer.commentId]
  }
  if (pointer.kind === 'commit') return [pointer.repositoryIdentity, pointer.commit]
  if (pointer.kind === 'local-artifact') {
    return [pointer.repositoryIdentity, pointer.path, pointer.contentDigest]
  }
  if (pointer.kind === 'manual') return [pointer.sourceLabel.normalize('NFC').trim().toLowerCase()]
  return null
}

const sourceKeyFor = (pointer) => {
  const identity = sourceIdentityFor(pointer)
  return identity ? hashIdentity({ prefix: 'source', values: [1, pointer.kind, ...identity] }) : null
}

const pointerCountsForPromotion = (pointer) => (
  pointer.kind !== 'manual' && sourceIdentityFor(pointer) !== null
)

const validateSubmission = ({ submission, paths }) => {
  assertObject({ value: submission, label: 'submission' })
  assertClosedFields({
    value: submission,
    fields: ['schemaVersion', 'decision', 'confidence', 'scope', 'subjectKey', 'linkedSubjects', 'learning', 'relationship', 'reason', 'explicitPreference', 'generic', 'examples', 'evidence'],
    label: 'submission',
  })
  if (submission.schemaVersion !== 1) fail('submission schemaVersion must be 1')
  if (submission.decision !== 'capture') fail('submission decision must be capture')
  if (!['low', 'medium', 'high'].includes(submission.confidence)) fail('submission confidence is invalid')
  if (!['project', 'shared'].includes(submission.scope)) fail('submission scope is invalid')
  if (!portableKey.test(submission.subjectKey)) fail('submission subjectKey must be a portable slug')
  if (byteLength(submission.subjectKey) > 128) fail('submission subjectKey exceeds 128 UTF-8 bytes')
  const linkedSubjects = submission.linkedSubjects ?? []
  if (!Array.isArray(linkedSubjects)
    || linkedSubjects.length > 16
    || new Set(linkedSubjects).size !== linkedSubjects.length
    || linkedSubjects.some((subject) => !portableKey.test(subject) || byteLength(subject) > 128)) {
    fail('submission linkedSubjects must be unique portable slugs')
  }
  requireString({ value: submission.learning, label: 'submission learning', maxBytes: 4096 })
  assertSafePersistedText({ value: submission.learning, label: 'submission learning' })
  if (!normalizeLearning(submission.learning)) fail('submission learning must contain meaningful text')
  if (submission.reason !== undefined) {
    requireString({ value: submission.reason, label: 'submission reason', maxBytes: 512 })
    assertSafePersistedText({ value: submission.reason, label: 'submission reason' })
  }
  if (submission.explicitPreference !== undefined && typeof submission.explicitPreference !== 'boolean') fail('explicitPreference must be boolean')
  if (submission.generic !== undefined && typeof submission.generic !== 'boolean') fail('generic must be boolean')
  if (submission.relationship !== undefined) {
    assertObject({ value: submission.relationship, label: 'submission relationship' })
    assertClosedFields({ value: submission.relationship, fields: ['kind', 'targetId'], label: 'submission relationship' })
    if (!['reinforces', 'refines', 'contradicts'].includes(submission.relationship.kind)) fail('submission relationship kind is invalid')
    if (!guidanceIdPattern.test(submission.relationship.targetId)) fail('submission relationship targetId is invalid')
  }
  validateExamples(submission.examples)
  assertObject({ value: submission.evidence, label: 'submission evidence' })
  assertClosedFields({ value: submission.evidence, fields: ['summary', 'pointers'], label: 'submission evidence' })
  requireString({ value: submission.evidence.summary, label: 'evidence summary', maxBytes: 512 })
  assertSafePersistedText({ value: submission.evidence.summary, label: 'evidence summary' })
  if (!Array.isArray(submission.evidence.pointers) || submission.evidence.pointers.length === 0) {
    fail('submission evidence pointers must be a non-empty array')
  }
  const pointers = [...new Map(
    submission.evidence.pointers
      .map((pointer) => validatePointer(structuredClone(pointer)))
      .map((pointer) => [JSON.stringify(pointer), pointer]),
  ).values()]
  return {
    ...submission,
    scope: scopeFromSubmission({ scope: submission.scope, paths }),
    linkedSubjects,
    examples: submission.examples ?? [],
    evidence: { ...submission.evidence, pointers },
  }
}

const sameScope = (left, right) => scopeIdentity(left) === scopeIdentity(right)

const evidenceCountFor = ({ guidance, memory }) => (
  guidance.evidenceIds
    .map((id) => memory.evidence.find((evidence) => evidence.id === id))
    .filter((evidence) => evidence?.countsForPromotion)
    .length
)

const repositoryCountFor = ({ guidance, memory }) => (
  new Set(
    guidance.evidenceIds
      .map((id) => memory.evidence.find((evidence) => evidence.id === id))
      .filter((evidence) => evidence?.countsForPromotion && evidence.repositoryIdentity)
      .map((evidence) => evidence.repositoryIdentity),
  ).size
)

const desiredStatus = ({ submission, guidance, memory }) => {
  if (guidance.status === 'active') return { status: 'active', reason: 'already-active' }
  if (submission.explicitPreference === true) return { status: 'active', reason: 'explicit-preference' }
  if (submission.relationship?.kind === 'refines' || submission.relationship?.kind === 'contradicts') {
    return { status: 'candidate', reason: 'semantic-change-requires-confirmation' }
  }
  if (guidance.scope.kind === 'project' && evidenceCountFor({ guidance, memory }) >= 2) {
    return { status: 'active', reason: 'independent-evidence-threshold' }
  }
  if (guidance.scope.kind === 'shared' && guidance.generic === true && repositoryCountFor({ guidance, memory }) >= 2) {
    return { status: 'active', reason: 'multi-project-evidence-threshold' }
  }
  return { status: 'candidate', reason: 'inferred-observation' }
}

const addEvidence = ({ submission, memory, paths, now }) => {
  const pointers = submission.evidence.pointers
  const sourceKeys = [...new Set(pointers.map(sourceKeyFor).filter(Boolean))].sort()
  const matchingEvents = memory.evidence.filter((evidence) => (
    evidence.sourceKeys.some((key) => sourceKeys.includes(key))
  ))
  if (new Set(matchingEvents.map(({ id }) => id)).size > 1) fail('conflicting-source-events')
  if (matchingEvents.length > 0) {
    const existing = matchingEvents[0]
    const serialized = new Set(existing.pointers.map((pointer) => JSON.stringify(pointer)))
    let changed = false
    for (const pointer of pointers) {
      if (!serialized.has(JSON.stringify(pointer))) {
        existing.pointers.push(pointer)
        changed = true
      }
    }
    const nextSourceKeys = [...new Set([...existing.sourceKeys, ...sourceKeys])].sort()
    if (nextSourceKeys.length !== existing.sourceKeys.length) changed = true
    existing.sourceKeys = nextSourceKeys
    if (!existing.countsForPromotion && pointers.some(pointerCountsForPromotion)) {
      existing.countsForPromotion = true
      existing.repositoryIdentity = paths.identity
      changed = true
    }
    return { evidence: existing, created: false, changed }
  }
  const evidence = {
    id: `evidence:v1:${randomUUID()}`,
    summary: submission.evidence.summary,
    pointers,
    sourceKeys,
    countsForPromotion: pointers.some(pointerCountsForPromotion),
    ...(pointers.some(pointerCountsForPromotion) ? { repositoryIdentity: paths.identity } : {}),
    createdAt: now,
  }
  memory.evidence.push(evidence)
  return { evidence, created: true, changed: true }
}

const renderMemoryIndex = (memory) => {
  const records = [...memory.guidance].sort((left, right) => left.id.localeCompare(right.id))
  const sections = records.map((record) => {
    const examples = (record.examples ?? []).map((example) => (
      `\n#### ${example.kind === 'pattern' ? 'Pattern' : 'Antipattern'} (\`${example.language}\`)\n\n`
        + `\`\`\`${example.language}\n${example.code}\n\`\`\``
    )).join('\n')
    return `## ${record.id}\n\n`
      + `- Status: \`${record.status}\`\n`
      + `- Scope: \`${scopeIdentity(record.scope)}\`\n`
      + `- Subject: \`${record.subjectKey}\`\n`
      + (record.linkedSubjects
        ? `- Linked subjects: ${record.linkedSubjects.map((subject) => `\`${subject}\``).join(', ') || 'none'}\n`
        : '')
      + `- Evidence: ${record.evidenceIds.map((id) => `\`${id}\``).join(', ') || 'none'}\n\n`
      + `${record.learning}${examples}\n`
  })
  return `# Field-guide memory\n\nThis index contains concise guidance. Use the utility to retrieve bounded active records.\n\n`
    + `${sections.join('\n')}`
    + '## Machine-readable record\n\n'
    + 'The JSON block is canonical. Use the utility for validated changes.\n\n'
    + '<!-- field-guide-memory-json:v1 -->\n```json\n'
    + `${JSON.stringify(memory, null, 2)}\n`
    + '```\n'
}

const writeTextAtomically = ({ path, content }) => {
  const temporaryPath = `${path}.tmp-${process.pid}`
  writeFileSync(temporaryPath, content, { flag: 'wx' })
  renameSync(temporaryPath, path)
}

const writeMemoryViews = ({ paths, memory: content }) => {
  const memory = { ...content, schemaVersion: schemaVersionFor(content) }
  validateMemory(memory)
  const current = readMemory(paths) ?? emptyMemory()
  if (!existsSync(paths.memoryIndexFile)) {
    writeTextAtomically({ path: paths.memoryIndexFile, content: renderMemoryIndex(current) })
  }
  ensureIndexEntry({
    indexPath: paths.rootIndex,
    heading: 'Memory records',
    linkPath: paths.memoryIndexFile,
    label: 'Structured memory',
    description: 'Candidate and active guidance with bounded evidence pointers.',
  })
  writeTextAtomically({ path: paths.memoryIndexFile, content: renderMemoryIndex(memory) })
  writeMemoryAtomically({ paths, memory })
  // Last, so a crash between the writes leaves a mismatch, which voids confirmations.
  writeWatermark({ paths, memory })
}

// The memory revision and fingerprints of the last annotation-aware write. It stays local and
// never syncs. Any other revision means an older plugin wrote memory since then, and the
// fingerprints still name the records that plugin may have deleted.
const readWatermark = (paths) => {
  if (!existsSync(paths.annotationsWatermarkFile)) return {}
  // A watermark that does not parse counts as a mismatch, which only voids confirmations.
  try {
    return JSON.parse(readFileSync(paths.annotationsWatermarkFile, 'utf8')) ?? {}
  } catch {
    return {}
  }
}

const writeWatermark = ({ paths, memory }) => {
  const fingerprints = sortedUnion(memory.guidance.map(({ fingerprint }) => fingerprint))
  writeTextAtomically({ path: paths.annotationsWatermarkFile, content: `${JSON.stringify({ memoryRevision: memory.revision, fingerprints })}\n` })
}

const watermarkCurrent = ({ paths, memory }) => readWatermark(paths).memoryRevision === memory.revision

// An older plugin may have retired, restored, deleted, or recaptured guidance since the last
// annotation-aware write. Revoke every fingerprint in memory, annotations, or the watermark once,
// which covers deleted records and confirmations still in transit, then record the revision.
// A store without a watermark, such as one from the first annotation release, is treated the same.
// These revocations carry the reconcile prefix, so nightly maintenance can tell them apart.
const reconcileAnnotations = (paths) => {
  const memory = readMarkdownMemory(paths)
  if (!memory || watermarkCurrent({ paths, memory })) return
  const annotations = readAnnotations(paths.annotationsFile)
  const { fingerprints: known } = readWatermark(paths)
  const fingerprints = sortedUnion(memory.guidance.map(({ fingerprint }) => fingerprint), Object.keys(annotations.records), Array.isArray(known) ? known : [])
  for (const fingerprint of fingerprints) revokeRecord(annotationRecordFor({ annotations, fingerprint }), newReconcileRevocationId())
  writeAnnotations({ path: paths.annotationsFile, annotations })
  writeWatermark({ paths, memory })
}

// A writer waits briefly for the lock, inside the hook's five-second timeout. It removes a lock
// that is older than any write takes, or whose owner process exited. A PID proves an exit only
// within the same PID namespace, because each sandboxed command can run in its own.
const lockWaitMs = 1500
const lockRetryMs = 50
const staleLockMs = 60 * 1000

const pidNamespace = () => {
  try {
    return readlinkSync('/proc/self/ns/pid')
  } catch {
    // Without /proc (macOS), every process shares one PID space.
    return null
  }
}

const isStaleLock = ({ text, ageMs }) => {
  if (ageMs > staleLockMs) return true
  let owner
  try {
    owner = JSON.parse(text)
  } catch {
    // A lock without owner data, such as one from an older plugin, is stale only by age.
    return false
  }
  if (!Number.isSafeInteger(owner?.pid) || owner.pidNamespace !== pidNamespace()) return false
  try {
    process.kill(owner.pid, 0)
    return false
  } catch (error) {
    return error.code === 'ESRCH'
  }
}

// Removes a stale lock only while it still holds the content judged stale, so a lock that a new
// owner took in the meantime survives. Only a lock taken between the second read and the unlink
// can be lost. Returns whether the lock is gone.
const removeStaleLock = (lockFile) => {
  try {
    const text = readFileSync(lockFile, 'utf8')
    if (!isStaleLock({ text, ageMs: Date.now() - statSync(lockFile).mtimeMs })) return false
    if (readFileSync(lockFile, 'utf8') === text) unlinkSync(lockFile)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return true
    throw error
  }
}

// Links a file that already holds the owner data into place, so a live lock is never empty and
// stale-lock recovery cannot mistake a lock that was just taken for an empty old one.
const acquireLock = (lockFile) => {
  const deadline = Date.now() + lockWaitMs
  // A writer that died while holding its owner file leaves it behind; remove those past the stale age.
  for (const name of readdirSync(dirname(lockFile)).filter((each) => each.startsWith(`${basename(lockFile)}.`) && each.endsWith('.tmp'))) {
    const path = join(dirname(lockFile), name)
    if (Date.now() - (statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? Date.now()) > staleLockMs) rmSync(path, { force: true })
  }
  const token = randomUUID()
  const ownerFile = `${lockFile}.${token}.tmp`
  const owner = JSON.stringify({ pid: process.pid, pidNamespace: pidNamespace(), createdAt: Date.now(), token })
  writeFileSync(ownerFile, owner)
  try {
    for (;;) {
      try {
        linkSync(ownerFile, lockFile)
        return owner
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
      }
      if (removeStaleLock(lockFile)) continue
      if (Date.now() >= deadline) fail('Field-guide memory is locked by another writer; retry the operation')
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, lockRetryMs)
    }
  } finally {
    rmSync(ownerFile, { force: true })
  }
}

// Serializes writes to memory and annotations in one guide, and reconciles annotations first.
// A caller that refuses a lagging watermark passes reconcile false, because reconciling it voids
// every confirmation.
const withMemoryLock = ({ paths, action, reconcile = true }) => {
  const lockFile = paths.memoryLockFile
  const owner = acquireLock(lockFile)
  try {
    if (reconcile) reconcileAnnotations(paths)
    return action()
  } finally {
    // A lock that stale recovery handed to another writer is no longer this writer's to remove.
    try {
      if (readFileSync(lockFile, 'utf8') === owner) unlinkSync(lockFile)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}

const submitObservationUnlocked = ({ paths, inputPath, inputJson }) => {
  requireInitialized(paths)
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run init first')
  const input = readSubmissionInput({ inputPath, inputJson })
  // Unicode line separators would split an injected line. Only new input is checked, so a store
  // that already holds one still loads; injection renders them as spaces.
  if (/[\u0085\u2028\u2029]/u.test(JSON.stringify(input))) fail('submission must not contain control characters')
  const submission = validateSubmission({ submission: input, paths })
  const fingerprint = fingerprintFor(submission)
  const exact = memory.guidance.find((guidance) => guidance.fingerprint === fingerprint)
  const target = submission.relationship
    ? memory.guidance.find((guidance) => guidance.id === submission.relationship.targetId)
    : exact
  if (submission.relationship && !target) fail('relationship target does not exist')
  if (target && (!sameScope(target.scope, submission.scope) || target.subjectKey !== submission.subjectKey)) {
    fail('relationship target must use the same scope and subjectKey')
  }
  if (submission.relationship && !['candidate', 'active'].includes(target.status)) {
    fail('relationship target must be candidate or active')
  }

  const now = new Date().toISOString()
  const { evidence, created: createdEvidence, changed: evidenceChanged } = addEvidence({ submission, memory, paths, now })
  const reinforcementTarget = exact ?? (submission.relationship?.kind === 'reinforces' ? target : null)
  if (reinforcementTarget && reinforcementTarget.evidenceIds.includes(evidence.id)) {
    if (createdEvidence) fail('internal evidence identity error')
    if (evidenceChanged) writeMemoryViews({ paths, memory: { ...memory, revision: memory.revision + 1 } })
    return {
      outcome: 'duplicate-evidence',
      targetId: reinforcementTarget.id,
      independentEvidenceCount: reinforcementTarget.independentEvidenceCount,
      status: reinforcementTarget.status,
      evidenceId: evidence.id,
      sourceKeys: evidence.sourceKeys,
    }
  }

  let guidance = reinforcementTarget
  let previousStatus = guidance?.status
  if (!guidance) {
    guidance = {
      id: fingerprint.replace('fingerprint', 'guidance'),
      fingerprint,
      scope: submission.scope,
      subjectKey: submission.subjectKey,
      linkedSubjects: submission.linkedSubjects,
      learning: submission.learning,
      status: 'candidate',
      confidence: submission.confidence,
      ...(submission.generic === undefined ? {} : { generic: submission.generic }),
      ...(submission.relationship ? { relationship: submission.relationship } : {}),
      examples: submission.examples,
      evidenceIds: [],
      independentEvidenceCount: 0,
      transitions: [],
      createdAt: now,
      updatedAt: now,
    }
    memory.guidance.push(guidance)
  }
  if (submission.generic === true) guidance.generic = true
  guidance.linkedSubjects = [...new Set([...(guidance.linkedSubjects ?? []), ...submission.linkedSubjects])].sort()
  guidance.evidenceIds.push(evidence.id)
  guidance.independentEvidenceCount = evidenceCountFor({ guidance, memory })
  guidance.updatedAt = now
  const promotion = desiredStatus({ submission, guidance, memory })
  if (guidance.transitions.length === 0 || promotion.status !== guidance.status) {
    guidance.transitions.push({
      from: guidance.transitions.length === 0 ? null : guidance.status,
      to: promotion.status,
      reason: promotion.reason,
      source: submission.explicitPreference ? 'user' : 'observation',
      at: now,
    })
  }
  guidance.status = promotion.status
  const nextMemory = { ...memory, revision: memory.revision + 1 }
  // A new record starts unconfirmed, even when an earlier record with the same text was confirmed.
  if (!reinforcementTarget) revokeConfirmations({ annotationsFile: paths.annotationsFile, fingerprints: [fingerprint] })
  writeMemoryViews({ paths, memory: nextMemory })
  return {
    outcome: previousStatus === 'candidate' && guidance.status === 'active'
      ? 'promoted'
      : (reinforcementTarget ? 'reinforced' : 'created'),
    targetId: guidance.id,
    evidenceId: evidence.id,
    sourceKeys: evidence.sourceKeys,
    independentEvidenceCount: guidance.independentEvidenceCount,
    ...(previousStatus ? { previousStatus } : {}),
    status: guidance.status,
    promotionReason: promotion.reason,
  }
}

const submitObservation = ({ paths, inputPath, inputJson }) => (
  withMemoryLock({ paths, action: () => submitObservationUnlocked({ paths, inputPath, inputJson }) })
)

// Shared sync orders retirements and restores with two grow-only sets of IDs on each shared
// fingerprint. A user retirement adds a random ID. Withdrawing a replacement acknowledges only
// the ID of the supersession it created. Import only copies IDs. A record is retired while any
// ID is unacknowledged. A shared record retired before the sets existed counts as one baseline ID.
const baselineRetirementId = (fingerprint) => hashIdentity({ prefix: 'retirement', values: ['baseline', fingerprint] })

const retirementSetsOf = (guidance) => ({
  retirements: guidance.retirements
    ?? (guidance.scope.kind === 'shared' && retiredStatuses.has(guidance.status) ? [baselineRetirementId(guidance.fingerprint)] : []),
  acknowledged: guidance.acknowledged ?? [],
})

const hasUnacknowledgedRetirement = ({ retirements, acknowledged }) => retirements.some((id) => !acknowledged.includes(id))

const sortedUnion = (...lists) => [...new Set(lists.flat())].sort()

const validateRetirementSets = ({ retirements, acknowledged, label }) => {
  for (const [name, ids] of [['retirements', retirements], ['acknowledged', acknowledged]]) {
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some((id) => !retirementIdPattern.test(id))) {
      fail(`${label} ${name} must be a unique array of retirement IDs`)
    }
  }
  if (acknowledged.some((id) => !retirements.includes(id))) fail(`${label} acknowledges an unknown retirement`)
}

const setRetirementSets = ({ guidance, retirements, acknowledged }) => {
  guidance.retirements = sortedUnion(retirements)
  guidance.acknowledged = sortedUnion(acknowledged)
}

// Call before the retirement transition, while the current status still decides the baseline.
// Returns the new ID, or undefined for repository-scoped guidance.
const addRetirement = (guidance) => {
  if (guidance.scope.kind !== 'shared') return undefined
  const { retirements, acknowledged } = retirementSetsOf(guidance)
  const retirementId = `retirement:v1:${randomBytes(32).toString('hex')}`
  setRetirementSets({ guidance, retirements: [...retirements, retirementId], acknowledged })
  return retirementId
}

// A supersession made before its transition stored an ID used the baseline ID.
const acknowledgeOwnSupersession = (superseded) => {
  const { retirements, acknowledged } = retirementSetsOf(superseded)
  const own = superseded.transitions.at(-1).retirementId ?? baselineRetirementId(superseded.fingerprint)
  if (retirements.includes(own)) setRetirementSets({ guidance: superseded, retirements, acknowledged: [...acknowledged, own] })
}

const appendTransition = ({ guidance, to, reason, source, now, replacementId, retirementId, operationId }) => {
  guidance.transitions.push({
    from: guidance.status,
    to,
    reason,
    source,
    at: now,
    ...(replacementId ? { replacementId } : {}),
    ...(retirementId ? { retirementId } : {}),
    ...(operationId ? { operationId } : {}),
  })
  guidance.status = to
  guidance.updatedAt = now
}

// Annotations live in annotations.json beside memory.md, keyed by guidance fingerprint, so
// memory.md and its export keep their formats. Each confirmation and each trigger is an entry
// with a random ID. Removing one acknowledges its ID, as retirement sets do. A merge is the union
// of entries and acknowledgments, so a removal reaches every machine in any sync order.
// Each revocation adds a random ID to the record's revocations, merged by union. A confirmation
// lists in seen the revocations its machine knew; it counts only while it has seen them all, so a
// revocation also covers confirmations it has not seen, and a concurrent revocation wins.
// Only the UserPromptSubmit hook adds a confirmation; agent commands can only remove one.
const annotationTriggers = ['handoff', 'pr-created', 'pr-merged']
const annotationIdPattern = /^annotation:v1:[0-9a-f]{64}$/
const supportedSchemaVersion = 1

const emptyAnnotations = () => ({ schemaVersion: supportedSchemaVersion, records: {} })
const emptyAnnotationRecord = () => ({ confirmations: [], triggers: [], acknowledged: [], revocations: [] })
const requireAnnotationIds = ({ ids, label, allowRetirements = false }) => {
  const valid = (id) => annotationIdPattern.test(id) || (allowRetirements && retirementIdPattern.test(id))
  if (!Array.isArray(ids) || !ids.every(valid) || new Set(ids).size !== ids.length) {
    fail(`${label} must list unique annotation IDs`)
  }
}

const requireTrigger = (trigger) => {
  if (!annotationTriggers.includes(trigger)) fail(`trigger must be one of: ${annotationTriggers.join(', ')}`)
  return trigger
}

const validateAnnotationEntry = ({ entry, kind }) => {
  const label = `annotation ${kind}`
  assertObject({ value: entry, label })
  assertClosedFields({ value: entry, fields: kind === 'trigger' ? ['id', 'trigger', 'at'] : ['id', 'at', 'host', 'seen'], label })
  if (kind === 'confirmation') requireAnnotationIds({ ids: entry.seen, label: `${label} seen`, allowRetirements: true })
  if (!annotationIdPattern.test(entry.id)) fail(`${label} has an invalid id`)
  requireTimestamp({ value: entry.at, label: `${label} at` })
  if (kind === 'trigger') requireTrigger(entry.trigger)
  if (entry.host !== undefined && !['claude', 'codex'].includes(entry.host)) fail(`${label} host must be claude or codex`)
}

const validateAnnotationRecord = (record) => {
  assertObject({ value: record, label: 'annotations record' })
  assertClosedFields({ value: record, fields: ['confirmations', 'triggers', 'acknowledged', 'revocations'], label: 'annotations record' })
  if (![record.confirmations, record.triggers, record.acknowledged].every(Array.isArray)) {
    fail('annotations record needs confirmations, triggers, and acknowledged arrays')
  }
  requireAnnotationIds({ ids: record.revocations, label: 'annotations record revocations' })
  record.confirmations.forEach((entry) => validateAnnotationEntry({ entry, kind: 'confirmation' }))
  record.triggers.forEach((entry) => validateAnnotationEntry({ entry, kind: 'trigger' }))
  const ids = [...record.confirmations, ...record.triggers].map(({ id }) => id)
  if (new Set(ids).size !== ids.length) fail('annotations record repeats an entry ID')
  if (new Set(record.acknowledged).size !== record.acknowledged.length || record.acknowledged.some((id) => !ids.includes(id))) {
    fail('annotations record acknowledges an unknown or repeated entry')
  }
}

const validateAnnotations = (annotations) => {
  assertObject({ value: annotations, label: 'annotations' })
  assertClosedFields({ value: annotations, fields: ['schemaVersion', 'records'], label: 'annotations' })
  if (annotations.schemaVersion !== supportedSchemaVersion) fail(`annotations have unsupported schema version: ${annotations.schemaVersion}`)
  assertObject({ value: annotations.records, label: 'annotations records' })
  for (const [fingerprint, record] of Object.entries(annotations.records)) {
    if (!fingerprintPattern.test(fingerprint)) fail('annotations record key must be a guidance fingerprint')
    validateAnnotationRecord(record)
  }
  return annotations
}

// A missing file holds no annotations.
const readAnnotations = (annotationsFile) => {
  if (!existsSync(annotationsFile)) return emptyAnnotations()
  return validateAnnotations(readJsonInput(annotationsFile))
}

// Markers carry authority, so guidance renders without them when annotations cannot be read.
// validate and the hook's version line report the problem instead.
const readAnnotationsForDisplay = (annotationsFile) => {
  try {
    return readAnnotations(annotationsFile)
  } catch {
    return emptyAnnotations()
  }
}

const uniqueEntries = (entries) => [...new Map(entries.map((entry) => [entry.id, entry])).values()]
  .sort((left, right) => left.id.localeCompare(right.id))

// Unions entries, acknowledgments, and revocations per fingerprint, in a stable order.
const mergeAnnotations = (...sources) => {
  const records = {}
  for (const source of sources) {
    for (const [fingerprint, record] of Object.entries(source.records)) {
      const current = records[fingerprint] ?? emptyAnnotationRecord()
      records[fingerprint] = {
        confirmations: uniqueEntries([...current.confirmations, ...record.confirmations]),
        triggers: uniqueEntries([...current.triggers, ...record.triggers]),
        acknowledged: sortedUnion(current.acknowledged, record.acknowledged),
        revocations: sortedUnion(current.revocations, record.revocations),
      }
    }
  }
  const sorted = Object.keys(records).sort().map((fingerprint) => [fingerprint, records[fingerprint]])
  return { schemaVersion: supportedSchemaVersion, records: Object.fromEntries(sorted) }
}

// Writes only a changed file, so a repeated sync leaves both copies byte for byte unchanged.
const writeAnnotations = ({ path, annotations }) => {
  const content = `${JSON.stringify(validateAnnotations(mergeAnnotations(annotations)), null, 2)}\n`
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return
  writeTextAtomically({ path, content })
}

const annotationRecordFor = ({ annotations, fingerprint }) => {
  annotations.records[fingerprint] ??= emptyAnnotationRecord()
  return annotations.records[fingerprint]
}

const outstandingEntries = ({ record, entries }) => entries.filter(({ id }) => !record.acknowledged.includes(id))

// Acknowledges the given entries that are still outstanding. Returns whether any were.
const acknowledgeEntries = ({ record, entries }) => {
  const ids = outstandingEntries({ record, entries }).map(({ id }) => id)
  record.acknowledged.push(...ids)
  return ids.length > 0
}

const newAnnotationId = () => `annotation:v1:${randomBytes(32).toString('hex')}`
const newAnnotationEntry = (fields) => ({ id: newAnnotationId(), at: new Date().toISOString(), ...fields })

// A reconcile's revocation is an annotation ID whose first 16 hex digits are fixed and whose rest
// is random, so every released reader accepts it, each reconcile still adds a new revocation, and
// nightly maintenance can tell a confirmation that a reconcile voided from one the user withdrew.
const reconcileRevocationPrefix = hashIdentity({ prefix: 'annotation', values: ['reconcile'] }).slice(0, 'annotation:v1:'.length + 16)
const newReconcileRevocationId = () => `${reconcileRevocationPrefix}${randomBytes(24).toString('hex')}`

// A retirement ID enters annotations in annotation format, which the first annotation release accepts.
const retirementRevocationId = (id) => hashIdentity({ prefix: 'annotation', values: ['retirement', id] })

// A record's revocations, plus one for each retirement ID that memory keeps and sync carries for
// shared records, so a retirement or undo by a plugin without annotations also revokes.
const revocationIds = ({ record, guidance }) => (
  sortedUnion(record.revocations, retirementSetsOf(guidance).retirements.map(retirementRevocationId))
)

// A confirmation counts while it is outstanding and has seen every revocation of its record,
// apart from any the caller excuses. Its time is metadata only, so machine clocks never decide authority.
const countingConfirmations = ({ record, guidance, excused = [] }) => {
  const revocations = revocationIds({ record, guidance }).filter((id) => !excused.includes(id))
  return outstandingEntries({ record, entries: record.confirmations }).filter(({ seen }) => revocations.every((id) => seen.includes(id)))
}

// Returns the new revocation's ID.
const revokeRecord = (record, id = newAnnotationId()) => {
  record.revocations.push(id)
  return id
}

// Automation passes excused revocations so a crashed operation's revocations do not expose a record
// the user confirmed; injected markers excuse none, so the crash still fails closed for authority.
const annotationMarkers = ({ annotations, guidance, excused = [] }) => {
  const record = annotations.records[guidance.fingerprint] ?? emptyAnnotationRecord()
  return {
    confirmed: countingConfirmations({ record, guidance, excused }).length > 0,
    triggers: [...new Set(outstandingEntries({ record, entries: record.triggers }).map(({ trigger }) => trigger))].sort(),
  }
}

// Only a main thread sees markers; a delegate or subagent reads the same guidance without them.
const displayMarkers = ({ annotations, guidance, mainThread }) => (
  mainThread ? annotationMarkers({ annotations, guidance }) : { confirmed: false, triggers: [] }
)

// Retiring, restoring, deleting, or capturing a record revokes the confirmations of its
// fingerprint, so the same text never inherits authority, even from one that arrives by sync.
// Call it before the memory write: a failed write then leaves authority removed, not lingering.
const revokeConfirmations = ({ annotationsFile, fingerprints }) => {
  if (fingerprints.length === 0) return
  const annotations = readAnnotations(annotationsFile)
  fingerprints.forEach((fingerprint) => revokeRecord(annotationRecordFor({ annotations, fingerprint })))
  writeAnnotations({ path: annotationsFile, annotations })
}

const guidanceReferencePattern = /^(?:guidance:v1:[0-9a-f]{64}|[0-9a-f]{8,64})$/

// Finds the record for a full guidance ID or an unambiguous hex prefix. Returns the record or a
// short reason that it cannot be used.
const findGuidance = ({ memory, reference }) => {
  if (!guidanceReferencePattern.test(reference)) return { problem: 'use a full guidance ID or a hex prefix of at least 8 characters' }
  const prefix = `guidance:v1:${reference.replace(/^guidance:v1:/u, '')}`
  const matches = memory.guidance.filter(({ id }) => id.startsWith(prefix))
  if (matches.length === 0) return { problem: 'no guidance matches that ID' }
  if (matches.length > 1) return { problem: 'that prefix matches more than one guidance record' }
  return { guidance: matches[0] }
}

const requireGuidance = ({ memory, reference }) => {
  const { guidance, problem } = findGuidance({ memory, reference })
  if (problem) fail(problem)
  return guidance
}

const readInitializedMemory = (paths) => {
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run init first')
  return memory
}

const unconfirmUnlocked = ({ paths, reference }) => {
  const guidance = requireGuidance({ memory: readInitializedMemory(paths), reference })
  const annotations = readAnnotations(paths.annotationsFile)
  const record = annotationRecordFor({ annotations, fingerprint: guidance.fingerprint })
  const confirmed = countingConfirmations({ record, guidance }).length > 0
  // The revocation also covers a confirmation made on another machine that has not synced yet.
  revokeRecord(record)
  writeAnnotations({ path: paths.annotationsFile, annotations })
  return { outcome: confirmed ? 'unconfirmed' : 'not-confirmed', targetId: guidance.id }
}

/** Removes the user's confirmation of a record. It needs no approval because it only removes authority. */
const unconfirm = ({ paths, reference }) => (
  withMemoryLock({ paths, action: () => unconfirmUnlocked({ paths, reference }) })
)

const annotateUnlocked = ({ paths, reference, triggers, removeTrigger }) => {
  const guidance = requireGuidance({ memory: readInitializedMemory(paths), reference })
  if (!['candidate', 'active'].includes(guidance.status)) fail('annotate requires a candidate or active target')
  const annotations = readAnnotations(paths.annotationsFile)
  const record = annotationRecordFor({ annotations, fingerprint: guidance.fingerprint })
  let changed
  if (removeTrigger === undefined) {
    const current = annotationMarkers({ annotations, guidance }).triggers
    const added = [...new Set(triggers.split(',').map((trigger) => requireTrigger(trigger.trim())))].filter((trigger) => !current.includes(trigger))
    record.triggers.push(...added.map((trigger) => newAnnotationEntry({ trigger })))
    changed = added.length > 0
  } else {
    requireTrigger(removeTrigger)
    changed = acknowledgeEntries({ record, entries: record.triggers.filter(({ trigger }) => trigger === removeTrigger) })
  }
  if (changed) writeAnnotations({ path: paths.annotationsFile, annotations })
  return { outcome: changed ? 'annotated' : 'unchanged', targetId: guidance.id, triggers: annotationMarkers({ annotations, guidance }).triggers }
}

/** Adds or removes event triggers. Triggers choose when guidance is retrieved; they grant no authority. */
const annotate = ({ paths, reference, triggers, removeTrigger }) => (
  withMemoryLock({ paths, action: () => annotateUnlocked({ paths, reference, triggers, removeTrigger }) })
)

const delegateThreadPrefixes = ['thread:delegated-task:', 'mcp:launch:']

/**
 * Reports whether a hook or command runs in a main thread. Claude and Codex subagent hook input
 * carries agent_id. T3 Code delegate threads have a prefixed T3CODE_THREAD_ID; main T3 threads
 * have a plain UUID, and other hosts set none. A command cannot see agent_id, so a Claude
 * subagent that runs the CLI in a main T3 thread counts as main.
 */
export const isMainThread = ({ agentId, env }) => (
  !(typeof agentId === 'string' && agentId.length > 0)
    && !delegateThreadPrefixes.some((prefix) => (env.T3CODE_THREAD_ID ?? '').startsWith(prefix))
)

const confirmPromptPattern = /^confirm fg:(\S+)$/u
const confirmationMessage = ({ exact, text }) => ({ exact, systemMessage: text, context: text })
const notConfirmed = (reason) => confirmationMessage({ exact: true, text: `Field Guide: nothing confirmed; ${reason}.` })

const confirmUnlocked = ({ files, reference, host }) => {
  const memory = readMarkdownMemory(files)
  if (!memory) return notConfirmed('no Field Guide memory exists')
  const { guidance, problem } = findGuidance({ memory, reference })
  if (problem) return notConfirmed(problem)
  if (guidance.status !== 'active') return notConfirmed(`that guidance is ${guidance.status}, not active`)
  const annotations = readAnnotations(files.annotationsFile)
  const record = annotationRecordFor({ annotations, fingerprint: guidance.fingerprint })
  if (countingConfirmations({ record, guidance }).length > 0) {
    return confirmationMessage({ exact: true, text: `Field Guide: already confirmed: "${guidance.learning}"` })
  }
  record.confirmations.push(newAnnotationEntry({ ...(host ? { host } : {}), seen: revocationIds({ record, guidance }) }))
  writeAnnotations({ path: files.annotationsFile, annotations })
  const line = injectionLine({ guidance, markers: annotationMarkers({ annotations, guidance }) })
  return {
    exact: true,
    systemMessage: `Field Guide confirmed ${guidance.id.slice('guidance:v1:'.length, 'guidance:v1:'.length + 8)}: "${guidance.learning}"`,
    context: `Field Guide: the user confirmed this guidance with an exact confirm prompt, so it now carries the [confirmed] marker:\n${line}\nAcknowledge the confirmation in one line. The prompt asks for nothing else.`,
  }
}

/**
 * Handles a prompt that names a confirmation. A trimmed prompt that is exactly
 * `confirm fg:<id>`, in a main thread, confirms one active record, and one that is exactly
 * `confirm fg:proposal:<id>` approves one stored proposal; the result reports why
 * anything else confirms nothing. Returns null for a prompt that does not mention
 * `confirm fg:`, and for a near miss outside a main thread. A near miss, such as a pasted report
 * that mentions a confirm prompt, only tells the agent: it has no message for the user. Stores only an entry ID, the time,
 * the host, and the revocation IDs it saw, some derived from retirement IDs, never prompt text.
 * It takes memory.lock, then reads memory.md, the watermark, and annotations.json, which reconcile
 * may rewrite, and proposals.json for a proposal; it never reads operations.jsonl.
 */
export const confirmFromPrompt = ({ guideRoot, prompt, mainThread, host }) => {
  const reference = prompt.trim().match(confirmPromptPattern)?.[1]
  if (reference === undefined) {
    if (!/confirm fg:/iu.test(prompt) || !mainThread) return null
    return { exact: false, context: 'Field Guide: nothing confirmed; a confirmation is a prompt that is exactly `confirm fg:<id>`, typed by the user' }
  }
  if (!mainThread) return notConfirmed('only a prompt the user types in a main thread can confirm guidance')
  const files = guideFilesFor(guideRootFor(guideRoot))
  if (!existsSync(files.memoryIndexFile)) return notConfirmed('no Field Guide memory exists')
  const confirm = reference.startsWith('proposal:') ? approveProposalUnlocked : confirmUnlocked
  return withMemoryLock({ paths: files, action: () => confirm({ files, reference, host }) })
}

/** Returns one line when the store's memory or annotations are newer than this plugin reads. */
export const storeVersionNotice = ({ guideRoot }) => {
  const files = guideFilesFor(guideRootFor(guideRoot))
  const versionOf = (read) => {
    try {
      return read()?.schemaVersion
    } catch {
      // Malformed content is not a version problem; validate reports it.
      return undefined
    }
  }
  const newer = (version, supported) => Number.isSafeInteger(version) && version > supported
  return newer(versionOf(() => readMemoryBlock(files)), memorySchemaVersions.at(-1))
    || newer(versionOf(() => (existsSync(files.annotationsFile) ? readJsonInput(files.annotationsFile) : null)), supportedSchemaVersion)
    ? 'Field Guide: the guide uses a newer format than this plugin reads, so some stored guidance is not applied. Update the Field Guide plugin.'
    : null
}

const validateTransitionInput = (input) => {
  assertObject({ value: input, label: 'transition input' })
  assertClosedFields({
    value: input,
    fields: ['schemaVersion', 'action', 'targetId', 'replacementId', 'confirmed', 'reason', 'source'],
    label: 'transition input',
  })
  if (input.schemaVersion !== 1) fail('transition schemaVersion must be 1')
  if (!['activate', 'supersede', 'undo', 'withdraw'].includes(input.action)) {
    fail('transition action is invalid')
  }
  if (!guidanceIdPattern.test(input.targetId)) fail('transition targetId is invalid')
  requireString({ value: input.reason, label: 'transition reason', maxBytes: 512 })
  requireString({ value: input.source, label: 'transition source', maxBytes: 128, noWhitespace: true })
  if (input.action === 'supersede') {
    if (!guidanceIdPattern.test(input.replacementId)) fail('supersede requires a valid replacementId')
    if (input.confirmed !== true) fail('supersede requires confirmed: true')
  } else if (input.replacementId !== undefined) {
    fail('replacementId is only valid for supersede')
  } else if (input.confirmed !== undefined) {
    fail('confirmed is only valid for supersede')
  }
  return input
}

// A superseded record needs an active replacement, so withdrawing the replacement also moves
// each record it superseded, one or, after a consolidation, several, and returns them. Only a
// user's withdrawal adds a retirement ID and acknowledges the supersession. A record returns to
// active only when none of its retirements is outstanding; otherwise it moves to withdrawn.
const withdrawGuidance = ({ memory, target, input, now, byUser }) => {
  if (!['candidate', 'active'].includes(target.status)) fail(`${input.action} requires a candidate or active target`)
  const transition = { reason: input.reason, source: input.source, now, operationId: input.operationId }
  const retirementId = byUser ? addRetirement(target) : undefined
  appendTransition({ guidance: target, to: 'withdrawn', ...transition })
  const superseded = memory.guidance.filter((guidance) => (
    guidance.status === 'superseded' && guidance.transitions.at(-1).replacementId === target.id
  ))
  for (const guidance of superseded) {
    if (byUser) acknowledgeOwnSupersession(guidance)
    const to = hasUnacknowledgedRetirement(retirementSetsOf(guidance)) ? 'withdrawn' : 'active'
    appendTransition({ guidance, to, ...transition })
  }
  return { superseded, retirementId }
}

const transitionGuidanceUnlocked = ({ paths, inputPath }) => {
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run init first')
  const input = validateTransitionInput(readJsonInput(inputPath))
  const statusBefore = new Map(memory.guidance.map(({ id, status }) => [id, status]))
  const target = memory.guidance.find(({ id }) => id === input.targetId)
  if (!target) fail('transition target does not exist')
  const now = new Date().toISOString()

  if (input.action === 'activate') {
    if (target.status !== 'candidate') fail('activate requires a candidate target')
    appendTransition({ guidance: target, to: 'active', reason: input.reason, source: input.source, now })
  }

  if (input.action === 'withdraw' || input.action === 'undo') {
    // A consolidation is undone as one journaled operation, so its declined set is recorded.
    if (target.consolidates) fail(`${input.action} cannot retire a consolidated replacement; run undo-operation --id ${target.transitions[0].operationId}`)
    withdrawGuidance({ memory, target, input, now, byUser: true })
  }

  if (input.action === 'supersede') {
    if (target.status !== 'active') fail('supersede requires an active target')
    const replacement = memory.guidance.find(({ id }) => id === input.replacementId)
    if (!replacement) fail('supersede replacement does not exist')
    if (replacement.id === target.id) fail('guidance cannot supersede itself')
    if (!['candidate', 'active'].includes(replacement.status)) fail('supersede replacement must be candidate or active')
    if (!sameScope(target.scope, replacement.scope) || target.subjectKey !== replacement.subjectKey) {
      fail('supersede replacement must use the same scope and subjectKey')
    }
    if (!replacement.relationship
      || !['refines', 'contradicts'].includes(replacement.relationship.kind)
      || replacement.relationship.targetId !== target.id) {
      fail('supersede replacement must be a linked refinement or contradiction')
    }
    if (replacement.status === 'candidate') {
      appendTransition({ guidance: replacement, to: 'active', reason: input.reason, source: input.source, now })
    }
    const retirementId = addRetirement(target)
    appendTransition({
      guidance: target,
      to: 'superseded',
      reason: input.reason,
      source: input.source,
      now,
      replacementId: replacement.id,
      retirementId,
    })
  }

  const nextMemory = { ...memory, revision: memory.revision + 1 }
  // Retirement and restore both change authority, so each record whose status changed is revoked.
  const changed = memory.guidance.filter(({ id, status }) => statusBefore.get(id) !== status)
  revokeConfirmations({ annotationsFile: paths.annotationsFile, fingerprints: changed.map(({ fingerprint }) => fingerprint) })
  writeMemoryViews({ paths, memory: nextMemory })
  return {
    outcome: input.action,
    targetId: target.id,
    status: target.status,
    ...(input.replacementId ? { replacementId: input.replacementId } : {}),
  }
}

const transitionGuidance = ({ paths, inputPath }) => (
  withMemoryLock({ paths, action: () => transitionGuidanceUnlocked({ paths, inputPath }) })
)

const deletionPreviewToken = ({ memory, targetId }) => (
  hashIdentity({
    prefix: 'delete-preview',
    values: [1, memory.revision, targetId, createHash('sha256').update(JSON.stringify(memory)).digest('hex')],
  })
)

const validateDeleteInput = (input) => {
  assertObject({ value: input, label: 'delete input' })
  assertClosedFields({
    value: input,
    fields: ['schemaVersion', 'targetId', 'apply', 'previewToken'],
    label: 'delete input',
  })
  if (input.schemaVersion !== 1) fail('delete schemaVersion must be 1')
  if (!guidanceIdPattern.test(input.targetId)) fail('delete targetId is invalid')
  if (input.apply !== undefined && typeof input.apply !== 'boolean') fail('delete apply must be boolean')
  if (input.previewToken !== undefined) {
    requireString({ value: input.previewToken, label: 'delete previewToken', maxBytes: 128, noWhitespace: true })
  }
  return input
}

const deleteGuidanceUnlocked = ({ paths, inputPath }) => {
  validate(paths)
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run init first')
  const input = validateDeleteInput(readJsonInput(inputPath))
  const target = memory.guidance.find(({ id }) => id === input.targetId)
  if (!target) fail('delete target does not exist')
  if (!['withdrawn', 'archived'].includes(target.status)) {
    fail('permanent deletion requires a withdrawn or archived target')
  }
  if (memory.guidance.some((guidance) => (
    guidance.relationship?.targetId === target.id
      || guidance.consolidates?.includes(target.id)
      || guidance.transitions.some(({ replacementId }) => replacementId === target.id)
  ))) {
    fail('permanent deletion target is referenced by another guidance record')
  }
  const remainingGuidance = memory.guidance.filter(({ id }) => id !== target.id)
  const referencedEvidence = new Set(remainingGuidance.flatMap(({ evidenceIds }) => evidenceIds))
  const removedEvidenceIds = target.evidenceIds.filter((id) => !referencedEvidence.has(id))
  const previewToken = deletionPreviewToken({ memory, targetId: target.id })
  if (input.apply !== true) {
    return {
      outcome: 'delete-preview',
      targetId: target.id,
      removedEvidenceIds,
      previewToken,
      applied: false,
    }
  }
  if (input.previewToken !== previewToken) fail('delete apply requires the current dry-run previewToken')
  if (target.scope.kind === 'shared') {
    revokeConfirmations({ annotationsFile: paths.annotationsFile, fingerprints: [target.fingerprint] })
  } else {
    // Project annotations never sync, and once the record is gone export would treat them as shared.
    const annotations = readAnnotations(paths.annotationsFile)
    delete annotations.records[target.fingerprint]
    writeAnnotations({ path: paths.annotationsFile, annotations })
  }
  const nextMemory = {
    ...memory,
    revision: memory.revision + 1,
    guidance: remainingGuidance,
    evidence: memory.evidence.filter(({ id }) => !removedEvidenceIds.includes(id)),
  }
  writeMemoryViews({ paths, memory: nextMemory })
  return {
    outcome: 'deleted',
    targetId: target.id,
    removedEvidenceIds,
    applied: true,
  }
}

const deleteGuidance = ({ paths, inputPath }) => (
  withMemoryLock({ paths, action: () => deleteGuidanceUnlocked({ paths, inputPath }) })
)

const retiredStatuses = new Set(['superseded', 'withdrawn', 'archived'])
const portableGuidanceFields = ['subjectKey', 'linkedSubjects', 'learning', 'confidence', 'generic', 'examples']

// Shared guidance travels between machines without evidence, repository identities, or
// relationships. Retired records travel as fingerprints with their retirement sets only, so
// their text stays local.
const exportSharedGuidanceUnlocked = ({ paths, outputPath, annotationsPath }) => {
  requireInitialized(paths)
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run init first')
  // Read and validate both outputs before either is written.
  const annotations = annotationsPath ? portableAnnotations({ paths, memory, annotationsPath }) : null
  const shared = memory.guidance.filter(({ scope }) => scope.kind === 'shared')
  // Union with the output file's sets. A machine that never had a record must not drop
  // another machine's retirements or acknowledgments of it.
  const entries = new Map()
  const addEntry = ({ fingerprint, retirements, acknowledged }) => {
    if (retirements.length === 0) return
    const current = entries.get(fingerprint) ?? { retirements: [], acknowledged: [] }
    entries.set(fingerprint, {
      fingerprint,
      retirements: sortedUnion(current.retirements, retirements),
      acknowledged: sortedUnion(current.acknowledged, acknowledged),
    })
  }
  if (existsSync(resolve(outputPath))) validatePortableSharedGuidance(readJsonInput(outputPath)).retired.forEach(addEntry)
  for (const guidance of shared) addEntry({ fingerprint: guidance.fingerprint, ...retirementSetsOf(guidance) })
  // A record that the merged sets retire is exported as its fingerprint only, so its text stays local.
  const active = shared
    .filter(({ status, fingerprint }) => status === 'active' && !hasUnacknowledgedRetirement(entries.get(fingerprint) ?? { retirements: [], acknowledged: [] }))
    .map(({ subjectKey, linkedSubjects, learning, confidence, generic, examples }) => ({
      subjectKey,
      linkedSubjects: linkedSubjects ?? [],
      learning,
      confidence,
      ...(generic === undefined ? {} : { generic }),
      examples: examples ?? [],
    }))
    .sort((left, right) => left.subjectKey.localeCompare(right.subjectKey) || left.learning.localeCompare(right.learning))
  const retired = [...entries.values()].sort((left, right) => left.fingerprint.localeCompare(right.fingerprint))
  writeTextAtomically({
    path: resolve(outputPath),
    content: `${JSON.stringify({ schemaVersion: 2, active, retired }, null, 2)}\n`,
  })
  if (annotations) writeAnnotations({ path: resolve(annotationsPath), annotations })
  return { active: active.length, retired: retired.length, ...(annotations ? { annotated: Object.keys(annotations.records).length } : {}) }
}

// The portable annotations file has the local format. It keeps every entry already in the file,
// so a machine never drops another machine's entries, and adds the local entries for every
// fingerprint that is not a local project record, as the shared guidance export does. A
// journaled project operation names project fingerprints too, including a replacement that a
// crash kept out of memory. A fingerprint hashes its scope, so none of them is shared.
const portableAnnotations = ({ paths, memory, annotationsPath }) => {
  const existing = existsSync(resolve(annotationsPath)) ? validateAnnotations(readJsonInput(annotationsPath)) : emptyAnnotations()
  const fingerprintsOf = (kind) => memory.guidance.filter(({ scope }) => scope.kind === kind).map(({ fingerprint }) => fingerprint)
  const { operations } = journalForDisplay(paths)
  const projectFingerprints = new Set([
    ...fingerprintsOf('project'),
    ...[...(operations?.values() ?? [])].filter(({ scope }) => scope === 'project')
      .flatMap(({ fingerprints, replacementFingerprint }) => [...fingerprints, ...(replacementFingerprint ? [replacementFingerprint] : [])]),
  ])
  // Without the journal, a fingerprint that memory does not hold may be project data, so only
  // records that memory shows are shared are exported. The rest, such as a revocation of a deleted
  // shared record, wait for an export after the journal is repaired; retirements still travel in
  // the guidance export.
  const sharedFingerprints = new Set(fingerprintsOf('shared'))
  const exported = operations ? (fingerprint) => !projectFingerprints.has(fingerprint) : (fingerprint) => sharedFingerprints.has(fingerprint)
  const local = readAnnotations(paths.annotationsFile)
  const records = Object.entries(local.records).filter(([fingerprint]) => exported(fingerprint))
  return mergeAnnotations(existing, { records: Object.fromEntries(records) })
}

// Returns the export in version 2 form. Version 1 listed retired fingerprints only, so each
// becomes its fingerprint's baseline retirement.
const validatePortableSharedGuidance = (input) => {
  assertObject({ value: input, label: 'shared guidance export' })
  assertClosedFields({ value: input, fields: ['schemaVersion', 'active', 'retired'], label: 'shared guidance export' })
  if (![1, 2].includes(input.schemaVersion)) fail(`unsupported shared guidance export version: ${input.schemaVersion}`)
  if (!Array.isArray(input.active) || !Array.isArray(input.retired)) fail('shared guidance export needs active and retired arrays')
  input.active.forEach((record) => {
    assertObject({ value: record, label: 'shared guidance' })
    assertClosedFields({ value: record, fields: portableGuidanceFields, label: 'shared guidance' })
  })
  const retired = input.schemaVersion === 1
    ? input.retired.map((fingerprint) => ({ fingerprint, retirements: [baselineRetirementId(fingerprint)], acknowledged: [] }))
    : input.retired
  for (const entry of retired) {
    assertObject({ value: entry, label: 'shared guidance retirement' })
    assertClosedFields({ value: entry, fields: ['fingerprint', 'retirements', 'acknowledged'], label: 'shared guidance retirement' })
    if (!fingerprintPattern.test(entry.fingerprint)) fail('shared guidance export has an invalid retired fingerprint')
    validateRetirementSets({ ...entry, label: 'shared guidance retirement' })
    if (entry.retirements.length === 0) fail('shared guidance retirement needs at least one retirement ID')
  }
  if (new Set(retired.map(({ fingerprint }) => fingerprint)).size !== retired.length) fail('shared guidance export repeats a retired fingerprint')
  return { ...input, retired }
}

// Copies each export retirement set onto the matching shared record. Returns whether any set grew.
const mergeRetirementSets = ({ entries, local }) => {
  let changed = false
  for (const entry of entries) {
    const guidance = local.get(entry.fingerprint)
    if (!guidance) continue
    const current = retirementSetsOf(guidance)
    const retirements = sortedUnion(current.retirements, entry.retirements)
    const acknowledged = sortedUnion(current.acknowledged, entry.acknowledged)
    if (retirements.length === current.retirements.length && acknowledged.length === current.acknowledged.length) continue
    setRetirementSets({ guidance, retirements, acknowledged })
    changed = true
  }
  return changed
}

// Adds each exported active record that is not retired, and promotes a matching local candidate.
const addActiveRecords = ({ memory, input, local, now, result }) => {
  const entries = new Map(input.retired.map((entry) => [entry.fingerprint, entry]))
  for (const record of input.active) {
    const scope = { kind: 'shared' }
    const fingerprint = fingerprintFor({ scope, subjectKey: record.subjectKey, learning: record.learning })
    const existing = local.get(fingerprint)
    const entry = entries.get(fingerprint)
    if (hasUnacknowledgedRetirement(existing ? retirementSetsOf(existing) : entry ?? { retirements: [], acknowledged: [] })) continue
    if (existing?.status === 'candidate') {
      appendTransition({ guidance: existing, to: 'active', reason: 'active-on-another-machine', source: 'shared-sync', now })
      result.promoted.push(existing.id)
    }
    if (existing) continue
    const guidance = {
      id: fingerprint.replace('fingerprint', 'guidance'),
      fingerprint,
      scope,
      ...record,
      status: 'active',
      evidenceIds: [],
      independentEvidenceCount: 0,
      transitions: [{ from: null, to: 'active', reason: 'imported-shared-guidance', source: 'shared-sync', at: now }],
      ...(entry ? { retirements: entry.retirements, acknowledged: entry.acknowledged } : {}),
      createdAt: now,
      updatedAt: now,
    }
    validateGuidanceRecord(guidance)
    memory.guidance.push(guidance)
    result.created.push(guidance.id)
  }
}

// Withdraws each candidate or active shared record that its sets retire, and restores each
// withdrawn shared record that its sets no longer retire.
const reconcileSharedStatus = ({ memory, now, result }) => {
  const input = { action: 'import', reason: 'retired-on-another-machine', source: 'shared-sync' }
  for (const guidance of memory.guidance.filter(({ scope }) => scope.kind === 'shared')) {
    const retired = hasUnacknowledgedRetirement(retirementSetsOf(guidance))
    if (!retired && guidance.status === 'withdrawn') {
      appendTransition({ guidance, to: 'active', reason: 'restored-on-another-machine', source: 'shared-sync', now })
      result.restored.push(guidance.id)
    }
    if (!retired || !['candidate', 'active'].includes(guidance.status)) continue
    const { superseded } = withdrawGuidance({ memory, target: guidance, input, now, byUser: false })
    result.retired.push(guidance.id)
    for (const each of superseded) result[each.status === 'active' ? 'restored' : 'retired'].push(each.id)
  }
}

// Merges exported shared guidance by fingerprint into shared-scope records only. A fingerprint
// is retired while any retirement ID is unacknowledged. Local candidates are promoted because
// another machine already activated them. Annotations merge as a union, which is how a
// confirmation made on another machine arrives. That trusts the portable file: confirmation
// guards against agent error, not against someone who can write the file.
const importSharedGuidanceUnlocked = ({ paths, inputPath, annotationsPath }) => {
  requireInitialized(paths)
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run init first')
  const input = validatePortableSharedGuidance(readJsonInput(inputPath))
  const incoming = annotationsPath ? validateAnnotations(readJsonInput(annotationsPath)) : null
  const now = new Date().toISOString()
  const result = { created: [], promoted: [], retired: [], restored: [] }
  const local = new Map(memory.guidance.filter(({ scope }) => scope.kind === 'shared').map((guidance) => [guidance.fingerprint, guidance]))
  const setsChanged = mergeRetirementSets({ entries: input.retired, local })
  addActiveRecords({ memory, input, local, now, result })
  reconcileSharedStatus({ memory, now, result })
  // Exported retirement IDs revoke too, even for a fingerprint without a local record, so the
  // result does not depend on which export arrives first.
  const annotations = mergeAnnotations(readAnnotations(paths.annotationsFile), incoming ?? emptyAnnotations())
  for (const { fingerprint, retirements } of input.retired) {
    const record = annotationRecordFor({ annotations, fingerprint })
    record.revocations = sortedUnion(record.revocations, retirements.map(retirementRevocationId))
  }
  if (Object.keys(annotations.records).length > 0) writeAnnotations({ path: paths.annotationsFile, annotations })
  if (setsChanged || Object.values(result).some((ids) => ids.length > 0)) {
    writeMemoryViews({ paths, memory: { ...memory, revision: memory.revision + 1 } })
  }
  return result
}

// Export reconciles under the lock first, so revocations it mints reach other machines.
const exportSharedGuidance = ({ paths, outputPath, annotationsPath }) => {
  requireInitialized(paths)
  return withMemoryLock({ paths, action: () => exportSharedGuidanceUnlocked({ paths, outputPath, annotationsPath }) })
}

const importSharedGuidance = ({ paths, inputPath, annotationsPath }) => (
  withMemoryLock({ paths, action: () => importSharedGuidanceUnlocked({ paths, inputPath, annotationsPath }) })
)

const fitWholeRecords = ({ records, maxRecords, maxBytes }) => {
  const included = []
  for (const record of records) {
    const nextBytes = byteLength(JSON.stringify([...included, record]))
    if (included.length >= maxRecords || nextBytes > maxBytes) continue
    included.push(record)
  }
  return {
    records: included,
    bytes: byteLength(JSON.stringify(included)),
    omittedCount: records.length - included.length,
  }
}

const retrievalRecord = ({ guidance, match, markers }) => ({
  id: guidance.id,
  scope: guidance.scope,
  subjectKey: guidance.subjectKey,
  linkedSubjects: guidance.linkedSubjects ?? [],
  learning: guidance.learning,
  status: guidance.status,
  examples: guidance.examples ?? [],
  updatedAt: guidance.updatedAt,
  match,
  // Confirmation renders only in hook lines, so the CLI never reports it.
  ...(markers.triggers.length > 0 ? { triggers: markers.triggers } : {}),
})

const retrievalStopwords = new Set([
  'and', 'are', 'but', 'capture', 'correction', 'corrections', 'durable', 'field',
  'for', 'from', 'guidance', 'guide', 'into', 'learning', 'memory', 'preference',
  'preferences', 'project', 'remember', 'repository', 'shared', 'that', 'the',
  'their', 'them', 'then', 'these', 'this', 'those', 'use', 'used', 'uses',
  'using', 'was', 'were', 'will', 'with', 'would', 'your',
  // Function words carry no topic, so they must not satisfy the overlap threshold.
  'about', 'after', 'again', 'all', 'also', 'another', 'any', 'before', 'being',
  'both', 'can', 'could', 'does', 'each', 'either', 'every', 'has', 'have', 'how',
  'its', 'just', 'may', 'more', 'most', 'not', 'only', 'other', 'our', 'out',
  'over', 'own', 'same', 'should', 'some', 'such', 'than', 'too', 'under', 'what',
  'when', 'where', 'whether', 'which', 'who', 'why', 'you',
])

const relevanceTerms = (value) => (
  new Set(
    normalizeLearning(value ?? '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length >= 3 && !retrievalStopwords.has(term)),
  )
)

const applicabilityScore = ({ guidance, query }) => {
  const requested = relevanceTerms(query)
  if (requested.size === 0) return 0
  const available = relevanceTerms([
    guidance.subjectKey,
    ...(guidance.linkedSubjects ?? []),
    guidance.learning,
    ...(guidance.examples ?? []).map(({ code }) => code),
  ].join(' '))
  const overlap = [...requested].filter((term) => available.has(term)).length
  const requiredOverlap = requested.size === 1 ? 1 : 2
  return overlap >= requiredOverlap ? overlap : 0
}

const retrieveEvidence = ({ memory, guidanceId }) => {
  if (!guidanceIdPattern.test(guidanceId)) fail('--evidence-for must be a valid guidance ID')
  const guidance = memory.guidance.find(({ id }) => id === guidanceId)
  if (!guidance) fail('evidence target does not exist')
  const records = guidance.evidenceIds
    .map((id) => memory.evidence.find((evidence) => evidence.id === id))
    .filter(Boolean)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
  const fitted = fitWholeRecords({ records, maxRecords: 2, maxBytes: 6144 })
  return {
    mode: 'evidence',
    guidanceId,
    evidence: fitted.records,
    bytes: fitted.bytes,
    omittedCount: fitted.omittedCount,
    limits: { maxRecords: 2, maxBytes: 6144 },
  }
}

// The shared records among records that retrieval hides because project guidance of the
// repository repeats their text, compared as normalized learnings.
const hiddenSharedRecords = ({ records, projectLearnings }) => {
  const repeated = new Set(projectLearnings.map(normalizeLearning))
  return records.filter(({ scope, learning }) => scope.kind === 'shared' && repeated.has(normalizeLearning(learning)))
}

/** Returns active guidance for the repository, without shared records that a project record repeats. */
const applicableGuidance = ({ memory, paths }) => {
  const relevantActive = memory.guidance.filter(({ status, scope }) => (
    status === 'active' && (scope.kind === 'shared' || scope.repositoryIdentity === paths.identity)
  ))
  const hidden = new Set(hiddenSharedRecords({
    records: relevantActive,
    projectLearnings: relevantActive.filter(({ scope }) => scope.kind === 'project').map(({ learning }) => learning),
  }))
  return relevantActive.filter((guidance) => !hidden.has(guidance))
}

// The confirmed live shared records that a project consolidation's replacement would hide from
// retrieval in its repository, by retrieval's own rule. isConfirmed decides confirmation.
const hiddenConfirmedIds = ({ memory, learning, isConfirmed }) => hiddenSharedRecords({
  records: memory.guidance.filter(({ status }) => ['candidate', 'active'].includes(status)),
  projectLearnings: [learning],
}).filter(isConfirmed).map(({ id }) => id)

const requireNothingHidden = ({ memory, learning, isConfirmed }) => {
  const [hidden] = hiddenConfirmedIds({ memory, learning, isConfirmed })
  if (hidden) fail(`the replacement would hide confirmed shared guidance ${shortId(hidden)}, which retrieval leaves out when a project record repeats its text`)
}

const rankGuidance = ({ applicable, subjectKey, query }) => {
  const linkedSubjects = [...new Set(
    applicable
      .filter(({ subjectKey: recordSubject }) => recordSubject === subjectKey)
      .flatMap((record) => record.linkedSubjects ?? []),
  )].sort()
  const ranked = []
  for (const guidance of applicable) {
    let rank
    let match
    let score = 0
    if (guidance.subjectKey === subjectKey) {
      rank = guidance.scope.kind === 'project' ? 0 : 1
      match = guidance.scope.kind === 'project' ? 'project-subject' : 'shared-subject'
    } else if (linkedSubjects.includes(guidance.subjectKey)) {
      rank = 2
      match = 'linked-subject'
    } else {
      score = applicabilityScore({ guidance, query })
      if (score === 0) continue
      rank = 3
      match = 'applicability'
    }
    ranked.push({ guidance, rank, match, score })
  }
  ranked.sort((left, right) => (
    left.rank - right.rank
      || right.score - left.score
      || (left.guidance.scope.kind === right.guidance.scope.kind
        ? 0
        : (left.guidance.scope.kind === 'project' ? -1 : 1))
      || right.guidance.updatedAt.localeCompare(left.guidance.updatedAt)
      || left.guidance.id.localeCompare(right.guidance.id)
  ))
  return { ranked, linkedSubjects }
}

const retrieveGuidance = ({ memory, paths, subjectKey, query, markersFor }) => {
  if (subjectKey !== undefined && (!portableKey.test(subjectKey) || byteLength(subjectKey) > 128)) {
    fail('--subject must be a portable subject key')
  }
  if (query !== undefined) requireString({ value: query, label: 'retrieval query', maxBytes: 1024 })
  if (subjectKey === undefined && query === undefined) fail('retrieve requires --subject or --query')
  const { ranked, linkedSubjects } = rankGuidance({
    applicable: applicableGuidance({ memory, paths }),
    subjectKey,
    query,
  })
  const records = ranked.map(({ guidance, match }) => retrievalRecord({ guidance, match, markers: markersFor(guidance) }))
  const fitted = fitWholeRecords({ records, maxRecords: 5, maxBytes: 6144 })
  const routingCandidates = linkedSubjects.map((linkedSubject) => ({ subjectKey: linkedSubject }))
  const routingFit = fitWholeRecords({ records: routingCandidates, maxRecords: 16, maxBytes: 1800 })
  const routing = {
    projectKey: paths.projectKey,
    subjectKey: subjectKey ?? null,
    linkedSubjects: routingFit.records.map(({ subjectKey: linkedSubject }) => linkedSubject),
    omittedLinkedSubjectCount: routingFit.omittedCount,
  }
  const routingBytes = byteLength(JSON.stringify(routing))
  if (routingBytes > 2048) fail('routing index exceeds 2048 UTF-8 bytes')
  return {
    mode: 'guidance',
    routing,
    routingBytes,
    guidance: fitted.records,
    bytes: fitted.bytes,
    omittedCount: fitted.omittedCount,
    limits: {
      routingMaxBytes: 2048,
      guidanceMaxRecords: 5,
      guidanceMaxBytes: 6144,
      normalEvidenceRecords: 0,
    },
  }
}

// Active guidance tagged with any of the event triggers: project records first, then shared, newest first.
const eventTagged = ({ applicable, annotations, events }) => applicable
  .filter((guidance) => annotationMarkers({ annotations, guidance }).triggers.some((trigger) => events.includes(trigger)))
  .sort((left, right) => (
    Number(left.scope.kind === 'shared') - Number(right.scope.kind === 'shared')
      || right.updatedAt.localeCompare(left.updatedAt)
      || left.id.localeCompare(right.id)
  ))

// Returns active guidance tagged with the event trigger within the normal retrieval budget.
const retrieveEvent = ({ memory, paths, event, annotations, markersFor }) => {
  requireTrigger(event)
  const tagged = eventTagged({ applicable: applicableGuidance({ memory, paths }), annotations, events: [event] })
  const records = tagged.map((guidance) => retrievalRecord({ guidance, match: 'event', markers: markersFor(guidance) }))
  const fitted = fitWholeRecords({ records, maxRecords: 5, maxBytes: 6144 })
  return {
    mode: 'event',
    event,
    guidance: fitted.records,
    bytes: fitted.bytes,
    omittedCount: fitted.omittedCount,
    limits: { maxRecords: 5, maxBytes: 6144 },
  }
}

const retrieve = ({ paths, subjectKey, query, evidenceFor, event, mainThread }) => {
  const memory = readMemory(paths) ?? emptyMemory()
  if (evidenceFor && (subjectKey !== undefined || query !== undefined)) {
    fail('--evidence-for cannot be combined with --subject or --query')
  }
  if (event !== undefined && (evidenceFor || subjectKey !== undefined || query !== undefined)) {
    fail('--event cannot be combined with --subject, --query, or --evidence-for')
  }
  if (evidenceFor) return retrieveEvidence({ memory, guidanceId: evidenceFor })
  const annotations = readAnnotationsForDisplay(paths.annotationsFile)
  const markersFor = (guidance) => displayMarkers({ annotations, guidance, mainThread })
  return event === undefined
    ? retrieveGuidance({ memory, paths, subjectKey, query, markersFor })
    : retrieveEvent({ memory, paths, event, annotations, markersFor })
}

const markerWords = new Set(['confirmed', ...annotationTriggers])

const markerWordPattern = new RegExp(`\\[(${[...markerWords].join('|')})\\]`, 'giu')

/**
 * Renders one guidance line. Markers come only from annotations, before the subject. A subject
 * named like a marker, a marker word anywhere in the learning, and a learning that starts with
 * "[" get a backslash, so stored text never reads as a marker.
 */
const injectionLine = ({ guidance, markers }) => {
  const prefix = [...(markers.confirmed ? ['confirmed'] : []), ...markers.triggers].map((marker) => `[${marker}] `).join('')
  const subject = `${markerWords.has(guidance.subjectKey) ? '\\' : ''}[${guidance.subjectKey}]`
  const learning = guidance.learning.replace(/[\u0085\u2028\u2029]/gu, ' ').replace(markerWordPattern, '\\[$1]').replace(/^\s*\[/u, '\\[')
  return `- ${prefix}${subject} ${learning}`
}

const readInjectionMemory = ({ repoRoot, guideRoot, mainThread }) => {
  // Hooks run on every session; skip Git work when no guide exists.
  if (!existsSync(join(guideRootFor(guideRoot), 'memory.md'))) return null
  const paths = resolvePaths({ repoRoot, guideRoot })
  const memory = readMemory(paths)
  if (!memory) return null
  // After an older plugin wrote memory, no confirmation counts until a current write reconciles.
  // Reconcile writes annotations before the watermark, so reading the watermark first never pairs
  // a reconciled watermark with annotations from before the reconcile.
  const current = watermarkCurrent({ paths, memory })
  const annotations = readAnnotationsForDisplay(paths.annotationsFile)
  const lineFor = (guidance) => {
    const markers = displayMarkers({ annotations, guidance, mainThread })
    return injectionLine({ guidance, markers: { ...markers, confirmed: markers.confirmed && current } })
  }
  return { paths, annotations, applicable: applicableGuidance({ memory, paths }), lineFor }
}

// Fits whole lines after the header and reports which records they show. Returns null when none fits.
const fittedInjection = ({ paths, header, candidates, lineFor, maxRecords, maxBytes }) => {
  const fittedLines = fitWholeRecords({ records: candidates.map(lineFor), maxRecords, maxBytes: maxBytes - byteLength(header) })
  if (fittedLines.records.length === 0) return null
  const injected = candidates.filter((guidance) => fittedLines.records.includes(lineFor(guidance)))
  return {
    projectKey: paths.projectKey,
    guidanceIds: injected.map(({ id }) => id),
    sharedIds: injected.filter(({ scope }) => scope.kind === 'shared').map(({ id }) => id),
    text: [header, ...fittedLines.records].join('\n'),
  }
}

/**
 * Selects session-start context: this repository's newest project guidance, then
 * the active shared records named by restoreIds (those a session received before
 * compaction) in the room left, and an index of the other applicable subjects.
 * Returns null when nothing applies. Lines carry annotation markers only when
 * mainThread is true.
 */
export const sessionStartInjection = ({ repoRoot, guideRoot, mainThread = false, restoreIds = [] }) => {
  const loaded = readInjectionMemory({ repoRoot, guideRoot, mainThread })
  if (!loaded) return null
  const { paths, applicable, lineFor } = loaded
  const newestFirst = (left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id)
  const project = applicable.filter(({ scope }) => scope.kind === 'project').sort(newestFirst)
  // Retired records are not applicable, so a restored record has its current text and status.
  const restored = applicable.filter(({ scope, id }) => scope.kind === 'shared' && restoreIds.includes(id)).sort(newestFirst)
  // JSON-array bytes are an upper bound for the rendered lines, so fitting to the
  // budget minus the framing text keeps each rendered section within budget.
  const projectHeader = restored.length > 0
    ? 'Field Guide: stored user guidance for this repository, and shared guidance this session received before compaction. Follow it when it applies.'
    : 'Field Guide: stored user guidance for this repository. Follow it when it applies.'
  const candidates = [...project, ...restored]
  const fittedLines = fitWholeRecords({
    records: candidates.map(lineFor),
    maxRecords: 8,
    maxBytes: 1536 - byteLength(projectHeader),
  })
  const injected = candidates.filter((guidance) => fittedLines.records.includes(lineFor(guidance)))
  const injectedIds = injected.map(({ id }) => id)
  const otherSubjects = [...new Set(
    applicable.filter(({ id }) => !injectedIds.includes(id)).map(({ subjectKey }) => subjectKey),
  )].sort()
  if (injected.length === 0 && otherSubjects.length === 0) return null
  const indexPrefix = 'Other stored Field Guide subjects: '
  const indexSuffix = '. Retrieve one with $field-guide:field-guide when the task touches it.'
  const moreText = (count) => (count > 0 ? ` and ${count} more` : '')
  const fittedSubjects = fitWholeRecords({
    records: otherSubjects,
    maxRecords: 64,
    maxBytes: 1024 - byteLength(`${indexPrefix}${moreText(otherSubjects.length)}${indexSuffix}`),
  })

  const sections = []
  if (injected.length > 0) sections.push([projectHeader, ...fittedLines.records].join('\n'))
  if (otherSubjects.length > 0) {
    sections.push(`${indexPrefix}${fittedSubjects.records.join(', ')}${moreText(fittedSubjects.omittedCount)}${indexSuffix}`)
  }
  return { projectKey: paths.projectKey, guidanceIds: injectedIds, text: sections.join('\n\n') }
}

/**
 * Selects up to three applicable records that match the user's prompt and were
 * not already injected. Returns null when nothing new matches. Lines carry
 * annotation markers only when mainThread is true.
 */
export const promptInjection = ({ repoRoot, guideRoot, prompt, excludeIds, mainThread = false }) => {
  // Match on the prompt's distinct terms: the whole prompt counts, but a long
  // paste costs no more than its vocabulary.
  const query = [...relevanceTerms(prompt)].join(' ')
  if (query.length === 0) return null
  const loaded = readInjectionMemory({ repoRoot, guideRoot, mainThread })
  if (!loaded) return null
  const { paths, applicable, lineFor } = loaded
  const candidates = rankGuidance({ applicable, query }).ranked
    .map(({ guidance }) => guidance)
    .filter(({ id }) => !excludeIds.includes(id))
  const header = 'Field Guide: stored user guidance that may apply to this request. Follow it when it applies.'
  return fittedInjection({ paths, header, candidates, lineFor, maxRecords: 3, maxBytes: 2048 })
}

/**
 * Selects up to three active records tagged with any of the event triggers,
 * project records first, within 1.5 KB. queuedMerge adds that an `--auto`
 * merge may only be queued. Returns null when no trigger is known or nothing
 * is tagged. Lines carry annotation markers only when mainThread is true.
 */
export const eventInjection = ({ repoRoot, guideRoot, events, queuedMerge = false, mainThread = false }) => {
  const known = events.filter((event) => annotationTriggers.includes(event))
  if (known.length === 0) return null
  const loaded = readInjectionMemory({ repoRoot, guideRoot, mainThread })
  if (!loaded) return null
  const { paths, annotations, applicable, lineFor } = loaded
  const tagged = eventTagged({ applicable, annotations, events: known })
  const queued = queuedMerge ? ' The merge used --auto, so it may only be queued: confirm the PR merged before acting on this guidance.' : ''
  const header = `Field Guide: stored user guidance tagged ${known.map((event) => `[${event}]`).join(' or ')}. Follow it when it applies.${queued}`
  return fittedInjection({ paths, header, candidates: tagged, lineFor, maxRecords: 3, maxBytes: 1536 })
}

const candidateMatches = ({ paths, subjectKey, scope: scopeKind }) => {
  if (!portableKey.test(subjectKey ?? '') || byteLength(subjectKey) > 128) {
    fail('--subject must be a portable subject key')
  }
  if (!['project', 'shared'].includes(scopeKind)) fail('--scope must be project or shared')
  const memory = readMemory(paths) ?? emptyMemory()
  const records = memory.guidance
    .filter((guidance) => (
      ['candidate', 'active'].includes(guidance.status)
        && guidance.subjectKey === subjectKey
        && guidance.scope.kind === scopeKind
        && (scopeKind === 'shared' || guidance.scope.repositoryIdentity === paths.identity)
    ))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((guidance) => ({
      id: guidance.id,
      status: guidance.status,
      scope: guidance.scope,
      subjectKey: guidance.subjectKey,
      learning: guidance.learning,
      examples: guidance.examples ?? [],
      ...(guidance.relationship ? { relationship: guidance.relationship } : {}),
    }))
  const fitted = fitWholeRecords({ records, maxRecords: 10, maxBytes: 6144 })
  return {
    mode: 'candidates',
    candidates: fitted.records,
    bytes: fitted.bytes,
    omittedCount: fitted.omittedCount,
    limits: { maxRecords: 10, maxBytes: 6144 },
  }
}

const pointerProblem = ({ pointer, paths }) => {
  if (pointer.kind === 'commit' && pointer.repositoryIdentity === paths.identity) {
    const resolved = git({
      repoRoot: paths.repositoryRoot,
      args: ['rev-parse', '--verify', `${pointer.commit}^{commit}`],
      optional: true,
    })
    if (resolved !== pointer.commit) return 'unknown-commit'
  }
  if (pointer.kind === 'local-artifact' && pointer.repositoryIdentity === paths.identity) {
    const artifactPath = resolve(paths.repositoryRoot, pointer.path)
    if (!existsSync(artifactPath)) return 'missing-local-artifact'
    let digest
    try {
      digest = `sha256:${createHash('sha256').update(readFileSync(artifactPath)).digest('hex')}`
    } catch {
      return 'unreadable-local-artifact'
    }
    if (digest !== pointer.contentDigest) return 'local-artifact-digest-mismatch'
  }
  return null
}

const isString = (value) => typeof value === 'string'
const isStringArray = (value) => Array.isArray(value) && value.every(isString)
// A pattern's test() converts its argument to a string, so an array holding an ID would pass it.
const isGuidanceId = (value) => isString(value) && guidanceIdPattern.test(value)

// The fields of a pending entry that the read-only readers use, with their checks. An optional
// field is checked only when present.
const pendingEntryFields = {
  required: { action: isString, scope: (value) => value === 'project' || value === 'shared', fingerprints: isStringArray },
  optional: { replacementFingerprint: isString, revocationIds: isStringArray, declined: isStringArray },
}

// Fails on an entry whose fields the read-only readers could misread. A nightly run's entries
// must have exactly the shape dream apply writes.
const requireReadableJournalEntry = ({ entry, index }) => {
  const problem = (text) => fail(`operations.jsonl entry ${index + 1} ${text}`)
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) problem('is not an object')
  if (entry.type === 'run' || entry.type === 'run-intent') {
    const invalid = runEntryProblems(entry)
    if (invalid.length > 0) problem(`has an invalid ${invalid.join(', ')}`)
    return
  }
  if (!['pending', 'commit', 'abort'].includes(entry.type)) problem('has an unknown type')
  if (!isString(entry.operationId) || !operationIdPattern.test(entry.operationId)) problem('has an invalid operationId')
  if (entry.type !== 'pending') return
  const invalid = [
    ...Object.entries(pendingEntryFields.required).filter(([field, valid]) => !valid(entry[field])),
    ...Object.entries(pendingEntryFields.optional).filter(([field, valid]) => entry[field] !== undefined && !valid(entry[field])),
  ].map(([field]) => field)
  if (invalid.length > 0) problem(`has an invalid ${invalid.join(', ')}`)
}

// The journal's entries and operations for a read-only report, or null for both and the error
// when it cannot be read or holds an entry whose fields those reports could misread. consolidate
// and undo-operation fail on a line that is not JSON; the nightly plan reports either error,
// dream apply refuses, and the annotation export falls back to records that memory shows are shared.
const journalForDisplay = (paths) => {
  try {
    const journal = readJournal(paths)
    journal.forEach((entry, index) => requireReadableJournalEntry({ entry, index }))
    return { journal, operations: operationsIn(journal) }
  } catch (error) {
    return { journal: null, operations: null, error: error.message }
  }
}

// Overlapping live records of each subject, for review. A journal that cannot be read hides no
// group: declined groups are listed again, and nothing is applied from an audit.
const duplicateGroups = ({ paths, memory }) => {
  const { operations } = journalForDisplay(paths)
  const declined = operations ? declinedSets(operations) : new Set()
  const subjects = subjectStates({ memory, annotations: readAnnotationsForDisplay(paths.annotationsFile) })
  return [...subjects.values()].flatMap(({ scope, subjectKey, records }) => (
    overlapGroups({ records: records.map(({ guidance }) => guidance), declined }).map((ids) => ({ scope: scope.kind, subjectKey, ids }))
  ))
}

export const audit = (paths) => {
  let validationErrors
  try {
    validationErrors = validationErrorsFor(paths)
  } catch (error) {
    validationErrors = [error.message]
  }
  let memory
  try {
    memory = readMemory(paths) ?? emptyMemory()
  } catch (error) {
    return {
      mode: 'audit',
      validationErrors: [...validationErrors, error.message],
      staleCandidates: [],
      unresolvedRelationships: [],
      brokenPointers: [],
      duplicateCandidates: [],
      orphanEvidence: [],
      oversizedRecords: [],
      recommendations: ['Repair malformed canonical state before other maintenance.'],
    }
  }
  const staleCandidates = memory.guidance
    .filter((guidance) => guidance.status === 'candidate')
    .filter((guidance) => (
      (guidance.scope.kind === 'project' && evidenceCountFor({ guidance, memory }) >= 2)
        || (guidance.scope.kind === 'shared'
          && guidance.generic === true
          && repositoryCountFor({ guidance, memory }) >= 2)
    ))
    .map(({ id }) => id)
  const unresolvedRelationships = memory.guidance
    .filter((guidance) => (
      guidance.status === 'candidate'
        && ['refines', 'contradicts'].includes(guidance.relationship?.kind)
    ))
    .map(({ id, relationship }) => ({ id, ...relationship }))
  const brokenPointers = memory.evidence.flatMap((evidence) => (
    evidence.pointers.flatMap((pointer, pointerIndex) => {
      const problem = pointerProblem({ pointer, paths })
      return problem ? [{ evidenceId: evidence.id, pointerIndex, problem }] : []
    })
  ))
  const duplicateCandidates = duplicateGroups({ paths, memory })
  const referencedEvidence = new Set(memory.guidance.flatMap(({ evidenceIds }) => evidenceIds))
  const orphanEvidence = memory.evidence
    .filter(({ id }) => !referencedEvidence.has(id))
    .map(({ id }) => id)
  const oversizedRecords = [
    ...memory.guidance
      .filter((record) => byteLength(JSON.stringify(record)) > 6144)
      .map(({ id }) => ({ kind: 'guidance', id })),
    ...memory.evidence
      .filter((record) => byteLength(JSON.stringify(record)) > 6144)
      .map(({ id }) => ({ kind: 'evidence', id })),
  ]
  const recommendations = []
  if (validationErrors.length > 0) recommendations.push('Repair index or cache validation errors.')
  if (staleCandidates.length > 0) recommendations.push('Review candidates that already meet promotion evidence thresholds.')
  if (unresolvedRelationships.length > 0) recommendations.push('Confirm or reject unresolved refinements and contradictions.')
  if (brokenPointers.length > 0) recommendations.push('Review broken local or commit pointers. Do not fetch stored URLs automatically.')
  if (orphanEvidence.length > 0) recommendations.push('Remove orphan evidence only through an approved maintenance apply.')
  if (oversizedRecords.length > 0) recommendations.push('Reduce oversized records without truncating them during retrieval.')
  if (duplicateCandidates.length > 0) recommendations.push('Review overlapping guidance; consolidate a group only through the consolidate preview-and-apply flow.')
  return {
    mode: 'audit',
    validationErrors,
    staleCandidates,
    unresolvedRelationships,
    brokenPointers,
    duplicateCandidates,
    orphanEvidence,
    oversizedRecords,
    recommendations,
  }
}

const validateMaintenanceInput = (input) => {
  assertObject({ value: input, label: 'maintenance input' })
  assertClosedFields({
    value: input,
    fields: ['schemaVersion', 'action', 'targetIds', 'reason', 'apply', 'previewToken'],
    label: 'maintenance input',
  })
  if (input.schemaVersion !== 1) fail('maintenance schemaVersion must be 1')
  if (!['archive', 'repair-cache'].includes(input.action)) fail('maintenance action must be archive or repair-cache')
  if (input.action === 'archive') {
    if (!Array.isArray(input.targetIds)
      || input.targetIds.length === 0
      || new Set(input.targetIds).size !== input.targetIds.length
      || input.targetIds.some((id) => !guidanceIdPattern.test(id))) {
      fail('archive targetIds must be a non-empty unique guidance ID array')
    }
  } else if (input.targetIds !== undefined) {
    fail('repair-cache must not include targetIds')
  }
  requireString({ value: input.reason, label: 'maintenance reason', maxBytes: 512 })
  assertSafePersistedText({ value: input.reason, label: 'maintenance reason' })
  if (input.apply !== undefined && typeof input.apply !== 'boolean') fail('maintenance apply must be boolean')
  if (input.previewToken !== undefined) {
    requireString({ value: input.previewToken, label: 'maintenance previewToken', maxBytes: 128, noWhitespace: true })
  }
  return input
}

const maintenancePreviewToken = ({ memory, input }) => (
  hashIdentity({
    prefix: 'maintenance-preview',
    values: [1, input.action, input.targetIds ?? [], input.reason, createHash('sha256').update(JSON.stringify(memory)).digest('hex')],
  })
)

const repairCache = ({ paths, input }) => {
  const memory = readMarkdownMemory(paths)
  if (!memory) fail('repair-cache requires a valid canonical memory.md record')
  const cacheBytes = existsSync(paths.memoryFile) ? readFileSync(paths.memoryFile, 'utf8') : null
  let cacheState = 'missing'
  if (cacheBytes !== null) {
    try {
      cacheState = JSON.stringify(readJsonMemory(paths)) === JSON.stringify(memory) ? 'current' : 'stale'
    } catch {
      cacheState = 'invalid'
    }
  }
  const previewToken = hashIdentity({
    prefix: 'maintenance-preview',
    values: [1, input.action, input.reason, memory, cacheBytes],
  })
  if (input.apply !== true) {
    return {
      outcome: 'maintenance-preview',
      action: input.action,
      cacheState,
      previewToken,
      applied: false,
    }
  }
  if (input.previewToken !== previewToken) fail('maintenance apply requires the current dry-run previewToken')
  writeMemoryAtomically({ paths, memory })
  return {
    outcome: cacheState === 'current' ? 'maintenance-no-change' : 'maintained',
    action: input.action,
    cacheState,
    applied: true,
  }
}

// Applies a change to a copy of memory and validates the result as the store write would, so an
// invalid change fails before any preview, proposal, journal entry, or annotation write.
const requireValidChange = ({ memory, change, label }) => {
  const trial = structuredClone(memory)
  change(trial)
  try {
    validateMemory({ ...trial, schemaVersion: schemaVersionFor(trial) })
  } catch (error) {
    fail(`the ${label} result would be invalid: ${error.message}`)
  }
}

// Archives one record. A shared record gets a retirement ID, so the archive reaches other machines.
const archiveRecord = ({ guidance, reason, source, now, operationId }) => {
  addRetirement(guidance)
  appendTransition({ guidance, to: 'archived', reason, source, now, operationId })
}

const maintainUnlocked = ({ paths, inputPath }) => {
  const input = validateMaintenanceInput(readJsonInput(inputPath))
  if (input.action === 'repair-cache') return repairCache({ paths, input })
  validate(paths)
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run init first')
  const targets = input.targetIds.map((id) => {
    const target = memory.guidance.find((guidance) => guidance.id === id)
    if (!target) fail(`maintenance target does not exist: ${id}`)
    if (!['candidate', 'active', 'superseded', 'withdrawn'].includes(target.status)) {
      fail(`archive requires a non-archived target: ${id}`)
    }
    return target
  })
  const now = new Date().toISOString()
  const archive = (store) => input.targetIds.forEach((id) => (
    archiveRecord({ guidance: store.guidance.find((guidance) => guidance.id === id), reason: input.reason, source: 'maintenance', now })
  ))
  requireValidChange({ memory, change: archive, label: 'archived' })
  const previewToken = maintenancePreviewToken({ memory, input })
  if (input.apply !== true) {
    return {
      outcome: 'maintenance-preview',
      action: input.action,
      targetIds: input.targetIds,
      previewToken,
      applied: false,
    }
  }
  if (input.previewToken !== previewToken) fail('maintenance apply requires the current dry-run previewToken')
  archive(memory)
  const nextMemory = { ...memory, revision: memory.revision + 1 }
  revokeConfirmations({ annotationsFile: paths.annotationsFile, fingerprints: targets.map(({ fingerprint }) => fingerprint) })
  writeMemoryViews({ paths, memory: nextMemory })
  return {
    outcome: 'maintained',
    action: input.action,
    targetIds: input.targetIds,
    applied: true,
  }
}

const maintain = ({ paths, inputPath }) => (
  withMemoryLock({ paths, action: () => maintainUnlocked({ paths, inputPath }) })
)

// Reversible operations. consolidate, an automated archive, and undo-operation each run as one
// operation in the write-ahead journal operations.jsonl: a pending entry, then the store change,
// then a commit entry. Each transition an operation makes carries its operation ID, so recovery
// tells a change that reached memory from one that did not by that ID, whatever other writers
// did in between. The journal holds IDs, fingerprints, revisions, and a sanitized reason, never
// guidance text. It stays local, never syncs, and no hook reads it.
const maxConsolidationTargets = 8
const undoWindowDays = 90
const proposalLifetimeDays = 14
const dayMs = 24 * 60 * 60 * 1000

const newOperationId = () => `operation:v1:${randomBytes(32).toString('hex')}`
const contentDigest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const shortId = (id) => id.replace(/^[a-z]+:v1:/u, '').slice(0, 12)

const readJournal = (paths) => {
  if (!existsSync(paths.operationsFile)) return []
  // A crash during an append can leave an unterminated last line; it never took effect.
  const lines = readFileSync(paths.operationsFile, 'utf8').split('\n').slice(0, -1)
  return lines.flatMap((line, index) => {
    if (line.length === 0) return []
    try {
      return [JSON.parse(line)]
    } catch {
      fail(`operations.jsonl line ${index + 1} is not valid JSON`)
    }
  })
}

const appendJournal = ({ paths, entries }) => {
  if (entries.length === 0) return
  const lines = entries.map((entry) => `${JSON.stringify(entry)}\n`).join('')
  const existing = existsSync(paths.operationsFile) ? readFileSync(paths.operationsFile, 'utf8') : ''
  if (existing.endsWith('\n') || existing.length === 0) {
    appendFileSync(paths.operationsFile, lines)
    return
  }
  writeTextAtomically({ path: paths.operationsFile, content: `${existing.slice(0, existing.lastIndexOf('\n') + 1)}${lines}` })
}

// Each operation's pending entry, with its state: pending, committed, or aborted.
const operationsIn = (journal) => {
  const operations = new Map()
  for (const entry of journal) {
    if (entry.type === 'pending') operations.set(entry.operationId, { ...entry, state: 'pending' })
    const operation = operations.get(entry.operationId)
    if (operation && entry.type === 'commit') operation.state = 'committed'
    if (operation && entry.type === 'abort') operation.state = 'aborted'
  }
  return operations
}

const operationLanded = ({ memory, operationId }) => memory.guidance.some(({ transitions }) => (
  transitions.some((transition) => transition.operationId === operationId)
))

// A consolidation annotates its replacement before the memory write: an approval confirms it, and
// it takes its targets' triggers. When the operation aborts, acknowledge exactly those trigger
// entries, even when a later capture put the same text in memory, so that capture inherits none;
// a trigger the user added under another ID stays. Only entries that reached annotations are
// acknowledged; a crash can stop before that write. While the record is absent, also revoke its
// confirmation. A capture already revoked it, and a later confirmation is the user's own.
const cancelUnlandedReplacement = ({ paths, memory, replacementFingerprint, triggerIds = [] }) => {
  if (!replacementFingerprint) return
  const annotations = readAnnotations(paths.annotationsFile)
  const record = annotationRecordFor({ annotations, fingerprint: replacementFingerprint })
  if (!memory.guidance.some(({ fingerprint }) => fingerprint === replacementFingerprint)) revokeRecord(record)
  acknowledgeEntries({ record, entries: record.triggers.filter(({ id }) => triggerIds.includes(id)) })
  writeAnnotations({ path: paths.annotationsFile, annotations })
}

// Commits each pending operation whose transitions reached memory and aborts the rest. Returns
// the journal with the entries it added.
const recoverOperations = ({ paths, memory }) => {
  const journal = readJournal(paths)
  const at = new Date().toISOString()
  const entries = []
  for (const { operationId, state, replacementFingerprint, triggerIds } of operationsIn(journal).values()) {
    if (state !== 'pending') continue
    if (operationLanded({ memory, operationId })) {
      entries.push({ type: 'commit', operationId, at, revision: memory.revision, recovered: true })
      continue
    }
    entries.push({ type: 'abort', operationId, at, revision: memory.revision })
    cancelUnlandedReplacement({ paths, memory, replacementFingerprint, triggerIds })
  }
  // A crash after the canonical write can leave memory.json behind it. The memory lock already
  // reconciled the watermark, so only the cache is rebuilt, the way repair-cache does it.
  if (entries.some(({ type }) => type === 'commit')) writeMemoryAtomically({ paths, memory })
  appendJournal({ paths, entries })
  return [...journal, ...entries]
}

// The predecessor sets of undone consolidations. They are not proposed again.
// Revocations journaled by operations that never reached memory: aborted, or pending and not landed.
const unlandedRevocations = ({ operations, memory }) => [...operations.values()]
  .filter(({ state, operationId }) => state === 'aborted' || (state === 'pending' && !operationLanded({ memory, operationId })))
  .flatMap(({ revocationIds }) => revocationIds ?? [])

const declinedSets = (operations) => new Set([...operations.values()]
  .filter(({ action, state, declined }) => action === 'undo-operation' && state === 'committed' && declined)
  .map(({ declined }) => declined.join(',')))

const requireNotDeclined = ({ declined, fingerprints }) => {
  if (declined.has([...fingerprints].sort().join(','))) fail('the user declined that consolidation by undoing it; it is not proposed again')
}

const pendingEntry = ({ memory, operationId, action, scope, subjectKey, fingerprints, reason, now, fields }) => ({
  type: 'pending',
  operationId,
  action,
  at: now,
  revision: memory.revision,
  scope: scope.kind,
  subjectKey,
  fingerprints: [...fingerprints].sort(),
  reason,
  ...fields,
})

// The pending entry of a new consolidation or archive, checked as the journal readers check it,
// with every string under the new-text guard, including the subject key it copies from memory.
// undo-operation copies the fields of an entry already journaled, so it builds its own.
const newPendingEntry = (fields) => {
  const entry = pendingEntry(fields)
  requireReadableJournalEntry({ entry, index: 0 })
  assertSafeNewValue({ value: entry, label: 'pending entry' })
  return entry
}

// Journals each operation, writes annotations, then writes memory once, then commits. A crash
// before the memory write leaves pending entries that recovery aborts; a crash after it leaves
// entries that recovery commits.
const commitOperations = ({ paths, memory, annotations, entries }) => {
  appendJournal({ paths, entries })
  writeAnnotations({ path: paths.annotationsFile, annotations })
  const revision = memory.revision + 1
  writeMemoryViews({ paths, memory: { ...memory, revision } })
  const at = new Date().toISOString()
  appendJournal({ paths, entries: entries.map(({ operationId }) => ({ type: 'commit', operationId, at, revision })) })
}

const findOperation = ({ operations, reference }) => {
  const hex = reference.match(/^(?:operation:v1:)?([0-9a-f]{8,64})$/u)?.[1]
  if (!hex) fail('use a full operation ID or a hex prefix of at least 8 characters')
  const matches = [...operations.values()].filter(({ operationId }) => operationId.startsWith(`operation:v1:${hex}`))
  if (matches.length !== 1) fail(matches.length === 0 ? 'no journaled operation matches that ID' : 'that prefix matches more than one operation')
  return matches[0]
}

// Memory version 2 is written only when every plugin copy installed on this machine reads it,
// because Claude Code and Codex keep separate copies over one store. A copy that ships the
// version 2 schema reads it, whatever its version label says.
const v2ReaderFile = join('skills', 'field-guide', 'schemas', 'memory-v2.schema.json')
// Likewise, nightly run entries are journaled only when every copy reads them: an older copy
// rejects the whole journal. A copy that reads run entries also reads memory version 2.
const dreamRunReaderFile = join('skills', 'field-guide', 'schemas', 'dream-apply-v1.schema.json')
const directoriesIn = (path) => (existsSync(path)
  ? readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map(({ name }) => name)
  : [])

// The table header line that the Codex plugin installer writes for each installed plugin.
const codexPluginHeader = /^\[plugins\."([^"@\\]+)@([^"@\\]+)"\]$/u
// The table header line where Codex records that the user trusted one of a plugin's hooks.
const codexHookStateHeader = /^\[hooks\.state\."[^"@\\]+@[^"@\\:]+:hooks\/hooks\.json:[a-z_]+:\d+:\d+"\]$/u
// A TOML escape can spell a plugin name without its plain text.
const tomlUnicodeEscape = /\\(?:u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|x[0-9A-Fa-f]{2})/u

// Codex writes `<plugin>@` only in the two header lines above. Any other line that holds it, such
// as an inline key, a subtable, other quoting, or a comment, may name a copy this check cannot
// locate, so the copy is unknown. A comment is refused too, because the check reads no TOML.
const unknownCodexEntries = ({ lines, plugin }) => {
  if (plugin === undefined) return []
  const unknown = (problem) => ({ host: 'Codex', plugin, path: null, problem })
  const unread = lines.filter((line) => line.includes(`${plugin}@`) && !codexPluginHeader.test(line) && !codexHookStateHeader.test(line))
  return [
    ...unread.map(() => unknown('config.toml names it in a form this check does not read')),
    ...(lines.some((line) => tomlUnicodeEscape.test(line)) ? [unknown('config.toml holds an escape that can spell its name')] : []),
  ]
}

// Codex keeps a plugin at plugins/cache/<marketplace>/<plugin>/<version> and loads its newest
// version; an older version directory is a leftover. config.toml names the installed plugins, so
// only their marketplaces count; without such an entry, every cached marketplace does.
const codexCopies = ({ codexRoot, plugin }) => {
  const configFile = join(codexRoot, 'config.toml')
  const cache = join(codexRoot, 'plugins', 'cache')
  const wanted = (name) => plugin === undefined || name === plugin
  const lines = existsSync(configFile) ? readFileSync(configFile, 'utf8').split(/\r?\n/u) : []
  const named = lines.flatMap((line) => {
    const [, name, marketplace] = line.match(codexPluginHeader) ?? []
    return name && wanted(name) ? [{ name, marketplace }] : []
  })
  const cached = directoriesIn(cache).flatMap((marketplace) => directoriesIn(join(cache, marketplace)).filter(wanted).map((name) => ({ name, marketplace })))
  const located = (named.length > 0 ? named : cached).flatMap(({ name, marketplace }) => {
    const versions = join(cache, marketplace, name)
    const newest = directoriesIn(versions).filter((version) => !version.startsWith('.')).sort((left, right) => left.localeCompare(right, 'en', { numeric: true })).at(-1)
    return newest ? [{ host: 'Codex', plugin: name, path: join(versions, newest) }] : []
  })
  return [...located, ...unknownCodexEntries({ lines, plugin })]
}

/**
 * Returns the plugin copies that Claude Code and Codex load on this machine: every plugin, or
 * only the one named. Each copy names its host, its plugin, and its absolute path. A copy that
 * cannot be located has no string path, and a Codex copy has a problem that says why.
 */
export const installedPluginCopies = ({ plugin } = {}) => {
  const claudeRoot = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
  const codexRoot = process.env.CODEX_HOME || join(homedir(), '.codex')
  const copies = []
  const installedFile = join(claudeRoot, 'plugins', 'installed_plugins.json')
  if (existsSync(installedFile)) {
    for (const [key, entries] of Object.entries(readJsonInput(installedFile).plugins ?? {})) {
      const name = key.split('@')[0]
      if ((plugin !== undefined && name !== plugin) || !Array.isArray(entries)) continue
      copies.push(...entries.map(({ installPath }) => ({ host: 'Claude Code', plugin: name, path: installPath })))
    }
  }
  return [...copies, ...codexCopies({ codexRoot, plugin })]
}

const displayPath = (path) => (path.startsWith(`${homedir()}/`) ? `~${path.slice(homedir().length)}` : path)

const requireCurrentReaders = ({ readerFile = v2ReaderFile, reads = 'memory version 2' } = {}) => {
  for (const { host, path, problem } of installedPluginCopies({ plugin: 'field-guide' })) {
    if (problem) fail(`a ${host} plugin copy may be older: ${problem}; refresh the Field Guide plugin on both hosts first`)
    if (typeof path !== 'string' || !existsSync(join(path, readerFile))) {
      fail(`the ${host} plugin copy at ${displayPath(String(path))} is older and cannot read ${reads}; refresh the Field Guide plugin on both hosts first`)
    }
  }
}

// Only the user's exact confirm prompt creates a confirmation or an approval, so automated input
// that names one is refused, not ignored.
const confirmationFields = new Set(['approval', 'approved', 'confirmation', 'confirmations', 'confirmed', 'explicitPreference'])
const rejectConfirmationFields = ({ value, label }) => {
  if (!value || typeof value !== 'object') return
  for (const [key, each] of Object.entries(value)) {
    if (!Array.isArray(value) && confirmationFields.has(key)) fail(`${label} must not carry a confirmation field: ${key}`)
    rejectConfirmationFields({ value: each, label })
  }
}

const requireTargetIds = ({ value, label, min = 2 }) => {
  if (!Array.isArray(value) || value.length < min || value.length > maxConsolidationTargets
    || new Set(value).size !== value.length || !value.every(isGuidanceId)) {
    fail(`${label} must list ${min} to ${maxConsolidationTargets} unique guidance IDs`)
  }
  return value
}

// Stored records accept any opaque language label; a new example names a language.
const exampleLanguagePattern = /^[A-Za-z0-9+#._-]{1,32}$/u

// The caller has already applied the new-text guard to the object that holds the replacement.
const validateReplacement = (replacement) => {
  assertObject({ value: replacement, label: 'replacement' })
  assertClosedFields({ value: replacement, fields: ['learning', 'confidence', 'examples'], label: 'replacement' })
  requireString({ value: replacement.learning, label: 'replacement learning', maxBytes: 4096 })
  if (/[\u0085\u2028\u2029]/u.test(replacement.learning) || !normalizeLearning(replacement.learning)) {
    fail('replacement learning must be meaningful text without line separators')
  }
  if (!['low', 'medium', 'high'].includes(replacement.confidence)) fail('replacement confidence is invalid')
  validateExamples(replacement.examples)
  if ((replacement.examples ?? []).some(({ language }) => !exampleLanguagePattern.test(language))) {
    fail('replacement example language must be a language name, such as sh or typescript')
  }
  return replacement
}

const requireReason = (value) => requireString({ value, label: 'reason', maxBytes: 512 })

const validateConsolidationInput = (input) => {
  rejectConfirmationFields({ value: input, label: 'consolidate input' })
  assertObject({ value: input, label: 'consolidate input' })
  assertSafeNewValue({ value: input, label: 'consolidate input' })
  assertClosedFields({ value: input, fields: ['schemaVersion', 'targetIds', 'replacement', 'reason', 'source', 'apply', 'previewToken'], label: 'consolidate input' })
  if (input.schemaVersion !== 1) fail('consolidate schemaVersion must be 1')
  requireTargetIds({ value: input.targetIds, label: 'consolidate targetIds' })
  validateReplacement(input.replacement)
  requireReason(input.reason)
  requireString({ value: input.source, label: 'consolidate source', maxBytes: 128, noWhitespace: true })
  if (input.apply !== undefined && typeof input.apply !== 'boolean') fail('consolidate apply must be boolean')
  if (input.previewToken !== undefined) requireString({ value: input.previewToken, label: 'consolidate previewToken', maxBytes: 128, noWhitespace: true })
  return input
}

// The IDs of records that still replace superseded guidance. A superseded record needs an active
// replacement, so these records are neither replaced nor archived.
const supersedingIds = (memory) => new Set(memory.guidance
  .filter(({ status }) => status === 'superseded')
  .map(({ transitions }) => transitions.at(-1).replacementId))

const requireValidResult = ({ memory, targetIds, plan }) => requireValidChange({
  memory,
  label: 'consolidated',
  change: (trial) => {
    const targets = targetIds.map((id) => trial.guidance.find((guidance) => guidance.id === id))
    applyConsolidation({ memory: trial, plan: { ...plan, targets }, operationId: newOperationId(), reason: 'Trial consolidation.', source: 'trial', now: new Date().toISOString() })
  },
})

// Checks that the targets are active and share one scope and subject, and that the replacement
// is new text. The replacement is confirmed only when a target was confirmed: a stored proposal
// passes the value it recorded, and otherwise the targets' current confirmations decide. The
// proposal ID hashes the target fingerprints, the replacement, whose fingerprint covers its
// text, and that value.
const planConsolidation = ({ memory, annotations, excused = [], targetIds, replacement, confirmedFingerprints: storedConfirmed }) => {
  const targets = targetIds.map((id) => {
    const target = memory.guidance.find((guidance) => guidance.id === id)
    if (!target) fail(`consolidate target does not exist: ${id}`)
    // Undoing a shared consolidation needs operation data that sync does not carry yet.
    if (target.scope.kind === 'shared') fail(`consolidation of shared guidance is not supported yet: ${shortId(id)} is shared`)
    if (target.status !== 'active') fail(`consolidate requires active targets: ${id} is ${target.status}`)
    return target
  })
  const [{ scope, subjectKey }] = targets
  if (targets.some((target) => !sameScope(target.scope, scope) || target.subjectKey !== subjectKey)) {
    fail('consolidate targets must share one scope and subjectKey')
  }
  const superseding = supersedingIds(memory)
  const replacing = targets.find(({ id }) => superseding.has(id))
  if (replacing) fail(`${shortId(replacing.id)} still replaces superseded guidance; undo that change before consolidating it`)
  const fingerprint = fingerprintFor({ scope, subjectKey, learning: replacement.learning })
  if (memory.guidance.some((guidance) => guidance.fingerprint === fingerprint)) fail('consolidate replacement must be new text; that guidance is already stored')
  const targetFingerprints = targets.map((target) => target.fingerprint).sort()
  const confirmedFingerprints = storedConfirmed
    ?? targets.filter((guidance) => annotationMarkers({ annotations, guidance, excused }).confirmed).map(({ fingerprint }) => fingerprint).sort()
  const confirms = confirmedFingerprints.length > 0
  requireValidResult({ memory, targetIds, plan: { scope, subjectKey, replacement, fingerprint, targetFingerprints } })
  return {
    targets,
    scope,
    subjectKey,
    replacement,
    fingerprint,
    targetFingerprints,
    confirmsReplacement: confirms,
    confirmedFingerprints,
    // The whole replacement is hashed, so an approval binds its confidence and examples too.
    proposalId: hashIdentity({ prefix: 'proposal', values: [1, targetFingerprints, fingerprint, replacement.learning, replacement.confidence, replacement.examples ?? [], confirmedFingerprints] }),
  }
}

// Adds the replacement and supersedes each target in place. Evidence links carry over without
// new evidence. Targets are project guidance, so they get no retirement IDs for now.
const applyConsolidation = ({ memory, plan, operationId, reason, source, now }) => {
  const { targets } = plan
  const replacement = {
    id: plan.fingerprint.replace('fingerprint', 'guidance'),
    fingerprint: plan.fingerprint,
    scope: plan.scope,
    subjectKey: plan.subjectKey,
    linkedSubjects: sortedUnion(...targets.map(({ linkedSubjects }) => linkedSubjects ?? [])),
    learning: plan.replacement.learning,
    status: 'active',
    confidence: plan.replacement.confidence,
    ...(targets.every(({ generic }) => generic === true) ? { generic: true } : {}),
    consolidates: targets.map(({ id }) => id).sort(),
    examples: plan.replacement.examples ?? [],
    evidenceIds: [...new Set(targets.flatMap(({ evidenceIds }) => evidenceIds))],
    independentEvidenceCount: 0,
    transitions: [{ from: null, to: 'active', reason, source, at: now, operationId }],
    createdAt: now,
    updatedAt: now,
  }
  replacement.independentEvidenceCount = evidenceCountFor({ guidance: replacement, memory })
  memory.guidance.push(replacement)
  const retirementIds = targets.flatMap((target) => {
    const retirementId = addRetirement(target)
    appendTransition({ guidance: target, to: 'superseded', reason, source, now, replacementId: replacement.id, retirementId, operationId })
    return retirementId ? [retirementId] : []
  })
  return { replacement, retirementIds }
}

// Revokes the targets and the new record, which starts unconfirmed, and moves the targets'
// triggers to it. An approved consolidation of confirmed records then confirms it, after that
// revocation. Returns the target revocation IDs and the new trigger entry IDs.
const annotateConsolidation = ({ annotations, plan, replacement, approval }) => {
  const triggers = sortedUnion(...plan.targets.map((guidance) => annotationMarkers({ annotations, guidance }).triggers))
  const targetRevocationIds = plan.targets.map((target) => revokeRecord(annotationRecordFor({ annotations, fingerprint: target.fingerprint })))
  const record = annotationRecordFor({ annotations, fingerprint: replacement.fingerprint })
  revokeRecord(record)
  const current = annotationMarkers({ annotations, guidance: replacement }).triggers
  const added = triggers.filter((trigger) => !current.includes(trigger)).map((trigger) => newAnnotationEntry({ trigger }))
  record.triggers.push(...added)
  if (approval) {
    record.confirmations.push(newAnnotationEntry({ ...(approval.host ? { host: approval.host } : {}), seen: revocationIds({ record, guidance: replacement }) }))
  }
  return { revocationIds: targetRevocationIds, triggerIds: added.map(({ id }) => id) }
}

// Applies one consolidation to memory and annotations in place and returns its journal entry.
const consolidateInPlace = ({ memory, annotations, plan, reason, source, now, fields = {}, approval }) => {
  const operationId = newOperationId()
  const revision = memory.revision
  const { replacement, retirementIds } = applyConsolidation({ memory, plan, operationId, reason, source, now })
  const { revocationIds, triggerIds } = annotateConsolidation({ annotations, plan, replacement, approval })
  return newPendingEntry({
    memory: { revision },
    operationId,
    action: 'consolidate',
    scope: plan.scope,
    subjectKey: plan.subjectKey,
    fingerprints: plan.targetFingerprints,
    reason,
    now,
    fields: { replacementFingerprint: plan.fingerprint, retirementIds, revocationIds, triggerIds, inverse: `undo-operation --id ${operationId}`, ...fields },
  })
}

// An automated archive is journaled and reversible; a manual archive through maintain stays
// final. Only active project guidance is archived this way: shared changes are proposals.
const archiveInPlace = ({ memory, annotations, target, reason, now, fields = {} }) => {
  if (target.status !== 'active' || target.scope.kind !== 'project') fail('an automated archive requires active project guidance')
  requireValidChange({
    memory,
    label: 'archived',
    change: (trial) => archiveRecord({ guidance: trial.guidance.find(({ id }) => id === target.id), reason, source: 'dream', now, operationId: newOperationId() }),
  })
  const operationId = newOperationId()
  const revision = memory.revision
  archiveRecord({ guidance: target, reason, source: 'dream', now, operationId })
  revokeRecord(annotationRecordFor({ annotations, fingerprint: target.fingerprint }))
  return newPendingEntry({
    memory: { revision },
    operationId,
    action: 'archive',
    scope: target.scope,
    subjectKey: target.subjectKey,
    fingerprints: [target.fingerprint],
    reason,
    now,
    fields: { retirementIds: [], inverse: `undo-operation --id ${operationId}`, ...fields },
  })
}

const appliedResult = (entry) => ({
  operationId: entry.operationId,
  action: entry.action,
  undoUntil: new Date(Date.parse(entry.at) + undoWindowDays * dayMs).toISOString(),
  undo: entry.inverse,
})

// Proposals wait in proposals.json for the user's exact `confirm fg:proposal:<id>` prompt.
// The file stays local and never syncs.
const emptyProposals = () => ({ schemaVersion: 1, proposals: [] })
const proposalIdPattern = /^proposal:v1:[0-9a-f]{64}$/

const validateProposal = (proposal) => {
  assertObject({ value: proposal, label: 'proposal' })
  assertSafeNewValue({ value: proposal, label: 'proposal' })
  assertClosedFields({ value: proposal, fields: ['id', 'kind', 'scopeDigest', 'subjectKey', 'targetFingerprints', 'replacement', 'confirmsReplacement', 'confirmedFingerprints', 'reason', 'createdAt', 'expiresAt', 'approval', 'appliedOperationId'], label: 'proposal' })
  if (!proposalIdPattern.test(proposal.id) || proposal.kind !== 'consolidate') fail('proposal has an invalid id or kind')
  if (typeof proposal.confirmsReplacement !== 'boolean') fail('proposal confirmsReplacement must be boolean')
  if (!Array.isArray(proposal.confirmedFingerprints) || proposal.confirmedFingerprints.some((each) => !proposal.targetFingerprints?.includes(each))
    || proposal.confirmsReplacement !== (proposal.confirmedFingerprints.length > 0)) {
    fail('proposal confirmedFingerprints must list the confirmed targets')
  }
  if (!/^[0-9a-f]{64}$/u.test(proposal.scopeDigest)) fail('proposal scopeDigest is invalid')
  if (!portableKey.test(proposal.subjectKey)) fail('proposal subjectKey must be a portable slug')
  if (!Array.isArray(proposal.targetFingerprints) || proposal.targetFingerprints.some((each) => !fingerprintPattern.test(each))) fail('proposal targetFingerprints are invalid')
  validateReplacement(proposal.replacement)
  requireReason(proposal.reason)
  requireTimestamp({ value: proposal.createdAt, label: 'proposal createdAt' })
  requireTimestamp({ value: proposal.expiresAt, label: 'proposal expiresAt' })
  if (proposal.approval !== undefined) {
    assertObject({ value: proposal.approval, label: 'proposal approval' })
    assertClosedFields({ value: proposal.approval, fields: ['at', 'host'], label: 'proposal approval' })
    requireTimestamp({ value: proposal.approval.at, label: 'proposal approval at' })
  }
  if (proposal.appliedOperationId !== undefined && !operationIdPattern.test(proposal.appliedOperationId)) fail('proposal appliedOperationId is invalid')
}

const readProposals = (paths) => {
  if (!existsSync(paths.proposalsFile)) return emptyProposals()
  const store = readJsonInput(paths.proposalsFile)
  assertObject({ value: store, label: 'proposals' })
  assertClosedFields({ value: store, fields: ['schemaVersion', 'proposals'], label: 'proposals' })
  if (store.schemaVersion !== 1 || !Array.isArray(store.proposals)) fail('proposals.json has an unsupported format')
  store.proposals.forEach(validateProposal)
  return store
}

const writeProposals = ({ paths, store }) => writeTextAtomically({ path: paths.proposalsFile, content: `${JSON.stringify(store, null, 2)}\n` })
const expired = (proposal) => Date.parse(proposal.expiresAt) <= Date.now()
const confirmPromptFor = (proposal) => `confirm fg:proposal:${shortId(proposal.id)}`
// A project scope's repository identity can be a local path, such as the Git directory of a
// repository without a remote, so a proposal stores only a digest of its scope.
const scopeDigest = (scope) => contentDigest(scopeIdentity(scope))

// A new proposal for a consolidation plan, checked as readProposals checks it, so a field copied
// from memory, such as a legacy subject key, cannot make proposals.json unreadable.
const newProposal = ({ plan, reason, now }) => {
  const proposal = {
    id: plan.proposalId,
    kind: 'consolidate',
    scopeDigest: scopeDigest(plan.scope),
    subjectKey: plan.subjectKey,
    targetFingerprints: plan.targetFingerprints,
    replacement: plan.replacement,
    confirmsReplacement: plan.confirmsReplacement,
    confirmedFingerprints: plan.confirmedFingerprints,
    reason,
    createdAt: now,
    expiresAt: new Date(Date.parse(now) + proposalLifetimeDays * dayMs).toISOString(),
  }
  validateProposal(proposal)
  return proposal
}

// The proposal store with each plan's consolidation proposal added once, and the proposal for
// each plan. A stored proposal keeps its approval and expiry. It writes nothing.
const preparedProposals = ({ paths, plans, now }) => {
  if (plans.length === 0) return { store: null, stored: [] }
  const store = readProposals(paths)
  store.proposals = store.proposals.filter((proposal) => !expired(proposal))
  const stored = plans.map(({ plan, reason }) => {
    const existing = store.proposals.find(({ id }) => id === plan.proposalId)
    if (existing) return existing
    const proposal = newProposal({ plan, reason, now })
    store.proposals.push(proposal)
    return proposal
  })
  return { store, stored }
}

const storeProposals = ({ paths, plans, now }) => {
  const { store, stored } = preparedProposals({ paths, plans, now })
  if (store) writeProposals({ paths, store })
  return stored
}

const proposalResult = ({ proposal, plan }) => ({
  proposalId: proposal?.id ?? plan.proposalId,
  confirmPrompt: confirmPromptFor(proposal ?? { id: plan.proposalId }),
  targetIds: plan.targets.map(({ id }) => id),
  confirmsReplacement: plan.confirmsReplacement,
  ...(proposal ? { expiresAt: proposal.expiresAt } : {}),
})

const findProposal = ({ store, reference }) => {
  const hex = reference.match(/^proposal:(?:v1:)?([0-9a-f]{8,64})$/u)?.[1]
  if (!hex) return { problem: 'use a proposal ID as proposal:<hex prefix of at least 8 characters>' }
  const matches = store.proposals.filter(({ id }) => id.startsWith(`proposal:v1:${hex}`))
  if (matches.length !== 1) return { problem: matches.length === 0 ? 'no stored proposal matches that ID' : 'that prefix matches more than one proposal' }
  return { proposal: matches[0] }
}

// Records the user's approval of one stored proposal. Only the UserPromptSubmit hook calls it.
const approveProposalUnlocked = ({ files, reference, host }) => {
  const store = readProposals(files)
  const { proposal, problem } = findProposal({ store, reference })
  if (problem) return notConfirmed(problem)
  if (proposal.appliedOperationId) return notConfirmed('that proposal was already applied')
  if (expired(proposal)) return notConfirmed('that proposal expired; ask for a new one')
  if (!proposal.approval) {
    proposal.approval = { at: new Date().toISOString(), ...(host ? { host } : {}) }
    writeProposals({ paths: files, store })
  }
  const confirmation = proposal.confirmsReplacement ? 'the replacement will be confirmed' : 'the replacement will start unconfirmed'
  const text = `Field Guide approved proposal ${shortId(proposal.id)}: consolidate ${proposal.targetFingerprints.length} records into "${proposal.replacement.learning}"; ${confirmation}`
  return {
    exact: true,
    systemMessage: text,
    context: `${text}. Apply it with consolidate --approval proposal:${shortId(proposal.id)}. Acknowledge the approval in one line. The prompt asks for nothing else.`,
  }
}

const consolidatePreviewToken = ({ memory, annotations, input }) => hashIdentity({
  prefix: 'consolidate-preview',
  values: [1, input.targetIds, input.replacement, input.reason, input.source, contentDigest(memory), contentDigest(annotations)],
})

const consolidateUnlocked = ({ paths, inputPath }) => {
  const input = validateConsolidationInput(readJsonInput(inputPath))
  const memory = readInitializedMemory(paths)
  const operations = operationsIn(recoverOperations({ paths, memory }))
  const annotations = readAnnotations(paths.annotationsFile)
  const excused = unlandedRevocations({ operations, memory })
  const plan = planConsolidation({ memory, annotations, excused, targetIds: input.targetIds, replacement: input.replacement })
  requireNotDeclined({ declined: declinedSets(operations), fingerprints: plan.targetFingerprints })
  requireNothingHidden({ memory, learning: input.replacement.learning, isConfirmed: (guidance) => annotationMarkers({ annotations, guidance, excused }).confirmed })
  // A confirmed record is never rewritten without the user's approval of this exact change.
  if (plan.confirmsReplacement) {
    const [proposal] = storeProposals({ paths, plans: [{ plan, reason: input.reason }], now: new Date().toISOString() })
    return { outcome: 'approval-required', ...proposalResult({ proposal, plan }), applied: false }
  }
  const previewToken = consolidatePreviewToken({ memory, annotations, input })
  const replacementId = plan.fingerprint.replace('fingerprint', 'guidance')
  if (input.apply !== true) return { outcome: 'consolidate-preview', targetIds: input.targetIds, replacementId, previewToken, applied: false }
  if (input.previewToken !== previewToken) fail('consolidate apply requires the current dry-run previewToken')
  requireCurrentReaders()
  const entry = consolidateInPlace({ memory, annotations, plan, reason: input.reason, source: input.source, now: new Date().toISOString() })
  commitOperations({ paths, memory, annotations, entries: [entry] })
  return { outcome: 'consolidated', targetIds: input.targetIds, replacementId, ...appliedResult(entry), applied: true }
}

// Applies a stored proposal that the user approved. It recomputes the proposal ID from current
// memory, so an approval covers only the exact records and text it was given for. When a
// target was confirmed as the proposal was stored, it confirms the replacement in the same commit.
const consolidateApprovedUnlocked = ({ paths, reference }) => {
  const memory = readInitializedMemory(paths)
  const operations = operationsIn(recoverOperations({ paths, memory }))
  const store = readProposals(paths)
  const { proposal, problem } = findProposal({ store, reference })
  if (problem) fail(problem)
  const applied = proposal.appliedOperationId
    ?? [...operations.values()].find(({ proposalId, state }) => proposalId === proposal.id && state === 'committed')?.operationId
  if (applied) fail(`proposal ${shortId(proposal.id)} was already applied as ${applied}`)
  if (expired(proposal)) fail(`proposal ${shortId(proposal.id)} expired; propose it again`)
  if (!proposal.approval) fail(`proposal ${shortId(proposal.id)} has no approval from the user; offer \`${confirmPromptFor(proposal)}\``)
  // An undo after the approval declines the set, and the later undo wins.
  requireNotDeclined({ declined: declinedSets(operations), fingerprints: proposal.targetFingerprints })
  const targetIds = proposal.targetFingerprints.map((fingerprint) => (
    memory.guidance.find((guidance) => guidance.fingerprint === fingerprint)?.id ?? fail(`a record in proposal ${shortId(proposal.id)} no longer exists`)
  ))
  const plan = planConsolidation({ memory, targetIds, replacement: proposal.replacement, confirmedFingerprints: proposal.confirmedFingerprints })
  if (plan.proposalId !== proposal.id || scopeDigest(plan.scope) !== proposal.scopeDigest || plan.subjectKey !== proposal.subjectKey) {
    fail(`proposal ${shortId(proposal.id)} does not match its approved content`)
  }
  // The approval covered the records as they were confirmed then. A crashed attempt revoked their
  // confirmations itself, so the revocations it journaled are excused; any later revocation, such
  // as an unconfirm, still counts as a change.
  const annotations = readAnnotations(paths.annotationsFile)
  const excused = unlandedRevocations({ operations, memory })
  const confirmedNow = plan.targets.filter((guidance) => annotationMarkers({ annotations, guidance, excused }).confirmed)
    .map(({ fingerprint }) => fingerprint).sort()
  if (JSON.stringify(confirmedNow) !== JSON.stringify(proposal.confirmedFingerprints)) {
    fail(`confirmation of a record in proposal ${shortId(proposal.id)} changed since it was stored; propose it again`)
  }
  requireNothingHidden({ memory, learning: proposal.replacement.learning, isConfirmed: (guidance) => annotationMarkers({ annotations, guidance, excused }).confirmed })
  requireCurrentReaders()
  const entry = consolidateInPlace({
    memory,
    annotations,
    plan,
    reason: proposal.reason,
    source: 'user-approval',
    now: new Date().toISOString(),
    fields: { proposalId: proposal.id },
    ...(proposal.confirmsReplacement ? { approval: proposal.approval } : {}),
  })
  commitOperations({ paths, memory, annotations, entries: [entry] })
  proposal.appliedOperationId = entry.operationId
  writeProposals({ paths, store })
  return { outcome: 'consolidated', targetIds, replacementId: plan.fingerprint.replace('fingerprint', 'guidance'), confirmed: proposal.confirmsReplacement, ...appliedResult(entry), applied: true }
}

const consolidate = ({ paths, inputPath, approval }) => (
  withMemoryLock({ paths, action: () => (approval ? consolidateApprovedUnlocked({ paths, reference: approval }) : consolidateUnlocked({ paths, inputPath })) })
)

const conflict = (message) => fail(`conflict: ${message}`)

// Withdraws the replacement the way a user's undo does, which restores each record it still
// supersedes. A record that something else retired stays retired.
const undoConsolidation = ({ memory, operation, operationId, now }) => {
  const replacement = memory.guidance.find(({ fingerprint }) => fingerprint === operation.replacementFingerprint)
  if (!replacement) conflict(`the replacement of operation ${shortId(operation.operationId)} no longer exists`)
  if (!['candidate', 'active'].includes(replacement.status)) {
    const later = replacement.transitions.at(-1).operationId
    conflict(`replacement ${shortId(replacement.id)} is ${replacement.status}${later ? ` by operation ${later}; undo that operation first` : ''}`)
  }
  const predecessors = memory.guidance.filter(({ fingerprint }) => operation.fingerprints.includes(fingerprint))
  for (const predecessor of predecessors.filter(({ status }) => status === 'superseded')) {
    const own = predecessor.transitions.at(-1)
    if (own.operationId !== operation.operationId || (own.retirementId && !operation.retirementIds.includes(own.retirementId))) {
      conflict(`${shortId(predecessor.id)} is superseded by something other than operation ${shortId(operation.operationId)}`)
    }
  }
  const input = { action: 'undo-operation', reason: 'The user undid this consolidation.', source: 'undo-operation', operationId }
  const { retirementId } = withdrawGuidance({ memory, target: replacement, input, now, byUser: true })
  return {
    replacementId: replacement.id,
    restoredIds: predecessors.filter(({ status }) => status === 'active').map(({ id }) => id),
    keptRetiredIds: predecessors.filter(({ status }) => status !== 'active').map(({ id }) => id),
    retirementIds: retirementId ? [retirementId] : [],
    declined: operation.fingerprints,
  }
}

const undoArchive = ({ memory, operation, operationId, now }) => {
  const target = memory.guidance.find(({ fingerprint }) => fingerprint === operation.fingerprints[0])
  if (!target || target.status !== 'archived' || target.transitions.at(-1).operationId !== operation.operationId) {
    conflict(`the record archived by operation ${shortId(operation.operationId)} changed since then`)
  }
  appendTransition({ guidance: target, to: 'active', reason: 'The user undid this archive.', source: 'undo-operation', now, operationId })
  return { restoredIds: [target.id], keptRetiredIds: [], retirementIds: [] }
}

const undoers = { consolidate: undoConsolidation, archive: undoArchive }

// A problem for each restore of archived guidance that no journaled undo of that archive made:
// the restore must name an undo-operation entry, not aborted, that undoes the archive's operation.
const unlinkedRestores = ({ memory, operations }) => memory.guidance.flatMap(({ id, transitions }) => transitions.flatMap((restore, index) => {
  if (restore.from !== 'archived' || restore.to !== 'active') return []
  const archived = transitions[index - 1].operationId
  const undo = operations.get(restore.operationId)
  if (undo?.action === 'undo-operation' && undo.undoes === archived && undo.state !== 'aborted') return []
  return [`${shortId(id)} was restored by no journaled undo of archive operation ${shortId(String(archived))}`]
}))

const undoOperationUnlocked = ({ paths, reference }) => {
  const memory = readInitializedMemory(paths)
  const operations = operationsIn(recoverOperations({ paths, memory }))
  const [unlinked] = unlinkedRestores({ memory, operations })
  if (unlinked) fail(`${unlinked}; repair memory before undo-operation`)
  const operation = findOperation({ operations, reference })
  // Earlier builds of this release journaled shared consolidations; reversing one needs operation
  // data that sync does not carry yet.
  if (operation.scope === 'shared') fail(`operation ${shortId(operation.operationId)} changed shared guidance, which undo-operation does not reverse yet`)
  if (operation.state === 'aborted') fail(`operation ${shortId(operation.operationId)} never applied; there is nothing to undo`)
  if (operation.action === 'undo-operation') {
    fail(operations.get(operation.undoes)?.action === 'archive'
      ? 'undo-operation cannot undo an undo; archive the record again instead'
      : 'undo-operation cannot undo an undo; the undone set is declined, so its records stay separate')
  }
  if (!isString(operation.action) || !Object.hasOwn(undoers, operation.action)) {
    fail(`operation ${shortId(operation.operationId)} has an unknown action; undo-operation reverses only ${Object.keys(undoers).join(' and ')}`)
  }
  const undo = [...operations.values()].find(({ undoes, state }) => undoes === operation.operationId && state === 'committed')
  if (undo) return { outcome: 'already-undone', undoes: operation.operationId, operationId: undo.operationId }
  if (Date.now() - Date.parse(operation.at) > undoWindowDays * dayMs) fail(`operation ${shortId(operation.operationId)} is older than the ${undoWindowDays}-day undo window`)
  // A restore writes the archived->active edge, which only a copy that reads run entries accepts.
  requireCurrentReaders(operation.action === 'archive' ? { readerFile: dreamRunReaderFile, reads: 'a restored archive' } : {})
  const annotations = readAnnotations(paths.annotationsFile)
  const statusBefore = new Map(memory.guidance.map(({ id, status }) => [id, status]))
  const now = new Date().toISOString()
  const operationId = newOperationId()
  const revision = memory.revision
  const { declined, retirementIds, ...undone } = undoers[operation.action]({ memory, operation, operationId, now })
  // Retirement and restore both change authority, so each record whose status changed is revoked.
  const revocationIds = memory.guidance.filter(({ id, status }) => statusBefore.get(id) !== status)
    .map(({ fingerprint }) => revokeRecord(annotationRecordFor({ annotations, fingerprint })))
  const entry = pendingEntry({
    memory: { revision },
    operationId,
    action: 'undo-operation',
    scope: { kind: operation.scope },
    subjectKey: operation.subjectKey,
    fingerprints: operation.fingerprints,
    reason: 'The user undid this operation.',
    now,
    fields: { undoes: operation.operationId, retirementIds, revocationIds, ...(declined ? { declined: [...declined].sort() } : {}) },
  })
  commitOperations({ paths, memory, annotations, entries: [entry] })
  return { outcome: 'undone', operationId, undoes: operation.operationId, ...undone }
}

/** Undoes one journaled operation by its ID. Repeating it changes nothing. */
const undoOperation = ({ paths, reference }) => (
  withMemoryLock({ paths, action: () => undoOperationUnlocked({ paths, reference }) })
)

// Subjects group live records by scope and subject key. A subject's digest covers every field of
// each record that a nightly plan shows its reviewer, so any change between a plan and its apply,
// including a confirmation or a reinforcement, makes the apply stale.
const subjectIdFor = ({ scope, subjectKey }) => hashIdentity({ prefix: 'subject', values: [1, scopeIdentity(scope), subjectKey] })

/** Returns the fields of a live record that a nightly plan shows its reviewer, with the learning unredacted. */
export const reviewedRecord = ({ guidance, confirmed, triggers }) => ({
  id: guidance.id,
  status: guidance.status,
  confirmed,
  triggers,
  learning: guidance.learning,
  ...(guidance.linkedSubjects?.length ? { linkedSubjects: guidance.linkedSubjects } : {}),
  updatedAt: guidance.updatedAt,
})

// confirmationsCurrent false shows every record unconfirmed, as the hook does while the watermark
// lags memory. Besides the excused revocations, a record's reconcile revocations are excused too:
// a reconcile voids every confirmation because it cannot tell what changed, not because the user
// withdrew one, so nightly maintenance still leaves that guidance to the user. lapsed maps a
// subject to the runs whose proposal of it lapsed. The digest covers them, so the review after a
// lapse comes from a new plan and is a new run; a subject without a lapse keeps the digest it had.
const subjectStates = ({ memory, annotations, excused = [], confirmationsCurrent = true, lapsed = new Map() }) => {
  const subjects = new Map()
  const live = memory.guidance.filter(({ status }) => ['candidate', 'active'].includes(status)).sort((left, right) => left.id.localeCompare(right.id))
  for (const guidance of live) {
    const subjectId = subjectIdFor(guidance)
    const subject = subjects.get(subjectId) ?? { subjectId, scope: guidance.scope, subjectKey: guidance.subjectKey, records: [] }
    const voided = (annotations.records[guidance.fingerprint]?.revocations ?? []).filter((id) => id.startsWith(reconcileRevocationPrefix))
    const markers = annotationMarkers({ annotations, guidance, excused: [...excused, ...voided] })
    subject.records.push({ guidance, ...markers, confirmed: markers.confirmed && confirmationsCurrent })
    subjects.set(subjectId, subject)
  }
  for (const subject of subjects.values()) {
    const lapsedRunIds = lapsed.get(subject.subjectId) ?? []
    subject.digest = hashIdentity({ prefix: 'subject-state', values: [1, subject.records.map(reviewedRecord), ...(lapsedRunIds.length > 0 ? [lapsedRunIds] : [])] })
  }
  return subjects
}

// Records of one subject whose terms overlap, linked transitively. A group that the user declined
// by undoing its consolidation is left out.
const overlapThreshold = 0.5
const overlaps = (left, right) => {
  const [a, b] = [relevanceTerms(left.learning), relevanceTerms(right.learning)]
  const union = new Set([...a, ...b]).size
  return union > 0 && [...a].filter((term) => b.has(term)).length / union >= overlapThreshold
}

const overlapGroups = ({ records, declined }) => {
  const groupOf = new Map(records.map((record) => [record.id, new Set([record])]))
  records.forEach((left, index) => records.slice(index + 1).forEach((right) => {
    if (groupOf.get(left.id) === groupOf.get(right.id) || !overlaps(left, right)) return
    const merged = new Set([...groupOf.get(left.id), ...groupOf.get(right.id)])
    for (const record of merged) groupOf.set(record.id, merged)
  }))
  return [...new Set(groupOf.values())]
    .filter((group) => group.size >= 2 && !declined.has([...group].map(({ fingerprint }) => fingerprint).sort().join(',')))
    .map((group) => [...group].map(({ id }) => id).sort())
}

// The proposals a run stored that the user never applied and can no longer approve: expired, or
// missing from proposals.json because the run stopped before it published them. A run records
// each proposal's expiry, and nothing extends one. published holds the IDs in proposals.json.
const lapsedProposals = ({ proposals, operations, published }) => proposals.filter(({ id, expiresAt }) => (
  (Date.parse(expiresAt) <= Date.now() || !published.has(id))
  && ![...operations.values()].some(({ proposalId, state }) => proposalId === id && state === 'committed')
))

// One digest of every live guidance source, null for one that is absent.
const liveStateOf = (liveDigests) => hashIdentity({
  prefix: 'live-state',
  values: [1, Object.entries(liveDigests).sort(([left], [right]) => left.localeCompare(right))],
})

// For each subject, the runs whose proposal of it lapsed, sorted. A time-dependent answer: a plan
// made before a proposal expires is stale after it.
const lapsedRuns = ({ runs, operations, published }) => {
  const lapsed = new Map()
  for (const { runId, proposals } of runs) {
    for (const { subjectId } of lapsedProposals({ proposals, operations, published })) lapsed.set(subjectId, sortedUnion(lapsed.get(subjectId) ?? [], [runId]))
  }
  return lapsed
}

// The IDs in proposals.json, or an empty set and the error when it cannot be read, so the plan
// treats every proposal as lapsed and reviews its subject again; dream apply refuses instead.
const publishedForDisplay = (paths) => {
  try {
    return { published: new Set(readProposals(paths).proposals.map(({ id }) => id)) }
  } catch (error) {
    return { published: new Set(), error: error.message }
  }
}

// A subject is due while a contradiction that holds one of its records waits for the user, and
// otherwise until a review saw this subject state against this live guidance.
const isDue = ({ subject, reviewed, open, live }) => (
  open.some(({ subjectIds }) => subjectIds.includes(subject.subjectId)) || !reviewed[subject.subjectId]?.has(`${subject.digest} ${live}`)
)

/**
 * Whether two subjects apply together, so a contradiction may pair their records: the same subject
 * key in two scopes, one of them shared.
 */
export const appliesWith = (left, right) => (
  left.subjectId !== right.subjectId && left.subjectKey === right.subjectKey && [left, right].some(({ scope }) => scope.kind === 'shared')
)

// For each subject, the states it was reviewed in: each pairs the subject digest with the live
// state of that review. A subject whose subject and live guidance return to a reviewed state, such
// as live text edited and then restored, needs no new review. A lapse changes the digest, so the
// subject of a lapsed proposal is reviewed again.
const reviewedStates = (runs) => {
  const states = {}
  for (const run of runs) {
    for (const [subjectId, { digest, live }] of Object.entries(run.subjectDigests)) (states[subjectId] ??= new Set()).add(`${digest} ${live}`)
  }
  return states
}

// The contradictions that earlier runs queued for the user and that are still open: both records
// are still live and at least one is confirmed. Each run's report lists what it queued, so the
// journal alone answers this. Each pair names the subjects of its two records.
const openContradictions = ({ runs, subjects }) => {
  const live = new Map([...subjects.values()].flatMap(({ subjectId, records }) => records.map(({ guidance, confirmed }) => [guidance.id, { subjectId, confirmed }])))
  const open = new Map()
  for (const { kind, targetId, conflictingId } of runs.flatMap(({ report }) => report?.queued ?? [])) {
    const pair = [targetId, conflictingId].map((id) => live.get(id))
    if (kind !== 'contradiction' || !pair.every(Boolean) || !pair.some(({ confirmed }) => confirmed)) continue
    open.set([targetId, conflictingId].sort().join(','), { targetId, conflictingId, subjectIds: pair.map(({ subjectId }) => subjectId) })
  }
  return [...open.values()]
}

/**
 * Returns the read-only state that a nightly plan reports: live subjects with their digests,
 * records, and overlap groups, whether each is due for review against the given live digests, and
 * any operation still pending. It writes nothing, not even journal recovery; a run that recovery
 * would record counts as recorded. When the journal cannot be read, every subject is due, none
 * lists a queued contradiction, and stateErrors names the error. When proposals.json cannot be
 * read, every stored proposal counts as lapsed, and stateErrors names that error too.
 */
export const dreamState = ({ paths, liveDigests }) => {
  const memory = readInitializedMemory(paths)
  // Without the journal, no group is declined, no revocation is excused, and no review or queued
  // contradiction is known, so every subject is due; the state names the error instead of pending
  // operations. Unreadable annotations show no markers; audit reports them.
  const { journal, operations, error } = journalForDisplay(paths)
  const declined = operations ? declinedSets(operations) : new Set()
  const excused = operations ? unlandedRevocations({ operations, memory }) : []
  const runs = journal ? [...journal, ...recoveredRuns({ journal, memory })].filter(({ type }) => type === 'run') : []
  const reviewed = reviewedStates(runs)
  const live = liveStateOf(liveDigests)
  const { published, error: proposalsError } = publishedForDisplay(paths)
  // Confirmations apply the hook's watermark check, read before annotations as the hook does. Like
  // consolidate, the plan still counts a confirmation that only a crashed operation revoked.
  const confirmationsCurrent = watermarkCurrent({ paths, memory })
  const states = subjectStates({
    memory,
    annotations: readAnnotationsForDisplay(paths.annotationsFile),
    excused,
    confirmationsCurrent,
    lapsed: lapsedRuns({ runs, operations: operations ?? new Map(), published }),
  })
  const open = openContradictions({ runs, subjects: states })
  const subjects = [...states.values()].map((subject) => ({
    ...subject,
    overlapGroups: overlapGroups({ records: subject.records.map(({ guidance }) => guidance), declined }),
    queuedContradictions: open.filter(({ subjectIds }) => subjectIds.includes(subject.subjectId)).map(({ targetId, conflictingId }) => ({ targetId, conflictingId })),
    due: isDue({ subject, reviewed, open, live }),
  }))
  return {
    revision: memory.revision,
    subjects,
    ...(operations ? { pendingOperations: [...operations.values()].filter(({ state }) => state === 'pending').map(({ operationId }) => operationId) } : {}),
    stateErrors: [error, proposalsError].filter(Boolean),
    undoWindowDays,
  }
}

/** The live guidance sources that a nightly plan reads and a run may name. */
export const liveSources = ['claude-md', 'agents-md', 'roles', 'coding-standards', 'skills', 'plugin-skills']

// A nightly run applies at most this many changes, and reviews at most this many actions.
const maxDreamOperations = 10
const maxDreamActions = 50
const dreamFlagKinds = ['conflict', 'unused', 'live-edit']
const subjectIdPattern = /^subject:v1:[0-9a-f]{64}$/
const subjectDigestPattern = /^subject-state:v1:[0-9a-f]{64}$/

// liveDigests holds every known source, with null for one that is missing on this machine.
const requireLiveSource = ({ source, liveDigests }) => {
  if (!isString(source) || !Object.hasOwn(liveDigests, source)) fail(`live guidance source must be one of: ${Object.keys(liveDigests).join(', ')}`)
  return source
}

// An action that names live guidance as the duplicate or the place to edit needs that guidance.
const requirePresentLiveSource = ({ source, liveDigests }) => {
  requireLiveSource({ source, liveDigests })
  if (liveDigests[source] === null) fail(`live guidance ${source} is not present on this machine`)
}

// Runs one step for one action and names that action in a failure. A run applies all of its
// actions or none, so one rejected action stops the whole run.
const forAction = ({ label, action, step }) => {
  try {
    return step()
  } catch (error) {
    throw new Error(`dream ${label} (${action?.action}) rejected: ${error.message}; the run applied nothing`, { cause: error })
  }
}

const dreamActionFields = {
  consolidate: ['action', 'targetIds', 'replacement', 'reason'],
  archive: ['action', 'targetId', 'duplicateOf', 'reason'],
  contradiction: ['action', 'targetId', 'conflictingId', 'reason'],
  flag: ['action', 'kind', 'targetIds', 'source', 'reason'],
}

const dreamActionValidators = {
  consolidate: ({ action }) => {
    requireTargetIds({ value: action.targetIds, label: 'dream consolidate targetIds' })
    validateReplacement(action.replacement)
  },
  archive: ({ action, liveDigests }) => {
    if (!isGuidanceId(action.targetId)) fail('dream archive targetId is invalid')
    if (isGuidanceId(action.duplicateOf)) return
    if (typeof action.duplicateOf !== 'string' || !action.duplicateOf.startsWith('live:')) fail('dream archive duplicateOf must be a guidance ID or live:<source>')
    requirePresentLiveSource({ source: action.duplicateOf.slice('live:'.length), liveDigests })
  },
  contradiction: ({ action }) => {
    if (![action.targetId, action.conflictingId].every(isGuidanceId) || action.conflictingId === action.targetId) {
      fail('dream contradiction needs two different guidance IDs')
    }
  },
  flag: ({ action, liveDigests }) => {
    if (!isString(action.kind) || !dreamFlagKinds.includes(action.kind)) fail(`dream flag kind must be one of: ${dreamFlagKinds.join(', ')}`)
    requireTargetIds({ value: action.targetIds, label: 'dream flag targetIds', min: 1 })
    if (action.kind === 'live-edit' || action.source !== undefined) requirePresentLiveSource({ source: action.source, liveDigests })
  },
}

const validateDreamAction = ({ action, liveDigests }) => {
  assertObject({ value: action, label: 'dream action' })
  assertSafeNewValue({ value: action, label: 'action' })
  // Checked as a string before any lookup by key, which would convert ['archive'] to 'archive'.
  if (!isString(action.action) || !Object.hasOwn(dreamActionFields, action.action)) fail(`dream action is not allowed: ${JSON.stringify(action.action)}`)
  const fields = dreamActionFields[action.action]
  assertClosedFields({ value: action, fields, label: `dream ${action.action} action` })
  requireReason(action.reason)
  dreamActionValidators[action.action]({ action, liveDigests })
}

const validateDreamInput = ({ input, liveDigests }) => {
  // Checked first, so a confirmation field is refused even inside an otherwise invalid action.
  rejectConfirmationFields({ value: input, label: 'dream input' })
  assertObject({ value: input, label: 'dream input' })
  assertClosedFields({ value: input, fields: ['schemaVersion', 'live', 'subjects'], label: 'dream input' })
  if (input.schemaVersion !== 1) fail('dream input schemaVersion must be 1')
  assertObject({ value: input.live, label: 'dream input live digests' })
  Object.keys(input.live).forEach((source) => requireLiveSource({ source, liveDigests }))
  if (!Array.isArray(input.subjects) || input.subjects.length === 0) fail('dream input needs at least one subject')
  input.subjects.forEach((subject, subjectIndex) => {
    assertObject({ value: subject, label: 'dream subject' })
    assertClosedFields({ value: subject, fields: ['subjectId', 'digest', 'actions'], label: 'dream subject' })
    if (![[subject.subjectId, subjectIdPattern], [subject.digest, subjectDigestPattern]].every(([value, pattern]) => isString(value) && pattern.test(value))) fail('dream subject has an invalid subjectId or digest')
    if (!Array.isArray(subject.actions)) fail('dream subject actions must be an array')
    subject.actions.forEach((action, actionIndex) => forAction({
      label: `subjects[${subjectIndex}].actions[${actionIndex}]`,
      action,
      step: () => validateDreamAction({ action, liveDigests }),
    }))
  })
  if (input.subjects.flatMap(({ actions }) => actions).length > maxDreamActions) fail(`a dream run reviews at most ${maxDreamActions} actions`)
}

// The records a run keeps, each with the reason: those an archive in it names as the duplicate,
// which rules out a cycle of duplicates, and both records of each contradiction it queues for
// the user, in either subject, and both records of each contradiction an earlier run queued that
// is still open. No action in the run archives or consolidates a kept record, even as a flag or a
// proposal. The set is fixed before any action is decided, so the order of actions does not matter.
const heldRecords = ({ input, confirmed, open }) => {
  const held = new Map(open.flatMap(({ targetId, conflictingId }) => [targetId, conflictingId].map((id) => [id, 'a contradiction queued for the user names it'])))
  for (const { actions } of input.subjects) {
    for (const action of actions) {
      const pair = [action.targetId, action.conflictingId]
      if (action.action === 'contradiction' && pair.some((id) => confirmed.has(id))) pair.forEach((id) => held.set(id, 'a contradiction queued in this run names it'))
      if (action.action === 'archive' && isGuidanceId(action.duplicateOf)) held.set(action.duplicateOf, 'an archive in this run names it as the duplicate')
    }
  }
  return held
}

const requireNotHeld = ({ run, ids }) => {
  const kept = ids.find((id) => run.held.has(id))
  if (kept) fail(`${shortId(kept)} is kept because ${run.held.get(kept)}`)
}

// Each record takes part in at most one operation or proposal per run. A record that still
// replaces superseded guidance is never changed.
const claimTargets = ({ run, ids }) => {
  const replacing = ids.find((id) => run.superseding.has(id))
  if (replacing) fail(`${shortId(replacing)} still replaces superseded guidance; undo that change first`)
  if (ids.some((id) => run.targeted.has(id))) fail('a dream run changes each record at most once')
  ids.forEach((id) => run.targeted.add(id))
}

const decideFlag = ({ action, record, run }) => {
  action.targetIds.forEach(record)
  if (action.kind === 'unused' && !isAnalyticsEnabled({ guideRoot: run.guideRoot })) fail('an unused flag needs local analytics')
  run.flags.push({ kind: action.kind, targetIds: action.targetIds, ...(action.source ? { source: action.source } : {}), reason: action.reason })
}

// A contradiction may pair records from two subjects that apply together: a project subject and
// the shared subject with the same key. The other subject must be in the input, so its digest is
// checked too.
const applicableRecord = ({ id, subject, run }) => {
  const own = subject.records.find(({ guidance }) => guidance.id === id)
  if (own) return { record: own, subject }
  const other = [...run.subjects.values()].find(({ records }) => records.some(({ guidance }) => guidance.id === id))
  if (!other || !appliesWith(subject, other)) {
    fail(`${id} is not live guidance in subject ${subject.subjectKey} or in the subject that applies with it`)
  }
  if (!run.inputSubjectIds.has(other.subjectId)) fail(`${shortId(id)} is in subject ${other.subjectKey} (${other.scope.kind}); list its subject in the input with its digest`)
  return { record: other.records.find(({ guidance }) => guidance.id === id), subject: other }
}

// Nothing changes either record. Both subjects are reviewed again, because a queued decision or a
// flag lives only in the report.
const decideContradiction = ({ action, subject, run }) => {
  const pair = [action.targetId, action.conflictingId].map((id) => applicableRecord({ id, subject, run }))
  if (pair.every((each) => each.subject !== subject)) fail('a contradiction names at least one record of its own subject')
  pair.forEach((each) => run.unresolved.add(each.subject.subjectId))
  if (pair.some(({ record }) => record.confirmed)) run.queued.push({ kind: 'contradiction', targetId: action.targetId, conflictingId: action.conflictingId, reason: action.reason })
  else run.flags.push({ kind: 'conflict', targetIds: [action.targetId, action.conflictingId], reason: action.reason })
}

const decideArchive = ({ action, record, subject, run }) => {
  if (action.duplicateOf === action.targetId) fail('dream archive duplicateOf names its own target')
  if (isGuidanceId(action.duplicateOf)) {
    const status = run.memory.guidance.find(({ id }) => id === action.duplicateOf)?.status ?? 'missing'
    if (status !== 'active') fail(`duplicateOf must name an active record: ${shortId(action.duplicateOf)} is ${status}`)
    record(action.duplicateOf)
  }
  const target = record(action.targetId)
  requireNotHeld({ run, ids: [action.targetId] })
  if (target.confirmed || subject.scope.kind === 'shared') {
    run.flags.push({ kind: target.confirmed ? 'confirmed-duplicate' : 'shared-proposal', targetIds: [action.targetId], duplicateOf: action.duplicateOf, reason: action.reason })
    return
  }
  claimTargets({ run, ids: [action.targetId] })
  const guidance = run.memory.guidance.find(({ id }) => id === action.targetId)
  run.entries.push(archiveInPlace({ memory: run.memory, annotations: run.annotations, target: guidance, reason: action.reason, now: run.now, fields: { runId: run.runId } }))
}

const decideConsolidation = ({ action, record, subject, run }) => {
  const targets = action.targetIds.map(record)
  requireNotHeld({ run, ids: action.targetIds })
  // Shared guidance is not consolidated yet, so a shared overlap is left to the user.
  if (subject.scope.kind === 'shared') {
    run.flags.push({ kind: 'shared-overlap', targetIds: action.targetIds, reason: action.reason })
    return
  }
  requireNotDeclined({ declined: run.declined, fingerprints: targets.map(({ guidance }) => guidance.fingerprint) })
  if (byteLength(action.replacement.learning) > targets.reduce((total, { guidance }) => total + byteLength(guidance.learning), 0)) {
    fail('a consolidation must not be longer than the records it replaces')
  }
  claimTargets({ run, ids: action.targetIds })
  const plan = planConsolidation({ memory: run.memory, annotations: run.annotations, excused: run.excused, targetIds: action.targetIds, replacement: action.replacement })
  if (consolidationLeftToUser({ action, targets, plan, run })) {
    run.flags.push({ kind: 'confirmed-overlap', targetIds: action.targetIds, reason: action.reason })
    return
  }
  if (plan.confirmsReplacement) {
    // Built here too, so a preview refuses a proposal that proposals.json would reject.
    newProposal({ plan, reason: action.reason, now: run.now })
    run.proposals.push({ plan, reason: action.reason })
    return
  }
  run.entries.push(consolidateInPlace({ memory: run.memory, annotations: run.annotations, plan, reason: action.reason, source: 'dream', now: run.now, fields: { runId: run.runId } }))
}

// A merge that confirmed guidance forbids, which neither an automatic change nor a proposal can
// carry: its replacement would hide a confirmed shared record from retrieval, or a target counts
// as confirmed only because a reconcile voided its confirmation, which an approval cannot confirm.
const consolidationLeftToUser = ({ action, targets, plan, run }) => (
  hiddenConfirmedIds({ memory: run.memory, learning: action.replacement.learning, isConfirmed: ({ id }) => run.confirmed.has(id) }).length > 0
  || (!plan.confirmsReplacement && targets.some(({ confirmed }) => confirmed))
)

// A subject that is not due comes to a run only as context for a due subject that applies with
// it, so it takes only a contradiction that names a record of that due subject.
const requireContextAction = ({ action, subject, run }) => {
  if (run.due.has(subject.subjectId)) return
  const ofDueSubject = (id) => [...run.subjects.values()].some((other) => (
    run.due.has(other.subjectId) && appliesWith(subject, other) && other.records.some(({ guidance }) => guidance.id === id)
  ))
  if (action.action !== 'contradiction' || ![action.targetId, action.conflictingId].some(ofDueSubject)) {
    fail(`subject ${subject.subjectKey} (${subject.scope.kind}) is context for this run: it takes only a contradiction with a record of a due subject that applies with it`)
  }
}

// Decides one action by the lifecycle rules. Automation never changes a confirmed record or,
// for now, a shared one: those changes become proposals, flags, or queued decisions, and never a
// proposal for a shared record. Every other change is applied to the working copies and journaled.
const dreamDecisions = { flag: decideFlag, contradiction: decideContradiction, archive: decideArchive, consolidate: decideConsolidation }
const decideDreamAction = ({ action, subject, run }) => {
  requireContextAction({ action, subject, run })
  const record = (id) => subject.records.find(({ guidance }) => guidance.id === id)
    ?? fail(`${id} is not live guidance in subject ${subject.subjectKey}`)
  dreamDecisions[action.action]({ action, record, subject, run })
}

const dreamReport = ({ run, applied, stored = [] }) => ({
  operations: run.entries.map((entry) => ({
    action: entry.action,
    targetIds: run.memory.guidance.filter(({ fingerprint }) => entry.fingerprints.includes(fingerprint)).map(({ id }) => id).sort(),
    ...(entry.replacementFingerprint ? { replacementId: entry.replacementFingerprint.replace('fingerprint', 'guidance') } : {}),
    ...(applied ? appliedResult(entry) : {}),
  })),
  proposals: run.proposals.map(({ plan }, index) => proposalResult({ proposal: stored[index], plan })),
  queued: run.queued,
  flags: run.flags,
  undoWindowDays,
})

// The live guidance and each subject must still be as the plan saw them. Returns what changed,
// or undefined.
const planChange = ({ input, liveDigests, subjects }) => {
  for (const [source, digest] of Object.entries(liveDigests)) {
    if ((input.live[source] ?? null) !== digest) return `live guidance ${source} changed since the plan; plan again`
  }
  for (const { subjectId, digest } of input.subjects) {
    const subject = subjects.get(subjectId)
    if (subject?.digest !== digest) return `subject ${subject ? `${subject.subjectKey} (${subject.scope.kind})` : subjectId} changed since the plan; plan again`
  }
  return undefined
}

// The run entry makes a replay a no-op and holds the report a replay returns. For each subject it
// reviewed and left nothing unresolved, it records the subject's digest and the live state of
// every known source, null for one that is absent, so the next plan skips that subject only while
// both are unchanged. Its proposals' expiries let that plan review a subject again, with a new
// digest, once a proposal lapses.
const runEntry = ({ input, liveDigests, run, stored, report }) => {
  const after = subjectStates({ memory: run.memory, annotations: run.annotations, excused: run.excused, lapsed: run.lapsed })
  const resolved = input.subjects.filter(({ subjectId }) => after.has(subjectId) && !run.unresolved.has(subjectId))
  const live = liveStateOf(liveDigests)
  return {
    type: 'run',
    runId: run.runId,
    at: run.now,
    revision: run.memory.revision + (run.entries.length > 0 ? 1 : 0),
    operationIds: run.entries.map(({ operationId }) => operationId),
    // A stored proposal holds only a digest of its scope, so the subject comes from its plan.
    proposals: stored.map((proposal, index) => ({ id: proposal.id, subjectId: subjectIdFor(run.proposals[index].plan), expiresAt: proposal.expiresAt })),
    subjectDigests: Object.fromEntries(resolved.map(({ subjectId }) => [subjectId, { digest: after.get(subjectId).digest, live }])),
    report,
  }
}

// The read shape of the run and run-intent entries above: each field the writer issues, with the
// writer's ID and digest patterns, and no other field. Each check returns a boolean, so a malformed
// entry makes the journal unreadable instead of throwing from a reader.
const passes = (check) => (value) => {
  try {
    check(value)
    return true
  } catch {
    return false
  }
}
const matching = (pattern) => (value) => isString(value) && pattern.test(value)
const oneOf = (...values) => (value) => values.includes(value)
const arrayOf = (valid) => (value) => Array.isArray(value) && value.every(valid)
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
// The fields of value that are unsupported, missing, or invalid. An optional field is checked only when present.
const shapeProblems = ({ value, required, optional = {} }) => [
  ...Object.keys(value).filter((field) => !Object.hasOwn(required, field) && !Object.hasOwn(optional, field)),
  ...Object.entries(required).filter(([field, valid]) => !Object.hasOwn(value, field) || !valid(value[field])).map(([field]) => field),
  ...Object.entries(optional).filter(([field, valid]) => Object.hasOwn(value, field) && !valid(value[field])).map(([field]) => field),
]
const exactShape = (required, optional) => (value) => isPlainObject(value) && shapeProblems({ value, required, optional }).length === 0
// Picks the shape by the value of one field, such as an action or a kind.
const shapeBy = (field, shapes) => (value) => isPlainObject(value) && isString(value[field]) && Object.hasOwn(shapes, value[field]) && shapes[value[field]](value)

const isTimestamp = passes((value) => requireTimestamp({ value, label: 'timestamp' }))
// A finished run's report is returned as stored, so its reasons pass the writer's new-text guard too.
const isReason = passes((value) => {
  requireReason(value)
  assertSafeNewValue({ value, label: 'reason' })
})
// Unique guidance IDs, as many as the writer issues for that field.
const isGuidanceIds = ({ min, max = min }) => (value) => (
  Array.isArray(value) && value.length >= min && value.length <= max && new Set(value).size === value.length && value.every(isGuidanceId)
)
const isOperationId = matching(operationIdPattern)
const isLiveSource = oneOf(...liveSources)
const isTargetGroup = isGuidanceIds({ min: 2, max: maxConsolidationTargets })
const isFlaggedIds = isGuidanceIds({ min: 1, max: maxConsolidationTargets })
const appliedFields = { operationId: isOperationId, undoUntil: isTimestamp, undo: isString }
const isReportOperation = (value) => shapeBy('action', {
  consolidate: exactShape({ action: oneOf('consolidate'), targetIds: isTargetGroup, ...appliedFields, replacementId: isGuidanceId }),
  archive: exactShape({ action: oneOf('archive'), targetIds: isGuidanceIds({ min: 1 }), ...appliedFields }),
})(value) && value.undo === `undo-operation --id ${value.operationId}`
const isReportProposal = (value) => exactShape({
  proposalId: matching(proposalIdPattern),
  confirmPrompt: isString,
  targetIds: isTargetGroup,
  // A run proposes only a merge that confirms its replacement.
  confirmsReplacement: oneOf(true),
  expiresAt: isTimestamp,
})(value) && value.confirmPrompt === confirmPromptFor({ id: value.proposalId })
const flagShape = ({ kind, targetIds, required = {}, optional = {} }) => exactShape({ kind: oneOf(kind), targetIds, ...required, reason: isReason }, optional)
const duplicateOfField = { duplicateOf: (value) => isGuidanceId(value) || (isString(value) && value.startsWith('live:') && isLiveSource(value.slice('live:'.length))) }
// A conflict flag comes from a flag action or from a contradiction, which names two records.
const isReportFlag = shapeBy('kind', {
  conflict: flagShape({ kind: 'conflict', targetIds: isFlaggedIds, optional: { source: isLiveSource } }),
  unused: flagShape({ kind: 'unused', targetIds: isFlaggedIds, optional: { source: isLiveSource } }),
  'live-edit': flagShape({ kind: 'live-edit', targetIds: isFlaggedIds, required: { source: isLiveSource } }),
  'confirmed-duplicate': flagShape({ kind: 'confirmed-duplicate', targetIds: isGuidanceIds({ min: 1 }), required: duplicateOfField }),
  'shared-proposal': flagShape({ kind: 'shared-proposal', targetIds: isGuidanceIds({ min: 1 }), required: duplicateOfField }),
  'shared-overlap': flagShape({ kind: 'shared-overlap', targetIds: isTargetGroup }),
  'confirmed-overlap': flagShape({ kind: 'confirmed-overlap', targetIds: isTargetGroup }),
})
const isQueuedContradiction = (value) => exactShape({ kind: oneOf('contradiction'), targetId: isGuidanceId, conflictingId: isGuidanceId, reason: isReason })(value)
  && value.targetId !== value.conflictingId
const runEntryFields = {
  type: oneOf('run', 'run-intent'),
  runId: matching(/^run:v1:[0-9a-f]{64}$/),
  at: isTimestamp,
  revision: (value) => Number.isInteger(value) && value >= 0,
  operationIds: arrayOf(isOperationId),
  proposals: arrayOf(exactShape({ id: matching(proposalIdPattern), subjectId: matching(subjectIdPattern), expiresAt: isTimestamp })),
  subjectDigests: (value) => isPlainObject(value) && Object.entries(value).every(([subjectId, state]) => (
    subjectIdPattern.test(subjectId) && exactShape({ digest: matching(subjectDigestPattern), live: matching(/^live-state:v1:[0-9a-f]{64}$/) })(state)
  )),
  report: exactShape({
    operations: arrayOf(isReportOperation),
    proposals: arrayOf(isReportProposal),
    queued: arrayOf(isQueuedContradiction),
    flags: arrayOf(isReportFlag),
    undoWindowDays: oneOf(undoWindowDays),
  }),
}

// Whether a well-formed entry's report names the entry's own operations, in order, each with the
// undo deadline of the run's time, and its own proposals, in order, with their expiries.
const reportMatchesEntry = ({ at, operationIds, proposals, report }) => {
  const undoUntil = new Date(Date.parse(at) + undoWindowDays * dayMs).toISOString()
  return report.operations.length === operationIds.length
    && report.operations.every((operation, index) => operation.operationId === operationIds[index] && operation.undoUntil === undoUntil)
    && report.proposals.length === proposals.length
    && report.proposals.every(({ proposalId, expiresAt }, index) => proposalId === proposals[index].id && expiresAt === proposals[index].expiresAt)
}

// The fields of a run or run-intent entry that do not have the shape dream apply writes. Only
// recovery marks a run entry recovered.
const runEntryProblems = (entry) => {
  const problems = shapeProblems({
    value: entry,
    required: runEntryFields,
    optional: entry.type === 'run' ? { recovered: oneOf(true) } : {},
  })
  return problems.length > 0 || reportMatchesEntry(entry) ? problems : ['report']
}

// A run journals its entry as an intent before it writes memory and as a run after. A crash in
// between leaves an intent whose operations reached memory: the run happened, so it counts as
// recorded. An intent whose operations never reached memory stays unrecorded. This computes the
// run entries recovery adds and writes nothing, so a plan can count them too.
const recoveredRuns = ({ journal, memory }) => {
  const operations = operationsIn(journal)
  const landed = (operationId) => {
    const state = operations.get(operationId)?.state
    return state === 'committed' || (state === 'pending' && operationLanded({ memory, operationId }))
  }
  const recorded = new Set(journal.filter(({ type }) => type === 'run').map(({ runId }) => runId))
  return journal
    .filter(({ type, runId, operationIds }) => type === 'run-intent' && !recorded.has(runId) && operationIds.every(landed))
    .map((intent) => ({ ...intent, type: 'run', recovered: true }))
}

const recoverRuns = ({ paths, journal, memory }) => {
  const entries = recoveredRuns({ journal, memory })
  appendJournal({ paths, entries })
  return [...journal, ...entries]
}

const readOrRefuse = ({ read, label }) => {
  try {
    return read()
  } catch (error) {
    fail(`dream apply needs ${label}: ${error.message}`)
  }
}

// The plan shows confirmations through display readers, which show none when the journal or
// annotations cannot be read or the watermark lags memory. A run decides by confirmation, so it
// refuses in each of those cases before it writes anything, recovery included; it also refuses
// when proposals.json cannot be read, which decides which proposals lapsed. Otherwise it reads the
// same journal, annotations, excused revocations, and proposals as the plan, so both agree.
// Returns the journal as read, before recovery, and the IDs in proposals.json.
const requireReadableDreamState = ({ paths, memory }) => {
  const { journal, error } = journalForDisplay(paths)
  if (error) fail(`dream apply needs a readable journal: ${error}`)
  readOrRefuse({ read: () => readAnnotations(paths.annotationsFile), label: 'readable annotations' })
  const { proposals } = readOrRefuse({ read: () => readProposals(paths), label: 'a readable proposals.json' })
  if (!watermarkCurrent({ paths, memory })) {
    fail('dream apply needs the annotation watermark to match memory: an older plugin or an interrupted write left it behind. '
      + 'The next Field Guide write that takes the memory lock reconciles it and voids confirmations; then plan again')
  }
  return { journal, published: new Set(proposals.map(({ id }) => id)) }
}

// A JSON value with the keys of every object sorted and arrays in their order, so an input whose
// keys come in another order is the same run.
const sortedKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortedKeys)
  if (!isPlainObject(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedKeys(value[key])]))
}

// The run entry of a finished run, including one that recovery would record for an intent whose
// operations reached memory. It reads the journal as it is and writes nothing.
const finishedRun = ({ journal, memory, runId }) => [...journal, ...recoveredRuns({ journal, memory })]
  .findLast((entry) => entry.type === 'run' && entry.runId === runId)

const confirmedIdsOf = (subjects) => new Set([...subjects.values()].flatMap(({ records }) => records.filter(({ confirmed }) => confirmed).map(({ guidance }) => guidance.id)))

// The state that one run decides against, from the recovered journal, as the plan computes it,
// with working copies of memory and annotations: a preview and its apply run the same code, and
// the preview writes nothing.
const dreamRun = ({ paths, input, memory, journal, liveDigests, published, runId }) => {
  const annotations = readAnnotations(paths.annotationsFile)
  const operations = operationsIn(journal)
  const excused = unlandedRevocations({ operations, memory })
  const runs = journal.filter(({ type }) => type === 'run')
  const lapsed = lapsedRuns({ runs, operations, published })
  const subjects = subjectStates({ memory, annotations, excused, lapsed })
  const open = openContradictions({ runs, subjects })
  const reviewed = reviewedStates(runs)
  const live = liveStateOf(liveDigests)
  const confirmed = confirmedIdsOf(subjects)
  return {
    runId,
    guideRoot: paths.guideRoot,
    now: new Date().toISOString(),
    memory: structuredClone(memory),
    annotations: structuredClone(annotations),
    excused,
    lapsed,
    declined: declinedSets(operations),
    subjects,
    due: new Set([...subjects.values()].filter((subject) => isDue({ subject, reviewed, open, live })).map(({ subjectId }) => subjectId)),
    confirmed,
    inputSubjectIds: new Set(input.subjects.map(({ subjectId }) => subjectId)),
    held: heldRecords({ input, confirmed, open }),
    superseding: supersedingIds(memory),
    targeted: new Set(),
    unresolved: new Set(),
    entries: [],
    proposals: [],
    queued: [],
    flags: [],
  }
}

// Decides each action of the input. A subject whose run leaves a flag or a queued decision is
// reviewed again, because those live only in the report. So is a subject listed without each
// subject that applies with it, such as one the packet budget left out: a contradiction may pair
// their records, so the review is not complete.
const decideRun = ({ input, run }) => {
  input.subjects.forEach((subject, subjectIndex) => {
    const reported = run.flags.length + run.queued.length
    const state = run.subjects.get(subject.subjectId)
    subject.actions.forEach((action, actionIndex) => forAction({
      label: `subjects[${subjectIndex}].actions[${actionIndex}]`,
      action,
      step: () => decideDreamAction({ action, subject: state, run }),
    }))
    const counterpartMissing = [...run.subjects.values()].some((other) => appliesWith(state, other) && !run.inputSubjectIds.has(other.subjectId))
    if (run.flags.length + run.queued.length > reported || counterpartMissing) run.unresolved.add(subject.subjectId)
  })
}

const applyDreamRunUnlocked = ({ paths, input, readLiveDigests, previewToken }) => {
  // Read under the lock, so the live guidance compared with the plan is the state this run writes against.
  const liveDigests = readLiveDigests()
  const memory = readInitializedMemory(paths)
  const { journal: journaled, published } = requireReadableDreamState({ paths, memory })
  const runId = hashIdentity({ prefix: 'run', values: [1, sortedKeys(input)] })
  // Before any other check or any recovery: a run with a run entry is final, whatever its
  // proposals' expiry, so replaying it returns its report and writes nothing. The report offers
  // only the proposals still in proposals.json. A review after a proposal lapsed comes from a new
  // plan, whose subject digest names the lapse, so it is a new run.
  const finished = finishedRun({ journal: journaled, memory, runId })
  if (finished) {
    const proposals = finished.report.proposals.filter(({ proposalId }) => published.has(proposalId))
    return { mode: 'dream-apply', outcome: 'already-applied', runId, ...finished.report, proposals }
  }
  const journal = recoverRuns({ paths, journal: recoverOperations({ paths, memory }), memory })
  validateDreamInput({ input, liveDigests })
  const run = dreamRun({ paths, input, memory, journal, liveDigests, published, runId })
  const change = planChange({ input, liveDigests, subjects: run.subjects })
  if (change) fail(change)
  const token = hashIdentity({ prefix: 'dream-preview', values: [1, runId, contentDigest(memory), contentDigest(run.annotations)] })
  decideRun({ input, run })
  if (run.entries.length > maxDreamOperations) fail(`a dream run applies at most ${maxDreamOperations} changes; the run applied nothing`)
  if (previewToken === undefined) return { mode: 'dream-apply', outcome: 'preview', runId, previewToken: token, ...dreamReport({ run, applied: false }) }
  if (previewToken !== token) fail('dream apply requires the current dry-run previewToken')
  // Every applied run journals its run entries, even one that only flags or queues.
  requireCurrentReaders({ readerFile: dreamRunReaderFile, reads: 'nightly run entries' })
  const { store, stored } = preparedProposals({ paths, plans: run.proposals, now: run.now })
  const report = dreamReport({ run, applied: true, stored })
  const entry = runEntry({ input, liveDigests, run, stored, report })
  const intent = { ...entry, type: 'run-intent' }
  // The plan and a replay read these entries with this check, so a run writes only entries they read.
  for (const each of [intent, entry]) {
    const invalid = runEntryProblems(each)
    if (invalid.length > 0) fail(`the ${each.type} entry has an invalid ${invalid.join(', ')}; the run applied nothing`)
  }
  appendJournal({ paths, entries: [intent] })
  if (run.entries.length > 0) commitOperations({ paths, memory: run.memory, annotations: run.annotations, entries: run.entries })
  appendJournal({ paths, entries: [entry] })
  // Proposals are published only once the run entry makes the run final, so no proposal of a run
  // that failed can be approved. A crash before this write loses them: they count as lapsed, so
  // the next plan reviews their subject again, and a replay does not offer them.
  if (store) writeProposals({ paths, store })
  return { mode: 'dream-apply', outcome: 'applied', runId, ...report }
}

/**
 * Validates and applies one nightly run's actions: schema, privacy guard, allowed actions,
 * thresholds, live and per-subject digests, then a preview token. It rejects confirmation fields
 * and applies every change in one journaled memory write. A finished run replays as a no-op.
 * readLiveDigests returns the live digests by source; it runs once the memory lock is held.
 */
export const applyDreamRun = ({ paths, input, readLiveDigests, previewToken }) => (
  // The lock does not reconcile a lagging watermark here: that voids every confirmation, and the
  // run refuses instead.
  withMemoryLock({ paths, reconcile: false, action: () => applyDreamRunUnlocked({ paths, input, readLiveDigests, previewToken }) })
)

const initialize = (paths) => {
  mkdirSync(paths.sharedRoot, { recursive: true })
  mkdirSync(paths.reviewsRoot, { recursive: true })

  ensureFile(
    paths.rootIndex,
    '# Field Guide\n\nRead only the guidance relevant to the current task.\n\n## Shared guidance\n\n## Projects\n',
  )
  ensureFile(
    paths.projectIndex,
    `# ${paths.repositoryName} Field Guide\n\n`
      + `- Identity: \`${paths.identity}\`\n`
      + `- Origin: \`${paths.origin ?? 'not available'}\`\n`
      + `- Initialized from: \`${paths.repositoryRoot}\`\n\n`
      + '## Durable patterns\n\n'
      + '## Review evidence\n',
  )
  ensureFile(
    paths.patternsFile,
    `# ${paths.repositoryName} Patterns\n\n`
      + 'Keep current project-specific preferences and anti-patterns here, with links to supporting review records.\n',
  )

  ensureIndexEntry({
    indexPath: paths.rootIndex,
    heading: 'Projects',
    linkPath: paths.projectIndex,
    label: paths.repositoryName,
    description: `Project-specific patterns and committed review evidence for ${paths.repositoryName}.`,
  })
  ensureIndexEntry({
    indexPath: paths.projectIndex,
    heading: 'Durable patterns',
    linkPath: paths.patternsFile,
    label: 'Project patterns',
    description: 'Current project-specific preferences and anti-patterns.',
  })

  const hasCanonicalMemory = existsSync(paths.memoryIndexFile)
  const hasMemoryCache = existsSync(paths.memoryFile)
  if (hasCanonicalMemory !== hasMemoryCache) {
    if (hasMemoryCache) fail('Field-guide memory has a JSON cache without canonical memory.md')
    fail('Field-guide memory has canonical memory.md without a JSON cache')
  }
  if (!hasCanonicalMemory) writeMemoryViews({ paths, memory: emptyMemory() })
  validate(paths)
}

const markdownLinks = (content) => (
  [...content.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)].map((match) => match[1])
)

const isExternalLink = (link) => (
  /^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith('#')
)

const validateLinks = ({ indexPath, errors }) => {
  const content = readFileSync(indexPath, 'utf8')
  for (const link of markdownLinks(content)) {
    if (isExternalLink(link)) continue
    const target = resolve(dirname(indexPath), link)
    if (!existsSync(target)) errors.push(`${indexPath} links to missing file: ${link}`)
  }
  return content
}

const markdownFiles = (directory) => {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(directory, entry.name))
    .sort()
}

const projectIndexes = (projectsRoot) => {
  if (!existsSync(projectsRoot)) return []
  return readdirSync(projectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(projectsRoot, entry.name, 'init.md'))
    .filter(existsSync)
    .sort()
}

const requireInitialized = (paths) => {
  const required = [paths.rootIndex, paths.projectIndex, paths.patternsFile, paths.reviewsRoot]
  const missing = required.filter((path) => !existsSync(path))
  if (missing.length > 0) fail(`Field guide is not initialized; missing: ${missing.join(', ')}`)
}

const validateIndexedFiles = ({ files, indexPath, indexContent, errors }) => {
  for (const file of files) {
    const link = relative(dirname(indexPath), file).replaceAll('\\', '/')
    if (!indexContent.includes(`](${link})`)) errors.push(`${file} is not linked from ${indexPath}`)
  }
}

const validateIdentity = ({ paths, errors }) => {
  if (readIdentity(paths.projectIndex) !== paths.identity) {
    errors.push(`${paths.projectIndex} does not match repository identity ${paths.identity}`)
  }
}

const validateReviewCommit = ({ reviewFile, paths, errors }) => {
  const review = readFileSync(reviewFile, 'utf8')
  const commit = review.match(/^- Commit: `([0-9a-f]{40})`$/m)?.[1]
  if (!commit) {
    errors.push(`${reviewFile} is missing a full 40-character Commit field`)
    return
  }

  const resolvedCommit = git({
    repoRoot: paths.repositoryRoot,
    args: ['rev-parse', '--verify', `${commit}^{commit}`],
    optional: true,
  })
  if (resolvedCommit !== commit) errors.push(`${reviewFile} references unknown commit ${commit}`)
}

const validateReviews = ({ paths, projectContent, errors }) => {
  const reviewFiles = markdownFiles(paths.reviewsRoot)
  validateIndexedFiles({
    files: reviewFiles,
    indexPath: paths.projectIndex,
    indexContent: projectContent,
    errors,
  })
  for (const reviewFile of reviewFiles) {
    validateReviewCommit({ reviewFile, paths, errors })
  }
}

const validateGuidanceLinks = ({ paths, reviewFiles, sharedFiles, errors }) => {
  const guidanceFiles = [paths.patternsFile, ...reviewFiles, ...sharedFiles]
  for (const guidanceFile of guidanceFiles) {
    validateLinks({ indexPath: guidanceFile, errors })
  }
}

const projectReviewReference = ({ sharedFile, link, paths }) => {
  if (isExternalLink(link)) return null
  const target = resolve(dirname(sharedFile), link)
  const projectRelative = relative(paths.projectsRoot, target).replaceAll('\\', '/')
  const match = projectRelative.match(/^(?!\.\.\/)([^/]+)\/reviews\/[^/]+\.md$/)
  if (!match) return null
  return { projectKey: match[1], target }
}

const projectIndexFor = ({ projectKey, paths }) => (
  join(paths.projectsRoot, projectKey, 'init.md')
)

const isIndexedReview = ({ reference, paths }) => {
  const projectIndex = projectIndexFor({ projectKey: reference.projectKey, paths })
  if (!existsSync(projectIndex)) return false
  const link = relative(dirname(projectIndex), reference.target).replaceAll('\\', '/')
  return readFileSync(projectIndex, 'utf8').includes(`](${link})`)
}

const commitFromReview = (reviewFile) => {
  if (!existsSync(reviewFile)) return ''
  return readFileSync(reviewFile, 'utf8').match(/^- Commit: `([0-9a-f]{40})`$/m)?.[1] ?? ''
}

const initializedRootFrom = (projectIndex) => {
  if (!existsSync(projectIndex)) return ''
  return readFileSync(projectIndex, 'utf8').match(/^- Initialized from: `(.+)`$/m)?.[1] ?? ''
}

const reviewCommitExists = ({ reference, paths }) => {
  const projectIndex = projectIndexFor({ projectKey: reference.projectKey, paths })
  const repoRoot = initializedRootFrom(projectIndex)
  const commit = commitFromReview(reference.target)
  if (!repoRoot || !commit) return false
  return git({
    repoRoot,
    args: ['rev-parse', '--verify', `${commit}^{commit}`],
    optional: true,
  }) === commit
}

const sharedEvidenceProjects = ({ sharedFile, content, paths }) => (
  new Set(
    markdownLinks(content)
      .map((link) => projectReviewReference({ sharedFile, link, paths }))
      .filter(Boolean)
      .filter((reference) => isIndexedReview({ reference, paths }))
      .filter((reference) => reviewCommitExists({ reference, paths }))
      .map((reference) => reference.projectKey),
  )
)

const hasValidSharedPromotion = ({ sharedFile, content, paths }) => {
  const mode = content.match(
    /^- Promotion: `(explicit-general-preference|multi-project-evidence)`$/m,
  )?.[1]
  if (mode === 'explicit-general-preference') {
    return /^- Preference source: \S.+$/m.test(content)
  }
  if (mode === 'multi-project-evidence') {
    return sharedEvidenceProjects({ sharedFile, content, paths }).size >= 2
  }
  return false
}

const validateSharedPromotions = ({ sharedFiles, paths, errors }) => {
  for (const sharedFile of sharedFiles) {
    const content = readFileSync(sharedFile, 'utf8')
    if (!hasValidSharedPromotion({ sharedFile, content, paths })) {
      errors.push(`${sharedFile} is missing valid promotion evidence`)
    }
  }
}

// Every validation error, one per item, so a reader can redact each on its own.
// Each restore of archived guidance must link, through the journal, to the archive it undoes. A
// journal that cannot be read cannot show that link, so a store that holds a restore fails.
const restoreLinkErrors = ({ paths, memory }) => {
  const { operations, error } = journalForDisplay(paths)
  if (operations) return unlinkedRestores({ memory, operations })
  return unlinkedRestores({ memory, operations: new Map() }).length > 0 ? [`restored archives cannot be checked: ${error}`] : []
}

const validationErrorsFor = (paths) => {
  requireInitialized(paths)
  const errors = []
  const rootContent = validateLinks({ indexPath: paths.rootIndex, errors })
  const projectContent = validateLinks({ indexPath: paths.projectIndex, errors })
  const reviewFiles = markdownFiles(paths.reviewsRoot)
  const sharedFiles = markdownFiles(paths.sharedRoot)

  validateIdentity({ paths, errors })
  validateIndexedFiles({
    files: sharedFiles,
    indexPath: paths.rootIndex,
    indexContent: rootContent,
    errors,
  })
  validateIndexedFiles({
    files: projectIndexes(paths.projectsRoot),
    indexPath: paths.rootIndex,
    indexContent: rootContent,
    errors,
  })
  validateIndexedFiles({
    files: [paths.patternsFile],
    indexPath: paths.projectIndex,
    indexContent: projectContent,
    errors,
  })
  validateReviews({ paths, projectContent, errors })
  validateGuidanceLinks({ paths, reviewFiles, sharedFiles, errors })
  validateSharedPromotions({ sharedFiles, paths, errors })
  const memory = readMemory(paths)
  if (!memory) {
    errors.push(`${paths.memoryIndexFile} is missing or invalid`)
  } else {
    if (readFileSync(paths.memoryIndexFile, 'utf8') !== renderMemoryIndex(memory)) {
      errors.push(`${paths.memoryIndexFile} is not canonical`)
    }
    const memoryLink = relative(dirname(paths.rootIndex), paths.memoryIndexFile).replaceAll('\\', '/')
    if (!rootContent.includes(`](${memoryLink})`)) errors.push(`${paths.memoryIndexFile} is not linked from ${paths.rootIndex}`)
    const cachedMemory = readJsonMemory(paths)
    if (!cachedMemory || JSON.stringify(cachedMemory) !== JSON.stringify(memory)) {
      errors.push(`${paths.memoryFile} does not match canonical memory.md`)
    }
    errors.push(...restoreLinkErrors({ paths, memory }))
  }
  try {
    readAnnotations(paths.annotationsFile)
  } catch (error) {
    errors.push(`${paths.annotationsFile} is invalid: ${error.message}`)
  }
  return errors
}

const validate = (paths) => {
  const errors = validationErrorsFor(paths)
  if (errors.length > 0) fail(`Field guide validation failed:\n- ${errors.join('\n- ')}`)
}

// Runs retrieve from the CLI, where only the environment shows a delegate thread, and records
// guidance retrievals in analytics.
const retrieveCommand = ({ paths, options }) => {
  const result = retrieve({
    paths,
    subjectKey: options.subject,
    query: options.query,
    evidenceFor: options['evidence-for'],
    event: options.event,
    mainThread: isMainThread({ env: process.env }),
  })
  if (result.mode === 'evidence') return result
  const event = appendAnalyticsEvent({
    guideRoot: paths.guideRoot,
    event: {
      type: 'retrieval',
      projectKey: paths.projectKey,
      guidanceIds: result.guidance.map(({ id }) => id),
    },
  })
  return event ? { ...result, analyticsEventId: event.id } : result
}

// Records a lifecycle change in analytics when analytics is enabled.
const withLifecycleEvent = ({ paths, type, result }) => {
  appendAnalyticsEvent({
    guideRoot: paths.guideRoot,
    event: { type, projectKey: paths.projectKey, guidanceId: result.targetId, outcome: result.outcome },
  })
  return result
}

const analyticsInput = (options) => readSubmissionInput({ inputPath: options.input, inputJson: options['input-json'] })

// Each command returns its result, or undefined when it reports only the resolved paths.
const commandHandlers = {
  'analytics-enable': ({ paths }) => configureAnalytics({ guideRoot: paths.guideRoot, enabled: true }),
  'analytics-disable': ({ paths }) => configureAnalytics({ guideRoot: paths.guideRoot, enabled: false }),
  'analytics-report': ({ paths, options }) => reportAnalytics({ guideRoot: paths.guideRoot, since: options.since }),
  'analytics-impact': ({ paths, options }) => recordImpact({ guideRoot: paths.guideRoot, input: analyticsInput(options) }),
  'analytics-review': ({ paths, options }) => recordReview({ guideRoot: paths.guideRoot, input: analyticsInput(options) }),
  annotate: ({ paths, options }) => annotate({ paths, reference: options.id, triggers: options.triggers, removeTrigger: options['remove-trigger'] }),
  audit: ({ paths }) => audit(paths),
  candidates: ({ paths, options }) => candidateMatches({ paths, subjectKey: options.subject, scope: options.scope }),
  consolidate: ({ paths, options }) => consolidate({ paths, inputPath: options.input, approval: options.approval }),
  delete: ({ paths, options }) => deleteGuidance({ paths, inputPath: options.input }),
  export: ({ paths, options }) => exportSharedGuidance({ paths, outputPath: options.output, annotationsPath: options.annotations }),
  import: ({ paths, options }) => importSharedGuidance({ paths, inputPath: options.input, annotationsPath: options.annotations }),
  init: ({ paths }) => initialize(paths),
  maintain: ({ paths, options }) => maintain({ paths, inputPath: options.input }),
  paths: () => undefined,
  retrieve: ({ paths, options }) => retrieveCommand({ paths, options }),
  submit: ({ paths, options }) => withLifecycleEvent({
    paths,
    type: 'submission',
    result: submitObservation({ paths, inputPath: options.input, inputJson: options['input-json'] }),
  }),
  transition: ({ paths, options }) => withLifecycleEvent({ paths, type: 'transition', result: transitionGuidance({ paths, inputPath: options.input }) }),
  unconfirm: ({ paths, options }) => unconfirm({ paths, reference: options.id }),
  'undo-operation': ({ paths, options }) => undoOperation({ paths, reference: options.id }),
  validate: ({ paths }) => validate(paths),
}

const main = () => {
  const { command, options } = parseArgs(process.argv.slice(2))
  const paths = resolvePaths({ repoRoot: options['repo-root'], guideRoot: options['guide-root'] })
  const result = commandHandlers[command]({ paths, options })
  process.stdout.write(`${JSON.stringify({ ...paths, ...(result ? { result } : {}) }, null, 2)}\n`)
}

/** Runs a CLI's main when its file is the process entry point, and reports an error on stderr. */
export const runIfEntryPoint = ({ path, main: run }) => {
  try {
    if (realpathSync(process.argv[1]) !== path) return
  } catch {
    // The lifecycle hook imports this module; it has no command to run.
    return
  }
  try {
    run()
  } catch (error) {
    process.stderr.write(`${basename(path)}: ${error.message}\n`)
    process.exitCode = 1
  }
}

runIfEntryPoint({ path: scriptPath, main })
