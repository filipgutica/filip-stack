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
import { spawnSync } from 'node:child_process'
import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

const home = homedir()
const secretsDir = join(home, '.config', 'secrets')
const logDirs = ['.claude/projects', '.claude/shell-snapshots', '.codex/sessions', '.codex/shell_snapshots', '.t3/userdata/logs']
// A shorter value would match unrelated text and report every log.
const minLength = 8
const shellModes = ['-c', '-lc', '-ic', '-lic']
// The shell runs this Node binary by absolute path, so a startup file cannot replace the
// probe with a function, and a startup file that exits early leaves no report.
const marker = 'check-secret-exposure-environment'
const probe = `process.stdout.write(${JSON.stringify(marker)} + JSON.stringify(process.env))`
const failures = []
const octal = (mode) => (mode & 0o777).toString(8)

const readSecrets = () => {
  let names
  try {
    names = readdirSync(secretsDir)
  } catch (error) {
    failures.push(error.code === 'ENOENT' ? `${secretsDir} is missing` : `${secretsDir} is unreadable (${error.code})`)
    return []
  }
  const folder = lstatSync(secretsDir)
  if (!folder.isDirectory()) failures.push(`${secretsDir} is not a folder`)
  else if ((folder.mode & 0o777) !== 0o700) failures.push(`${secretsDir} has mode ${octal(folder.mode)}, want 700`)
  const secrets = []
  for (const name of names) {
    const path = join(secretsDir, name)
    const entry = lstatSync(path)
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
  const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(probe)}`
  const env = { HOME: home, PATH: process.env.PATH ?? '/usr/bin:/bin', TERM: 'dumb' }
  if (process.env.ZDOTDIR) env.ZDOTDIR = process.env.ZDOTDIR
  for (const flags of shellModes) {
    const started = `${basename(shell)} ${flags}`
    const result = spawnSync(shell, [flags, command], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 })
    const start = result.stdout?.lastIndexOf(marker) ?? -1
    let environment
    try {
      environment = start >= 0 ? JSON.parse(result.stdout.slice(start + marker.length)) : undefined
    } catch {
      environment = undefined
    }
    if (!environment) {
      failures.push(`${started} did not report its environment, so it is unchecked`)
      continue
    }
    checkEnvironment(environment, started, secrets)
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

// A message built from a variable name or a path could still hold a value.
const redact = (message) => secrets.reduce((text, { value }) => text.split(value).join('[redacted]'), message)
if (failures.length > 0) {
  for (const failure of failures) console.log(`FAIL: ${redact(failure)}`)
  process.exit(1)
}
console.log(`OK: ${secrets.length} secret(s) in ${secretsDir}; no environment holds one${scan ? ' and no agent log contains one' : ''}.`)
