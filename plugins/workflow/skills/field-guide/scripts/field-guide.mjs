#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
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

const commands = new Set(['init', 'migrate', 'paths', 'validate'])
const optionNames = new Map([
  ['--repo-root', 'repo-root'],
  ['--guide-root', 'guide-root'],
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
    fail('Usage: field-guide.mjs <init|migrate|paths|validate> --repo-root <path> [--guide-root <path>] [--apply]')
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

const validateMemory = (memory) => {
  assertObject({ value: memory, label: 'memory store' })
  assertClosedFields({
    value: memory,
    fields: ['schemaVersion', 'revision', 'guidance', 'evidence'],
    label: 'memory store',
  })
  if (memory.schemaVersion !== 1) fail(`memory store has unsupported schema version: ${memory.schemaVersion}`)
  if (!Number.isSafeInteger(memory.revision) || memory.revision < 0) {
    fail('memory store revision must be a non-negative integer')
  }
  if (!Array.isArray(memory.guidance)) fail('memory store guidance must be an array')
  if (!Array.isArray(memory.evidence)) fail('memory store evidence must be an array')
  if (memory.guidance.length > 0) fail('memory store guidance records are not supported before schema expansion')
  if (memory.evidence.length > 0) fail('memory store evidence records are not supported before schema expansion')
  return memory
}

const readMemory = (paths) => {
  if (!existsSync(paths.memoryFile)) return null
  let parsed
  try {
    parsed = JSON.parse(readFileSync(paths.memoryFile, 'utf8'))
  } catch (error) {
    fail(`memory store is not valid JSON: ${error.message}`)
  }
  return validateMemory(parsed)
}

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
    appendFileSync(indexPath, `\n## ${heading}\n\n${entry}`)
    return
  }

  writeFileSync(indexPath, insertEntryIntoSection({ content, marker, entry }))
}

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
  readMemory(paths)

  if (errors.length > 0) fail(`Field guide validation failed:\n- ${errors.join('\n- ')}`)
}

const main = () => {
  const { command, options } = parseArgs(process.argv.slice(2))
  const paths = resolvePaths({
    repoRoot: options['repo-root'],
    guideRoot: options['guide-root'],
  })

  let migration
  if (command === 'init') initialize(paths)
  if (command === 'migrate') migration = migrate({ paths, apply: options.apply === true })
  if (command === 'validate') validate(paths)

  process.stdout.write(`${JSON.stringify({ ...paths, ...(migration ? { migration } : {}) }, null, 2)}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${basename(scriptPath)}: ${error.message}\n`)
  process.exitCode = 1
}
