#!/usr/bin/env node
// Refresh existing filip-stack installations without replacing machine-local choices.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDevelopmentOnlyPluginPath } from './plugin-payload-policy.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const script = fileURLToPath(import.meta.url)
const loadedModules = [script, join(repository, 'scripts/plugin-payload-policy.mjs')].map((path) => ({ path, content: readFileSync(path) }))
const home = homedir()
const codexHome = process.env.CODEX_HOME || join(home, '.codex')
const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(home, '.claude')
const dryRun = process.argv.includes('--dry-run')
const json = process.argv.includes('--json')
const report = { host: hostname(), dryRun, startedAt: new Date().toISOString(), components: [] }
const stateRoot = join(process.env.XDG_STATE_HOME || join(home, '.local', 'state'), 'filip-stack')
const lock = join(stateRoot, 'sync.lock')

const readJson = (path, fallback) => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: repository, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, ...options })
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')}: ${result.error?.message || result.stderr.trim() || `exit ${result.status}`}`)
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

const verifyPayload = ({ source, installed, plugin = false }) => {
  const expected = files(source).filter((path) => !plugin || !isDevelopmentOnlyPluginPath(path))
  for (const path of expected) {
    if (!existsSync(join(installed, path)) || !readFileSync(join(source, path)).equals(readFileSync(join(installed, path)))) {
      throw new Error(`installed payload differs: ${join(installed, path)}`)
    }
  }
  const extra = files(installed).filter((path) => !expected.includes(path))
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

const refreshSource = () => {
  const branch = git('branch', '--show-current')
  const dirty = Boolean(git('status', '--porcelain'))
  if (dryRun) return { commit: git('rev-parse', 'HEAD'), branch, clean: !dirty, updateAllowed: branch === 'main' && !dirty }
  if (branch !== 'main') throw new Error('sync requires the canonical checkout on main')
  if (dirty) throw new Error('checkout has local changes; commit or move them before syncing')
  git('pull', '--ff-only')
  return { commit: git('rev-parse', 'HEAD') }
}

const refreshGuidance = () => {
  if (resolve(codexHome) !== join(home, '.codex') || resolve(claudeHome) !== join(home, '.claude')) {
    throw new Error('host-config targets ~/.codex and ~/.claude; custom CODEX_HOME or CLAUDE_CONFIG_DIR guidance requires an explicit migration')
  }
  if (dryRun) return { status: run(process.execPath, [join(repository, 'scripts/host-config.mjs'), 'status']) }
  run(process.execPath, [join(repository, 'scripts/host-config.mjs'), 'apply'])
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
  if (existsSync(claude)) {
    if (realpathSync(claude) !== realpathSync(canonical)) throw new Error(`${claude} is a separate installation; migrate it explicitly`)
    hosts.push('claude-code')
  }
  return hosts
}

const refreshSkill = ({ name, entry, lockPath }) => {
  const path = join(home, '.agents', 'skills', name)
  if (entry.ref && entry.ref !== 'main') return { name, state: 'pinned', ref: entry.ref }
  if (!/^[0-9a-f]{40}$/u.test(entry.skillFolderHash || '') || treeHash(path).toString('hex') !== entry.skillFolderHash) {
    throw new Error(`${name} has local edits or an unverifiable lock; preserve those changes before syncing`)
  }
  const hosts = skillHosts(name)
  if (!dryRun) {
    run('npx', ['--yes', 'skills', 'add', 'filipgutica/filip-stack', '-g', '-a', ...hosts, '-s', name, '-y'])
    verifyPayload({ source: join(repository, 'skills', name), installed: path })
    const updated = readJson(lockPath).skills[name]
    if (updated.source !== entry.source) throw new Error(`${name} lost its filip-stack source lock`)
  }
  return { name, hosts, state: dryRun ? 'planned' : 'current' }
}

const refreshSkills = () => {
  const lockPath = join(home, '.agents', '.skill-lock.json')
  const installed = Object.entries(readJson(lockPath, { skills: {} }).skills).filter(([, entry]) => entry.source === 'filipgutica/filip-stack')
  const skills = installed.map(([name, entry]) => {
    try { return refreshSkill({ name, entry, lockPath }) }
    catch (error) { return { name, state: 'blocked', message: error.message } }
  })
  const blocked = skills.filter(({ state }) => state === 'blocked')
  return { skills, ...(blocked.length ? { state: 'blocked', message: blocked.map(({ message }) => message).join('; ') } : {}) }
}

const claudeInventory = () => JSON.parse(run('claude', ['plugin', 'list', '--json']))
  .filter((plugin) => plugin.id.endsWith('@filip-stack'))
const codexInventory = () => JSON.parse(run('codex', ['plugin', 'list', '--marketplace', 'filip-stack', '--json'])).installed

const verifyPlugin = ({ name, path }) => {
  const source = join(repository, 'plugins', name)
  const expected = readJson(join(source, '.claude-plugin/plugin.json')).version
  const manifest = readJson(join(path, '.claude-plugin/plugin.json'))
  if (manifest.version !== expected) throw new Error(`${name}: installed ${manifest.version}, expected ${expected}`)
  return { name, version: manifest.version, files: verifyPayload({ source, installed: path, plugin: true }) }
}

const refreshClaude = () => {
  if (!available('claude')) return { state: 'skipped', message: 'Claude is not installed' }
  const before = claudeInventory()
  if (!before.length) return { state: 'skipped', message: 'No filip-stack plugins installed in Claude' }
  const known = readJson(join(claudeHome, 'plugins', 'known_marketplaces.json'), {})['filip-stack']
  const source = known?.source
  if (source?.ref || source?.branch || source?.source !== 'github' || source?.repo !== 'filipgutica/filip-stack') {
    return { state: 'pinned', message: 'Marketplace has a custom source or ref; preserved' }
  }
  if (before.some((plugin) => plugin.scope !== 'user')) throw new Error('Claude has project/local plugin installations; sync those scopes from their projects explicitly')
  if (!dryRun) {
    run('claude', ['plugin', 'marketplace', 'update', 'filip-stack'])
    for (const plugin of before) {
      run('claude', ['plugin', 'update', plugin.id, '--scope', plugin.scope, '-y'])
    }
  }
  const after = dryRun ? before : claudeInventory()
  for (const plugin of before) {
    const updated = after.find((item) => item.id === plugin.id && item.scope === plugin.scope)
    if (!updated || updated.enabled !== plugin.enabled) throw new Error(`${plugin.id}: scope or enabled state changed`)
  }
  return { plugins: after.map((plugin) => dryRun ? { name: plugin.id, scope: plugin.scope } : verifyPlugin({ name: plugin.id.split('@')[0], path: plugin.installPath })) }
}

const codexPluginResult = (plugin, after) => {
  const updated = after.find((item) => item.pluginId === plugin.pluginId)
  if (!updated || updated.enabled !== plugin.enabled) throw new Error(`${plugin.pluginId}: enabled state changed`)
  if (!plugin.enabled) return { name: plugin.name, state: 'disabled' }
  if (dryRun) return { name: plugin.name }
  return verifyPlugin({ name: plugin.name, path: join(codexHome, 'plugins/cache/filip-stack', plugin.name, updated.version) })
}

const refreshCodex = () => {
  if (!available('codex')) return { state: 'skipped', message: 'Codex is not installed' }
  const before = codexInventory()
  if (!before.length) return { state: 'skipped', message: 'No filip-stack plugins installed in Codex' }
  const marketplace = JSON.parse(run('codex', ['plugin', 'marketplace', 'list', '--json'])).marketplaces.find(({ name }) => name === 'filip-stack')
  const source = marketplace?.marketplaceSource
  if (source?.sourceType !== 'git' || !/^https:\/\/github\.com\/filipgutica\/filip-stack(?:\.git)?$/u.test(source.source) || source.ref) {
    return { state: 'pinned', message: 'Marketplace has a custom source or ref; preserved' }
  }
  if (!dryRun) {
    run('codex', ['plugin', 'marketplace', 'upgrade', 'filip-stack'])
    for (const plugin of before) {
      if (!plugin.enabled) continue
      run('codex', ['plugin', 'add', plugin.pluginId, '--json'])
    }
  }
  const after = dryRun ? before : codexInventory()
  return { plugins: before.map((plugin) => codexPluginResult(plugin, after)) }
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

const main = () => {
  if (process.argv.slice(2).length === 1 && process.argv[2] === '--help') {
    process.stdout.write('Usage: filip-stack sync [--dry-run] [--json]\n\nRefresh existing filip-stack guidance, skills, and plugins on this machine.\n--dry-run previews local state without fetching or writing.\n--json prints component results as JSON.\n')
    return
  }
  if (process.argv.slice(2).some((arg) => !['--dry-run', '--json'].includes(arg))) throw new Error('Usage: filip-stack sync [--dry-run] [--json]')
  if (!dryRun) acquireLock()
  let handedOff = false
  try {
    step('source', refreshSource)
    const sourceFailed = report.components[0].state === 'blocked'
    if (sourceFailed) return
    // A pulled updater or policy must execute in a fresh process. Release only
    // our lock; the child acquires its own and owns the final report.
    if (!dryRun && loadedModules.some(({ path, content }) => !content.equals(readFileSync(path)))) {
      rmSync(lock, { recursive: true })
      handedOff = true
      const child = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: 'inherit' })
      if (child.error) throw child.error
      process.exitCode = child.status ?? 1
      return
    }
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
