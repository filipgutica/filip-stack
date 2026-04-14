import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pluginRoot = join(repoRoot, 'plugins/filip-stack')

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

console.log('Validating Claude plugin...')

await validateJson(join(pluginRoot, '.claude-plugin/plugin.json'), ['name'])
await validateJson(join(pluginRoot, 'hooks/hooks.json'), ['hooks'])
await validateJson(join(repoRoot, '.claude-plugin/marketplace.json'), ['name', 'owner', 'plugins'])

const skillsDir = join(pluginRoot, 'skills')
const skills = await readdir(skillsDir).catch(() => [])
for (const skill of skills) {
  await validateSkillMd(join(skillsDir, skill, 'SKILL.md'))
}

if (errors > 0) {
  console.error(`\n${errors} validation error(s) found.`)
  process.exit(1)
}

console.log('All checks passed.')
