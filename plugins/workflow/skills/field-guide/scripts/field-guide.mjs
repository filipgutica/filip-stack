#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { isIP } from 'node:net'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const commands = new Set(['audit', 'candidates', 'delete', 'init', 'maintain', 'migrate', 'paths', 'retrieve', 'submit', 'transition', 'validate'])
const optionNames = new Map([
  ['--repo-root', 'repo-root'],
  ['--guide-root', 'guide-root'],
  ['--input', 'input'],
  ['--subject', 'subject'],
  ['--query', 'query'],
  ['--evidence-for', 'evidence-for'],
  ['--scope', 'scope'],
])
const flagNames = new Map([['--apply', 'apply']])

const parseOptions = (args) => {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    const flagName = flagNames.get(flag)
    if (flagName) {
      options[flagName] = true
      continue
    }
    const optionName = optionNames.get(flag)
    if (!optionName) fail(`Invalid argument: ${flag}`)
    const value = args[index + 1]
    if (!value || value.startsWith('--')) fail(`Missing value for ${flag}`)
    options[optionName] = value
    index += 1
  }
  return options
}

const parseArgs = (argv) => {
  const [command, ...rest] = argv
  if (!commands.has(command)) {
    fail('Usage: field-guide.mjs <audit|candidates|delete|init|maintain|migrate|paths|retrieve|submit|transition|validate> --repo-root <path> [--guide-root <path>] [--input <json-file>] [--subject <key>] [--scope <project|shared>] [--query <text>] [--evidence-for <guidance-id>] [--apply]')
  }
  const options = parseOptions(rest)
  if (!options['repo-root']) fail('--repo-root is required')
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
    memoryFile: join(guideRoot, 'memory.json'),
    memoryIndexFile: join(guideRoot, 'memory.md'),
    memoryLockFile: join(guideRoot, 'memory.lock'),
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
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    : /[\u0000-\u001f\u007f]/u.test(value)
)
const portableKey = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const sourceKeyPattern = /^source:v1:[0-9a-f]{64}$/
const fingerprintPattern = /^fingerprint:v1:[0-9a-f]{64}$/
const evidenceIdPattern = /^evidence:v1:[0-9a-f-]{36}$/
const guidanceIdPattern = /^guidance:v1:[0-9a-f]{64}$/

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
  let decodedPathAndFragment = `${parsed.pathname}${parsed.hash}`
  for (let depth = 0; /%[0-9a-f]{2}/iu.test(decodedPathAndFragment); depth += 1) {
    if (depth === 5) fail(`${kind} URL contains excessive nested percent encoding`)
    try {
      decodedPathAndFragment = decodeURIComponent(decodedPathAndFragment)
    } catch {
      fail(`${kind} URL contains invalid percent encoding`)
    }
  }
  assertSafePersistedText({ value: decodedPathAndFragment, label: `${kind} URL` })
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

const validateGuidanceRecord = (guidance) => {
  assertObject({ value: guidance, label: 'guidance record' })
  assertClosedFields({
    value: guidance,
    fields: ['id', 'fingerprint', 'scope', 'subjectKey', 'linkedSubjects', 'learning', 'status', 'confidence', 'generic', 'relationship', 'examples', 'evidenceIds', 'independentEvidenceCount', 'transitions', 'createdAt', 'updatedAt'],
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
    assertClosedFields({ value: transition, fields: ['from', 'to', 'reason', 'source', 'at', 'replacementId'], label: 'guidance transition' })
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
        'superseded->archived',
        'withdrawn->archived',
      ])
      if (!allowedEdges.has(edge)) fail(`${guidance.id} has an illegal lifecycle transition: ${edge}`)
    }
    if (guidance.transitions.at(-1).to !== guidance.status) fail(`${guidance.id} status does not match its transition history`)
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

const readMarkdownMemory = (paths) => {
  if (!existsSync(paths.memoryIndexFile)) return null
  const content = readFileSync(paths.memoryIndexFile, 'utf8')
  const marker = '<!-- field-guide-memory-json:v1 -->\n```json\n'
  const start = content.lastIndexOf(marker)
  if (start === -1) return null
  const jsonStart = start + marker.length
  const jsonEnd = content.indexOf('\n```', jsonStart)
  if (jsonEnd === -1) fail('memory.md has an unterminated machine-readable record')
  let parsed
  try {
    parsed = JSON.parse(content.slice(jsonStart, jsonEnd))
  } catch (error) {
    fail(`memory.md machine-readable record is not valid JSON: ${error.message}`)
  }
  return validateMemory(parsed)
}

const readMemory = (paths) => readMarkdownMemory(paths) ?? readJsonMemory(paths)

const createJsonExclusively = ({ path, value }) => {
  const temporaryPath = `${path}.tmp-${process.pid}`
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
  try {
    linkSync(temporaryPath, path)
  } finally {
    unlinkSync(temporaryPath)
  }
}

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
    const examples = record.examples.map((example) => (
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

const withMemoryLock = ({ paths, action }) => {
  let descriptor
  try {
    descriptor = openSync(paths.memoryLockFile, 'wx')
  } catch (error) {
    if (error.code === 'EEXIST') fail('Field-guide memory is locked by another writer; retry the operation')
    throw error
  }
  try {
    return action()
  } finally {
    closeSync(descriptor)
    unlinkSync(paths.memoryLockFile)
  }
}

const submitObservationUnlocked = ({ paths, inputPath }) => {
  requireInitialized(paths)
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run migrate --apply first')
  const submission = validateSubmission({ submission: readJsonInput(inputPath), paths })
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

const submitObservation = ({ paths, inputPath }) => (
  withMemoryLock({ paths, action: () => submitObservationUnlocked({ paths, inputPath }) })
)

const appendTransition = ({ guidance, to, reason, source, now, replacementId }) => {
  guidance.transitions.push({
    from: guidance.status,
    to,
    reason,
    source,
    at: now,
    ...(replacementId ? { replacementId } : {}),
  })
  guidance.status = to
  guidance.updatedAt = now
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

const transitionGuidanceUnlocked = ({ paths, inputPath }) => {
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run migrate --apply first')
  const input = validateTransitionInput(readJsonInput(inputPath))
  const target = memory.guidance.find(({ id }) => id === input.targetId)
  if (!target) fail('transition target does not exist')
  const now = new Date().toISOString()

  if (input.action === 'activate') {
    if (target.status !== 'candidate') fail('activate requires a candidate target')
    appendTransition({ guidance: target, to: 'active', reason: input.reason, source: input.source, now })
  }

  if (input.action === 'withdraw' || input.action === 'undo') {
    if (!['candidate', 'active'].includes(target.status)) fail(`${input.action} requires a candidate or active target`)
    appendTransition({ guidance: target, to: 'withdrawn', reason: input.reason, source: input.source, now })
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
    appendTransition({
      guidance: target,
      to: 'superseded',
      reason: input.reason,
      source: input.source,
      now,
      replacementId: replacement.id,
    })
  }

  const nextMemory = { ...memory, revision: memory.revision + 1 }
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
  if (!memory) fail('Field-guide memory is not initialized; run migrate --apply first')
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

const retrievalRecord = ({ guidance, match }) => ({
  id: guidance.id,
  scope: guidance.scope,
  subjectKey: guidance.subjectKey,
  linkedSubjects: guidance.linkedSubjects ?? [],
  learning: guidance.learning,
  status: guidance.status,
  examples: guidance.examples,
  updatedAt: guidance.updatedAt,
  match,
})

const queryTerms = (query) => (
  new Set(
    normalizeLearning(query ?? '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length >= 3),
  )
)

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

const retrieveGuidance = ({ memory, paths, subjectKey, query }) => {
  if (!portableKey.test(subjectKey ?? '') || byteLength(subjectKey) > 128) {
    fail('--subject must be a portable subject key')
  }
  if (query !== undefined) requireString({ value: query, label: 'retrieval query', maxBytes: 1024 })
  const active = memory.guidance.filter(({ status }) => status === 'active')
  const relevantActive = active.filter(({ scope }) => (
    scope.kind === 'shared' || scope.repositoryIdentity === paths.identity
  ))
  const exactSubject = relevantActive.filter(({ subjectKey: recordSubject }) => recordSubject === subjectKey)
  const projectExactLearning = new Set(
    exactSubject
      .filter(({ scope }) => scope.kind === 'project' && scope.repositoryIdentity === paths.identity)
      .map(({ learning }) => normalizeLearning(learning)),
  )
  const effectiveExactSubject = exactSubject.filter((guidance) => !(
    guidance.scope.kind === 'shared' && projectExactLearning.has(normalizeLearning(guidance.learning))
  ))
  const linkedSubjects = [...new Set(effectiveExactSubject.flatMap((record) => record.linkedSubjects ?? []))].sort()
  const terms = queryTerms(query)
  const ranked = []
  for (const guidance of relevantActive) {
    if (guidance.scope.kind === 'shared'
      && guidance.subjectKey === subjectKey
      && projectExactLearning.has(normalizeLearning(guidance.learning))) continue
    let rank
    let match
    if (guidance.subjectKey === subjectKey) {
      rank = guidance.scope.kind === 'project' ? 0 : 1
      match = guidance.scope.kind === 'project' ? 'project-subject' : 'shared-subject'
    } else if (linkedSubjects.includes(guidance.subjectKey)) {
      rank = 2
      match = 'linked-subject'
    } else {
      const normalized = normalizeLearning(guidance.learning)
      if (terms.size === 0 || ![...terms].some((term) => normalized.includes(term))) continue
      rank = 3
      match = 'applicability'
    }
    ranked.push({ guidance, rank, match })
  }
  ranked.sort((left, right) => (
    left.rank - right.rank
      || (left.guidance.scope.kind === right.guidance.scope.kind
        ? 0
        : (left.guidance.scope.kind === 'project' ? -1 : 1))
      || right.guidance.updatedAt.localeCompare(left.guidance.updatedAt)
      || left.guidance.id.localeCompare(right.guidance.id)
  ))
  const records = ranked.map(({ guidance, match }) => retrievalRecord({ guidance, match }))
  const fitted = fitWholeRecords({ records, maxRecords: 5, maxBytes: 6144 })
  const routingCandidates = linkedSubjects.map((linkedSubject) => ({ subjectKey: linkedSubject }))
  const routingFit = fitWholeRecords({ records: routingCandidates, maxRecords: 16, maxBytes: 1800 })
  const routing = {
    projectKey: paths.projectKey,
    subjectKey,
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

const retrieve = ({ paths, subjectKey, query, evidenceFor }) => {
  const memory = readMemory(paths) ?? emptyMemory()
  if (evidenceFor && (subjectKey !== undefined || query !== undefined)) {
    fail('--evidence-for cannot be combined with --subject or --query')
  }
  return evidenceFor
    ? retrieveEvidence({ memory, guidanceId: evidenceFor })
    : retrieveGuidance({ memory, paths, subjectKey, query })
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
      examples: guidance.examples,
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
  if (input.action !== 'archive') fail('maintenance action must be archive')
  if (!Array.isArray(input.targetIds)
    || input.targetIds.length === 0
    || new Set(input.targetIds).size !== input.targetIds.length
    || input.targetIds.some((id) => !guidanceIdPattern.test(id))) {
    fail('maintenance targetIds must be a non-empty unique guidance ID array')
  }
  requireString({ value: input.reason, label: 'maintenance reason', maxBytes: 512 })
  if (input.apply !== undefined && typeof input.apply !== 'boolean') fail('maintenance apply must be boolean')
  if (input.previewToken !== undefined) {
    requireString({ value: input.previewToken, label: 'maintenance previewToken', maxBytes: 128, noWhitespace: true })
  }
  return input
}

const maintenancePreviewToken = ({ memory, input }) => (
  hashIdentity({
    prefix: 'maintenance-preview',
    values: [1, input.action, input.targetIds, input.reason, createHash('sha256').update(JSON.stringify(memory)).digest('hex')],
  })
)

const maintainUnlocked = ({ paths, inputPath }) => {
  validate(paths)
  const memory = readMemory(paths)
  if (!memory) fail('Field-guide memory is not initialized; run migrate --apply first')
  const input = validateMaintenanceInput(readJsonInput(inputPath))
  const targets = input.targetIds.map((id) => {
    const target = memory.guidance.find((guidance) => guidance.id === id)
    if (!target) fail(`maintenance target does not exist: ${id}`)
    if (!['candidate', 'superseded', 'withdrawn'].includes(target.status)) {
      fail(`archive requires an inactive target: ${id}`)
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
    appendTransition({
      guidance: target,
      to: 'archived',
      reason: input.reason,
      source: 'maintenance',
      now,
    })
  }
  const nextMemory = { ...memory, revision: memory.revision + 1 }
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

const migrate = ({ paths, apply }) => {
  requireInitialized(paths)
  if (readMemory(paths)) return { action: 'none', applied: false }
  validate(paths)
  if (!apply) return { action: 'create-memory-store', applied: false }
  createJsonExclusively({ path: paths.memoryFile, value: emptyMemory() })
  readMemory(paths)
  return { action: 'create-memory-store', applied: true }
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
  if (memory?.guidance.length > 0) {
    if (!existsSync(paths.memoryIndexFile)) {
      errors.push(`${paths.memoryIndexFile} is missing`)
    } else if (readFileSync(paths.memoryIndexFile, 'utf8') !== renderMemoryIndex(memory)) {
      errors.push(`${paths.memoryIndexFile} does not match memory.json`)
    }
    const memoryLink = relative(dirname(paths.rootIndex), paths.memoryIndexFile).replaceAll('\\', '/')
    if (!rootContent.includes(`](${memoryLink})`)) errors.push(`${paths.memoryIndexFile} is not linked from ${paths.rootIndex}`)
  }
  if (existsSync(paths.memoryIndexFile)) {
    const cachedMemory = readJsonMemory(paths)
    if (!cachedMemory || JSON.stringify(cachedMemory) !== JSON.stringify(memory)) {
      errors.push(`${paths.memoryFile} does not match canonical memory.md`)
    }
  }

  if (errors.length > 0) fail(`Field guide validation failed:\n- ${errors.join('\n- ')}`)
}

const main = () => {
  const { command, options } = parseArgs(process.argv.slice(2))
  const paths = resolvePaths({
    repoRoot: options['repo-root'],
    guideRoot: options['guide-root'],
  })

  let migration
  let result
  if (command === 'audit') result = audit(paths)
  if (command === 'candidates') result = candidateMatches({
    paths,
    subjectKey: options.subject,
    scope: options.scope,
  })
  if (command === 'delete') result = deleteGuidance({ paths, inputPath: options.input })
  if (command === 'init') initialize(paths)
  if (command === 'maintain') result = maintain({ paths, inputPath: options.input })
  if (command === 'migrate') migration = migrate({ paths, apply: options.apply === true })
  if (command === 'retrieve') result = retrieve({
    paths,
    subjectKey: options.subject,
    query: options.query,
    evidenceFor: options['evidence-for'],
  })
  if (command === 'submit') result = submitObservation({ paths, inputPath: options.input })
  if (command === 'transition') result = transitionGuidance({ paths, inputPath: options.input })
  if (command === 'validate') validate(paths)

  process.stdout.write(`${JSON.stringify({ ...paths, ...(migration ? { migration } : {}), ...(result ? { result } : {}) }, null, 2)}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${basename(scriptPath)}: ${error.message}\n`)
  process.exitCode = 1
}
