import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../../cli/filip-stack.mjs', import.meta.url))
const repository = fileURLToPath(new URL('../../', import.meta.url))
const run = (args, script = cli) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })

test('help and version work without a source checkout', () => {
  const missing = join(tmpdir(), 'filip-stack-missing-checkout')
  const help = run(['--repo', missing, '--help'])
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /Usage: filip-stack/)
  assert.match(help.stdout, /field-guide-sync/)
  assert.match(help.stdout, /sync.*guidance.*skills.*plugins/)
  const version = run(['--repo', missing, '--version'])
  assert.equal(version.status, 0, version.stderr)
  assert.equal(version.stdout.trim(), JSON.parse(readFileSync(new URL('../../cli/package.json', import.meta.url), 'utf8')).version)
  assert.equal(version.stdout.trim(), JSON.parse(readFileSync(new URL('../../.release-please-manifest.json', import.meta.url), 'utf8')).cli)
})

test('the installed command uses the selected checkout and forwards options and failures', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'filip-stack-cli-'))
  t.after(() => rmSync(home, { recursive: true, force: true }))
  const installed = join(home, 'installed cli')
  cpSync(new URL('../../cli/', import.meta.url), installed, { recursive: true })
  const script = join(installed, 'filip-stack.mjs')
  const version = run(['--version'], script)
  assert.equal(version.status, 0, version.stderr)
  assert.equal(version.stdout, run(['--version']).stdout)
  const target = join(home, 'target')
  const args = ['--repo', repository]
  const status = run([...args, 'status', '--home', target], script)
  assert.equal(status.status, 0, status.stderr)
  assert.match(status.stdout, /^applied: never\nrepository: /)
  assert.deepEqual(readdirSync(home), ['installed cli'])
  const failure = run([...args, 'status', '--not-an-option'], script)
  assert.equal(failure.status, 1)
  assert.match(failure.stderr, /Usage:/)
})

test('missing checkout and incomplete --repo return an actionable error', () => {
  const missing = run(['--repo', join(tmpdir(), 'filip-stack-missing-checkout'), 'status'])
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /clone filipgutica\/filip-stack there or pass --repo/)
  assert.equal(run(['--repo']).status, 1)
  assert.equal(run(['--repo', '--help']).status, 1)
})

test('sync explains an older checkout and exposes command help', (t) => {
  const old = mkdtempSync(join(tmpdir(), 'filip-stack-old-checkout-'))
  t.after(() => rmSync(old, { recursive: true, force: true }))
  cpSync(new URL('../../scripts/', import.meta.url), `${old}/scripts`, { recursive: true, filter: (path) => !path.endsWith('sync.mjs') })
  const missing = run(['--repo', old, 'sync', '--dry-run', '--json'])
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /does not support sync; update its main branch/)
  const help = run(['--repo', repository, 'sync', '--help'])
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /Usage: filip-stack sync/)
})
