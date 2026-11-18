#!/usr/bin/env node
// Fails when a secret in ~/.config/secrets could leak into agent output. Secrets live in
// files there, never in a shell environment: an exported secret is captured by every
// agent that dumps its environment and by Codex shell snapshots.
//
// Usage: node check-secret-exposure.mjs [--scan]
// It checks that the folder is mode 700 and each entry a regular 600 file, and that neither
// this process nor the login shell in $SHELL (started with -c, -lc, -ic and -lic) has a
// secret value in its environment. --scan also lists agent log files that contain a secret.
// Every message is redacted, so it never prints a secret value.
//
// It catches accidental exposure, not a startup file written to fool it. The log scan
// matches each value as written and JSON-escaped, which covers token-style secrets.
import { spawnSync } from 'node:child_process'
import { lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const home = homedir()
const secretsDir = join(home, '.config', 'secrets')
const logDirs = ['.claude/projects', '.claude/shell-snapshots', '.codex/sessions', '.codex/shell_snapshots', '.t3/userdata/logs']
// A shorter value would match unrelated text and report every log.
const minLength = 8
const shellModes = ['-c', '-lc', '-ic', '-lic']
// The shell runs this Node binary by absolute path, so a startup file cannot replace the
// probe with a function. The probe writes its report to its own file, so startup output and
// exit hooks cannot corrupt it, and a startup file that exits early leaves no report.
const probe = 'require("node:fs").writeFileSync(process.argv[1], JSON.stringify(process.env))'
const quote = (text) => `'${text.replaceAll("'", "'\\''")}'`
const failures = []
const octal = (mode) => (mode & 0o777).toString(8)
// Returns undefined when the entry vanished between listing and this call.
const entryStat = (path) => {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

const readSecrets = () => {
  let names
  try {
    names = readdirSync(secretsDir)
  } catch (error) {
    failures.push(error.code === 'ENOENT' ? `${secretsDir} is missing` : `${secretsDir} is unreadable (${error.code})`)
    return []
  }
  const folder = entryStat(secretsDir)
  if (!folder?.isDirectory()) failures.push(`${secretsDir} is not a folder`)
  else if ((folder.mode & 0o777) !== 0o700) failures.push(`${secretsDir} has mode ${octal(folder.mode)}, want 700`)
  const secrets = []
  for (const name of names) {
    const path = join(secretsDir, name)
    const entry = entryStat(path)
    if (!entry) continue
    if (!entry.isFile()) {
      failures.push(`${path} is not a regular file; keep each secret as a file in the folder`)
      continue
    }
    if ((entry.mode & 0o777) !== 0o600) failures.push(`${path} has mode ${octal(entry.mode)}, want 600`)
    let value
    try {
      value = readFileSync(path, 'utf8').trim()
    } catch (error) {
      failures.push(`${path} is unreadable (${error.code})`)
      continue
    }
    if (value.length < minLength) failures.push(`${path} is empty or shorter than ${minLength} characters`)
    else secrets.push({ name, value })
  }
  return secrets
}

// Names each variable whose value holds a secret.
const checkEnvironment = (environment, where, secrets) => {
  for (const [variable, value] of Object.entries(environment)) {
    for (const secret of secrets) {
      if (typeof value === 'string' && value.includes(secret.value)) failures.push(`${where} exports ${variable}, which holds ${secret.name}`)
    }
  }
}

// Starts the shell from a minimal environment, so the result reflects its startup files and
// not the caller's environment. ZDOTDIR is kept because it selects zsh's startup files.
const checkShells = (secrets) => {
  const shell = process.env.SHELL || '/bin/sh'
  const env = { HOME: home, PATH: process.env.PATH ?? '/usr/bin:/bin', TERM: 'dumb' }
  if (process.env.ZDOTDIR) env.ZDOTDIR = process.env.ZDOTDIR
  const reports = mkdtempSync(join(tmpdir(), 'check-secret-exposure-'))
  try {
    for (const flags of shellModes) {
      const started = `${basename(shell)} ${flags}`
      const report = join(reports, flags.slice(1))
      const command = [process.execPath, '-e', probe, report].map(quote).join(' ')
      spawnSync(shell, [flags, command], { env, stdio: 'ignore', timeout: 30_000 })
      let environment
      try {
        environment = JSON.parse(readFileSync(report, 'utf8'))
      } catch {
        failures.push(`${started} did not report its environment, so it is unchecked`)
        continue
      }
      checkEnvironment(environment, started, secrets)
    }
  } finally {
    rmSync(reports, { recursive: true, force: true })
  }
}

const files = function* (dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code !== 'ENOENT') failures.push(`${dir} is unreadable (${error.code})`)
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* files(path)
    else if (entry.isFile()) yield path
  }
}

const scanLogs = (secrets) => {
  // JSON logs escape characters such as newlines and quotes, so look for that form too.
  const forms = secrets.map(({ name, value }) => ({ name, needles: [...new Set([value, JSON.stringify(value).slice(1, -1)])] }))
  for (const dir of logDirs) {
    for (const path of files(join(home, dir))) {
      let content
      try {
        content = readFileSync(path)
      } catch (error) {
        failures.push(`${path} is unreadable (${error.code})`)
        continue
      }
      for (const { name, needles } of forms) {
        if (needles.some((needle) => content.includes(needle))) failures.push(`${path} contains ${name}`)
      }
    }
  }
}

const scan = process.argv.includes('--scan')
const secrets = readSecrets()
checkEnvironment(process.env, 'this process', secrets)
checkShells(secrets)
if (scan) scanLogs(secrets)

// A line built from a variable name or a path could still hold a value.
const print = (line) => console.log(secrets.reduce((text, { value }) => text.split(value).join('[redacted]'), line))
if (failures.length > 0) {
  for (const failure of failures) print(`FAIL: ${failure}`)
  process.exit(1)
}
print(`OK: ${secrets.length} secret(s) in ${secretsDir}; no environment holds one${scan ? ' and no agent log contains one' : ''}.`)
