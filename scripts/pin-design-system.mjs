#!/usr/bin/env node
// Pins the @filipgutica/design-system version that host config installs as ~/design-system.
//   pin-design-system.mjs <version>  writes host-config/design-system.json from the npm registry
//   pin-design-system.mjs --check    downloads the pinned tarball and verifies its integrity
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const packageName = '@filipgutica/design-system'
const pinPath = fileURLToPath(new URL('../host-config/design-system.json', import.meta.url))
const usage = 'Usage: pin-design-system.mjs <version> | --check'

const fail = (message) => {
  process.stderr.write(`pin-design-system: ${message}\n`)
  process.exit(1)
}

const download = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    .catch((error) => fail(`downloading ${url} failed (${error.cause?.message || error.message})`))
  if (!response.ok) fail(`${url} returned HTTP ${response.status}`)
  return response
}

const pin = async (version) => {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) fail(`${version} is not an exact version. ${usage}`)
  const { dist } = await (await download(`https://registry.npmjs.org/${packageName}/${version}`)).json()
  if (!dist?.integrity?.startsWith('sha512-')) fail(`${packageName}@${version} has no sha512 integrity`)
  const pinned = { package: packageName, version, integrity: dist.integrity, tarball: dist.tarball }
  writeFileSync(pinPath, `${JSON.stringify(pinned, null, 2)}\n`)
  process.stdout.write(`pinned ${packageName}@${version}\n`)
}

const check = async () => {
  const pinned = JSON.parse(readFileSync(pinPath, 'utf8'))
  const bytes = Buffer.from(await (await download(pinned.tarball)).arrayBuffer())
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  if (integrity !== pinned.integrity) fail(`${pinned.tarball} has integrity ${integrity}, but the pin expects ${pinned.integrity}`)
  process.stdout.write(`${pinned.package}@${pinned.version} matches its pin\n`)
}

const [argument, ...extra] = process.argv.slice(2)
if (!argument || extra.length > 0) fail(usage)
await (argument === '--check' ? check() : pin(argument))
