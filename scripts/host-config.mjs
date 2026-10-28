#!/usr/bin/env node
// Applies host-config/ to the Claude, Codex, and shared agent directories in a home directory.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = join(dirname(scriptPath), '..')
const sourceRoot = join(repoRoot, 'host-config')
const sharedGuidancePath = (home) => join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'filip-stack', 'field-guide.json')
const fieldGuideScript = join(repoRoot, 'plugins', 'field-guide', 'skills', 'field-guide', 'scripts', 'field-guide.mjs')
const manifestTarget = '.agents/.filip-stack-host-config.json'
const blockStart = '<!-- filip-stack:host-config:begin (managed by filip-stack; edit host-config/ there) -->'
const blockEnd = '<!-- filip-stack:host-config:end -->'

// Source directories copied file for file into the home directory.
const fileRoots = [['claude', '.claude'], ['codex', '.codex'], ['agents', '.agents'], ['design-language', 'design-language']]
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

const listFiles = (directory) => (
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== '.DS_Store')
    .map((entry) => join(entry.parentPath, entry.name))
)

const renderText = ({ text, home }) => text.replaceAll('{{HOME}}', home)

const renderGuidance = ({ host, home }) => {
  const core = read(join(sourceRoot, 'guidance', 'core.md'))
  const assembled = core.replace(/\{\{include:([a-z-]+)\}\}/g, (_, name) => (
    read(join(sourceRoot, 'guidance', host, `${name}.md`)).trimEnd()
  ))
  return renderText({ text: assembled, home })
}

const desiredTargets = (home) => {
  const targets = new Map()
  for (const [source, target] of fileRoots) {
    for (const file of listFiles(join(sourceRoot, source))) {
      const relativePath = join(target, relative(join(sourceRoot, source), file))
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

const sourceCommit = () => {
  const git = (args) => spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' })
  const head = git(['rev-parse', '--short', 'HEAD']).stdout.trim() || 'unknown'
  const dirty = git(['status', '--porcelain', '--', 'host-config']).stdout.trim().length > 0
  return dirty ? `${head}+dirty` : head
}

// Classifies each target as current, update, edited, remove, or edited-remove.
// A target is edited when its managed text differs from both the repository
// version and the version this script last applied.
const plan = (home) => {
  const manifest = readManifest(home)
  const desired = desiredTargets(home)
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
    if (desired.has(target)) continue
    const current = readManaged({ home, target, kind: 'file' })
    const state = current.content === null || hash(current.content) === appliedHash ? 'remove' : 'edited-remove'
    entries.push({ target, kind: 'file', content: null, current, state })
  }
  return { manifest, entries }
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

const status = ({ home }) => {
  const { manifest, entries } = plan(home)
  process.stdout.write(`applied: ${manifest.commit ?? 'never'}\nrepository: ${sourceCommit()}\n`)
  for (const { target, state } of entries) process.stdout.write(`${state.padEnd(13)} ${target}\n`)
}

const writeManifest = ({ home, commit, files }) => {
  const path = join(home, manifestTarget)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ commit, files }, null, 2)}\n`)
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

const apply = ({ home, force }) => {
  const { manifest, entries } = plan(home)
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
      writeManifest({ home, commit: manifest.commit, files })
      process.stdout.write(`removed ${entry.target}\n`)
      continue
    }
    if (entry.current.unmarked) {
      process.stdout.write(`${entry.target} had no filip-stack block; restore any machine-local text from the backup below the block\n`)
    }
    writeTarget({ home, ...entry })
    files[entry.target] = hash(entry.content)
    // Record each write at once, so an interrupted apply still tracks the files it wrote.
    writeManifest({ home, commit: manifest.commit, files })
    process.stdout.write(`wrote ${entry.target}\n`)
  }
  writeManifest({ home, commit: sourceCommit(), files })
  const path = sharedGuidancePath(home)
  if (existsSync(path)) {
    runFieldGuide({ home, args: ['init'] })
    importSharedGuidance({ home })
  } else {
    process.stdout.write(`No shared Field Guide preferences were found; put them at ${path}\n`)
  }
}

// Pulls the checkout, then runs apply in a new process so the pulled script and sources apply.
// host-config ships from main, so update refuses to pull and apply another branch.
const update = ({ home, force }) => {
  const branch = spawnSync('git', ['-C', repoRoot, 'branch', '--show-current'], { encoding: 'utf8' }).stdout.trim()
  if (branch !== 'main') fail(`update runs only on main, but ${repoRoot} is on ${branch || 'a detached HEAD'}; switch to main or use apply`)
  const pull = spawnSync('git', ['-C', repoRoot, 'pull', '--ff-only'], { stdio: 'inherit' })
  if (pull.status !== 0) fail('git pull --ff-only failed; resolve the checkout and rerun')
  const applied = spawnSync(process.execPath, [scriptPath, 'apply', '--home', home, ...(force ? ['--force'] : [])], { stdio: 'inherit' })
  process.exit(applied.status ?? 1)
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
if (command === 'apply') apply(options)
if (command === 'update') update(options)
if (command === 'field-guide-sync') fieldGuideSync(options)
