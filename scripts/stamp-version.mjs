import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
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

const pathExists = async (path) => {
  try {
    await stat(path)
    return true
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return false
    }
    throw err
  }
}

const pluginsRoot = join(repoRoot, 'plugins')
const pluginEntries = await readdir(pluginsRoot, { withFileTypes: true })
const pluginDirs = pluginEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

for (const pluginDir of pluginDirs) {
  const claudeManifest = join(pluginsRoot, pluginDir, '.claude-plugin/plugin.json')
  if (await pathExists(claudeManifest)) {
    await stampJson(claudeManifest, (json) => ({
      ...json,
      version,
    }))
  }

  const codexManifest = join(pluginsRoot, pluginDir, '.codex-plugin/plugin.json')
  if (await pathExists(codexManifest)) {
    await stampJson(codexManifest, (json) => ({
      ...json,
      version,
    }))
  }
}

await stampJson(join(repoRoot, '.claude-plugin/marketplace.json'), (json) => ({
  ...json,
  version,
}))

await stampJson(join(repoRoot, '.agents/plugins/marketplace.json'), (json) => ({
  ...json,
  version,
}))
