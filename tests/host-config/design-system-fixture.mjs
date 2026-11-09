// Builds design-system package tarballs and their pins, so host-config tests run without the npm registry.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

export const fixturePayload = {
  'DESIGN.md': '# Design language\n\nRead tokens.css first.\n',
  'tokens.css': ':root { --accent: #4f46e5; }\n',
  'visualizations/report.css': '.report { color: var(--accent); }\n',
}

const put = (path, content) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

// Packs `files` (and any `links`, name to symlink target) as package/language/ the way npm publishes them.
// The pin's tarball URL refuses connections, so a test that needs a download replaces it.
export const buildPackage = ({ root, version = '1.0.0', files = fixturePayload, links = {} }) => {
  const source = join(root, `source-${version}`)
  for (const [name, content] of Object.entries(files)) put(join(source, 'package/language', name), content)
  for (const [name, target] of Object.entries(links)) symlinkSync(target, join(source, 'package/language', name))
  const tarball = join(root, `design-system-${version}.tgz`)
  // COPYFILE_DISABLE keeps macOS tar from adding ._ metadata entries.
  const packed = spawnSync('tar', ['-czf', tarball, '-C', source, 'package'], { encoding: 'utf8', env: { ...process.env, COPYFILE_DISABLE: '1' } })
  assert.equal(packed.status, 0, packed.stderr)
  const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`
  const pin = { package: '@filipgutica/design-system', version, integrity, tarball: 'http://127.0.0.1:9/unused.tgz' }
  return { version, tarball, pin }
}

export const writePin = ({ repo, pin }) => writeFileSync(join(repo, 'host-config/design-system.json'), `${JSON.stringify(pin, null, 2)}\n`)

export const cachePath = ({ cacheHome, version }) => join(cacheHome, 'filip-stack/design-system', `${version}.tgz`)

export const seedCache = ({ cacheHome, version, tarball }) => {
  const path = cachePath({ cacheHome, version })
  mkdirSync(dirname(path), { recursive: true })
  copyFileSync(tarball, path)
}

// Copies the host-config script, its sources, and Field Guide into `repo`, pinned to `pin`.
export const copyHostConfig = ({ repo, pin }) => {
  mkdirSync(join(repo, 'scripts'), { recursive: true })
  copyFileSync(new URL('../../scripts/host-config.mjs', import.meta.url), join(repo, 'scripts/host-config.mjs'))
  cpSync(new URL('../../host-config/', import.meta.url), join(repo, 'host-config'), { recursive: true })
  cpSync(new URL('../../plugins/field-guide/', import.meta.url), join(repo, 'plugins/field-guide'), { recursive: true })
  writePin({ repo, pin })
}

// Serves `body` for every request from 127.0.0.1 and returns its URL.
export const serve = async (body) => {
  const server = createServer((_, response) => response.end(body))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${server.address().port}/design-system.tgz`, close: () => new Promise((resolve) => server.close(resolve)) }
}

// Lists every file under `directory` with its sha256, so a test can prove nothing changed.
export const snapshot = (directory) => (
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => [join(entry.parentPath, entry.name), createHash('sha256').update(readFileSync(join(entry.parentPath, entry.name))).digest('hex')])
    .sort(([left], [right]) => left.localeCompare(right))
)

// Returns a URL on a port that was free a moment ago, so connecting to it fails.
export const unreachableUrl = async () => {
  const { url, close } = await serve('')
  await close()
  return url
}
