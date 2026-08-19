#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

const fail = (message) => {
  throw new Error(message)
}

const git = ({ repoRoot, args, optional = false }) => {
  const result = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' })
  if (result.status === 0) return result.stdout.trim()
  if (optional) return ''
  fail(result.stderr.trim() || `git ${args.join(' ')} failed in ${repoRoot}`)
}

const slugify = (value) => (
  value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'repository'
)

const shortHash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 8)

const stableId = (value) => `${slugify(value)}-${shortHash(value)}`

const normalizeRemote = (remote) => {
  if (!remote) return ''
  const scpStyle = remote.match(/^[^@]+@([^:]+):(.+)$/)
  const normalized = scpStyle
    ? `${scpStyle[1].toLowerCase()}/${scpStyle[2]}`
    : remote
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .replace(/^.*@/, '')

  return normalized.replace(/\/+$/, '').replace(/\.git$/i, '')
}

const parseArgs = (argv) => {
  const [command, ...rest] = argv
  if (!new Set(['paths', 'init', 'migrate-ledgers', 'topics', 'init-topic', 'configure-ticket-system']).has(command)) {
    fail('Usage: engineering-workflow.mjs <paths|init|migrate-ledgers|topics|init-topic|configure-ticket-system> [options]')
  }

  const options = {}
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index]
    if (flag === '--apply') {
      options.apply = true
      continue
    }
    if (!flag.startsWith('--') || index + 1 >= rest.length) fail(`Invalid argument: ${flag}`)
    options[flag.slice(2)] = rest[index + 1]
    index += 1
  }
  return { command, options }
}

const canonicalizePotentialPath = (inputPath) => {
  const missingSegments = []
  let existingPath = resolve(inputPath)
  while (!existsSync(existingPath)) {
    const parent = dirname(existingPath)
    if (parent === existingPath) break
    missingSegments.unshift(basename(existingPath))
    existingPath = parent
  }
  return join(realpathSync(existingPath), ...missingSegments)
}

const workflowRootFor = (inputRoot) => (
  canonicalizePotentialPath(inputRoot || join(homedir(), '.engineering-workflow'))
)

const repositoryPaths = ({ repoRoot: inputRoot, workflowRoot: inputWorkflowRoot, branch: inputBranch }) => {
  if (!inputRoot) fail('--repo-root is required')
  const requestedRoot = resolve(inputRoot)
  const repositoryRoot = realpathSync(git({ repoRoot: requestedRoot, args: ['rev-parse', '--show-toplevel'] }))
  const commonDirValue = git({ repoRoot: repositoryRoot, args: ['rev-parse', '--git-common-dir'] })
  const commonDir = realpathSync(isAbsolute(commonDirValue) ? commonDirValue : resolve(repositoryRoot, commonDirValue))
  const origin = git({ repoRoot: repositoryRoot, args: ['remote', 'get-url', 'origin'], optional: true })
  const normalizedRemote = normalizeRemote(origin)
  const identity = normalizedRemote ? `remote:${normalizedRemote}` : `common-dir:${commonDir}`
  const repositoryId = normalizedRemote
    ? stableId(normalizedRemote)
    : `${slugify(basename(repositoryRoot))}-${shortHash(commonDir)}`
  const branch = inputBranch || git({ repoRoot: repositoryRoot, args: ['branch', '--show-current'] })
    || `detached-${git({ repoRoot: repositoryRoot, args: ['rev-parse', '--short', 'HEAD'] })}`
  const branchId = stableId(branch)
  const workflowRoot = workflowRootFor(inputWorkflowRoot)
  const workflowRelative = relative(repositoryRoot, workflowRoot)
  if (workflowRelative === '' || (!workflowRelative.startsWith('..') && !isAbsolute(workflowRelative))) {
    fail('--workflow-root must be outside the repository')
  }
  const projectRoot = join(workflowRoot, repositoryId)

  return {
    workflowRoot,
    projectRoot,
    configFile: join(projectRoot, 'config.json'),
    topicsFile: join(projectRoot, 'topics.json'),
    specsRoot: join(projectRoot, 'specs'),
    ticketsRoot: join(projectRoot, 'tickets'),
    branchesRoot: join(projectRoot, 'branches'),
    branchRoot: join(projectRoot, 'branches', branchId),
    ledgerFile: join(projectRoot, 'branches', branchId, 'TASKS.md'),
    repositoryId,
    repositoryRoot,
    branch,
    branchId,
    origin: origin || null,
    identity,
  }
}

const validBackends = new Set(['local', 'jira', 'github'])
const topicIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ticketFilePattern = /^TICKET-([0-9]{3,})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const registryKeys = new Set(['schemaVersion', 'topics'])
const topicKeys = new Set(['id', 'title', 'status', 'createdAt', 'updatedAt'])
const externalTicketSystemKeys = new Set(['system', 'project', 'baseUrl'])

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasOnlyKeys = ({ value, keys }) => Object.keys(value).every((key) => keys.has(key))

const pathExists = (path) => {
  try {
    lstatSync(path)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

const parseJson = ({ file, label }) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`${label} is not valid JSON`)
  }
}

const normalizeBaseUrl = (value) => value.replace(/\/+$/, '')

const validExternalTicketSystem = (value) => (
  isObject(value) && hasOnlyKeys({ value, keys: externalTicketSystemKeys })
  && topicIdPattern.test(value.system || '')
  && typeof value.project === 'string' && value.project.trim() !== '' && value.project === value.project.trim()
  && typeof value.baseUrl === 'string' && (() => {
    try {
      const url = new URL(value.baseUrl)
      return value.baseUrl === value.baseUrl.trim()
        && url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
    } catch {
      return false
    }
  })()
)

const sameExternalTicketSystem = (left, right) => (
  left.system === right.system && left.project === right.project
  && normalizeBaseUrl(left.baseUrl) === normalizeBaseUrl(right.baseUrl)
)

const readProjectConfig = (paths) => {
  if (!pathExists(paths.configFile)) fail(`${paths.configFile} does not exist; run init first`)
  const config = parseJson({ file: paths.configFile, label: paths.configFile })
  if (!isObject(config) || config.schemaVersion !== 1 || !validBackends.has(config.ticketBackend)
    || !isObject(config.repository) || typeof config.repository.identity !== 'string'
    || typeof config.repository.root !== 'string'
    || !('origin' in config.repository)
    || (config.repository.origin !== null && typeof config.repository.origin !== 'string')
    || ('externalTicketSystem' in config && !validExternalTicketSystem(config.externalTicketSystem))
    || (config.ticketBackend !== 'local' && !config.externalTicketSystem)
    || (config.externalTicketSystem && config.ticketBackend !== 'local'
      && config.ticketBackend !== config.externalTicketSystem.system)) {
    fail(`${paths.configFile} is not a valid Engineering Workflow configuration`)
  }
  if (config.repository.identity !== paths.identity) {
    fail(`${paths.configFile} belongs to ${config.repository.identity}`)
  }
  return config
}

const validTimestamp = (value) => {
  if (typeof value !== 'string') return false
  const match = value.match(timestampPattern)
  if (!match || Number.isNaN(Date.parse(value))) return false
  const [, year, month, day] = match
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
  return Number(day) <= daysInMonth
}

const validateTopic = ({ topic, file }) => {
  if (!isObject(topic) || !hasOnlyKeys({ value: topic, keys: topicKeys })
    || !topicIdPattern.test(topic.id || '') || typeof topic.title !== 'string'
    || topic.title.trim() === '' || !new Set(['active', 'archived']).has(topic.status)
    || !validTimestamp(topic.createdAt) || !validTimestamp(topic.updatedAt)
    || Date.parse(topic.updatedAt) < Date.parse(topic.createdAt)) {
    fail(`${file} contains an invalid topic`)
  }
}

const readTopics = (paths) => {
  if (!pathExists(paths.topicsFile)) return { schemaVersion: 1, topics: [] }
  const registry = parseJson({ file: paths.topicsFile, label: paths.topicsFile })
  if (!isObject(registry) || !hasOnlyKeys({ value: registry, keys: registryKeys })
    || registry.schemaVersion !== 1 || !Array.isArray(registry.topics)) {
    fail(`${paths.topicsFile} is not a valid topic registry`)
  }
  const ids = new Set()
  for (const topic of registry.topics) {
    validateTopic({ topic, file: paths.topicsFile })
    if (ids.has(topic.id)) fail(`${paths.topicsFile} contains duplicate topic ID ${topic.id}`)
    ids.add(topic.id)
  }
  return registry
}

const writeJsonAtomically = ({ file, value }) => {
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporaryFile, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(temporaryFile, file)
}

const immediateDirectories = (directory) => {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

const listTopics = ({ paths }) => {
  readProjectConfig(paths)
  const registry = readTopics(paths)
  const registeredIds = new Set(registry.topics.map((topic) => topic.id))
  const discovered = new Map()
  for (const [location, directory] of [['specs', paths.specsRoot], ['tickets', paths.ticketsRoot]]) {
    for (const id of immediateDirectories(directory)) {
      if (registeredIds.has(id)) continue
      const locations = discovered.get(id) || []
      locations.push(location)
      discovered.set(id, locations)
    }
  }
  const unregisteredTopics = [...discovered]
    .map(([id, locations]) => ({ id, locations, validId: topicIdPattern.test(id) }))
    .sort((left, right) => left.id.localeCompare(right.id))
  const topics = [...registry.topics].sort((left, right) => left.id.localeCompare(right.id))
  return { topics, unregisteredTopics }
}

const validateDirectory = ({ directory, label }) => {
  if (!pathExists(directory)) return
  if (!lstatSync(directory).isDirectory()) fail(`${label} must be a directory`)
  try {
    readdirSync(directory, { withFileTypes: true })
  } catch (error) {
    fail(`${label} must be a directory`)
  }
}

const validateTicketTopic = ({ topicRoot, ticketBackend }) => {
  if (!pathExists(topicRoot)) return
  validateDirectory({ directory: topicRoot, label: `ticket topic directory ${topicRoot}` })
  const lifecycleDirectories = new Set(['todo', 'in-progress', 'done'])
  for (const entry of readdirSync(topicRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !lifecycleDirectories.has(entry.name)) {
      fail(`unexpected ticket topic entry ${entry.name}`)
    }
  }
  const ticketNumbers = new Set()
  for (const lifecycle of lifecycleDirectories) {
    const directory = join(topicRoot, lifecycle)
    validateDirectory({ directory, label: `ticket lifecycle directory ${directory}` })
    if (!pathExists(directory)) continue
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (ticketBackend !== 'local' && entry.isFile()) {
        fail(`${ticketBackend} backend cannot adopt local ticket file ${join(directory, entry.name)}`)
      }
      const match = entry.isFile() && entry.name.match(ticketFilePattern)
      if (!match) fail(`invalid ticket file ${join(directory, entry.name)}`)
      if (ticketNumbers.has(match[1])) fail(`duplicate ticket ID TICKET-${match[1]}`)
      ticketNumbers.add(match[1])
    }
  }
}

const withDirectoryLock = ({ lockDirectory, busyMessage, action }) => {
  try {
    mkdirSync(lockDirectory)
  } catch (error) {
    if (error.code === 'EEXIST') fail(busyMessage)
    throw error
  }
  try {
    return action()
  } finally {
    rmdirSync(lockDirectory)
  }
}

const withTopicRegistryLock = ({ paths, action }) => withDirectoryLock({
  lockDirectory: `${paths.topicsFile}.lock`,
  busyMessage: 'topic registry is being updated; retry the command',
  action,
})

const initializeTopic = ({ paths, topicId, title: inputTitle }) => {
  const config = readProjectConfig(paths)
  if (!topicIdPattern.test(topicId || '')) fail('--topic-id must be a lowercase hyphenated ID')
  const title = inputTitle?.trim()
  if (!title) fail('--title is required and cannot be empty')

  return withTopicRegistryLock({ paths, action: () => {
    const registry = readTopics(paths)
    const existing = registry.topics.find((topic) => topic.id === topicId)
    if (existing && (existing.title !== title || existing.status !== 'active')) {
      fail(`topic ${topicId} conflicts with the existing registry entry`)
    }

    const specTopicRoot = join(paths.specsRoot, topicId)
    const ticketTopicRoot = join(paths.ticketsRoot, topicId)
    validateDirectory({ directory: paths.specsRoot, label: paths.specsRoot })
    validateDirectory({ directory: paths.ticketsRoot, label: paths.ticketsRoot })
    validateDirectory({ directory: specTopicRoot, label: `spec topic directory ${specTopicRoot}` })
    validateTicketTopic({ topicRoot: ticketTopicRoot, ticketBackend: config.ticketBackend })

    mkdirSync(specTopicRoot, { recursive: true })
    for (const lifecycle of ['todo', 'in-progress', 'done']) {
      mkdirSync(join(ticketTopicRoot, lifecycle), { recursive: true })
    }

    if (existing) return existing
    const timestamp = new Date().toISOString()
    const topic = {
      id: topicId,
      title,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    writeJsonAtomically({
      file: paths.topicsFile,
      value: {
        ...registry,
        topics: [...registry.topics, topic].sort((left, right) => left.id.localeCompare(right.id)),
      },
    })
    return topic
  } })
}

const initialize = ({ paths, ticketBackend, project: inputProject, baseUrl: inputBaseUrl }) => {
  if (ticketBackend && !validBackends.has(ticketBackend)) {
    fail('--ticket-backend must be local, jira, or github')
  }

  let existing
  if (existsSync(paths.configFile)) {
    existing = parseJson({ file: paths.configFile, label: paths.configFile })
    if (existing?.repository?.identity !== paths.identity) {
      fail(`${paths.configFile} belongs to ${existing?.repository?.identity || 'an unknown repository'}`)
    }
    existing = readProjectConfig(paths)
  }
  if (existing && ticketBackend && ticketBackend !== existing.ticketBackend) {
    fail(`ticket backend conflicts with the existing ${existing.ticketBackend} configuration`)
  }
  const backend = ticketBackend || existing?.ticketBackend
  if (!backend) fail('--ticket-backend is required; choose local, jira, or github')

  if (existing && (inputProject !== undefined || inputBaseUrl !== undefined)) {
    if (existing.ticketBackend === 'local') {
      fail('local backend external associations must use configure-ticket-system')
    }
    const project = inputProject === undefined
      ? existing.externalTicketSystem.project
      : inputProject.trim()
    let baseUrl = inputBaseUrl === undefined
      ? existing.externalTicketSystem.baseUrl
      : inputBaseUrl.trim()
    baseUrl = normalizeBaseUrl(baseUrl)
    const requestedSystem = { system: existing.ticketBackend, project, baseUrl }
    if (!validExternalTicketSystem(requestedSystem)) {
      fail(`${existing.ticketBackend} backend requires --project and --base-url with valid values`)
    }
    if (!sameExternalTicketSystem(existing.externalTicketSystem, requestedSystem)) {
      fail('external ticket system conflicts with the existing project configuration')
    }
  }

  let externalTicketSystem
  if (!existing && backend !== 'local') {
    const project = inputProject?.trim()
    let baseUrl = inputBaseUrl?.trim()
    if (baseUrl) baseUrl = normalizeBaseUrl(baseUrl)
    externalTicketSystem = { system: backend, project, baseUrl }
    if (!validExternalTicketSystem(externalTicketSystem)) {
      fail(`${backend} backend requires --project and --base-url with valid values`)
    }
  } else if (!existing && (inputProject !== undefined || inputBaseUrl !== undefined)) {
    fail('local backend external associations must use configure-ticket-system')
  }

  const directories = [
    paths.specsRoot,
    paths.ticketsRoot,
    paths.branchesRoot,
  ]
  for (const directory of directories) mkdirSync(directory, { recursive: true })

  const config = {
    schemaVersion: 1,
    ticketBackend: backend,
    ...(externalTicketSystem ? { externalTicketSystem } : {}),
    repository: {
      identity: paths.identity,
      origin: paths.origin,
      root: paths.repositoryRoot,
    },
  }

  if (!existsSync(paths.configFile)) {
    writeFileSync(paths.configFile, `${JSON.stringify(config, null, 2)}\n`)
  }
}

const configureTicketSystem = ({ paths, system, project: inputProject, baseUrl: inputBaseUrl }) => {
  const project = inputProject?.trim()
  let baseUrl = inputBaseUrl?.trim()
  if (baseUrl) baseUrl = normalizeBaseUrl(baseUrl)
  const externalTicketSystem = { system, project, baseUrl }
  if (!validExternalTicketSystem(externalTicketSystem)) {
    fail('--system must be a lowercase slug, --project must not be empty, and --base-url must be an absolute HTTPS URL')
  }

  readProjectConfig(paths)
  return withDirectoryLock({
    lockDirectory: `${paths.configFile}.lock`,
    busyMessage: 'project configuration is being updated; retry the command',
    action: () => {
      const config = readProjectConfig(paths)
      if (config.ticketBackend !== 'local' && config.ticketBackend !== externalTicketSystem.system) {
        fail(`${config.ticketBackend} backend requires a matching ${config.ticketBackend} external ticket system`)
      }
      if (config.externalTicketSystem) {
        if (!sameExternalTicketSystem(config.externalTicketSystem, externalTicketSystem)) {
          fail('external ticket system conflicts with the existing project configuration')
        }
        return config.externalTicketSystem
      }

      writeJsonAtomically({
        file: paths.configFile,
        value: { ...config, externalTicketSystem },
      })
      return externalTicketSystem
    }
  })
}

const legacyLedgers = (sourceRoot) => {
  if (!existsSync(sourceRoot)) return []
  const ledgers = []
  for (const repository of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!repository.isDirectory()) continue
    const repositoryRoot = join(sourceRoot, repository.name)
    for (const branch of readdirSync(repositoryRoot, { withFileTypes: true })) {
      if (!branch.isDirectory()) continue
      const source = join(repositoryRoot, branch.name, 'TASKS.md')
      if (existsSync(source)) ledgers.push({ repository: repository.name, branch: branch.name, source })
    }
  }
  return ledgers.sort((left, right) => left.source.localeCompare(right.source))
}

const metadataValue = ({ content, label }) => {
  const match = content.match(
    new RegExp('^[> ]*(?:- )?' + label + ':\\s*(?:`([^`]+)`|(.+?))\\s*$', 'm'),
  )
  return match?.[1] || match?.[2]?.trim() || ''
}

const legacyMetadata = (ledgerFile) => {
  const content = readFileSync(ledgerFile, 'utf8')
  return {
    gitRoot: metadataValue({ content, label: 'Git root' }),
    branch: metadataValue({ content, label: 'Branch' }),
  }
}

const resolveMigrationCandidate = ({
  ledger,
  sourceRoot,
  workflowRoot,
  scopedRepositoryRoot,
  inputBranch,
}) => {
  const source = relative(sourceRoot, ledger.source)
  const metadata = legacyMetadata(ledger.source)
  if (!metadata.gitRoot || !metadata.branch) {
    return { status: 'conflict', entry: { source, reason: 'missing Git root or Branch metadata' } }
  }

  let paths
  try {
    paths = repositoryPaths({ repoRoot: metadata.gitRoot, workflowRoot, branch: metadata.branch })
  } catch (error) {
    return { status: 'conflict', entry: { source, reason: error.message } }
  }

  if (scopedRepositoryRoot && paths.repositoryRoot !== scopedRepositoryRoot) {
    return { status: 'skipped', entry: { source, reason: 'different repository' } }
  }
  if (inputBranch && metadata.branch !== inputBranch) {
    return { status: 'skipped', entry: { source, reason: 'different branch' } }
  }

  return {
    status: 'candidate',
    entry: { source, target: relative(workflowRoot, paths.ledgerFile) },
    absoluteSource: ledger.source,
    absoluteTarget: paths.ledgerFile,
  }
}

const uniqueMigrationCandidates = ({ candidates, conflicts }) => {
  const candidatesByTarget = new Map()
  for (const candidate of candidates) {
    const group = candidatesByTarget.get(candidate.absoluteTarget) || []
    group.push(candidate)
    candidatesByTarget.set(candidate.absoluteTarget, group)
  }

  const unique = []
  for (const group of candidatesByTarget.values()) {
    if (group.length === 1) {
      unique.push(group[0])
      continue
    }
    conflicts.push({
      sources: group.map((candidate) => candidate.entry.source),
      target: group[0].entry.target,
      reason: 'multiple legacy ledgers resolve to the same target',
    })
  }
  return unique
}

const migrateLedgers = ({
  sourceRoot: inputSourceRoot,
  workflowRoot: inputWorkflowRoot,
  repoRoot: inputRepoRoot,
  branch: inputBranch,
  apply,
}) => {
  if (apply && (!inputRepoRoot || !inputBranch)) {
    fail('--apply requires --repo-root and --branch')
  }
  const sourceRoot = resolve(inputSourceRoot || join(homedir(), '.project-tasks'))
  const workflowRoot = workflowRootFor(inputWorkflowRoot)
  const scopedRepositoryRoot = inputRepoRoot
    ? repositoryPaths({ repoRoot: inputRepoRoot, workflowRoot, branch: inputBranch }).repositoryRoot
    : ''
  const result = {
    sourceRoot,
    workflowRoot,
    mode: apply ? 'apply' : 'dry-run',
    copied: [],
    matching: [],
    conflicts: [],
    skipped: [],
  }
  const missing = []

  for (const ledger of legacyLedgers(sourceRoot)) {
    const candidate = resolveMigrationCandidate({
      ledger,
      sourceRoot,
      workflowRoot,
      scopedRepositoryRoot,
      inputBranch,
    })
    if (candidate.status !== 'candidate') {
      result[candidate.status === 'conflict' ? 'conflicts' : 'skipped'].push(candidate.entry)
      continue
    }

    if (existsSync(candidate.absoluteTarget)) {
      if (readFileSync(candidate.absoluteTarget).equals(readFileSync(candidate.absoluteSource))) {
        result.matching.push(candidate.entry)
      } else {
        result.conflicts.push(candidate.entry)
      }
      continue
    }
    missing.push(candidate)
  }

  const candidates = uniqueMigrationCandidates({ candidates: missing, conflicts: result.conflicts })

  if (!apply) {
    result.copied.push(...candidates.map((entry) => entry.entry))
  }

  if (result.conflicts.length > 0 || !apply) {
    if (result.conflicts.length > 0) process.exitCode = 2
    return result
  }

  for (const entry of candidates) {
    mkdirSync(resolve(entry.absoluteTarget, '..'), { recursive: true })
    copyFileSync(entry.absoluteSource, entry.absoluteTarget)
    if (!readFileSync(entry.absoluteTarget).equals(readFileSync(entry.absoluteSource))) {
      fail(`Verification failed for ${entry.absoluteTarget}`)
    }
    result.copied.push(entry.entry)
  }

  return result
}

try {
  const { command, options } = parseArgs(process.argv.slice(2))
  if (command === 'migrate-ledgers') {
    console.log(JSON.stringify(migrateLedgers({
      sourceRoot: options['source-root'],
      workflowRoot: options['workflow-root'],
      repoRoot: options['repo-root'],
      branch: options.branch,
      apply: options.apply,
    }), null, 2))
  } else {
    const paths = repositoryPaths({
      repoRoot: options['repo-root'],
      workflowRoot: options['workflow-root'],
      branch: options.branch,
    })
    if (command === 'init') {
      initialize({
        paths,
        ticketBackend: options['ticket-backend'],
        project: options.project,
        baseUrl: options['base-url'],
      })
      console.log(JSON.stringify(paths, null, 2))
    } else if (command === 'topics') {
      console.log(JSON.stringify(listTopics({ paths }), null, 2))
    } else if (command === 'init-topic') {
      const topic = initializeTopic({
        paths,
        topicId: options['topic-id'],
        title: options.title,
      })
      console.log(JSON.stringify({ paths, topic }, null, 2))
    } else if (command === 'configure-ticket-system') {
      const externalTicketSystem = configureTicketSystem({
        paths,
        system: options.system,
        project: options.project,
        baseUrl: options['base-url'],
      })
      console.log(JSON.stringify({ paths, externalTicketSystem }, null, 2))
    } else {
      console.log(JSON.stringify(paths, null, 2))
    }
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
