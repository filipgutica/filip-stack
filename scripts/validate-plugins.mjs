import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pluginsRoot = join(repoRoot, 'plugins')
const supportedHookEvents = new Set(['Stop', 'UserPromptSubmit'])

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

const validateHookHandler = async ({ expectedRootVariable, handler, event, path, pluginRoot }) => {
  if (handler?.type !== 'command' || typeof handler.command !== 'string') {
    fail(`${path} hook event "${event}" must use a command handler`)
    return
  }
  const references = [...handler.command.matchAll(/\$\{(CLAUDE_PLUGIN_ROOT|PLUGIN_ROOT)\}\/([^"\s]+)/g)]
  if (references.length === 0) {
    fail(`${path} hook event "${event}" must reference a packaged plugin file`)
    return
  }
  if (references.some(([, rootVariable]) => rootVariable !== expectedRootVariable)) {
    fail(`${path} hook event "${event}" must use \${${expectedRootVariable}} for packaged files`)
    return
  }
  for (const [, , reference] of references) {
    if (!await pathExists(join(pluginRoot, reference))) {
      fail(`${path} hook event "${event}" references a missing file: "${reference}"`)
    }
  }
}

const validateHookGroup = async ({ expectedRootVariable, group, event, path, pluginRoot }) => {
  if (!group || !Array.isArray(group.hooks) || group.hooks.length === 0) {
    fail(`${path} hook event "${event}" has an invalid handler group`)
    return
  }
  await Promise.all(group.hooks.map((handler) => (
    validateHookHandler({ expectedRootVariable, handler, event, path, pluginRoot })
  )))
}

const validateHookEvent = async ({ expectedRootVariable, event, groups, path, pluginRoot }) => {
  if (!supportedHookEvents.has(event)) fail(`${path} has an unsupported hook event: "${event}"`)
  if (!Array.isArray(groups) || groups.length === 0) {
    fail(`${path} hook event "${event}" must have at least one group`)
    return
  }
  await Promise.all(groups.map((group) => validateHookGroup({ expectedRootVariable, group, event, path, pluginRoot })))
}

const validateHooks = async ({ expectedRootVariable, path, pluginRoot }) => {
  const parsed = await validateJson(path, ['hooks'])
  if (!parsed) return
  if (!parsed.hooks || typeof parsed.hooks !== 'object' || Array.isArray(parsed.hooks)) {
    fail(`${path} has an invalid "hooks" object`)
    return
  }
  await Promise.all(Object.entries(parsed.hooks).map(([event, groups]) => (
    validateHookEvent({ expectedRootVariable, event, groups, path, pluginRoot })
  )))
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

console.log('Validating plugin manifests...')

await validateJson(join(repoRoot, '.claude-plugin/marketplace.json'), ['name', 'owner', 'plugins'])
await validateJson(join(repoRoot, '.agents/plugins/marketplace.json'), ['name', 'plugins'])

const pluginDirs = await readDirectoryNames(pluginsRoot)

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

  const hooksDir = join(pluginRoot, 'hooks')
  const hooksFiles = await readdir(hooksDir).catch(() => [])
  for (const hooksFile of hooksFiles.filter((file) => file.endsWith('.json')).sort()) {
    const expectedRootVariable = hooksFile === 'codex-hooks.json' ? 'PLUGIN_ROOT' : 'CLAUDE_PLUGIN_ROOT'
    await validateHooks({ expectedRootVariable, path: join(hooksDir, hooksFile), pluginRoot })
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
