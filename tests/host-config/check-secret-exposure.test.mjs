import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../host-config/agents/scripts/check-secret-exposure.mjs', import.meta.url))
const secret = 'test-secret-value-1234'

// A deterministic login shell: it reads only the fixture home's startup files, by mode, so
// the tests never depend on the machine's /etc/profile or dotfiles.
const fixtureShell = (home) => {
  const shell = join(home, 'fixture-shell')
  writeFileSync(shell, `#!/bin/sh
flags=$1
[ -f "$HOME/.startup-all" ] && . "$HOME/.startup-all"
case $flags in *l*) [ -f "$HOME/.startup-login" ] && . "$HOME/.startup-login" ;; esac
case $flags in *i*) [ -f "$HOME/.startup-interactive" ] && . "$HOME/.startup-interactive" ;; esac
eval "$2"
`, { mode: 0o755 })
  return shell
}

// A home with one secret file in a correctly locked folder.
const makeHome = () => {
  const home = mkdtempSync(join(tmpdir(), 'secret-exposure-'))
  const secrets = join(home, '.config', 'secrets')
  mkdirSync(secrets, { recursive: true })
  chmodSync(secrets, 0o700)
  writeFileSync(join(secrets, 'proxy-key'), `${secret}\n`, { mode: 0o600 })
  return home
}

const check = (home, { args = [], env = {} } = {}) => {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { HOME: home, SHELL: fixtureShell(home), PATH: process.env.PATH, ...env },
  })
  // No outcome may print the value it protects.
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret, 'u'))
  return result
}

// Asserts the check failed and printed a line matching each pattern.
const assertFails = (result, ...patterns) => {
  assert.equal(result.status, 1, result.stdout)
  for (const pattern of patterns) assert.match(result.stdout, pattern)
}

test('passes when the secret is only in its file', () => {
  const result = check(makeHome(), { args: ['--scan'] })
  assert.equal(result.status, 0, result.stdout)
  assert.match(result.stdout, /^OK: 1 secret\(s\)/u)
})

test('fails for each shell start that exports the secret, naming the variable', () => {
  const home = makeHome()
  writeFileSync(join(home, '.startup-interactive'), `export PROXY_KEY=${secret}\n`)
  const result = check(home)
  assertFails(result, /^FAIL: fixture-shell -ic exports PROXY_KEY, which holds proxy-key$/mu, /^FAIL: fixture-shell -lic exports PROXY_KEY, which holds proxy-key$/mu)
  assert.doesNotMatch(result.stdout, /fixture-shell -l?c exports/u)
})

test('names the variable without printing a secret that sits on a later line of its value', () => {
  const home = makeHome()
  writeFileSync(join(home, '.startup-login'), `export ODD="first line\n${secret}=suffix"\n`)
  const result = check(home)
  assertFails(result, /^FAIL: fixture-shell -lc exports ODD, which holds proxy-key$/mu)
})

test('fails when a startup file stops the shell before it reports', () => {
  const home = makeHome()
  writeFileSync(join(home, '.startup-all'), 'exit 0\n')
  const result = check(home)
  assertFails(result, /^FAIL: fixture-shell -c did not report its environment, so it is unchecked$/mu)
})

test('fails when the calling environment already holds the secret', () => {
  const result = check(makeHome(), { env: { PROXY_KEY: secret } })
  assertFails(result, /^FAIL: this process exports PROXY_KEY, which holds proxy-key$/mu)
})

test('fails when the folder or a file can be read by others', () => {
  const home = makeHome()
  chmodSync(join(home, '.config', 'secrets'), 0o755)
  chmodSync(join(home, '.config', 'secrets', 'proxy-key'), 0o644)
  const result = check(home)
  assertFails(result, /secrets has mode 755, want 700$/mu, /proxy-key has mode 644, want 600$/mu)
})

test('fails on a symlinked secret and on an empty secret file', () => {
  const home = makeHome()
  const outside = join(home, 'outside-key')
  writeFileSync(outside, 'another-secret-value', { mode: 0o600 })
  symlinkSync(outside, join(home, '.config', 'secrets', 'linked'))
  writeFileSync(join(home, '.config', 'secrets', 'empty'), '\n', { mode: 0o600 })
  const result = check(home, { args: ['--scan'] })
  assertFails(result, /linked is not a regular file/u, /empty is empty or shorter than 8 characters$/mu)
})

test('--scan lists agent logs that contain the secret, raw or JSON-escaped', () => {
  const home = makeHome()
  const quoted = 'quoted"secret-5678'
  writeFileSync(join(home, '.config', 'secrets', 'quoted'), quoted, { mode: 0o600 })
  const sessions = join(home, '.codex', 'sessions', '2026')
  mkdirSync(sessions, { recursive: true })
  writeFileSync(join(sessions, 'raw.jsonl'), `{"output":"${secret}"}\n`)
  writeFileSync(join(sessions, 'escaped.jsonl'), `${JSON.stringify({ output: quoted })}\n`)
  writeFileSync(join(sessions, 'clean.jsonl'), '{"output":"nothing"}\n')
  assert.equal(check(home).status, 0)
  const result = check(home, { args: ['--scan'] })
  assertFails(result, /^FAIL: .*\/\.codex\/sessions\/2026\/raw\.jsonl contains proxy-key$/mu, /^FAIL: .*\/\.codex\/sessions\/2026\/escaped\.jsonl contains quoted$/mu)
  assert.doesNotMatch(result.stdout, /clean\.jsonl|quoted"secret/u)
})
