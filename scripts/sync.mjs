#!/usr/bin/env node
// Refresh filip-stack installations and an optional shared fleet baseline.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { isDevelopmentOnlyPluginPath } from './plugin-payload-policy.mjs'
import { loadFleetConfig } from './fleet-config.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const script = fileURLToPath(import.meta.url)
const home = homedir()
const codexHome = process.env.CODEX_HOME || join(home, '.codex')
const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(home, '.claude')
const dryRun = process.argv.includes('--dry-run')
const json = process.argv.includes('--json')
const report = { host: hostname(), dryRun, startedAt: new Date().toISOString(), components: [] }
const stateRoot = join(process.env.XDG_STATE_HOME || join(home, '.local', 'state'), 'filip-stack')
const lock = join(stateRoot, 'sync.lock')
let policy

const readJson = (path, fallback) => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback
const run = (command, args, options = {}) => {
  const { includeOutputOnError = false, ...spawnOptions } = options
  const result = spawnSync(command, args, { cwd: repository, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, ...spawnOptions })
  if (result.error || result.status !== 0) {
    const output = includeOutputOnError && result.stdout.trim() ? `\n${result.stdout.trim()}` : ''
    throw new Error(`${command} ${args.join(' ')}: ${result.error?.message || result.stderr.trim() || `exit ${result.status}`}${output}`)
  }
  return result.stdout.trim()
}
const git = (...args) => run('git', ['-C', repository, ...args])
const available = (command) => {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 10000 })
  if (result.error?.code === 'ENOENT') return false
  if (result.error || result.status !== 0) throw new Error(`${command} --version failed: ${result.error?.message || result.stderr.trim() || `exit ${result.status}`}`)
  return true
}
const step = (name, action) => {
  try { report.components.push({ name, state: dryRun ? 'planned' : 'current', ...action() }) }
  catch (error) { report.components.push({ name, state: 'blocked', message: error.message }) }
}

const files = (root) => readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() || entry.isSymbolicLink())
  .map((entry) => relative(root, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort()

const isClaudeUseMarker = ({ installed, path }) => {
  if (!/^\.in_use\/[1-9][0-9]*$/u.test(path)) return false
  try {
    const markerPath = join(installed, path)
    if (!lstatSync(markerPath).isFile()) return false
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'))
    return marker?.pid === Number(path.split('/')[1]) && typeof marker.procStart === 'string' && Object.keys(marker).length === 2
  } catch (error) {
    // Session shutdown can remove a marker after it was enumerated.
    return error.code === 'ENOENT'
  }
}

const verifyPayload = ({ source, installed, plugin = false, claudeRuntime = false }) => {
  const expected = files(source).filter((path) => !plugin || !isDevelopmentOnlyPluginPath(path))
  for (const path of expected) {
    if (!existsSync(join(installed, path)) || !readFileSync(join(source, path)).equals(readFileSync(join(installed, path)))) {
      throw new Error(`installed payload differs: ${join(installed, path)}`)
    }
  }
  const extra = files(installed).filter((path) => !expected.includes(path) && !(claudeRuntime && isClaudeUseMarker({ installed, path })))
  if (extra.length) throw new Error(`unexpected installed files in ${installed}: ${extra.join(', ')}`)
  return expected.length
}

// The skills lock stores Git tree IDs for GitHub installs. Reproduce Git's tree
// encoding without an index or temporary repository, so local edits are detected.
const objectHash = (kind, bytes) => createHash('sha1').update(`${kind} ${bytes.length}\0`).update(bytes).digest()
const treeHash = (directory) => {
  const entries = readdirSync(directory).map((name) => {
    const path = join(directory, name)
    const stat = lstatSync(path)
    if (stat.isDirectory()) return { name, mode: '40000', hash: treeHash(path), order: `${name}/` }
    const content = stat.isSymbolicLink() ? Buffer.from(readlinkSync(path)) : readFileSync(path)
    return { name, mode: stat.isSymbolicLink() ? '120000' : stat.mode & 0o111 ? '100755' : '100644', hash: objectHash('blob', content), order: name }
  }).sort((a, b) => Buffer.compare(Buffer.from(a.order), Buffer.from(b.order)))
  return objectHash('tree', Buffer.concat(entries.map(({ name, mode, hash }) => Buffer.concat([Buffer.from(`${mode} ${name}\0`), hash]))))
}

// Some skills CLI installs record a SHA-256 folder hash instead. This mirrors
// computeSkillFolderHash in skills 1.8: it skips metadata.json files and
// .git, __pycache__, and __pypackages__ directories, follows only symlinks
// that stay inside the skill, and hashes text with CRLF line endings as LF.
const skippedFolderEntry = (name, isDirectory) => name === 'metadata.json' || (isDirectory && ['.git', '__pycache__', '__pypackages__'].includes(name))
// Returns 'directory', 'file', or null for an entry the skills CLI skips.
const folderEntryKind = ({ entry, path, root }) => {
  if (skippedFolderEntry(entry.name, entry.isDirectory())) return null
  if (!entry.isSymbolicLink()) return entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : null
  const target = existsSync(path) ? realpathSync(path) : null
  if (!target || (target !== root && !target.startsWith(root + sep))) return null
  if (!statSync(target).isDirectory()) return 'file'
  return skippedFolderEntry(entry.name, true) ? null : 'directory'
}
const crlfToLf = (content) => (!content.includes(0) && content.includes('\r\n')
  ? Buffer.from(content.toString('latin1').replaceAll('\r\n', '\n'), 'latin1')
  : content)
const folderFiles = ({ directory, prefix, root, ancestors }) => {
  const real = realpathSync(directory)
  if (ancestors.has(real)) return []
  const branch = new Set(ancestors).add(real)
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    const kind = folderEntryKind({ entry, path, root })
    if (kind === 'directory') return folderFiles({ directory: path, prefix: `${prefix}${entry.name}/`, root, ancestors: branch })
    return kind === 'file' ? [{ path: Buffer.from((prefix + entry.name).replaceAll('\\', '/')), content: crlfToLf(readFileSync(path)) }] : []
  })
}
const folderHash = (directory) => {
  const hash = createHash('sha256')
  const files = folderFiles({ directory, prefix: '', root: realpathSync(directory), ancestors: new Set() })
  for (const { path, content } of files.sort((a, b) => Buffer.compare(a.path, b.path))) {
    hash.update(path).update('\0').update(String(content.length)).update('\0').update(content)
  }
  return hash.digest('hex')
}
// Returns null for a lock value in neither format, so it never matches.
const installedHash = ({ lockHash, path }) => {
  if (/^[0-9a-f]{40}$/u.test(lockHash)) return treeHash(path).toString('hex')
  if (/^[0-9a-f]{64}$/u.test(lockHash)) return folderHash(path)
  return null
}

const refreshSource = () => {
  const branch = git('branch', '--show-current')
  const dirty = Boolean(git('status', '--porcelain'))
  const head = git('rev-parse', 'HEAD')
  const upstream = spawnSync('git', ['-C', repository, 'rev-parse', '@{upstream}'], { encoding: 'utf8', timeout: 10000 })
  if (dryRun) return { commit: head, branch, clean: !dirty, updateAllowed: branch === 'main' && !dirty && upstream.status === 0 && upstream.stdout.trim() === head }
  if (branch !== 'main') throw new Error('sync requires the canonical checkout on main')
  if (dirty) throw new Error('checkout has local changes; commit or move them before syncing')
  git('pull', '--ff-only')
  const commit = git('rev-parse', 'HEAD')
  if (commit !== git('rev-parse', '@{upstream}')) throw new Error('local main has unpublished commits; preserve them and select a separate clean main checkout')
  return { commit, previousCommit: head }
}

const assertGuidanceRevision = (status) => {
  const states = status.split('\n').slice(2)
  // Recording main is safe after squash/rebase too when no managed content
  // changes. Locally edited targets instead go through apply's diff guard.
  if (states.every((line) => line.startsWith('current ')) || states.some((line) => line.startsWith('edited'))) return
  const applied = readJson(join(home, '.agents/.filip-stack-host-config.json'), {}).commit
  if (!applied) return
  const selected = git('rev-parse', 'HEAD')
  if (!/^[0-9a-f]{7,40}$/u.test(applied)) throw new Error(`unverified applied guidance ${applied}; selected source ${selected}; guidance preserved`)
  const ancestry = spawnSync('git', ['-C', repository, 'merge-base', '--is-ancestor', applied, selected], { encoding: 'utf8', timeout: 10000 })
  if (ancestry.status !== 0) {
    const reason = ancestry.status === 1 ? 'is not contained in selected source' : 'could not be verified against selected source'
    throw new Error(`applied guidance ${applied} ${reason} ${selected}; guidance preserved until its changes are accepted`)
  }
}

const refreshGuidance = () => {
  if (resolve(codexHome) !== join(home, '.codex') || resolve(claudeHome) !== join(home, '.claude')) {
    throw new Error('host-config targets ~/.codex and ~/.claude; custom CODEX_HOME or CLAUDE_CONFIG_DIR guidance requires an explicit migration')
  }
  const before = run(process.execPath, [join(repository, 'scripts/host-config.mjs'), 'status'])
  assertGuidanceRevision(before)
  if (dryRun) return { status: before }
  run(process.execPath, [join(repository, 'scripts/host-config.mjs'), 'apply'], { includeOutputOnError: true })
  const preferences = join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'filip-stack', 'field-guide.json')
  if (existsSync(preferences)) run(process.execPath, [join(repository, 'scripts/host-config.mjs'), 'field-guide-sync'])
  const status = run(process.execPath, [join(repository, 'scripts/host-config.mjs'), 'status'])
  const targets = status.split('\n').slice(2)
  if (targets.some((line) => !line.startsWith('current '))) throw new Error(status)
  return { commit: readJson(join(home, '.agents/.filip-stack-host-config.json')).commit, targets: targets.length, preferences: existsSync(preferences) ? 'locally synced' : 'not configured' }
}

const skillHosts = (name) => {
  const canonical = join(home, '.agents', 'skills', name)
  const claude = join(claudeHome, 'skills', name)
  const hosts = ['codex']
  if (lstatSync(claude, { throwIfNoEntry: false })) {
    if (!existsSync(canonical) || !existsSync(claude) || realpathSync(claude) !== realpathSync(canonical)) throw new Error(`${claude} is a separate installation; migrate it explicitly`)
    hosts.push('claude-code')
  }
  return hosts
}

const assertSkillOwnership = ({ name, entry, path }) => {
  if (entry && entry.source !== 'filipgutica/filip-stack') throw new Error(`${name} belongs to ${entry.source}; baseline cannot replace it`)
  if (!entry && existsSync(path)) throw new Error(`${name} is an unmanaged installation; baseline cannot replace it`)
  if (!entry && lstatSync(join(claudeHome, 'skills', name), { throwIfNoEntry: false })) throw new Error(`${name} has an unmanaged Claude installation; baseline cannot replace it`)
}

const assertSkillUnedited = ({ name, entry, path }) => {
  const lockHash = entry?.skillFolderHash
  if (entry && (typeof lockHash !== 'string' || installedHash({ lockHash, path }) !== lockHash)) {
    throw new Error(`${name} has local edits or an unverifiable lock; preserve those changes before syncing`)
  }
}

const inspectSkill = ({ name, entry }) => {
  const path = join(home, '.agents', 'skills', name)
  if (policy.excluded.skills.includes(name)) return { name, state: 'excluded' }
  assertSkillOwnership({ name, entry, path })
  const previousHosts = entry ? skillHosts(name) : []
  const baselineHosts = policy.baseline.skills.includes(name) ? policy.agents : []
  const hosts = [...new Set([...previousHosts, ...baselineHosts])].filter((host) => policy.agents.includes(host))
  if (!hosts.length) return { name, hosts: previousHosts, state: 'excluded' }
  if (entry?.ref && entry.ref !== 'main') {
    if (!existsSync(path)) throw new Error(`${name} is pinned but missing; restore its pinned installation explicitly`)
    if (baselineHosts.some((host) => !previousHosts.includes(host))) throw new Error(`${name} is pinned; extend its host assignment explicitly before syncing`)
    return { name, hosts: previousHosts, state: 'pinned', ref: entry.ref }
  }
  assertSkillUnedited({ name, entry, path })
  return { name, path, previousHosts, hosts }
}

const refreshSkill = ({ name, entry, lockPath }) => {
  const plan = inspectSkill({ name, entry })
  if (plan.state) return plan
  const { path, hosts, previousHosts } = plan
  if (!dryRun) {
    run('npx', ['--yes', 'skills', 'add', 'filipgutica/filip-stack', '-g', '-a', ...hosts, '-s', name, '-y'])
    verifyPayload({ source: join(repository, 'skills', name), installed: path })
    const updated = readJson(lockPath).skills[name]
    if (updated.source !== 'filipgutica/filip-stack') throw new Error(`${name} lost its filip-stack source lock`)
    const actualHosts = skillHosts(name)
    if ([...previousHosts, ...hosts].some((host) => !actualHosts.includes(host))) throw new Error(`${name} lost a skill host assignment`)
  }
  return { name, hosts, state: dryRun ? 'planned' : 'current' }
}

const refreshSkills = () => {
  if (!policy.agents.length) return { state: 'excluded', message: 'No skill agents selected for this machine' }
  const lockPath = join(home, '.agents', '.skill-lock.json')
  const locked = readJson(lockPath, { skills: {} }).skills
  const installed = Object.keys(locked).filter((name) => locked[name].source === 'filipgutica/filip-stack')
  const desired = [...new Set([...installed, ...policy.baseline.skills])]
  const skills = desired.map((name) => {
    const entry = locked[name]
    try { return refreshSkill({ name, entry, lockPath }) }
    catch (error) { return { name, state: 'blocked', message: error.message } }
  })
  const blocked = skills.filter(({ state }) => state === 'blocked')
  return { skills, ...(blocked.length ? { state: 'blocked', message: blocked.map(({ message }) => message).join('; ') } : {}) }
}

const claudeInventory = () => JSON.parse(run('claude', ['plugin', 'list', '--json']))
  .filter((plugin) => plugin.id.endsWith('@filip-stack'))
const codexInventory = () => JSON.parse(run('codex', ['plugin', 'list', '--json'])).installed.filter((plugin) => plugin.pluginId.endsWith('@filip-stack'))
const desiredPlugins = (installed) => [...new Set([...installed, ...policy.baseline.plugins])].filter((name) => !policy.excluded.plugins.includes(name))
const requiredPlugins = () => policy.baseline.plugins.filter((name) => !policy.excluded.plugins.includes(name))

const verifyPlugin = ({ name, path, claudeRuntime = false }) => {
  const source = join(repository, 'plugins', name)
  const expected = readJson(join(source, '.claude-plugin/plugin.json')).version
  const manifest = readJson(join(path, '.claude-plugin/plugin.json'))
  if (manifest.version !== expected) throw new Error(`${name}: installed ${manifest.version}, expected ${expected}`)
  return { name, version: manifest.version, files: verifyPayload({ source, installed: path, plugin: true, claudeRuntime }) }
}

const missingClient = (name) => {
  if (requiredPlugins().length) throw new Error(`${name} is required by the baseline but is not installed; install it or select different agents for this machine`)
  return { state: 'skipped', message: `${name} is not installed` }
}

const pinnedMarketplace = (missing) => {
  if (missing.length) throw new Error(`custom or pinned marketplace preserved; baseline plugins missing: ${missing.join(', ')}`)
  return { state: 'pinned', message: 'Marketplace has a custom source or ref; preserved' }
}

const claudePluginResult = ({ name, before, after }) => {
  const previous = before.find((plugin) => plugin.id === `${name}@filip-stack`)
  const plugin = after.find((item) => item.id === `${name}@filip-stack` && item.scope === 'user')
  if (!plugin || plugin.enabled !== (previous?.enabled ?? true)) throw new Error(`${name}: scope or enabled state changed`)
  if (dryRun) return { name, scope: 'user', action: previous ? 'update' : 'install' }
  return { ...verifyPlugin({ name, path: plugin.installPath, claudeRuntime: true }), scope: plugin.scope, enabled: plugin.enabled }
}

const prepareClaudeMarketplace = ({ before, missing }) => {
  const known = readJson(join(claudeHome, 'plugins', 'known_marketplaces.json'), {})['filip-stack']
  if (!known && before.length) throw new Error('Existing Claude marketplace source is unknown; preserve it before enrolling a baseline')
  const source = known?.source
  if (known && (source?.ref || source?.branch || source?.source !== 'github' || source?.repo !== 'filipgutica/filip-stack')) return pinnedMarketplace(missing)
  if (!dryRun) {
    if (!known) run('claude', ['plugin', 'marketplace', 'add', 'filipgutica/filip-stack'])
    run('claude', ['plugin', 'marketplace', 'update', 'filip-stack'])
  }
}

const refreshClaude = () => {
  if (!policy.agents.includes('claude-code')) return { state: 'excluded', message: 'Claude is excluded for this machine' }
  if (!available('claude')) return missingClient('Claude')
  const before = claudeInventory()
  const desired = desiredPlugins(before.map((plugin) => plugin.id.split('@')[0]))
  if (!desired.length) return { state: 'skipped', message: 'No Claude plugins selected' }
  const missing = desired.filter((name) => !before.some((plugin) => plugin.id === `${name}@filip-stack`))
  if (before.some((plugin) => desired.includes(plugin.id.split('@')[0]) && plugin.scope !== 'user')) throw new Error('Claude has project/local plugin installations; sync those scopes from their projects explicitly')
  const preserved = prepareClaudeMarketplace({ before, missing })
  if (preserved) return preserved
  if (!dryRun) {
    for (const name of desired) {
      run('claude', ['plugin', missing.includes(name) ? 'install' : 'update', `${name}@filip-stack`, '--scope', 'user', '-y'])
    }
  }
  const after = dryRun ? [...before, ...missing.map((name) => ({ id: `${name}@filip-stack`, scope: 'user', enabled: true }))] : claudeInventory()
  return { plugins: desired.map((name) => claudePluginResult({ name, before, after })) }
}

const codexPluginResult = (plugin, after) => {
  const updated = after.find((item) => item.pluginId === plugin.pluginId)
  if (!updated || updated.enabled !== plugin.enabled) throw new Error(`${plugin.pluginId}: enabled state changed`)
  if (!plugin.enabled) return { name: plugin.name, state: 'disabled' }
  if (dryRun) return { name: plugin.name, action: plugin.installed === false ? 'install' : 'update' }
  return verifyPlugin({ name: plugin.name, path: join(codexHome, 'plugins/cache/filip-stack', plugin.name, updated.version) })
}

const prepareCodexMarketplace = ({ before, missing }) => {
  const marketplace = JSON.parse(run('codex', ['plugin', 'marketplace', 'list', '--json'])).marketplaces.find(({ name }) => name === 'filip-stack')
  if (!marketplace && before.length) throw new Error('Existing Codex marketplace source is unknown; preserve it before enrolling a baseline')
  const source = marketplace?.marketplaceSource
  if (marketplace && (source?.sourceType !== 'git' || !/^https:\/\/github\.com\/filipgutica\/filip-stack(?:\.git)?$/u.test(source.source) || source.ref)) return pinnedMarketplace(missing)
  if (!dryRun) {
    if (!marketplace) run('codex', ['plugin', 'marketplace', 'add', 'filipgutica/filip-stack', '--json'])
    run('codex', ['plugin', 'marketplace', 'upgrade', 'filip-stack'])
  }
}

const refreshCodex = () => {
  if (!policy.agents.includes('codex')) return { state: 'excluded', message: 'Codex is excluded for this machine' }
  if (!available('codex')) return missingClient('Codex')
  const before = codexInventory()
  const desired = desiredPlugins(before.map((plugin) => plugin.name))
  if (!desired.length) return { state: 'skipped', message: 'No Codex plugins selected' }
  const missing = desired.filter((name) => !before.some((plugin) => plugin.name === name))
  const preserved = prepareCodexMarketplace({ before, missing })
  if (preserved) return preserved
  const targets = desired.map((name) => before.find((plugin) => plugin.name === name) || { name, pluginId: `${name}@filip-stack`, enabled: true, installed: false })
  if (!dryRun) {
    for (const plugin of targets) {
      if (!plugin.enabled) continue
      run('codex', ['plugin', 'add', plugin.pluginId, '--json'])
    }
  }
  const after = dryRun ? targets : codexInventory()
  return { plugins: targets.map((plugin) => codexPluginResult(plugin, after)) }
}

const finish = (persist = !dryRun) => {
  report.completedAt = new Date().toISOString()
  report.ok = report.components.every(({ state }) => state !== 'blocked')
  if (persist) {
    const path = join(stateRoot, 'last-sync.json')
    report.reportPath = path
    writeFileSync(`${path}.tmp`, `${JSON.stringify(report, null, 2)}\n`)
    renameSync(`${path}.tmp`, path)
  }
  if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  else for (const item of report.components) process.stdout.write(`${item.state.padEnd(9)} ${item.name}${item.message ? `: ${item.message}` : ''}\n`)
  process.exitCode = report.ok ? 0 : 1
}

const acquireLock = () => {
  mkdirSync(stateRoot, { recursive: true })
  try { mkdirSync(lock) } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`another sync owns ${lock}; check the running process before removing a stale lock`)
    throw error
  }
  writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: report.startedAt }))
}

const savedConfigPath = () => join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'filip-stack', 'fleet.json')

// A refresh with --config saves that policy as this machine's own, so a later
// plain sync uses the same policy. A differing saved copy is backed up first,
// and a symlinked one is left alone because another tool owns its source.
const savePolicy = ({ source, digest }) => {
  const path = savedConfigPath()
  if (resolve(source) === resolve(path)) return { path, state: 'current' }
  if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) return { path, state: 'symlink' }
  const content = readFileSync(source)
  if (createHash('sha256').update(content).digest('hex') !== digest) throw new Error(`fleet config changed while loading: ${source}`)
  const previous = existsSync(path) ? readFileSync(path) : null
  if (previous?.equals(content)) return { path, state: 'current' }
  const backup = previous && `${path}.bak-${new Date().toISOString().replace(/[-:]|\.\d+/gu, '')}`
  if (backup) writeFileSync(backup, previous)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  return { path, state: 'saved', backup }
}

const configure = (options) => {
  const path = resolve(options.config || savedConfigPath())
  if (options.config && !existsSync(path)) throw new Error(`fleet config does not exist: ${path}`)
  policy = loadFleetConfig({ path, environmentId: options['environment-id'], host: hostname(), repository })
  return options.config && !dryRun ? { ...policy, savedPolicy: savePolicy({ source: path, digest: policy.digest }) } : policy
}

const main = () => {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean' }, config: { type: 'string' }, 'environment-id': { type: 'string' } } })
  if (values.help) {
    process.stdout.write('Usage: filip-stack sync [--dry-run] [--json] [--config <file>] [--environment-id <id>]\n\nRefresh filip-stack guidance, skills, and plugins, including the configured fleet baseline.\n--dry-run previews local state without fetching or writing.\n--json prints component results as JSON.\n--config applies a fleet config and saves it as the default, ~/.config/filip-stack/fleet.json.\n--environment-id selects this machine explicitly; otherwise match its hostname.\n')
    return
  }
  if (!dryRun) acquireLock()
  let handedOff = false
  try {
    step('source', refreshSource)
    const sourceFailed = report.components[0].state === 'blocked'
    if (sourceFailed) return
    // Any pulled revision can change loaded modules. Release only our lock;
    // the fresh process acquires its own and owns the final report.
    if (!dryRun && report.components[0].commit !== report.components[0].previousCommit) {
      rmSync(lock, { recursive: true })
      handedOff = true
      const child = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: 'inherit' })
      if (child.error) throw child.error
      process.exitCode = child.status ?? 1
      return
    }
    step('configuration', () => configure(values))
    if (report.components.at(-1).state === 'blocked') return
    step('guidance', refreshGuidance)
    step('skills', refreshSkills)
    step('claude', refreshClaude)
    step('codex', refreshCodex)
  } finally {
    if (!handedOff) {
      try { finish() }
      finally { if (!dryRun) rmSync(lock, { recursive: true, force: true }) }
    }
  }
}

try { main() } catch (error) {
  report.components.push({ name: 'invocation', state: 'blocked', message: error.message })
  finish(false)
}
