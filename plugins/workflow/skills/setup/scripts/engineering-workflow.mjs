#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
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
  if (!new Set(['paths', 'init', 'migrate-ledgers']).has(command)) {
    fail('Usage: engineering-workflow.mjs <paths|init|migrate-ledgers> [options]')
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
  const fallbackHash = createHash('sha256').update(commonDir).digest('hex').slice(0, 8)
  const repositoryId = normalizedRemote
    ? slugify(normalizedRemote)
    : `${slugify(basename(repositoryRoot))}-${fallbackHash}`
  const branch = inputBranch || git({ repoRoot: repositoryRoot, args: ['branch', '--show-current'] })
    || `detached-${git({ repoRoot: repositoryRoot, args: ['rev-parse', '--short', 'HEAD'] })}`
  const branchId = slugify(branch)
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
    specsRoot: join(projectRoot, 'specs'),
    ticketsRoot: join(projectRoot, 'tickets'),
    branchesRoot: join(projectRoot, 'branches'),
    branchRoot: join(projectRoot, 'branches', branchId),
    ledgerFile: join(projectRoot, 'branches', branchId, 'TASKS.md'),
    worktreesRoot: join(projectRoot, 'worktrees'),
    worktreeRoot: join(projectRoot, 'worktrees', branchId),
    repositoryId,
    repositoryRoot,
    branch,
    branchId,
    origin: origin || null,
    identity,
  }
}

const validBackends = new Set(['local', 'jira'])

const initialize = ({ paths, ticketBackend }) => {
  const backend = ticketBackend || 'local'
  if (!validBackends.has(backend)) fail('--ticket-backend must be local or jira')

  if (existsSync(paths.configFile)) {
    const existing = JSON.parse(readFileSync(paths.configFile, 'utf8'))
    if (existing?.repository?.identity !== paths.identity) {
      fail(`${paths.configFile} belongs to ${existing?.repository?.identity || 'an unknown repository'}`)
    }
  }

  const directories = [
    paths.specsRoot,
    paths.ticketsRoot,
    paths.branchesRoot,
    paths.worktreesRoot,
  ]
  for (const directory of directories) mkdirSync(directory, { recursive: true })

  const config = {
    schemaVersion: 1,
    ticketBackend: backend,
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

const migrateLedgers = ({
  sourceRoot: inputSourceRoot,
  workflowRoot: inputWorkflowRoot,
  repoRoot: inputRepoRoot,
  branch: inputBranch,
  apply,
}) => {
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

  if (result.conflicts.length > 0) {
    process.exitCode = 2
    return result
  }

  for (const entry of missing) {
    if (apply) {
      mkdirSync(resolve(entry.absoluteTarget, '..'), { recursive: true })
      copyFileSync(entry.absoluteSource, entry.absoluteTarget)
      if (!readFileSync(entry.absoluteTarget).equals(readFileSync(entry.absoluteSource))) {
        fail(`Verification failed for ${entry.absoluteTarget}`)
      }
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
    if (command === 'init') initialize({ paths, ticketBackend: options['ticket-backend'] })
    console.log(JSON.stringify(paths, null, 2))
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
