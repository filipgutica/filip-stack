import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return false
    }
    throw err
  }
}

console.log('Validating plugin manifests...')

await validateJson(join(repoRoot, '.claude-plugin/marketplace.json'), ['name', 'owner', 'plugins'])
await validateJson(join(repoRoot, '.agents/plugins/marketplace.json'), ['name', 'plugins'])

const pluginEntries = await readdir(pluginsRoot, { withFileTypes: true }).catch((err) => {
  fail(`${pluginsRoot} — ${err.message}`)
  return []
})

const pluginDirs = pluginEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

for (const pluginDir of pluginDirs) {
  const pluginRoot = join(pluginsRoot, pluginDir)

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

  for (const hooksPath of ['hooks/hooks.json', 'hooks/codex.json']) {
    const fullPath = join(pluginRoot, hooksPath)
    if (await pathExists(fullPath)) {
      await validateJson(fullPath, ['hooks'])
    }
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
