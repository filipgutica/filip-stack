#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
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

const commands = new Set([
  'analytics-disable', 'analytics-enable', 'analytics-impact', 'analytics-report', 'analytics-review',
  'annotate', 'audit', 'candidates', 'delete', 'export', 'import', 'init', 'maintain', 'paths', 'retrieve', 'submit', 'transition', 'unconfirm', 'validate',
])
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
])
// Options that only some commands accept.
const commandOptions = {
  event: ['retrieve'],
  annotations: ['export', 'import'],
  id: ['annotate', 'unconfirm'],
  triggers: ['annotate'],
  'remove-trigger': ['annotate'],
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
}

const parseArgs = (argv) => {
  const [command, ...rest] = argv
  if (!commands.has(command)) {
    fail('Usage: field-guide.mjs <analytics-disable|analytics-enable|analytics-impact|analytics-report|analytics-review|annotate|audit|candidates|delete|export|import|init|maintain|paths|retrieve|submit|transition|unconfirm|validate> --repo-root <path> [--guide-root <path>] [--input <json-file> | --input-json <json>] [--subject <key>] [--scope <project|shared>] [--query <text>] [--evidence-for <guidance-id>] [--event <trigger>] [--since <YYYY-MM-DD>] [--output <json-file>] [--annotations <json-file>] [--id <guidance-id>] [--triggers <list> | --remove-trigger <trigger>]')
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

const resolvePaths = ({ repoRoot: inputRoot, guideRoot: inputGuideRoot }) => {
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
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0085\u2028\u2029]/u.test(value)
    : /[\u0000-\u001f\u007f\u0085\u2028\u2029]/u.test(value)
)
const portableKey = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const sourceKeyPattern = /^source:v1:[0-9a-f]{64}$/
const fingerprintPattern = /^fingerprint:v1:[0-9a-f]{64}$/
const evidenceIdPattern = /^evidence:v1:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const guidanceIdPattern = /^guidance:v1:[0-9a-f]{64}$/
const retirementIdPattern = /^retirement:v1:[0-9a-f]{64}$/

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

const assertSafePersistedText = ({ value, label }) => {
  for (const { pattern, reason } of unsafePersistedTextPatterns) {
    if (pattern.test(value)) fail(`${label} contains a forbidden ${reason}`)
  }
}

const requireSafePersistedString = (options) => {
  const value = requireString(options)
  assertSafePersistedText({ value, label: options.label })
  return value
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
const validateTransitionRetirementId = ({ guidance, transition }) => {
  if (transition.retirementId === undefined) return
  if (transition.to !== 'superseded' || !retirementIdPattern.test(transition.retirementId)) fail('retirementId is valid only on a superseded transition')
  if (!guidance.retirements?.includes(transition.retirementId)) fail('a superseded transition names an unknown retirement')
}

const validateGuidanceRecord = (guidance) => {
  assertObject({ value: guidance, label: 'guidance record' })
  assertClosedFields({
    value: guidance,
    fields: ['id', 'fingerprint', 'scope', 'subjectKey', 'linkedSubjects', 'learning', 'status', 'confidence', 'generic', 'relationship', 'examples', 'evidenceIds', 'independentEvidenceCount', 'transitions', 'retirements', 'acknowledged', 'createdAt', 'updatedAt'],
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
    assertClosedFields({ value: transition, fields: ['from', 'to', 'reason', 'source', 'at', 'replacementId', 'retirementId'], label: 'guidance transition' })
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
    validateTransitionRetirementId({ guidance, transition })
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
  if (memory.schemaVersion !== 1) fail(`memory store has unsupported schema version: ${memory.schemaVersion}`)
  if (!Number.isSafeInteger(memory.revision) || memory.revision < 0) fail('memory store revision must be a non-negative integer')
  if (!Array.isArray(memory.guidance)) fail('memory store guidance must be an array')
  if (!Array.isArray(memory.evidence)) fail('memory store evidence must be an array')
  memory.guidance.forEach(validateGuidanceRecord)
  memory.evidence.forEach(validateEvidenceRecord)
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
      ])
      if (!allowedEdges.has(edge)) fail(`${guidance.id} has an illegal lifecycle transition: ${edge}`)
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
        || !replacement.relationship
        || !['refines', 'contradicts'].includes(replacement.relationship.kind)
        || replacement.relationship.targetId !== guidance.id) {
        fail(`${guidance.id} superseded transition requires a linked refinement or contradiction`)
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
  }
  return memory
}

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

const writeMemoryViews = ({ paths, memory }) => {
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
  const ownerFile = `${lockFile}.${randomUUID()}.tmp`
  writeFileSync(ownerFile, JSON.stringify({ pid: process.pid, pidNamespace: pidNamespace(), createdAt: Date.now() }))
  try {
    for (;;) {
      try {
        linkSync(ownerFile, lockFile)
        return
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

// Serializes writes to memory and annotations in one guide.
const withMemoryLock = ({ lockFile, action }) => {
  acquireLock(lockFile)
  try {
    return action()
  } finally {
    unlinkSync(lockFile)
  }
}

const submitObservationUnlocked = ({ paths, inputPath, inputJson }) => {
  requireInitialized(paths)
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run init first')
  const submission = validateSubmission({ submission: readSubmissionInput({ inputPath, inputJson }), paths })
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
  withMemoryLock({ lockFile: paths.memoryLockFile, action: () => submitObservationUnlocked({ paths, inputPath, inputJson }) })
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

const appendTransition = ({ guidance, to, reason, source, now, replacementId, retirementId }) => {
  guidance.transitions.push({
    from: guidance.status,
    to,
    reason,
    source,
    at: now,
    ...(replacementId ? { replacementId } : {}),
    ...(retirementId ? { retirementId } : {}),
  })
  guidance.status = to
  guidance.updatedAt = now
}

// Annotations live in annotations.json beside memory.md, keyed by guidance fingerprint, so
// memory.md and its export keep their formats. Each confirmation and each trigger is an entry
// with a random ID. Removing one acknowledges its ID, as retirement sets do. A merge is the union
// of entries and acknowledgments, so a removal reaches every machine in any sync order.
// A record's revokedAt is a barrier that merges by maximum: a confirmation made before it does
// not count, so a revocation also covers confirmations that this machine has not seen yet.
// Only the UserPromptSubmit hook adds a confirmation; agent commands can only remove one.
const annotationTriggers = ['handoff', 'pr-created', 'pr-merged']
const annotationIdPattern = /^annotation:v1:[0-9a-f]{64}$/
const supportedSchemaVersion = 1

const emptyAnnotations = () => ({ schemaVersion: supportedSchemaVersion, records: {} })
const emptyAnnotationRecord = () => ({ confirmations: [], triggers: [], acknowledged: [] })

const requireTrigger = (trigger) => {
  if (!annotationTriggers.includes(trigger)) fail(`trigger must be one of: ${annotationTriggers.join(', ')}`)
  return trigger
}

const validateAnnotationEntry = ({ entry, kind }) => {
  const label = `annotation ${kind}`
  assertObject({ value: entry, label })
  assertClosedFields({ value: entry, fields: kind === 'trigger' ? ['id', 'trigger', 'at'] : ['id', 'at', 'host'], label })
  if (!annotationIdPattern.test(entry.id)) fail(`${label} has an invalid id`)
  requireTimestamp({ value: entry.at, label: `${label} at` })
  if (kind === 'trigger') requireTrigger(entry.trigger)
  if (entry.host !== undefined && !['claude', 'codex'].includes(entry.host)) fail(`${label} host must be claude or codex`)
}

const validateAnnotationRecord = (record) => {
  assertObject({ value: record, label: 'annotations record' })
  assertClosedFields({ value: record, fields: ['confirmations', 'triggers', 'acknowledged', 'revokedAt'], label: 'annotations record' })
  if (![record.confirmations, record.triggers, record.acknowledged].every(Array.isArray)) {
    fail('annotations record needs confirmations, triggers, and acknowledged arrays')
  }
  if (record.revokedAt !== undefined) requireTimestamp({ value: record.revokedAt, label: 'annotations record revokedAt' })
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

// Validated timestamps are canonical ISO strings, so string order is time order.
const laterTime = (left, right) => (left === undefined || (right !== undefined && right > left) ? right : left)

// Unions entries and acknowledgments per fingerprint, in a stable order, and keeps the latest
// revocation barrier.
const mergeAnnotations = (...sources) => {
  const records = {}
  for (const source of sources) {
    for (const [fingerprint, record] of Object.entries(source.records)) {
      const current = records[fingerprint] ?? emptyAnnotationRecord()
      const revokedAt = laterTime(current.revokedAt, record.revokedAt)
      records[fingerprint] = {
        confirmations: uniqueEntries([...current.confirmations, ...record.confirmations]),
        triggers: uniqueEntries([...current.triggers, ...record.triggers]),
        acknowledged: sortedUnion(current.acknowledged, record.acknowledged),
        ...(revokedAt === undefined ? {} : { revokedAt }),
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

const newAnnotationEntry = (fields) => ({ id: `annotation:v1:${randomBytes(32).toString('hex')}`, at: new Date().toISOString(), ...fields })

// A confirmation counts while it is outstanding and was made after the revocation barrier.
const countingConfirmations = (record) => outstandingEntries({ record, entries: record.confirmations })
  .filter(({ at }) => record.revokedAt === undefined || at > record.revokedAt)

// Raises the barrier to now and acknowledges the known confirmations, so a plugin that ignores
// the barrier also sees them removed.
const revokeRecord = (record) => {
  record.revokedAt = laterTime(record.revokedAt, new Date().toISOString())
  acknowledgeEntries({ record, entries: record.confirmations })
}

const annotationMarkers = ({ annotations, guidance }) => {
  const record = annotations.records[guidance.fingerprint] ?? emptyAnnotationRecord()
  return {
    confirmed: countingConfirmations(record).length > 0,
    triggers: [...new Set(outstandingEntries({ record, entries: record.triggers }).map(({ trigger }) => trigger))].sort(),
  }
}

// Only a main thread sees markers; a delegate or subagent reads the same guidance without them.
const displayMarkers = ({ annotations, guidance, mainThread }) => (
  mainThread ? annotationMarkers({ annotations, guidance }) : { confirmed: false, triggers: [] }
)

// Retiring, deleting, or capturing a record revokes earlier confirmations of its fingerprint, so
// the same text never inherits authority, even from a confirmation that arrives by sync later.
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
  const confirmed = countingConfirmations(record).length > 0
  // The barrier also covers a confirmation made on another machine that has not synced yet.
  revokeRecord(record)
  writeAnnotations({ path: paths.annotationsFile, annotations })
  return { outcome: confirmed ? 'unconfirmed' : 'not-confirmed', targetId: guidance.id }
}

/** Removes the user's confirmation of a record. It needs no approval because it only removes authority. */
const unconfirm = ({ paths, reference }) => (
  withMemoryLock({ lockFile: paths.memoryLockFile, action: () => unconfirmUnlocked({ paths, reference }) })
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
  withMemoryLock({ lockFile: paths.memoryLockFile, action: () => annotateUnlocked({ paths, reference, triggers, removeTrigger }) })
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
  if (countingConfirmations(record).length > 0) {
    return confirmationMessage({ exact: true, text: `Field Guide: already confirmed: "${guidance.learning}"` })
  }
  // A barrier stamped by a clock that runs ahead would revoke this confirmation at once.
  // Stamping past it would let it outlast an unsynced revocation, so confirm nothing instead.
  const entry = newAnnotationEntry(host ? { host } : {})
  if (record.revokedAt !== undefined && entry.at <= record.revokedAt) {
    return notConfirmed(`a revocation of this guidance is stamped ${record.revokedAt}, later than this machine's clock; confirm again after that time`)
  }
  record.confirmations.push(entry)
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
 * `confirm fg:<id>`, in a main thread, confirms one active record; the result reports why
 * anything else confirms nothing. Returns null for a prompt that does not mention
 * `confirm fg:`. Stores only an entry ID, the time, and the host, never prompt text.
 */
export const confirmFromPrompt = ({ guideRoot, prompt, mainThread, host }) => {
  const reference = prompt.trim().match(confirmPromptPattern)?.[1]
  if (reference === undefined) {
    if (!/confirm fg:/iu.test(prompt)) return null
    return confirmationMessage({ exact: false, text: 'Field Guide: nothing confirmed; a confirmation is a prompt that is exactly `confirm fg:<id>`, typed by the user' })
  }
  if (!mainThread) return notConfirmed('only a prompt the user types in a main thread can confirm guidance')
  const files = guideFilesFor(guideRootFor(guideRoot))
  if (!existsSync(files.memoryIndexFile)) return notConfirmed('no Field Guide memory exists')
  return withMemoryLock({ lockFile: files.memoryLockFile, action: () => confirmUnlocked({ files, reference, host }) })
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
  const versions = [
    versionOf(() => readMemoryBlock(files)),
    versionOf(() => (existsSync(files.annotationsFile) ? readJsonInput(files.annotationsFile) : null)),
  ]
  return versions.some((version) => Number.isSafeInteger(version) && version > supportedSchemaVersion)
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
// the record it superseded, and returns that record. Only a user's withdrawal adds a retirement
// ID and acknowledges the supersession. The record returns to active only when none of its
// retirements is outstanding; otherwise it moves to withdrawn.
const withdrawGuidance = ({ memory, target, input, now, byUser }) => {
  if (!['candidate', 'active'].includes(target.status)) fail(`${input.action} requires a candidate or active target`)
  if (byUser) addRetirement(target)
  appendTransition({ guidance: target, to: 'withdrawn', reason: input.reason, source: input.source, now })
  const superseded = memory.guidance.find((guidance) => (
    guidance.status === 'superseded' && guidance.transitions.at(-1).replacementId === target.id
  ))
  if (!superseded) return null
  if (byUser) acknowledgeOwnSupersession(superseded)
  const to = hasUnacknowledgedRetirement(retirementSetsOf(superseded)) ? 'withdrawn' : 'active'
  appendTransition({ guidance: superseded, to, reason: input.reason, source: input.source, now })
  return superseded
}

const transitionGuidanceUnlocked = ({ paths, inputPath }) => {
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run init first')
  const input = validateTransitionInput(readJsonInput(inputPath))
  const target = memory.guidance.find(({ id }) => id === input.targetId)
  if (!target) fail('transition target does not exist')
  const now = new Date().toISOString()

  if (input.action === 'activate') {
    if (target.status !== 'candidate') fail('activate requires a candidate target')
    appendTransition({ guidance: target, to: 'active', reason: input.reason, source: input.source, now })
  }

  if (input.action === 'withdraw' || input.action === 'undo') withdrawGuidance({ memory, target, input, now, byUser: true })

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
  revokeConfirmations({ annotationsFile: paths.annotationsFile, fingerprints: retiredStatuses.has(target.status) ? [target.fingerprint] : [] })
  writeMemoryViews({ paths, memory: nextMemory })
  return {
    outcome: input.action,
    targetId: target.id,
    status: target.status,
    ...(input.replacementId ? { replacementId: input.replacementId } : {}),
  }
}

const transitionGuidance = ({ paths, inputPath }) => (
  withMemoryLock({ lockFile: paths.memoryLockFile, action: () => transitionGuidanceUnlocked({ paths, inputPath }) })
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
  revokeConfirmations({ annotationsFile: paths.annotationsFile, fingerprints: [target.fingerprint] })
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
  withMemoryLock({ lockFile: paths.memoryLockFile, action: () => deleteGuidanceUnlocked({ paths, inputPath }) })
)

const retiredStatuses = new Set(['superseded', 'withdrawn', 'archived'])
const portableGuidanceFields = ['subjectKey', 'linkedSubjects', 'learning', 'confidence', 'generic', 'examples']

// Shared guidance travels between machines without evidence, repository identities, or
// relationships. Retired records travel as fingerprints with their retirement sets only, so
// their text stays local.
const exportSharedGuidance = ({ paths, outputPath, annotationsPath }) => {
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
// fingerprint that is not a local project record, as the shared guidance export does.
const portableAnnotations = ({ paths, memory, annotationsPath }) => {
  const existing = existsSync(resolve(annotationsPath)) ? validateAnnotations(readJsonInput(annotationsPath)) : emptyAnnotations()
  const projectFingerprints = new Set(memory.guidance.filter(({ scope }) => scope.kind === 'project').map(({ fingerprint }) => fingerprint))
  const local = readAnnotations(paths.annotationsFile)
  const records = Object.entries(local.records).filter(([fingerprint]) => !projectFingerprints.has(fingerprint))
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
    const superseded = withdrawGuidance({ memory, target: guidance, input, now, byUser: false })
    result.retired.push(guidance.id)
    if (superseded) result[superseded.status === 'active' ? 'restored' : 'retired'].push(superseded.id)
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
  const activeBefore = new Set(memory.guidance.filter(({ status }) => !retiredStatuses.has(status)).map(({ id }) => id))
  const local = new Map(memory.guidance.filter(({ scope }) => scope.kind === 'shared').map((guidance) => [guidance.fingerprint, guidance]))
  const setsChanged = mergeRetirementSets({ entries: input.retired, local })
  addActiveRecords({ memory, input, local, now, result })
  reconcileSharedStatus({ memory, now, result })
  if (incoming) writeAnnotations({ path: paths.annotationsFile, annotations: mergeAnnotations(readAnnotations(paths.annotationsFile), incoming) })
  const retiredHere = memory.guidance.filter(({ id, status }) => activeBefore.has(id) && retiredStatuses.has(status))
  revokeConfirmations({ annotationsFile: paths.annotationsFile, fingerprints: retiredHere.map(({ fingerprint }) => fingerprint) })
  if (setsChanged || Object.values(result).some((ids) => ids.length > 0)) {
    writeMemoryViews({ paths, memory: { ...memory, revision: memory.revision + 1 } })
  }
  return result
}

const importSharedGuidance = ({ paths, inputPath, annotationsPath }) => (
  withMemoryLock({ lockFile: paths.memoryLockFile, action: () => importSharedGuidanceUnlocked({ paths, inputPath, annotationsPath }) })
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

/** Returns active guidance for the repository, without shared records that a project record repeats. */
const applicableGuidance = ({ memory, paths }) => {
  const relevantActive = memory.guidance.filter(({ status, scope }) => (
    status === 'active' && (scope.kind === 'shared' || scope.repositoryIdentity === paths.identity)
  ))
  const projectLearning = new Set(
    relevantActive
      .filter(({ scope }) => scope.kind === 'project')
      .map(({ learning }) => normalizeLearning(learning)),
  )
  return relevantActive.filter((guidance) => !(
    guidance.scope.kind === 'shared' && projectLearning.has(normalizeLearning(guidance.learning))
  ))
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

// Returns active guidance tagged with the event trigger, project records first, within the
// normal retrieval budget.
const retrieveEvent = ({ memory, paths, event, annotations, markersFor }) => {
  requireTrigger(event)
  const tagged = applicableGuidance({ memory, paths })
    .filter((guidance) => annotationMarkers({ annotations, guidance }).triggers.includes(event))
    .sort((left, right) => (
      Number(left.scope.kind === 'shared') - Number(right.scope.kind === 'shared')
        || right.updatedAt.localeCompare(left.updatedAt)
        || left.id.localeCompare(right.id)
    ))
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
  const learning = guidance.learning.replace(markerWordPattern, '\\[$1]').replace(/^\s*\[/u, '\\[')
  return `- ${prefix}${subject} ${learning}`
}

const readInjectionMemory = ({ repoRoot, guideRoot, mainThread }) => {
  // Hooks run on every session; skip Git work when no guide exists.
  if (!existsSync(join(guideRootFor(guideRoot), 'memory.md'))) return null
  const paths = resolvePaths({ repoRoot, guideRoot })
  const memory = readMemory(paths)
  if (!memory) return null
  const annotations = readAnnotationsForDisplay(paths.annotationsFile)
  const lineFor = (guidance) => injectionLine({ guidance, markers: displayMarkers({ annotations, guidance, mainThread }) })
  return { paths, applicable: applicableGuidance({ memory, paths }), lineFor }
}

/**
 * Selects session-start context: this repository's newest project guidance and
 * an index of the other applicable subjects. Returns null when nothing applies.
 * Lines carry annotation markers only when mainThread is true.
 */
export const sessionStartInjection = ({ repoRoot, guideRoot, mainThread = false }) => {
  const loaded = readInjectionMemory({ repoRoot, guideRoot, mainThread })
  if (!loaded) return null
  const { paths, applicable, lineFor } = loaded
  const project = applicable
    .filter(({ scope }) => scope.kind === 'project')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))
  // JSON-array bytes are an upper bound for the rendered lines, so fitting to the
  // budget minus the framing text keeps each rendered section within budget.
  const projectHeader = 'Field Guide: stored user guidance for this repository. Follow it when it applies.'
  const fittedLines = fitWholeRecords({
    records: project.map(lineFor),
    maxRecords: 8,
    maxBytes: 1536 - byteLength(projectHeader),
  })
  const injected = project.filter((guidance) => fittedLines.records.includes(lineFor(guidance)))
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
  const fittedLines = fitWholeRecords({
    records: candidates.map(lineFor),
    maxRecords: 3,
    maxBytes: 2048 - byteLength(header),
  })
  if (fittedLines.records.length === 0) return null
  const injected = candidates.filter((guidance) => fittedLines.records.includes(lineFor(guidance)))
  return {
    projectKey: paths.projectKey,
    guidanceIds: injected.map(({ id }) => id),
    text: [header, ...fittedLines.records].join('\n'),
  }
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

const audit = (paths) => {
  const validationErrors = []
  try {
    validate(paths)
  } catch (error) {
    validationErrors.push(error.message)
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
  const duplicateCandidates = []
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
  const now = new Date().toISOString()
  for (const target of targets) {
    addRetirement(target)
    appendTransition({
      guidance: target,
      to: 'archived',
      reason: input.reason,
      source: 'maintenance',
      now,
    })
  }
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
  withMemoryLock({ lockFile: paths.memoryLockFile, action: () => maintainUnlocked({ paths, inputPath }) })
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

const validate = (paths) => {
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
  }
  try {
    readAnnotations(paths.annotationsFile)
  } catch (error) {
    errors.push(`${paths.annotationsFile} is invalid: ${error.message}`)
  }

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

const main = () => {
  const { command, options } = parseArgs(process.argv.slice(2))
  const paths = resolvePaths({
    repoRoot: options['repo-root'],
    guideRoot: options['guide-root'],
  })

  let result
  if (command === 'analytics-enable') result = configureAnalytics({ guideRoot: paths.guideRoot, enabled: true })
  if (command === 'analytics-disable') result = configureAnalytics({ guideRoot: paths.guideRoot, enabled: false })
  if (command === 'analytics-report') result = reportAnalytics({ guideRoot: paths.guideRoot, since: options.since })
  if (command === 'analytics-impact') result = recordImpact({
    guideRoot: paths.guideRoot,
    input: readSubmissionInput({ inputPath: options.input, inputJson: options['input-json'] }),
  })
  if (command === 'analytics-review') result = recordReview({
    guideRoot: paths.guideRoot,
    input: readSubmissionInput({ inputPath: options.input, inputJson: options['input-json'] }),
  })
  if (command === 'annotate') result = annotate({
    paths,
    reference: options.id,
    triggers: options.triggers,
    removeTrigger: options['remove-trigger'],
  })
  if (command === 'audit') result = audit(paths)
  if (command === 'candidates') result = candidateMatches({
    paths,
    subjectKey: options.subject,
    scope: options.scope,
  })
  if (command === 'delete') result = deleteGuidance({ paths, inputPath: options.input })
  if (command === 'export') result = exportSharedGuidance({ paths, outputPath: options.output, annotationsPath: options.annotations })
  if (command === 'import') result = importSharedGuidance({ paths, inputPath: options.input, annotationsPath: options.annotations })
  if (command === 'init') initialize(paths)
  if (command === 'maintain') result = maintain({ paths, inputPath: options.input })
  if (command === 'retrieve') result = retrieveCommand({ paths, options })
  if (command === 'submit') {
    result = submitObservation({
      paths,
      inputPath: options.input,
      inputJson: options['input-json'],
    })
    appendAnalyticsEvent({
      guideRoot: paths.guideRoot,
      event: {
        type: 'submission',
        projectKey: paths.projectKey,
        guidanceId: result.targetId,
        outcome: result.outcome,
      },
    })
  }
  if (command === 'transition') {
    result = transitionGuidance({ paths, inputPath: options.input })
    appendAnalyticsEvent({
      guideRoot: paths.guideRoot,
      event: {
        type: 'transition',
        projectKey: paths.projectKey,
        guidanceId: result.targetId,
        outcome: result.outcome,
      },
    })
  }
  if (command === 'unconfirm') result = unconfirm({ paths, reference: options.id })
  if (command === 'validate') validate(paths)

  process.stdout.write(`${JSON.stringify({ ...paths, ...(result ? { result } : {}) }, null, 2)}\n`)
}

const isEntryPoint = () => {
  try {
    return realpathSync(process.argv[1]) === scriptPath
  } catch {
    // The lifecycle hook imports this module; it has no command to run.
    return false
  }
}

if (isEntryPoint()) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${basename(scriptPath)}: ${error.message}\n`)
    process.exitCode = 1
  }
}
