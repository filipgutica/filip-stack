import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'))

if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
  throw new Error('package.json is missing a valid version string')
}

const { version } = packageJson

const stampJson = async (path, updater) => {
  const parsed = JSON.parse(await readFile(path, 'utf8'))
  await writeFile(path, `${JSON.stringify(updater(parsed), null, 2)}\n`)
  console.log(`Stamped ${version} into ${path}`)
}

await stampJson(join(repoRoot, 'plugins/filip-stack/.claude-plugin/plugin.json'), (json) => ({
  ...json,
  version,
}))

await stampJson(join(repoRoot, 'plugins/filip-stack/.codex-plugin/plugin.json'), (json) => ({
  ...json,
  version,
}))

await stampJson(join(repoRoot, '.claude-plugin/marketplace.json'), (json) => ({
  ...json,
  version,
}))

await stampJson(join(repoRoot, '.agents/plugins/marketplace.json'), (json) => ({
  ...json,
  version,
}))
