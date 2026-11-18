#!/usr/bin/env node
// Fails when a secret in ~/.config/secrets could leak into agent output. Secrets live in
// files there, never in a shell environment: an exported secret is captured by every
// agent that dumps its environment and by Codex shell snapshots.
//
// Usage: node check-secret-exposure.mjs [--scan]
// It checks that the folder is mode 700 and each file 600, and that the login shell in
// $SHELL exports no secret value when started with -c, -lc or -ic. --scan also lists agent
// log files that contain a secret. It prints names only, never a secret value.
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

const home = homedir()
const secretsDir = join(home, '.config', 'secrets')
const logDirs = ['.claude/projects', '.claude/shell-snapshots', '.codex/sessions', '.codex/shell_snapshots', '.t3/userdata/logs']
// A shorter value would match unrelated text and report every log.
const minLength = 8
const failures = []
const mode = (path) => statSync(path).mode & 0o777
const octal = (value) => value.toString(8)

const readSecrets = () => {
  let names
  try {
    names = readdirSync(secretsDir)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    failures.push(`${secretsDir} is missing`)
    return []
  }
  if (mode(secretsDir) !== 0o700) failures.push(`${secretsDir} has mode ${octal(mode(secretsDir))}, want 700`)
  const secrets = []
  for (const name of names) {
    const path = join(secretsDir, name)
    if (!statSync(path).isFile()) continue
    if (mode(path) !== 0o600) failures.push(`${path} has mode ${octal(mode(path))}, want 600`)
    const value = readFileSync(path, 'utf8').trim()
    if (value.length < minLength) failures.push(`${path} is empty or shorter than ${minLength} characters`)
    else secrets.push({ name, value })
  }
  return secrets
}

// Starts the shell from an empty environment, so the result reflects its startup files and
// not the caller's environment.
const checkShells = (secrets) => {
  const shell = process.env.SHELL || '/bin/sh'
  for (const flags of ['-c', '-lc', '-ic']) {
    const result = spawnSync(shell, [flags, 'env'], {
      encoding: 'utf8',
      env: { HOME: home, PATH: process.env.PATH ?? '/usr/bin:/bin', TERM: 'dumb' },
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 30_000,
    })
    const started = `${basename(shell)} ${flags}`
    if (result.error || result.status !== 0) {
      failures.push(`${started} did not run, so its environment is unchecked`)
      continue
    }
    for (const { name, value } of secrets) {
      if (!result.stdout.includes(value)) continue
      const line = result.stdout.split('\n').find((entry) => entry.includes(value))
      const variable = line?.slice(0, line.indexOf('=')) || 'a variable'
      failures.push(`${started} exports ${variable}, which holds ${name}`)
    }
  }
}

const files = function* (dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* files(path)
    else if (entry.isFile()) yield path
  }
}

const scanLogs = (secrets) => {
  for (const dir of logDirs) {
    for (const path of files(join(home, dir))) {
      const content = readFileSync(path)
      for (const { name, value } of secrets) {
        if (content.includes(value)) failures.push(`${path} contains ${name}`)
      }
    }
  }
}

const scan = process.argv.includes('--scan')
const secrets = readSecrets()
checkShells(secrets)
if (scan) scanLogs(secrets)

if (failures.length > 0) {
  for (const failure of failures) console.log(`FAIL: ${failure}`)
  process.exit(1)
}
console.log(`OK: ${secrets.length} secret(s) in ${secretsDir}; no shell exports one${scan ? ' and no agent log contains one' : ''}.`)
