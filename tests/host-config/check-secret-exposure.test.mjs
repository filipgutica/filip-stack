import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../host-config/agents/scripts/check-secret-exposure.mjs', import.meta.url))
const secret = 'test-secret-value-1234'

// A home with one secret file in a correctly locked folder, and bash as the login shell.
const makeHome = () => {
  const home = mkdtempSync(join(tmpdir(), 'secret-exposure-'))
  const secrets = join(home, '.config', 'secrets')
  mkdirSync(secrets, { recursive: true, mode: 0o700 })
  chmodSync(secrets, 0o700)
  writeFileSync(join(secrets, 'proxy-key'), `${secret}\n`, { mode: 0o600 })
  return home
}

const check = (home, ...args) => {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { HOME: home, SHELL: '/bin/bash', PATH: process.env.PATH },
  })
  // No outcome may print the value it protects.
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret, 'u'))
  return result
}

test('passes when the secret is only in its file', () => {
  const result = check(makeHome(), '--scan')
  assert.equal(result.status, 0, result.stdout)
  assert.match(result.stdout, /^OK: 1 secret\(s\)/u)
})

test('fails for each shell start that exports the secret, naming the variable', () => {
  const home = makeHome()
  writeFileSync(join(home, '.bashrc'), `export PROXY_KEY=${secret}\n`)
  writeFileSync(join(home, '.bash_profile'), `export PROXY_KEY=${secret}\n`)
  const result = check(home)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /^FAIL: bash -ic exports PROXY_KEY, which holds proxy-key$/mu)
  assert.match(result.stdout, /^FAIL: bash -lc exports PROXY_KEY, which holds proxy-key$/mu)
  assert.doesNotMatch(result.stdout, /bash -c exports/u)
})

test('fails when the folder or a file can be read by others', () => {
  const home = makeHome()
  chmodSync(join(home, '.config', 'secrets'), 0o755)
  chmodSync(join(home, '.config', 'secrets', 'proxy-key'), 0o644)
  const result = check(home)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /secrets has mode 755, want 700$/mu)
  assert.match(result.stdout, /proxy-key has mode 644, want 600$/mu)
})

test('fails on an empty secret file instead of matching every log', () => {
  const home = makeHome()
  writeFileSync(join(home, '.config', 'secrets', 'empty'), '\n', { mode: 0o600 })
  const result = check(home, '--scan')
  assert.equal(result.status, 1)
  assert.match(result.stdout, /empty is empty or shorter than 8 characters$/mu)
})

test('--scan lists agent logs that contain the secret', () => {
  const home = makeHome()
  const sessions = join(home, '.codex', 'sessions', '2026')
  mkdirSync(sessions, { recursive: true })
  writeFileSync(join(sessions, 'leaked.jsonl'), `{"output":"${secret}"}\n`)
  writeFileSync(join(sessions, 'clean.jsonl'), '{"output":"nothing"}\n')
  assert.equal(check(home).status, 0)
  const result = check(home, '--scan')
  assert.equal(result.status, 1)
  assert.match(result.stdout, /^FAIL: .*\/\.codex\/sessions\/2026\/leaked\.jsonl contains proxy-key$/mu)
  assert.doesNotMatch(result.stdout, /clean\.jsonl/u)
})
