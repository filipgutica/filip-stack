#!/usr/bin/env node
// Applies host-config/ to the Claude, Codex, and shared agent directories in a home directory.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = join(dirname(scriptPath), '..')
const sourceRoot = join(repoRoot, 'host-config')
const sharedGuidancePath = (home) => join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'filip-stack', 'field-guide.json')
// The design system comes from the published @filipgutica/design-system package that this file pins.
const designSystemPinPath = join(sourceRoot, 'design-system.json')
const designSystemCachePath = ({ home, version }) => (
  join(process.env.XDG_CACHE_HOME || join(home, '.cache'), 'filip-stack', 'design-system', `${version}.tgz`)
)
const designSystemTarget = 'design-system'
// Where host config installed the design system before it moved to designSystemTarget. Kept only to migrate old installs.
const legacyDesignSystemTarget = 'design-language'
const fieldGuideScript = join(repoRoot, 'plugins', 'field-guide', 'skills', 'field-guide', 'scripts', 'field-guide.mjs')
const manifestTarget = '.agents/.filip-stack-host-config.json'
const blockStart = '<!-- filip-stack:host-config:begin (managed by filip-stack; edit host-config/ there) -->'
const blockEnd = '<!-- filip-stack:host-config:end -->'

// Source directories copied file for file into the home directory. The design system joins them once resolved.
const fileRoots = [['claude', '.claude'], ['codex', '.codex'], ['agents', '.agents']]
// Guidance files that receive a managed block. Text outside the block stays local.
const guidanceTargets = [['claude', '.claude/CLAUDE.md'], ['codex', '.codex/AGENTS.md']]

const commands = ['status', 'apply', 'update', 'field-guide-sync']
const usage = `Usage: host-config.mjs <${commands.join('|')}> [--home <dir>] [--force]`

const fail = (message) => {
  process.stderr.write(`host-config: ${message}\n`)
  process.exit(1)
}

const parseArgs = (argv) => {
  const [command, ...rest] = argv
  if (!commands.includes(command)) fail(usage)
  const options = { home: homedir(), force: false }
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === '--force' && ['apply', 'update'].includes(command)) options.force = true
    else if (rest[index] === '--home' && rest[index + 1]) options.home = rest[(index += 1)]
    else fail(usage)
  }
  return { command, options }
}

const read = (path) => readFileSync(path, 'utf8')
const hash = (text) => createHash('sha256').update(text).digest('hex')
// npm's `dist.integrity` format.
const integrityOf = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`

const listFiles = (directory) => (
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== '.DS_Store')
    .map((entry) => join(entry.parentPath, entry.name))
)

// Model names live only in models.json. Templates name a model as {{model:<provider>.<tier>.<id|label>}}.
let roster
const renderModel = (placeholder, provider, tier, field) => {
  roster ??= JSON.parse(read(join(sourceRoot, 'models.json')))
  return roster[provider]?.[tier]?.[field] ?? fail(`${placeholder} is not defined in host-config/models.json`)
}
const renderText = ({ text, home }) => text
  .replaceAll('{{HOME}}', home)
  .replace(/\{\{model:([a-z]+)\.([a-z]+)\.(id|label)\}\}/g, renderModel)

const renderGuidance = ({ host, home }) => {
  const core = read(join(sourceRoot, 'guidance', 'core.md'))
  const assembled = core.replace(/\{\{include:([a-z-]+)\}\}/g, (_, name) => (
    read(join(sourceRoot, 'guidance', host, `${name}.md`)).trimEnd()
  ))
  return renderText({ text: assembled, home })
}

// `designSystemFolder` is the extracted package's language/ folder, or null when status cannot read it.
const desiredTargets = ({ home, designSystemFolder }) => {
  const targets = new Map()
  const roots = fileRoots.map(([source, target]) => [join(sourceRoot, source), target])
  if (designSystemFolder) roots.push([designSystemFolder, designSystemTarget])
  for (const [directory, target] of roots) {
    for (const file of listFiles(directory)) {
      const relativePath = join(target, relative(directory, file))
      targets.set(relativePath, { kind: 'file', content: renderText({ text: read(file), home }) })
    }
  }
  for (const [host, target] of guidanceTargets) {
    const content = renderGuidance({ host, home })
    if (hasDelimiterLine(content)) fail(`${host} guidance must not contain a filip-stack delimiter line`)
    targets.set(target, { kind: 'block', content })
  }
  return targets
}

// Delimiters count only as whole lines, so text can quote them.
const delimiterOffsets = ({ text, delimiter }) => {
  const offsets = []
  let offset = 0
  for (const line of text.split('\n')) {
    if (line === delimiter) offsets.push(offset)
    offset += line.length + 1
  }
  return offsets
}

const hasDelimiterLine = (text) => (
  text.split('\n').some((line) => line === blockStart || line === blockEnd)
)

const splitBlock = ({ text, path }) => {
  const starts = delimiterOffsets({ text, delimiter: blockStart })
  const ends = delimiterOffsets({ text, delimiter: blockEnd })
  if (starts.length === 0 && ends.length === 0) return null
  if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) fail(`${path} must contain exactly one filip-stack block`)
  const afterEnd = ends[0] + blockEnd.length
  return {
    before: text.slice(0, starts[0]),
    body: text.slice(starts[0] + blockStart.length + 1, ends[0]),
    after: text.slice(text[afterEnd] === '\n' ? afterEnd + 1 : afterEnd),
  }
}

// Returns the managed text of a target: the whole file, or the block body.
// `unmarked` means a guidance file exists but has no block yet.
const readManaged = ({ home, target, kind }) => {
  const path = join(home, target)
  if (!existsSync(path)) return { content: null }
  const text = read(path)
  if (kind === 'file') return { content: text }
  const block = splitBlock({ text, path })
  if (block) return { content: block.body }
  return text.trim().length === 0 ? { content: null } : { content: text, unmarked: true }
}

const readManifest = (home) => {
  const path = join(home, manifestTarget)
  return existsSync(path) ? JSON.parse(read(path)) : { commit: null, files: {} }
}

const readPin = () => JSON.parse(read(designSystemPinPath))

// Returns the cached tarball path when its bytes match the pin, otherwise null. Never writes.
const verifiedCache = ({ home, pin }) => {
  const path = designSystemCachePath({ home, version: pin.version })
  return existsSync(path) && integrityOf(readFileSync(path)) === pin.integrity ? path : null
}

// Returns the pinned package's language/ folder, extracted to a temporary directory.
// On a cache miss the download is verified and extracted from a staging file first,
// so it enters the cache only when the whole install can use it.
const resolveDesignSystemFolder = async ({ home, pin }) => {
  const cached = verifiedCache({ home, pin })
  if (cached) return extractDesignSystemFolder(cached)
  const path = designSystemCachePath({ home, version: pin.version })
  let bytes
  try {
    const response = await fetch(pin.tarball, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
  } catch (error) {
    fail(`${pin.package}@${pin.version} is not cached at ${path}, and downloading ${pin.tarball} failed `
      + `(${error.cause?.message || error.message}). Nothing was written; rerun with network access.`)
  }
  const integrity = integrityOf(bytes)
  if (integrity !== pin.integrity) {
    fail(`${pin.tarball} failed the integrity check for ${pin.package}@${pin.version}: expected ${pin.integrity}, got ${integrity}. Nothing was written.`)
  }
  const staging = mkdtempSync(join(tmpdir(), 'host-config-download-'))
  process.on('exit', () => rmSync(staging, { recursive: true, force: true }))
  const staged = join(staging, `${pin.version}.tgz`)
  writeFileSync(staged, bytes)
  const designSystemFolder = extractDesignSystemFolder(staged)
  mkdirSync(dirname(path), { recursive: true })
  const partial = `${path}.${process.pid}.partial`
  writeFileSync(partial, bytes)
  renameSync(partial, path)
  process.stdout.write(`downloaded ${pin.package}@${pin.version} to ${path}\n`)
  return designSystemFolder
}

const tarList = (args) => {
  const result = spawnSync('tar', args, { encoding: 'utf8' })
  if (result.status !== 0) fail(`tar ${args.join(' ')} failed: ${result.stderr.trim()}`)
  return result.stdout.split('\n').filter(Boolean)
}

// Extracts the tarball's package/language/ into a temporary directory removed on exit.
// Accepts only regular files and directories whose paths stay inside that directory.
const extractDesignSystemFolder = (tarball) => {
  const names = tarList(['-tzf', tarball])
  // The first column of a verbose listing is the entry type in both GNU and BSD tar.
  const types = tarList(['-tvzf', tarball]).map((line) => line[0])
  const unsafe = names.find((name, index) => !['-', 'd'].includes(types[index]) || isAbsolute(name) || name.split('/').includes('..'))
  if (unsafe !== undefined || names.length !== types.length) fail(`${tarball} has an entry that is not a plain file or folder inside the package: ${unsafe}`)
  const directory = mkdtempSync(join(tmpdir(), 'host-config-design-system-'))
  process.on('exit', () => rmSync(directory, { recursive: true, force: true }))
  tarList(['-xzf', tarball, '-C', directory])
  const designSystemFolder = join(directory, 'package', 'language')
  if (!existsSync(designSystemFolder)) fail(`${tarball} has no package/language/ folder`)
  return designSystemFolder
}

const sourceCommit = () => {
  const git = (args) => spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' })
  const head = git(['rev-parse', '--short', 'HEAD']).stdout.trim() || 'unknown'
  const dirty = git(['status', '--porcelain', '--', 'host-config']).stdout.trim().length > 0
  return dirty ? `${head}+dirty` : head
}

// Classifies each target as current, update, edited, remove, edited-remove, or unknown.
// A target is edited when its managed text differs from both the repository
// version and the version this script last applied. Retired design-system targets are
// unknown when the pinned package is not cached, which only status allows.
const plan = ({ home, designSystemFolder }) => {
  const manifest = readManifest(home)
  const desired = desiredTargets({ home, designSystemFolder })
  const entries = []
  for (const [target, { kind, content }] of desired) {
    const current = readManaged({ home, target, kind })
    const appliedHash = manifest.files[target]
    let state = 'update'
    if (current.content === content && !current.unmarked) state = 'current'
    else if (current.unmarked) state = 'edited'
    else if (current.content !== null && hash(current.content) !== appliedHash) state = 'edited'
    entries.push({ target, kind, content, current, state })
  }
  for (const [target, appliedHash] of Object.entries(manifest.files)) {
    if (!desired.has(target)) entries.push({ target, kind: 'file', content: null, ...retiredState({ home, target, appliedHash, designSystemFolder }) })
  }
  return { manifest, entries }
}

// Classifies a target that was applied earlier but that the sources no longer produce.
// Without the package, status cannot tell whether the pin still ships a design-system file.
// No pin installs to legacyDesignSystemTarget, so those files classify like any other.
const retiredState = ({ home, target, appliedHash, designSystemFolder }) => {
  if (!designSystemFolder && target.startsWith(`${designSystemTarget}/`)) return { current: { content: null }, state: 'unknown' }
  const current = readManaged({ home, target, kind: 'file' })
  return { current, state: current.content === null || hash(current.content) === appliedHash ? 'remove' : 'edited-remove' }
}

const printDiff = ({ target, current, content }) => {
  const directory = mkdtempSync(join(tmpdir(), 'host-config-diff-'))
  const local = join(directory, 'local')
  const repository = join(directory, 'filip-stack')
  writeFileSync(local, current.content ?? '')
  writeFileSync(repository, content ?? '')
  const result = spawnSync('diff', ['-u', '--label', `local/${target}`, '--label', `filip-stack/${target}`, local, repository], { encoding: 'utf8' })
  process.stdout.write(result.stdout)
  rmSync(directory, { recursive: true, force: true })
}

// Status never downloads. Its header stays two lines because sync.mjs reads the target states after them.
const status = ({ home }) => {
  const pin = readPin()
  const tarball = verifiedCache({ home, pin })
  const { manifest, entries } = plan({ home, designSystemFolder: tarball && extractDesignSystemFolder(tarball) })
  const applied = manifest.designSystem?.version
  const version = applied && applied !== pin.version ? `${applied} → ${pin.version}` : pin.version
  const cache = tarball ? '' : ' (not cached; apply downloads it)'
  process.stdout.write(`applied: ${manifest.commit ?? 'never'}\nrepository: ${sourceCommit()}, design-system ${version}${cache}\n`)
  for (const { target, state } of entries) process.stdout.write(`${state.padEnd(13)} ${target}\n`)
}

const writeManifest = ({ home, commit, designSystem, files }) => {
  const path = join(home, manifestTarget)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ commit, designSystem, files }, null, 2)}\n`)
}

const backUp = (path) => {
  copyFileSync(path, `${path}.bak`)
  process.stdout.write(`backed up ${path} to ${path}.bak\n`)
}

const writeTarget = ({ home, target, kind, content, current }) => {
  const path = join(home, target)
  mkdirSync(dirname(path), { recursive: true })
  if (kind === 'file' || current.content === null || current.unmarked) {
    const block = `${blockStart}\n${content}${blockEnd}\n`
    writeFileSync(path, kind === 'file' ? content : block)
    return
  }
  const { before, after } = splitBlock({ text: read(path), path })
  writeFileSync(path, `${before}${blockStart}\n${content}${blockEnd}\n${after}`)
}

// Plan has retired the managed files in the old install folder by now. The folder goes only when
// nothing but empty folders remains; anything else, such as a .bak backup, is the user's to keep.
const removeLegacyDesignSystemFolder = ({ home }) => {
  const path = join(home, legacyDesignSystemTarget)
  if (!lstatSync(path, { throwIfNoEntry: false })?.isDirectory()) return
  if (readdirSync(path, { recursive: true, withFileTypes: true }).every((entry) => entry.isDirectory())) {
    rmSync(path, { recursive: true })
    process.stdout.write(`removed ${legacyDesignSystemTarget}/\n`)
    return
  }
  process.stdout.write(`kept ${path}: the design system now installs to ${join(home, designSystemTarget)}, `
    + 'and the old folder still holds files filip-stack does not manage. Remove it when you no longer need them.\n')
}

const runFieldGuide = ({ home, args }) => {
  const result = spawnSync(process.execPath, [
    fieldGuideScript, ...args, '--repo-root', repoRoot, '--guide-root', join(home, '.field-guide'),
  ], { encoding: 'utf8' })
  if (result.status !== 0) fail(`field-guide ${args[0]} failed: ${result.stderr.trim()}`)
  return JSON.parse(result.stdout).result
}

const importSharedGuidance = ({ home }) => {
  const result = runFieldGuide({ home, args: ['import', '--input', sharedGuidancePath(home)] })
  process.stdout.write(`field-guide: created ${result.created.length}, promoted ${result.promoted.length}, `
    + `retired ${result.retired.length}, skipped ${result.skipped.length}\n`)
  for (const { id, reason } of result.skipped) process.stdout.write(`  skipped ${id}: ${reason}\n`)
}

const apply = async ({ home, force }) => {
  const pin = readPin()
  const designSystemFolder = await resolveDesignSystemFolder({ home, pin })
  const { manifest, entries } = plan({ home, designSystemFolder })
  const edited = entries.filter(({ state }) => state === 'edited' || state === 'edited-remove')
  if (edited.length > 0 && !force) {
    for (const entry of edited) printDiff(entry)
    fail(`${edited.length} target(s) changed locally. Move the changes into host-config/ and rerun, `
      + 'or rerun with --force to back up and overwrite them.')
  }
  const files = { ...manifest.files }
  for (const entry of entries) {
    const path = join(home, entry.target)
    if (entry.state === 'current') {
      files[entry.target] = hash(entry.content)
      continue
    }
    if (entry.state.startsWith('edited')) backUp(path)
    if (entry.state.endsWith('remove')) {
      rmSync(path, { force: true })
      delete files[entry.target]
      writeManifest({ home, commit: manifest.commit, designSystem: manifest.designSystem, files })
      process.stdout.write(`removed ${entry.target}\n`)
      continue
    }
    if (entry.current.unmarked) {
      process.stdout.write(`${entry.target} had no filip-stack block; restore any machine-local text from the backup below the block\n`)
    }
    writeTarget({ home, ...entry })
    files[entry.target] = hash(entry.content)
    // Record each write at once, so an interrupted apply still tracks the files it wrote.
    writeManifest({ home, commit: manifest.commit, designSystem: manifest.designSystem, files })
    process.stdout.write(`wrote ${entry.target}\n`)
  }
  writeManifest({ home, commit: sourceCommit(), designSystem: { version: pin.version, integrity: pin.integrity }, files })
  removeLegacyDesignSystemFolder({ home })
  const path = sharedGuidancePath(home)
  if (existsSync(path)) {
    runFieldGuide({ home, args: ['init'] })
    importSharedGuidance({ home })
  } else {
    process.stdout.write(`No shared Field Guide preferences were found; put them at ${path}\n`)
  }
}

// Pulls the checkout, then runs apply and, when the dotfile exists, field-guide-sync in new processes,
// so the pulled script and sources apply.
// host-config ships from main, so update refuses to pull and apply another branch.
const update = ({ home, force }) => {
  const branch = spawnSync('git', ['-C', repoRoot, 'branch', '--show-current'], { encoding: 'utf8' }).stdout.trim()
  if (branch !== 'main') fail(`update runs only on main, but ${repoRoot} is on ${branch || 'a detached HEAD'}; switch to main or use apply`)
  const pull = spawnSync('git', ['-C', repoRoot, 'pull', '--ff-only'], { stdio: 'inherit' })
  if (pull.status !== 0) fail('git pull --ff-only failed; resolve the checkout and rerun')
  const applied = spawnSync(process.execPath, [scriptPath, 'apply', '--home', home, ...(force ? ['--force'] : [])], { stdio: 'inherit' })
  // Without a dotfile the machine has not opted in to syncing, so update creates none.
  if (applied.status !== 0 || !existsSync(sharedGuidancePath(home))) process.exit(applied.status ?? 1)
  const synced = spawnSync(process.execPath, [scriptPath, 'field-guide-sync', '--home', home], { stdio: 'inherit' })
  process.exit(synced.status ?? 1)
}

// Imports the synced dotfile first so the export keeps records from other machines.
const fieldGuideSync = ({ home }) => {
  const path = sharedGuidancePath(home)
  runFieldGuide({ home, args: ['init'] })
  if (existsSync(path)) importSharedGuidance({ home })
  mkdirSync(dirname(path), { recursive: true })
  runFieldGuide({ home, args: ['export', '--output', path] })
  process.stdout.write(`exported shared guidance to ${path}; add it to your dotfile manager\n`)
}

const { command, options } = parseArgs(process.argv.slice(2))
if (command === 'status') status(options)
if (command === 'apply') await apply(options)
if (command === 'update') update(options)
if (command === 'field-guide-sync') fieldGuideSync(options)
