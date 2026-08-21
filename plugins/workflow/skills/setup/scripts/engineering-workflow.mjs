#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

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
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'repository'
)
const shortHash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 8)
const stableId = (value) => `${slugify(value)}-${shortHash(value)}`
const markdownPath = (value) => value.split(sep).join('/')

const normalizeRemote = (remote) => {
  if (!remote) return ''
  const scpStyle = remote.match(/^[^@]+@([^:]+):(.+)$/)
  const normalized = scpStyle
    ? `${scpStyle[1].toLowerCase()}/${scpStyle[2]}`
    : remote.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^.*@/, '')
  return normalized.replace(/\/+$/, '').replace(/\.git$/i, '')
}

const commands = new Set([
  'paths', 'init', 'topics', 'init-topic', 'attach-topic', 'sync-topic',
  'complete-topic', 'abandon-topic', 'reopen-topic', 'mark-spec-implemented',
  'start-grill', 'update-grill', 'start-walkthrough', 'update-walkthrough',
  'configure-ticket-system',
])
const booleanFlags = new Set(['--confirm', '--confirm-warnings'])

const parseArgs = (argv) => {
  const [command, ...rest] = argv
  if (!commands.has(command)) {
    fail(`Usage: engineering-workflow.mjs <${[...commands].join('|')}> [options]`)
  }
  const options = {}
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index]
    if (booleanFlags.has(flag)) {
      options[flag.slice(2)] = true
      continue
    }
    if (!flag.startsWith('--') || index + 1 >= rest.length) fail(`Invalid argument: ${flag}`)
    if (flag.slice(2) in options) fail(`Duplicate argument: ${flag}`)
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

const topicStates = ['open', 'complete', 'abandoned']
const topicStateSet = new Set(topicStates)
const topicIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const repositoryIdPattern = /^[a-zA-Z0-9._-]+-[0-9a-f]{8}$/
const ticketFilePattern = /^TICKET-([0-9]{3,})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const validBackends = new Set(['local', 'jira', 'github'])
const externalTicketSystemKeys = new Set(['system', 'project', 'baseUrl'])
const manifestKeys = new Set([
  'schemaVersion', 'id', 'title', 'state', 'createdAt', 'updatedAt',
  'repositories', 'externalWork', 'transitions',
])
const transitionKeys = new Set(['from', 'to', 'at', 'actor', 'reason', 'warnings'])
const generatedStart = '<!-- engineering-workflow:generated-links:start -->'
const generatedEnd = '<!-- engineering-workflow:generated-links:end -->'

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

const validTimestamp = (value) => {
  if (typeof value !== 'string') return false
  const match = value.match(timestampPattern)
  if (!match || Number.isNaN(Date.parse(value))) return false
  const [, year, month, day] = match
  return Number(day) <= new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
}

const validHttpsUrl = (value) => {
  if (typeof value !== 'string' || value !== value.trim()) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

const parseJson = ({ file, label }) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
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

const validateTopicPathArgs = ({ topicId, topicState }) => {
  if (topicId && !topicIdPattern.test(topicId)) fail('--topic-id must be a lowercase hyphenated ID')
  if (topicState && !topicStateSet.has(topicState)) fail('--topic-state must be open, complete, or abandoned')
  if (topicState && !topicId) fail('--topic-state requires --topic-id')
}

const resolveRepositoryIdentity = ({ inputRoot }) => {
  if (!inputRoot) fail('--repo-root is required')
  const requestedRoot = resolve(inputRoot)
  const gitRoot = realpathSync(git({ repoRoot: requestedRoot, args: ['rev-parse', '--show-toplevel'] }))
  const commonDirValue = git({ repoRoot: gitRoot, args: ['rev-parse', '--git-common-dir'] })
  const commonDir = realpathSync(isAbsolute(commonDirValue) ? commonDirValue : resolve(gitRoot, commonDirValue))
  const origin = git({ repoRoot: gitRoot, args: ['remote', 'get-url', 'origin'], optional: true })
  const normalizedRemote = normalizeRemote(origin)
  const identity = normalizedRemote ? `remote:${normalizedRemote}` : `common-dir:${commonDir}`
  const repositoryId = normalizedRemote
    ? stableId(normalizedRemote)
    : `${slugify(basename(gitRoot))}-${shortHash(commonDir)}`
  return { gitRoot, origin, identity, repositoryId }
}

const resolveBranch = ({ gitRoot, inputBranch }) => {
  const branch = inputBranch || git({ repoRoot: gitRoot, args: ['branch', '--show-current'] })
    || `detached-${git({ repoRoot: gitRoot, args: ['rev-parse', '--short', 'HEAD'] })}`
  return { branch, branchId: stableId(branch) }
}

const topicArtifactPaths = ({ topicsRoot, repositoryTopicsRoot, topicId, topicState, branchId }) => {
  if (!topicId || !topicState) {
    return {
      topicRoot: null, topicFile: null, specFile: null, planFile: null,
      ticketsRoot: null, grillsRoot: null, walkthroughsRoot: null, repositoryTopicRoot: null,
      branchesRoot: null, branchRoot: null, ledgerFile: null,
    }
  }
  const topicRoot = join(topicsRoot, topicState, topicId)
  const repositoryTopicRoot = join(repositoryTopicsRoot, topicState, topicId)
  const branchesRoot = join(repositoryTopicRoot, 'branches')
  const branchRoot = join(branchesRoot, branchId)
  return {
    topicRoot, topicFile: join(topicRoot, 'TOPIC.md'),
    specFile: join(topicRoot, 'SPEC.md'), planFile: join(topicRoot, 'PLAN.md'),
    ticketsRoot: join(topicRoot, 'tickets'), grillsRoot: join(topicRoot, 'grills'),
    walkthroughsRoot: join(topicRoot, 'walkthroughs'),
    repositoryTopicRoot, branchesRoot, branchRoot, ledgerFile: join(branchRoot, 'TASKS.md'),
  }
}

const repositoryPaths = ({
  repoRoot: inputRoot, workflowRoot: inputWorkflowRoot, branch: inputBranch,
  topicId, topicState,
}) => {
  validateTopicPathArgs({ topicId, topicState })
  const { gitRoot, origin, identity, repositoryId } = resolveRepositoryIdentity({ inputRoot })
  const { branch, branchId } = resolveBranch({ gitRoot, inputBranch })
  const workflowRoot = workflowRootFor(inputWorkflowRoot)
  const workflowRelative = relative(gitRoot, workflowRoot)
  if (workflowRelative === '' || (!workflowRelative.startsWith('..') && !isAbsolute(workflowRelative))) {
    fail('--workflow-root must be outside the repository')
  }

  const topicsRoot = join(workflowRoot, 'topics')
  const repositoriesRoot = join(workflowRoot, 'repositories')
  const projectRoot = join(repositoriesRoot, repositoryId)
  const repositoryTopicsRoot = join(projectRoot, 'topics')
  const artifacts = topicArtifactPaths({
    topicsRoot, repositoryTopicsRoot, topicId, topicState, branchId,
  })

  return {
    workflowRoot, topicsRoot, repositoriesRoot, projectRoot,
    configFile: join(projectRoot, 'config.json'), repositoryTopicsRoot,
    ...artifacts,
    repositoryId, repositoryRoot: gitRoot, branch, branchId,
    origin: origin || null, identity, topicId: topicId || null, topicState: topicState || null,
  }
}

const readProjectConfig = (paths) => {
  if (!pathExists(paths.configFile)) fail(`${paths.configFile} does not exist; run init first`)
  const config = parseJson({ file: paths.configFile, label: paths.configFile })
  if (!isObject(config) || config.schemaVersion !== 1 || !validBackends.has(config.ticketBackend)
    || !isObject(config.repository) || typeof config.repository.identity !== 'string'
    || typeof config.repository.root !== 'string' || !('origin' in config.repository)
    || (config.repository.origin !== null && typeof config.repository.origin !== 'string')
    || ('externalTicketSystem' in config && !validExternalTicketSystem(config.externalTicketSystem))
    || (config.ticketBackend !== 'local' && !config.externalTicketSystem)
    || (config.externalTicketSystem && config.ticketBackend !== 'local'
      && config.ticketBackend !== config.externalTicketSystem.system)) {
    fail(`${paths.configFile} is not a valid Engineering Workflow configuration`)
  }
  if (config.repository.identity !== paths.identity) fail(`${paths.configFile} belongs to ${config.repository.identity}`)
  return config
}

const writeAtomically = ({ file, content }) => {
  mkdirSync(dirname(file), { recursive: true })
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    writeFileSync(temporaryFile, content)
    renameSync(temporaryFile, file)
  } catch (error) {
    if (pathExists(temporaryFile)) unlinkSync(temporaryFile)
    throw error
  }
}
const writeJsonAtomically = ({ file, value }) => {
  writeAtomically({ file, content: `${JSON.stringify(value, null, 2)}\n` })
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
const withTopicLock = ({ workflowRoot, action }) => withDirectoryLock({
  lockDirectory: join(workflowRoot, '.topics.lock'),
  busyMessage: 'topics are being updated; retry the command',
  action,
})

const validateTransition = (transition) => (
  isObject(transition) && hasOnlyKeys({ value: transition, keys: transitionKeys })
  && (transition.from === null || topicStateSet.has(transition.from))
  && topicStateSet.has(transition.to) && validTimestamp(transition.at)
  && typeof transition.actor === 'string' && transition.actor.trim() !== ''
  && typeof transition.reason === 'string' && transition.reason.trim() !== ''
  && Array.isArray(transition.warnings)
  && transition.warnings.every((warning) => typeof warning === 'string' && warning.trim() !== '')
)

const validTransitionEdge = ({ from, to }) => (
  (from === null && to === 'open')
  || (from === 'open' && new Set(['complete', 'abandoned']).has(to))
  || (new Set(['complete', 'abandoned']).has(from) && to === 'open')
)

const validTransitionHistory = ({ transitions, createdAt, updatedAt }) => {
  if (!Array.isArray(transitions) || transitions.length === 0) return false
  let previousState = null
  let previousTime = Date.parse(createdAt)
  for (const transition of transitions) {
    const transitionTime = Date.parse(transition.at)
    if (!validateTransition(transition) || transition.from !== previousState
      || !validTransitionEdge(transition) || transitionTime < previousTime) return false
    previousState = transition.to
    previousTime = transitionTime
  }
  return previousTime <= Date.parse(updatedAt)
}

const validUniqueArray = ({ value, validate }) => (
  Array.isArray(value) && value.every(validate) && new Set(value).size === value.length
)

const validManifestShape = (manifest) => (
  isObject(manifest) && hasOnlyKeys({ value: manifest, keys: manifestKeys })
  && manifest.schemaVersion === 1 && topicIdPattern.test(manifest.id || '')
  && typeof manifest.title === 'string' && manifest.title.trim() !== ''
  && topicStateSet.has(manifest.state)
  && validTimestamp(manifest.createdAt) && validTimestamp(manifest.updatedAt)
  && Date.parse(manifest.updatedAt) >= Date.parse(manifest.createdAt)
)

const validManifestCollections = (manifest) => (
  validUniqueArray({ value: manifest.repositories, validate: (id) => repositoryIdPattern.test(id) })
  && validUniqueArray({ value: manifest.externalWork, validate: validHttpsUrl })
  && validTransitionHistory({
    transitions: manifest.transitions, createdAt: manifest.createdAt, updatedAt: manifest.updatedAt,
  })
)

const validateManifest = ({ manifest, file, expectedId, expectedState }) => {
  if (!validManifestShape(manifest) || !validManifestCollections(manifest)) {
    fail(`${file} is not a valid topic manifest`)
  }
  if (manifest.id !== expectedId) fail(`${file} topic ID does not match its directory`)
  if (manifest.state !== expectedState) fail(`${file} topic state does not match its directory`)
  if (manifest.transitions.length === 0 || manifest.transitions.at(-1).to !== manifest.state) {
    fail(`${file} transition history does not match topic state`)
  }
}

const parseManifest = ({ file, expectedId, expectedState }) => {
  const content = readFileSync(file, 'utf8')
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) fail(`${file} is not a valid topic manifest`)
  const manifest = {}
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*): (.+)$/)
    if (!field || !manifestKeys.has(field[1]) || field[1] in manifest) {
      fail(`${file} is not a valid topic manifest`)
    }
    try {
      manifest[field[1]] = JSON.parse(field[2])
    } catch {
      fail(`${file} is not a valid topic manifest`)
    }
  }
  validateManifest({ manifest, file, expectedId, expectedState })
  return { manifest, body: match[2], content }
}

const manifestFrontmatter = (manifest) => {
  const lines = []
  for (const key of manifestKeys) lines.push(`${key}: ${JSON.stringify(manifest[key])}`)
  return `---\n${lines.join('\n')}\n---\n`
}

const immediateDirectories = (directory) => {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
}

const filesUnder = (directory) => {
  if (!existsSync(directory)) return []
  const files = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile()) files.push(path)
    }
  }
  visit(directory)
  return files.sort()
}

const ledgerFilesUnder = (repositoryTopicRoot) => (
  filesUnder(join(repositoryTopicRoot, 'branches')).filter((file) => basename(file) === 'TASKS.md')
)

const discoverTopics = ({ workflowRoot }) => {
  const topics = []
  const unregisteredTopics = []
  const ids = new Set()
  for (const state of topicStates) {
    const stateRoot = join(workflowRoot, 'topics', state)
    for (const id of immediateDirectories(stateRoot)) {
      const file = join(stateRoot, id, 'TOPIC.md')
      if (!pathExists(file)) {
        unregisteredTopics.push({ id, state, path: relative(workflowRoot, dirname(file)) })
        continue
      }
      if (ids.has(id)) fail(`duplicate topic ID ${id}`)
      ids.add(id)
      const { manifest } = parseManifest({ file, expectedId: id, expectedState: state })
      topics.push({ ...manifest, path: relative(workflowRoot, file) })
    }
  }
  return { topics: topics.sort((a, b) => a.id.localeCompare(b.id)), unregisteredTopics }
}

const findTopic = ({ workflowRoot, topicId }) => {
  if (!topicIdPattern.test(topicId || '')) fail('--topic-id must be a lowercase hyphenated ID')
  const { topics, unregisteredTopics } = discoverTopics({ workflowRoot })
  if (unregisteredTopics.some((topic) => topic.id === topicId)) {
    fail(`topic ${topicId} has a conflicting directory without a TOPIC.md manifest`)
  }
  const topic = topics.find((candidate) => candidate.id === topicId)
  if (!topic) fail(`topic ${topicId} does not exist`)
  return topic
}

const topicPaths = ({ paths, topic }) => repositoryPaths({
  repoRoot: paths.repositoryRoot, workflowRoot: paths.workflowRoot, branch: paths.branch,
  topicId: topic.id, topicState: topic.state,
})

const artifactHasTopicLink = ({ artifact, topicFile }) => {
  const target = markdownPath(relative(dirname(artifact), topicFile))
  return readFileSync(artifact, 'utf8').includes(`](${target})`)
}

const generatedLinks = ({ workflowRoot, topicRoot, manifest }) => {
  const links = []
  const add = ({ label, file }) => {
    if (!pathExists(file)) return
    links.push(`- ${label}: [${basename(file)}](${markdownPath(relative(topicRoot, file))})`)
  }
  add({ label: 'Specification', file: join(topicRoot, 'SPEC.md') })
  add({ label: 'Plan', file: join(topicRoot, 'PLAN.md') })
  for (const file of filesUnder(join(topicRoot, 'tickets'))) add({ label: 'Ticket', file })
  for (const file of filesUnder(join(topicRoot, 'grills'))) add({ label: 'Grill log', file })
  for (const file of filesUnder(join(topicRoot, 'walkthroughs'))) add({ label: 'Walkthrough log', file })
  for (const repositoryId of manifest.repositories) {
    const repositoryTopicRoot = join(
      workflowRoot, 'repositories', repositoryId, 'topics', manifest.state, manifest.id,
    )
    if (pathExists(repositoryTopicRoot)) {
      links.push(`- Repository: [${repositoryId}](${markdownPath(relative(topicRoot, repositoryTopicRoot))})`)
      for (const file of ledgerFilesUnder(repositoryTopicRoot)) add({ label: 'Branch ledger', file })
    }
  }
  for (const url of manifest.externalWork) links.push(`- External work: [${url}](${url})`)
  if (links.length === 0) links.push('- No artifacts are registered.')
  return `${generatedStart}\n## Artifacts\n\n${links.join('\n')}\n${generatedEnd}`
}

const validateGeneratedLinksSection = ({ topicRoot, body }) => {
  if (!body.includes(generatedStart) || !body.includes(generatedEnd)) {
    fail(`${join(topicRoot, 'TOPIC.md')} is missing its generated links section`)
  }
}

const updateGeneratedLinks = ({ workflowRoot, topicRoot, manifest, body }) => {
  validateGeneratedLinksSection({ topicRoot, body })
  const generated = generatedLinks({ workflowRoot, topicRoot, manifest })
  return body.replace(new RegExp(`${generatedStart}[\\s\\S]*?${generatedEnd}`), generated)
}

const writeManifest = ({ workflowRoot, topicRoot, manifest, body }) => {
  const nextBody = updateGeneratedLinks({ workflowRoot, topicRoot, manifest, body })
  writeAtomically({
    file: join(topicRoot, 'TOPIC.md'),
    content: `${manifestFrontmatter(manifest)}${nextBody.replace(/\s*$/, '\n')}`,
  })
}

const listRepositoryTopicDirectories = ({ workflowRoot, topicId }) => {
  const matches = []
  for (const repositoryId of immediateDirectories(join(workflowRoot, 'repositories'))) {
    for (const state of topicStates) {
      const directory = join(workflowRoot, 'repositories', repositoryId, 'topics', state, topicId)
      if (pathExists(directory)) matches.push({ repositoryId, state, directory })
    }
  }
  return matches
}

const topicEntryWarnings = ({ workflowRoot, topicRoot }) => {
  const warnings = []
  const allowedTopicEntries = new Set([
    'TOPIC.md', 'SPEC.md', 'PLAN.md', 'tickets', 'grills', 'walkthroughs',
  ])
  for (const entry of readdirSync(topicRoot, { withFileTypes: true })) {
    if (!allowedTopicEntries.has(entry.name)) {
      warnings.push(`${relative(workflowRoot, join(topicRoot, entry.name))} is not a registered topic artifact`)
    }
  }
  return warnings
}

const localTicketWarnings = ({ workflowRoot, topicRoot }) => {
  const warnings = []
  const ticketNumbers = new Set()
  const ticketsRoot = join(topicRoot, 'tickets')
  const ticketEntries = pathExists(ticketsRoot)
    ? readdirSync(ticketsRoot, { withFileTypes: true })
    : []
  if (!pathExists(ticketsRoot)) warnings.push(`${relative(workflowRoot, ticketsRoot)} does not exist`)
  for (const entry of ticketEntries) {
    if (!entry.isDirectory() || !new Set(['todo', 'in-progress', 'done']).has(entry.name)) {
      warnings.push(`${relative(workflowRoot, join(ticketsRoot, entry.name))} is not a ticket lifecycle directory`)
      continue
    }
    for (const ticket of readdirSync(join(ticketsRoot, entry.name), { withFileTypes: true })) {
      const match = ticket.isFile() && ticket.name.match(ticketFilePattern)
      if (!match) {
        warnings.push(`${relative(workflowRoot, join(ticketsRoot, entry.name, ticket.name))} is not a valid local ticket`)
      } else if (ticketNumbers.has(match[1])) {
        warnings.push(`duplicate local ticket ID TICKET-${match[1]}`)
      } else {
        ticketNumbers.add(match[1])
      }
    }
  }
  return warnings
}

const artifactLinkWarnings = ({ workflowRoot, topicRoot, manifest }) => {
  const warnings = []
  const topicFile = join(topicRoot, 'TOPIC.md')
  const topicArtifacts = [
    join(topicRoot, 'SPEC.md'), join(topicRoot, 'PLAN.md'),
    ...filesUnder(join(topicRoot, 'tickets')), ...filesUnder(join(topicRoot, 'grills')),
    ...filesUnder(join(topicRoot, 'walkthroughs')),
  ]
  for (const file of topicArtifacts) {
    if (pathExists(file) && !artifactHasTopicLink({ artifact: file, topicFile })) {
      warnings.push(`${relative(workflowRoot, file)} does not link to TOPIC.md`)
    }
  }
  for (const repositoryId of manifest.repositories) {
    const repositoryTopicRoot = join(
      workflowRoot, 'repositories', repositoryId, 'topics', manifest.state, manifest.id,
    )
    for (const ledger of ledgerFilesUnder(repositoryTopicRoot)) {
      if (!artifactHasTopicLink({ artifact: ledger, topicFile })) {
        warnings.push(`${relative(workflowRoot, ledger)} does not link to TOPIC.md`)
      }
    }
  }
  return warnings
}

const repositoryMembershipWarnings = ({ workflowRoot, manifest }) => {
  const warnings = []
  const matches = listRepositoryTopicDirectories({ workflowRoot, topicId: manifest.id })
  for (const match of matches) {
    if (match.state !== manifest.state) warnings.push(`${relative(workflowRoot, match.directory)} has state ${match.state}`)
    if (!manifest.repositories.includes(match.repositoryId)) warnings.push(`${match.repositoryId} is not registered in TOPIC.md`)
  }
  for (const repositoryId of manifest.repositories) {
    const repositoryTopicRoot = join(
      workflowRoot, 'repositories', repositoryId, 'topics', manifest.state, manifest.id,
    )
    if (!pathExists(repositoryTopicRoot)) {
      warnings.push(`${repositoryId} has no repository topic directory`)
    }
  }
  return warnings
}

const validateTopicArtifacts = ({ workflowRoot, topicRoot, manifest }) => [
  ...topicEntryWarnings({ workflowRoot, topicRoot }),
  ...localTicketWarnings({ workflowRoot, topicRoot }),
  ...artifactLinkWarnings({ workflowRoot, topicRoot, manifest }),
  ...repositoryMembershipWarnings({ workflowRoot, manifest }),
]

const requireRepositoryMembership = ({ paths, manifest }) => {
  readProjectConfig(paths)
  if (!manifest.repositories.includes(paths.repositoryId)) {
    fail(`repository ${paths.repositoryId} is not registered in topic ${manifest.id}`)
  }
  const repositoryTopicRoot = join(paths.repositoryTopicsRoot, manifest.state, manifest.id)
  if (!pathExists(repositoryTopicRoot)) {
    fail(`repository ${paths.repositoryId} has no topic directory for ${manifest.id}`)
  }
}

const readTopicForRepository = ({ paths, topic }) => {
  const resolved = topicPaths({ paths, topic })
  const parsed = parseManifest({
    file: resolved.topicFile, expectedId: topic.id, expectedState: topic.state,
  })
  requireRepositoryMembership({ paths, manifest: parsed.manifest })
  return { resolved, ...parsed }
}

const listTopics = ({ workflowRoot }) => {
  const result = discoverTopics({ workflowRoot })
  const unregisteredRepositoryTopics = []
  const topicById = new Map(result.topics.map((topic) => [topic.id, topic]))
  for (const repositoryId of immediateDirectories(join(workflowRoot, 'repositories'))) {
    for (const state of topicStates) {
      const stateRoot = join(workflowRoot, 'repositories', repositoryId, 'topics', state)
      for (const topicId of immediateDirectories(stateRoot)) {
        const topic = topicById.get(topicId)
        if (!topic || topic.state !== state || !topic.repositories.includes(repositoryId)) {
          unregisteredRepositoryTopics.push({ repositoryId, topicId, state })
        }
      }
    }
  }
  return { ...result, unregisteredRepositoryTopics }
}

const initialize = ({ paths, ticketBackend, project: inputProject, baseUrl: inputBaseUrl }) => {
  if (ticketBackend && !validBackends.has(ticketBackend)) fail('--ticket-backend must be local, jira, or github')
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

  let externalTicketSystem = existing?.externalTicketSystem
  if (!existing && backend !== 'local') {
    externalTicketSystem = {
      system: backend,
      project: inputProject?.trim(),
      baseUrl: inputBaseUrl ? normalizeBaseUrl(inputBaseUrl.trim()) : inputBaseUrl,
    }
    if (!validExternalTicketSystem(externalTicketSystem)) {
      fail(`${backend} backend requires --project and --base-url with valid values`)
    }
  } else if (!existing && (inputProject !== undefined || inputBaseUrl !== undefined)) {
    fail('local backend external associations must use configure-ticket-system')
  } else if (existing && (inputProject !== undefined || inputBaseUrl !== undefined)) {
    const requested = {
      system: existing.ticketBackend,
      project: inputProject?.trim() || externalTicketSystem?.project,
      baseUrl: normalizeBaseUrl(inputBaseUrl?.trim() || externalTicketSystem?.baseUrl || ''),
    }
    if (!externalTicketSystem || !validExternalTicketSystem(requested)
      || !sameExternalTicketSystem(externalTicketSystem, requested)) {
      fail('external ticket system conflicts with the existing project configuration')
    }
  }

  for (const state of topicStates) {
    mkdirSync(join(paths.topicsRoot, state), { recursive: true })
    mkdirSync(join(paths.repositoryTopicsRoot, state), { recursive: true })
  }
  const config = {
    schemaVersion: 1,
    ticketBackend: backend,
    ...(externalTicketSystem ? { externalTicketSystem } : {}),
    repository: { identity: paths.identity, origin: paths.origin, root: paths.repositoryRoot },
  }
  if (!existsSync(paths.configFile)) writeJsonAtomically({ file: paths.configFile, value: config })
  return paths
}

const configureTicketSystem = ({ paths, system, project: inputProject, baseUrl: inputBaseUrl }) => {
  const externalTicketSystem = {
    system, project: inputProject?.trim(),
    baseUrl: inputBaseUrl ? normalizeBaseUrl(inputBaseUrl.trim()) : inputBaseUrl,
  }
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
        fail(`${config.ticketBackend} backend requires a matching external ticket system`)
      }
      if (config.externalTicketSystem) {
        if (!sameExternalTicketSystem(config.externalTicketSystem, externalTicketSystem)) {
          fail('external ticket system conflicts with the existing project configuration')
        }
        return config.externalTicketSystem
      }
      writeJsonAtomically({ file: paths.configFile, value: { ...config, externalTicketSystem } })
      return externalTicketSystem
    },
  })
}

const createManifestBody = (title) => (
  `# ${title}\n\n${generatedStart}\n## Artifacts\n\n- No artifacts are registered.\n${generatedEnd}\n\n## Notes\n`
)

const attachTopicUnlocked = ({ paths, topicId, externalUrl }) => {
  readProjectConfig(paths)
  const topic = findTopic({ workflowRoot: paths.workflowRoot, topicId })
  if (topic.state !== 'open') fail(`topic ${topicId} must be reopened before attaching repository work`)
  const resolved = topicPaths({ paths, topic })
  const { manifest, body } = parseManifest({
    file: resolved.topicFile, expectedId: topic.id, expectedState: topic.state,
  })
  validateGeneratedLinksSection({ topicRoot: resolved.topicRoot, body })
  if (externalUrl && !validHttpsUrl(externalUrl)) fail('--external-url must be an absolute HTTPS URL')
  const conflicting = listRepositoryTopicDirectories({ workflowRoot: paths.workflowRoot, topicId })
    .find((match) => match.repositoryId === paths.repositoryId && match.state !== topic.state)
  if (conflicting) fail(`repository topic state conflicts at ${conflicting.directory}`)

  const repositories = [...new Set([...manifest.repositories, paths.repositoryId])].sort()
  const externalWork = [...new Set([...manifest.externalWork, ...(externalUrl ? [externalUrl] : [])])].sort()
  const repositoryTopicExisted = pathExists(resolved.repositoryTopicRoot)
  const changed = repositories.length !== manifest.repositories.length
    || externalWork.length !== manifest.externalWork.length
  try {
    mkdirSync(resolved.branchesRoot, { recursive: true })
    if (changed) {
      const next = { ...manifest, repositories, externalWork, updatedAt: new Date().toISOString() }
      writeManifest({ workflowRoot: paths.workflowRoot, topicRoot: resolved.topicRoot, manifest: next, body })
      return { manifest: next, paths: resolved, changed: true }
    }
    return { manifest, paths: resolved, changed: false }
  } catch (error) {
    if (!repositoryTopicExisted && pathExists(resolved.repositoryTopicRoot)) {
      rmSync(resolved.repositoryTopicRoot, { recursive: true, force: true })
    }
    throw error
  }
}

const attachTopic = ({ paths, topicId, externalUrl, confirmed }) => {
  if (!confirmed) fail('attach-topic requires --confirm')
  return withTopicLock({
    workflowRoot: paths.workflowRoot,
    action: () => attachTopicUnlocked({ paths, topicId, externalUrl }),
  })
}

const initializeTopic = ({ paths, topicId, title: inputTitle, confirmed }) => {
  readProjectConfig(paths)
  if (!confirmed) fail('init-topic requires --confirm')
  if (!topicIdPattern.test(topicId || '')) fail('--topic-id must be a lowercase hyphenated ID')
  const title = inputTitle?.trim()
  if (!title) fail('--title is required and cannot be empty')

  return withTopicLock({ workflowRoot: paths.workflowRoot, action: () => {
    const existing = discoverTopics({ workflowRoot: paths.workflowRoot }).topics.find((topic) => topic.id === topicId)
    if (existing) {
      if (existing.title !== title || existing.state !== 'open') fail(`topic ${topicId} conflicts with the existing manifest`)
      return attachTopicUnlocked({ paths, topicId })
    }
    const timestamp = new Date().toISOString()
    const manifest = {
      schemaVersion: 1, id: topicId, title, state: 'open',
      createdAt: timestamp, updatedAt: timestamp,
      repositories: [paths.repositoryId], externalWork: [],
      transitions: [{
        from: null, to: 'open', at: timestamp,
        actor: git({ repoRoot: paths.repositoryRoot, args: ['config', 'user.name'], optional: true }) || 'user',
        reason: 'Topic created', warnings: [],
      }],
    }
    const resolved = topicPaths({ paths, topic: manifest })
    if (pathExists(resolved.topicRoot)) fail(`topic path already exists: ${resolved.topicRoot}`)
    if (pathExists(resolved.repositoryTopicRoot)) fail(`repository topic path already exists: ${resolved.repositoryTopicRoot}`)
    mkdirSync(resolved.topicRoot, { recursive: true })
    for (const state of ['todo', 'in-progress', 'done']) mkdirSync(join(resolved.ticketsRoot, state), { recursive: true })
    mkdirSync(resolved.grillsRoot, { recursive: true })
    mkdirSync(resolved.walkthroughsRoot, { recursive: true })
    mkdirSync(resolved.branchesRoot, { recursive: true })
    writeManifest({
      workflowRoot: paths.workflowRoot, topicRoot: resolved.topicRoot,
      manifest, body: createManifestBody(title),
    })
    return { manifest, paths: resolved }
  } })
}

const syncTopicUnlocked = ({ paths, topicId }) => {
  const topic = findTopic({ workflowRoot: paths.workflowRoot, topicId })
  const { resolved, manifest, body, content } = readTopicForRepository({ paths, topic })
  const nextBody = updateGeneratedLinks({
    workflowRoot: paths.workflowRoot, topicRoot: resolved.topicRoot, manifest, body,
  })
  const nextContent = `${manifestFrontmatter(manifest)}${nextBody.replace(/\s*$/, '\n')}`
  if (nextContent !== content) writeAtomically({ file: resolved.topicFile, content: nextContent })
  return {
    manifest, paths: resolved, changed: nextContent !== content,
    warnings: validateTopicArtifacts({
      workflowRoot: paths.workflowRoot, topicRoot: resolved.topicRoot, manifest,
    }),
  }
}

const syncTopic = ({ paths, topicId }) => withTopicLock({
  workflowRoot: paths.workflowRoot,
  action: () => syncTopicUnlocked({ paths, topicId }),
})

const completionWarnings = ({ paths, resolved, manifest }) => {
  const warnings = validateTopicArtifacts({
    workflowRoot: paths.workflowRoot, topicRoot: resolved.topicRoot, manifest,
  })
  if (pathExists(resolved.specFile)
    && !/^\| Status \| Implemented \|$/m.test(readFileSync(resolved.specFile, 'utf8'))) {
    warnings.push('SPEC.md is not Implemented')
  }
  for (const state of ['todo', 'in-progress']) {
    for (const ticket of filesUnder(join(resolved.ticketsRoot, state))) {
      warnings.push(`${relative(paths.workflowRoot, ticket)} is ${state}`)
    }
  }
  for (const repositoryId of manifest.repositories) {
    const repositoryTopicRoot = join(
      paths.workflowRoot, 'repositories', repositoryId, 'topics', manifest.state, manifest.id,
    )
    for (const ledger of ledgerFilesUnder(repositoryTopicRoot)) {
      const openTasks = readFileSync(ledger, 'utf8').match(/^- \[ \] /gm) || []
      if (openTasks.length > 0) {
        warnings.push(`${relative(paths.workflowRoot, ledger)} has ${openTasks.length} incomplete tasks`)
      }
    }
  }
  for (const url of manifest.externalWork) warnings.push(`external status was not verified: ${url}`)
  return [...new Set(warnings)].sort()
}

const rewriteLedgerTopicLinks = ({ paths, manifest, fromState, toState, changes }) => {
  const oldTopicFile = join(paths.topicsRoot, fromState, manifest.id, 'TOPIC.md')
  const newTopicFile = join(paths.topicsRoot, toState, manifest.id, 'TOPIC.md')
  for (const repositoryId of manifest.repositories) {
    const repositoryTopicRoot = join(
      paths.repositoriesRoot, repositoryId, 'topics', toState, manifest.id,
    )
    for (const ledger of ledgerFilesUnder(repositoryTopicRoot)) {
      const original = readFileSync(ledger, 'utf8')
      const oldLink = markdownPath(relative(dirname(ledger), oldTopicFile))
      const newLink = markdownPath(relative(dirname(ledger), newTopicFile))
      const content = original.replaceAll(`](${oldLink})`, `](${newLink})`)
      if (content !== original) {
        writeAtomically({ file: ledger, content })
        changes.push({ file: ledger, original })
      }
    }
  }
}

const validateTransitionDirection = ({ topicId, fromState, toState }) => {
  if (fromState === toState) return
  if (toState !== 'open' && fromState !== 'open') {
    fail(`topic ${topicId} must be open before it can move to ${toState}`)
  }
  if (toState === 'open' && !new Set(['complete', 'abandoned']).has(fromState)) {
    fail(`topic ${topicId} must be complete or abandoned before it can reopen`)
  }
}

const transitionWarnings = ({ paths, resolved, manifest, toState }) => (
  toState === 'complete'
    ? completionWarnings({ paths, resolved, manifest })
    : validateTopicArtifacts({
      workflowRoot: paths.workflowRoot, topicRoot: resolved.topicRoot, manifest,
    })
)

const planTopicMoves = ({ paths, resolved, manifest, toState }) => {
  const moves = []
  for (const repositoryId of manifest.repositories) {
    const source = join(paths.repositoriesRoot, repositoryId, 'topics', manifest.state, manifest.id)
    const target = join(paths.repositoriesRoot, repositoryId, 'topics', toState, manifest.id)
    if (pathExists(source)) moves.push({ source, target })
  }
  moves.push({
    source: resolved.topicRoot,
    target: join(paths.topicsRoot, toState, manifest.id),
  })
  for (const move of moves) {
    if (pathExists(move.target)) fail(`topic transition target already exists: ${move.target}`)
    mkdirSync(dirname(move.target), { recursive: true })
  }
  return moves
}

const nextManifestState = ({ paths, manifest, toState, reason, actor, warnings }) => {
  const timestamp = new Date().toISOString()
  return {
    ...manifest, state: toState, updatedAt: timestamp,
    transitions: [...manifest.transitions, {
      from: manifest.state, to: toState, at: timestamp,
      actor: actor?.trim()
        || git({ repoRoot: paths.repositoryRoot, args: ['config', 'user.name'], optional: true })
        || 'user',
      reason, warnings,
    }],
  }
}

const rollbackTopicTransition = ({ moved, ledgerChanges, targetTopicRoot, originalManifest }) => {
  for (const change of ledgerChanges.reverse()) writeFileSync(change.file, change.original)
  const targetManifest = join(targetTopicRoot, 'TOPIC.md')
  if (pathExists(targetManifest)) writeFileSync(targetManifest, originalManifest)
  for (const move of moved.reverse()) {
    if (pathExists(move.target) && !pathExists(move.source)) renameSync(move.target, move.source)
  }
}

const applyTopicTransition = ({ paths, resolved, manifest, body, content, toState, reason, actor, warnings }) => {
  const moves = planTopicMoves({ paths, resolved, manifest, toState })
  const targetTopicRoot = moves.at(-1).target
  const moved = []
  let ledgerChanges = []
  try {
    for (const move of moves) {
      renameSync(move.source, move.target)
      moved.push(move)
    }
    const next = nextManifestState({ paths, manifest, toState, reason, actor, warnings })
    rewriteLedgerTopicLinks({
      paths, manifest, fromState: manifest.state, toState, changes: ledgerChanges,
    })
    writeManifest({ workflowRoot: paths.workflowRoot, topicRoot: targetTopicRoot, manifest: next, body })
    return { changed: true, topic: next, warnings }
  } catch (error) {
    rollbackTopicTransition({ moved, ledgerChanges, targetTopicRoot, originalManifest: content })
    throw error
  }
}

const transitionTopicUnlocked = ({ paths, topicId, toState, inputReason, inputActor, confirmWarnings }) => {
  const topic = findTopic({ workflowRoot: paths.workflowRoot, topicId })
  const { resolved, manifest, body, content } = readTopicForRepository({ paths, topic })
  if (topic.state === toState) return { changed: false, topic, warnings: [] }
  validateTransitionDirection({ topicId, fromState: topic.state, toState })
  const reason = inputReason?.trim()
  if (!reason) fail('--reason is required')
  const warnings = transitionWarnings({ paths, resolved, manifest, toState })
  if (warnings.length > 0 && !confirmWarnings) {
    process.exitCode = 2
    return { changed: false, confirmationRequired: true, warnings }
  }
  return applyTopicTransition({
    paths, resolved, manifest, body, content, toState,
    reason, actor: inputActor, warnings,
  })
}

const transitionTopic = ({ paths, topicId, toState, reason, actor, confirmWarnings }) => withTopicLock({
  workflowRoot: paths.workflowRoot,
  action: () => transitionTopicUnlocked({
    paths, topicId, toState, inputReason: reason, inputActor: actor, confirmWarnings,
  }),
})

const markSpecImplemented = ({ paths, topicId }) => withTopicLock({
  workflowRoot: paths.workflowRoot,
  action: () => {
    const topic = findTopic({ workflowRoot: paths.workflowRoot, topicId })
    requireRepositoryMembership({ paths, manifest: topic })
    const resolved = topicPaths({ paths, topic })
    if (!pathExists(resolved.specFile)) fail(`topic ${topicId} has no SPEC.md`)
    const content = readFileSync(resolved.specFile, 'utf8')
    const status = content.match(/^\| Status \| (Draft|Ready|Implemented) \|$/m)
    if (!status) fail('SPEC.md must contain a Draft, Ready, or Implemented metadata status')
    if (status[1] === 'Implemented') return { changed: false, status: 'Implemented' }
    writeAtomically({ file: resolved.specFile, content: content.replace(status[0], '| Status | Implemented |') })
    return { changed: true, previousStatus: status[1], status: 'Implemented' }
  },
})

const grillFilePattern = /^(\d{4}-\d{2}-\d{2})-(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/

const requireOpenGrillTopic = (topic) => {
  if (topic.state !== 'open') {
    fail(`topic ${topic.id} must be reopened before changing grill logs`)
  }
}

const readGrillLog = ({ logFile, topicFile }) => {
  const content = readFileSync(logFile, 'utf8')
  const title = basename(logFile).match(grillFilePattern)?.[3]
  const topicTarget = markdownPath(relative(dirname(logFile), topicFile))
  const pattern = new RegExp(
    `^# Grill: ${title}\\n\\nTopic: \\[TOPIC\\.md\\]\\(${topicTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`
      + '\\n\\n## Resolved decisions\\n([\\s\\S]*?)\\n## Next unresolved question\\n\\n(.+)\\n$',
  )
  const match = content.match(pattern)
  if (!match) fail(`${logFile} is not a valid grill log for this topic`)
  const decisionPattern = /\n*### Decision \d+\n\n- Question: .+\n- Recommendation: .+\n- Decision: .+\n- Rationale: .+\n/g
  if (match[1].replace(decisionPattern, '').trim() !== '') {
    fail(`${logFile} is not a valid grill log for this topic`)
  }
  return content
}

const startGrill = ({ paths, topicId, slug: inputSlug, logFile: inputLogFile }) => withTopicLock({
  workflowRoot: paths.workflowRoot,
  action: () => {
    const topic = findTopic({ workflowRoot: paths.workflowRoot, topicId })
    requireRepositoryMembership({ paths, manifest: topic })
    requireOpenGrillTopic(topic)
    const resolved = topicPaths({ paths, topic })
    if (inputLogFile) {
      const logFile = join(resolved.grillsRoot, basename(inputLogFile))
      if (!grillFilePattern.test(basename(inputLogFile)) || !pathExists(logFile)) {
        fail('--log-file must name an existing grill log for this topic')
      }
      readGrillLog({ logFile, topicFile: resolved.topicFile })
      return { resumed: true, logFile, topicFile: resolved.topicFile }
    }
    const slug = inputSlug?.trim()
    if (!topicIdPattern.test(slug || '')) fail('--slug must be a lowercase hyphenated ID')
    mkdirSync(resolved.grillsRoot, { recursive: true })
    const date = new Date().toISOString().slice(0, 10)
    const sequences = filesUnder(resolved.grillsRoot)
      .map((file) => basename(file).match(grillFilePattern))
      .filter((match) => match?.[1] === date)
      .map((match) => Number(match[2]))
    const sequence = String(Math.max(0, ...sequences) + 1).padStart(2, '0')
    const logFile = join(resolved.grillsRoot, `${date}-${sequence}-${slug}.md`)
    const topicLink = markdownPath(relative(dirname(logFile), resolved.topicFile))
    writeAtomically({
      file: logFile,
      content: `# Grill: ${slug}\n\nTopic: [TOPIC.md](${topicLink})\n\n## Resolved decisions\n\n## Next unresolved question\n\nTBD\n`,
    })
    syncTopicUnlocked({ paths, topicId })
    return { resumed: false, logFile, topicFile: resolved.topicFile }
  },
})

const requiredText = ({ name, value }) => {
  if (typeof value !== 'string' || value.trim() === '') fail(`--${name} is required`)
  const text = value.trim()
  if (/\r|\n/.test(text)) fail(`--${name} must be a single line`)
  return text
}

const updateGrill = ({
  paths, topicId, logFile: inputLogFile, question, recommendation,
  decision, rationale, nextQuestion,
}) => withTopicLock({
  workflowRoot: paths.workflowRoot,
  action: () => {
    const topic = findTopic({ workflowRoot: paths.workflowRoot, topicId })
    requireRepositoryMembership({ paths, manifest: topic })
    requireOpenGrillTopic(topic)
    const resolved = topicPaths({ paths, topic })
    const logFile = join(resolved.grillsRoot, basename(inputLogFile || ''))
    if (!grillFilePattern.test(basename(inputLogFile || '')) || !pathExists(logFile)) {
      fail('--log-file must name an existing grill log for this topic')
    }
    const values = {
      question: requiredText({ name: 'question', value: question }),
      recommendation: requiredText({ name: 'recommendation', value: recommendation }),
      decision: requiredText({ name: 'decision', value: decision }),
      rationale: requiredText({ name: 'rationale', value: rationale }),
      nextQuestion: requiredText({ name: 'next-question', value: nextQuestion }),
    }
    const content = readGrillLog({ logFile, topicFile: resolved.topicFile })
    const marker = '\n## Next unresolved question\n'
    if (!content.includes(marker)) fail(`${logFile} is not a valid grill log`)
    const count = (content.match(/^### Decision \d+$/gm) || []).length + 1
    const resolution = [
      `### Decision ${count}`, '',
      `- Question: ${values.question}`,
      `- Recommendation: ${values.recommendation}`,
      `- Decision: ${values.decision}`,
      `- Rationale: ${values.rationale}`, '',
    ].join('\n')
    const prefix = content.slice(0, content.indexOf(marker)).replace(/\s*$/, '\n\n')
    writeAtomically({
      file: logFile,
      content: `${prefix}${resolution}## Next unresolved question\n\n${values.nextQuestion}\n`,
    })
    return { logFile, decision: count }
  },
})

const walkthroughFilePattern = /^(\d{4}-\d{2}-\d{2})-(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/
const walkthroughSources = new Set(['last-turn', 'working-tree', 'branch'])
const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const unsafeWalkthroughText = /(?:^|\s)(?:\/Users\/|\/home\/|[A-Za-z]:\\|(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{12,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9._~+/-]{12,})|```|-----BEGIN [A-Z ]+PRIVATE KEY-----|^(?:User|Assistant|System|Prompt|Transcript):/i

const walkthroughText = ({ name, value }) => {
  const text = requiredText({ name, value })
  if (unsafeWalkthroughText.test(text)) fail(`${name} contains unsafe walkthrough content`)
  return text
}

const requireOpenWalkthroughTopic = (topic) => {
  if (topic.state !== 'open') {
    fail(`topic ${topic.id} must be reopened before changing walkthrough logs`)
  }
}

const walkthroughLogFile = ({ root, inputLogFile }) => {
  if (typeof inputLogFile !== 'string' || basename(inputLogFile) !== inputLogFile
    || !walkthroughFilePattern.test(inputLogFile)) {
    fail('--log-file must name an existing walkthrough log for this topic')
  }
  const logFile = join(root, inputLogFile)
  if (!pathExists(logFile)) fail('--log-file must name an existing walkthrough log for this topic')
  return logFile
}

const readWalkthroughLog = ({ logFile, topicFile, repositoryId }) => {
  const content = readFileSync(logFile, 'utf8')
  const title = basename(logFile).match(walkthroughFilePattern)?.[3]
  const topicTarget = markdownPath(relative(dirname(logFile), topicFile))
  const topicLogTarget = markdownPath(relative(dirname(topicFile), logFile))
  if (!readFileSync(topicFile, 'utf8').includes(`](${topicLogTarget})`)) {
    fail(`${logFile} is not a valid walkthrough log for this topic`)
  }
  const pattern = new RegExp(
    `^# Walkthrough: ${escapePattern(title)}\\n\\nTopic: \\[TOPIC\\.md\\]\\(${escapePattern(topicTarget)}\\)`
      + '\\n\\n## Provenance\\n\\n'
      + '- Source: (last-turn|working-tree|branch)\\n'
      + '- Repository: ([a-zA-Z0-9._-]+-[0-9a-f]{8})\\n'
      + '- Branch: (.+)\\n'
      + '- Base: (none|[0-9a-f]{40})\\n'
      + '- Head: ([0-9a-f]{40})\\n'
      + '- Range: (.+)\\n'
      + '- Started at: (.+)\\n\\n## Slices\\n([\\s\\S]*?)## Next slice\\n\\n(.+)\\n$',
  )
  const match = content.match(pattern)
  if (!match) fail(`${logFile} is not a valid walkthrough log for this topic`)
  const [, source, repository, branch, base, head, range, startedAt, slices, nextSlice] = match
  const validBase = source === 'branch' ? base !== 'none' : base === 'none'
  const expectedRange = source === 'branch' ? `${base}...${head}` : `${source}@${head}`
  if (repository !== repositoryId || !validTimestamp(startedAt)
    || !validBase || range !== expectedRange) {
    fail(`${logFile} is not a valid walkthrough log for this topic`)
  }
  const records = []
  const recordPattern = /^### Slice (\d+)\n\n- Slice: (.+)\n- Status: (covered|changed|unresolved)\n- Summary: (.+)\n- Evidence: (.+)\n- Decision: (.+)\n\n/gm
  let record
  while ((record = recordPattern.exec(slices)) !== null) {
    records.push({
      number: Number(record[1]), slice: record[2], status: record[3], summary: record[4],
      evidence: record[5], decision: record[6],
    })
  }
  if (slices.replace(recordPattern, '').trim() !== ''
    || records.some(({ number }, index) => number !== index + 1)) {
    fail(`${logFile} is not a valid walkthrough log for this topic`)
  }
  return { content, records, source, repository, branch, base, head, range, startedAt, nextSlice }
}

const startWalkthrough = ({
  paths, topicId, slug: inputSlug, source, baseRef, nextSlice, logFile: inputLogFile,
}) => withTopicLock({
  workflowRoot: paths.workflowRoot,
  action: () => {
    const topic = findTopic({ workflowRoot: paths.workflowRoot, topicId })
    requireRepositoryMembership({ paths, manifest: topic })
    requireOpenWalkthroughTopic(topic)
    const resolved = topicPaths({ paths, topic })
    if (inputLogFile) {
      const logFile = walkthroughLogFile({ root: resolved.walkthroughsRoot, inputLogFile })
      readWalkthroughLog({ logFile, topicFile: resolved.topicFile, repositoryId: paths.repositoryId })
      return { resumed: true, logFile, topicFile: resolved.topicFile }
    }
    const slug = inputSlug?.trim()
    if (!topicIdPattern.test(slug || '')) fail('--slug must be a lowercase hyphenated ID')
    if (!walkthroughSources.has(source)) fail('--source must be last-turn, working-tree, or branch')
    if (source === 'branch' && !baseRef?.trim()) fail('--base-ref is required when --source is branch')
    if (source !== 'branch' && baseRef !== undefined) fail('--base-ref is only valid when --source is branch')
    const values = { nextSlice: walkthroughText({ name: 'next-slice', value: nextSlice }) }
    const branch = walkthroughText({ name: 'branch', value: paths.branch })
    git({ repoRoot: paths.repositoryRoot, args: ['check-ref-format', '--branch', branch] })
    const head = git({ repoRoot: paths.repositoryRoot, args: ['rev-parse', 'HEAD'] })
    const base = source === 'branch'
      ? git({ repoRoot: paths.repositoryRoot, args: ['merge-base', 'HEAD', baseRef.trim()] })
      : 'none'
    const range = source === 'branch' ? `${base}...${head}` : `${source}@${head}`
    mkdirSync(resolved.walkthroughsRoot, { recursive: true })
    const date = new Date().toISOString().slice(0, 10)
    const sequences = filesUnder(resolved.walkthroughsRoot)
      .map((file) => basename(file).match(walkthroughFilePattern))
      .filter((match) => match?.[1] === date)
      .map((match) => Number(match[2]))
    const sequence = String(Math.max(0, ...sequences) + 1).padStart(2, '0')
    const logFile = join(resolved.walkthroughsRoot, `${date}-${sequence}-${slug}.md`)
    const topicLink = markdownPath(relative(dirname(logFile), resolved.topicFile))
    const startedAt = new Date().toISOString()
    writeAtomically({
      file: logFile,
      content: `# Walkthrough: ${slug}\n\nTopic: [TOPIC.md](${topicLink})\n\n## Provenance\n\n`
        + `- Source: ${source}\n- Repository: ${paths.repositoryId}\n- Branch: ${branch}\n`
        + `- Base: ${base}\n- Head: ${head}\n- Range: ${range}\n- Started at: ${startedAt}\n\n`
        + `## Slices\n\n## Next slice\n\n${values.nextSlice}\n`,
    })
    syncTopicUnlocked({ paths, topicId })
    return { resumed: false, logFile, topicFile: resolved.topicFile, base, head, range }
  },
})

const updateWalkthrough = ({
  paths, topicId, logFile: inputLogFile, slice, status, summary, evidence, decision, nextSlice,
}) => withTopicLock({
  workflowRoot: paths.workflowRoot,
  action: () => {
    const topic = findTopic({ workflowRoot: paths.workflowRoot, topicId })
    requireRepositoryMembership({ paths, manifest: topic })
    requireOpenWalkthroughTopic(topic)
    const resolved = topicPaths({ paths, topic })
    const logFile = walkthroughLogFile({ root: resolved.walkthroughsRoot, inputLogFile })
    const values = {
      slice: walkthroughText({ name: 'slice', value: slice }),
      summary: walkthroughText({ name: 'summary', value: summary }),
      evidence: walkthroughText({ name: 'evidence', value: evidence }),
      decision: walkthroughText({ name: 'decision', value: decision }),
      nextSlice: walkthroughText({ name: 'next-slice', value: nextSlice }),
    }
    if (!new Set(['covered', 'changed', 'unresolved']).has(status)) {
      fail('--status must be covered, changed, or unresolved')
    }
    const log = readWalkthroughLog({
      logFile, topicFile: resolved.topicFile, repositoryId: paths.repositoryId,
    })
    const marker = '\n## Next slice\n'
    const prefix = log.content.slice(0, log.content.indexOf(marker)).replace(/\s*$/, '\n\n')
    const count = log.records.length + 1
    writeAtomically({
      file: logFile,
      content: `${prefix}### Slice ${count}\n\n- Slice: ${values.slice}\n- Status: ${status}\n- Summary: ${values.summary}\n`
        + `- Evidence: ${values.evidence}\n- Decision: ${values.decision}\n\n## Next slice\n\n${values.nextSlice}\n`,
    })
    syncTopicUnlocked({ paths, topicId })
    return { logFile, slice: count }
  },
})

try {
  const { command, options } = parseArgs(process.argv.slice(2))
  if (command === 'topics') {
    console.log(JSON.stringify(listTopics({ workflowRoot: workflowRootFor(options['workflow-root']) }), null, 2))
  } else {
    let paths = repositoryPaths({
      repoRoot: options['repo-root'], workflowRoot: options['workflow-root'], branch: options.branch,
      topicId: options['topic-id'], topicState: options['topic-state'],
    })
    if (options['topic-id'] && !options['topic-state'] && command === 'paths') {
      paths = topicPaths({
        paths,
        topic: findTopic({ workflowRoot: paths.workflowRoot, topicId: options['topic-id'] }),
      })
    }

    if (command === 'init') {
      console.log(JSON.stringify(initialize({
        paths, ticketBackend: options['ticket-backend'], project: options.project,
        baseUrl: options['base-url'],
      }), null, 2))
    } else if (command === 'init-topic') {
      console.log(JSON.stringify(initializeTopic({
        paths, topicId: options['topic-id'], title: options.title, confirmed: options.confirm,
      }), null, 2))
    } else if (command === 'attach-topic') {
      console.log(JSON.stringify(attachTopic({
        paths, topicId: options['topic-id'], externalUrl: options['external-url'], confirmed: options.confirm,
      }), null, 2))
    } else if (command === 'sync-topic') {
      console.log(JSON.stringify(syncTopic({ paths, topicId: options['topic-id'] }), null, 2))
    } else if (new Set(['complete-topic', 'abandon-topic', 'reopen-topic']).has(command)) {
      const states = { 'complete-topic': 'complete', 'abandon-topic': 'abandoned', 'reopen-topic': 'open' }
      console.log(JSON.stringify(transitionTopic({
        paths, topicId: options['topic-id'], toState: states[command], reason: options.reason,
        actor: options.actor, confirmWarnings: options['confirm-warnings'],
      }), null, 2))
    } else if (command === 'mark-spec-implemented') {
      console.log(JSON.stringify(markSpecImplemented({ paths, topicId: options['topic-id'] }), null, 2))
    } else if (command === 'start-grill') {
      console.log(JSON.stringify(startGrill({
        paths, topicId: options['topic-id'], slug: options.slug, logFile: options['log-file'],
      }), null, 2))
    } else if (command === 'update-grill') {
      console.log(JSON.stringify(updateGrill({
        paths, topicId: options['topic-id'], logFile: options['log-file'],
        question: options.question, recommendation: options.recommendation,
        decision: options.decision, rationale: options.rationale,
        nextQuestion: options['next-question'],
      }), null, 2))
    } else if (command === 'start-walkthrough') {
      console.log(JSON.stringify(startWalkthrough({
        paths, topicId: options['topic-id'], slug: options.slug, source: options.source,
        baseRef: options['base-ref'], nextSlice: options['next-slice'], logFile: options['log-file'],
      }), null, 2))
    } else if (command === 'update-walkthrough') {
      console.log(JSON.stringify(updateWalkthrough({
        paths, topicId: options['topic-id'], logFile: options['log-file'], slice: options.slice,
        status: options.status, summary: options.summary, evidence: options.evidence,
        decision: options.decision, nextSlice: options['next-slice'],
      }), null, 2))
    } else if (command === 'configure-ticket-system') {
      const externalTicketSystem = configureTicketSystem({
        paths, system: options.system, project: options.project, baseUrl: options['base-url'],
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
