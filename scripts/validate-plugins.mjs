import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDevelopmentOnlyPluginPath } from './plugin-payload-policy.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pluginsRoot = join(repoRoot, 'plugins')

let errors = 0

const fail = (message) => {
  console.error(`  FAIL: ${message}`)
  errors++
}

const validateJson = async (path, requiredFields = []) => {
  try {
    const content = await readFile(path, 'utf8')
    const parsed = JSON.parse(content)
    for (const field of requiredFields) {
      if (!(field in parsed)) fail(`${path} is missing required field: "${field}"`)
    }
    return parsed
  } catch (err) {
    fail(`${path} — ${err.message}`)
    return null
  }
}

const validateSkillMd = async (path) => {
  const content = await readFile(path, 'utf8').catch((err) => {
    fail(`${path} — ${err.message}`)
    return null
  })
  if (content === null) return
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) {
    fail(`${path} — missing YAML frontmatter`)
    return
  }
  if (!match[1].includes('description:')) {
    fail(`${path} — frontmatter missing required field: "description"`)
  }
}

const pathExists = async (path) => {
  try {
    await stat(path)
    return true
  } catch (err) {
    if (err?.code === 'ENOENT') return false
    throw err
  }
}

const readDirectoryNames = async (path) => (
  await readdir(path, { withFileTypes: true }).catch((err) => {
    fail(`${path} — ${err.message}`)
    return []
  })
)
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const validateRuntimePayload = async (pluginRoot) => {
  const paths = await readdir(pluginRoot, { recursive: true })
  for (const path of paths.sort()) {
    if (!(await stat(join(pluginRoot, path))).isFile()) continue
    if (isDevelopmentOnlyPluginPath(path)) {
      fail(`${join(pluginRoot, path)} is a development-only test asset inside the runtime plugin payload`)
    }
  }
}

console.log('Validating plugin manifests...')

await validateJson(join(repoRoot, '.claude-plugin/marketplace.json'), ['name', 'owner', 'plugins'])
await validateJson(join(repoRoot, '.agents/plugins/marketplace.json'), ['name', 'plugins'])

const pluginDirs = await readDirectoryNames(pluginsRoot)

for (const pluginDir of pluginDirs) {
  const pluginRoot = join(pluginsRoot, pluginDir)
  await validateRuntimePayload(pluginRoot)

  const claudeManifest = join(pluginRoot, '.claude-plugin/plugin.json')
  const codexManifest = join(pluginRoot, '.codex-plugin/plugin.json')
  const hasClaudeManifest = await pathExists(claudeManifest)
  const hasCodexManifest = await pathExists(codexManifest)

  if (!hasClaudeManifest && !hasCodexManifest) {
    fail(`${pluginRoot} is missing a Claude or Codex plugin manifest`)
  }

  if (hasClaudeManifest) {
    await validateJson(claudeManifest, ['name'])
  }
  if (hasCodexManifest) {
    await validateJson(codexManifest, ['name', 'skills'])
  }

  const skillsDir = join(pluginRoot, 'skills')
  const skills = await readdir(skillsDir).catch(() => [])
  for (const skill of skills) {
    await validateSkillMd(join(skillsDir, skill, 'SKILL.md'))
  }
}

if (errors > 0) {
  console.error(`\n${errors} validation error(s) found.`)
  process.exit(1)
}

console.log('All checks passed.')
