// Reads the per-skill guidance test files in tests/skills/scenarios/<skill>.json and
// the options `run.mjs` passes to promptfoo through the environment.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = new URL('../', import.meta.url).pathname
const scenariosDir = join(repoRoot, 'tests/skills/scenarios/')
// A test file covers a standalone skill or Field Guide.
const skillRoots = ['skills', 'plugins/field-guide/skills']

// Returns [{ skill, routing, rules }], one entry per file.
export const readSkillScenarios = () => readdirSync(scenariosDir).filter((file) => file.endsWith('.json')).sort()
  .map((file) => ({ skill: file.replace(/\.json$/u, ''), routing: [], rules: [], ...JSON.parse(readFileSync(join(scenariosDir, file), 'utf8')) }))

// `--no-base` runs only the working tree; `--skill <name>` narrows to one skill's scenarios.
export const evalOptions = () => ({ noBase: process.env.EVAL_NO_BASE === '1', skill: process.env.EVAL_SKILL || null })

// The SKILL.md a test file's rules send, relative to the repository root.
export const skillFile = (skill) => {
  const file = skillRoots.map((root) => `${root}/${skill}/SKILL.md`).find((path) => existsSync(join(repoRoot, path)))
  if (!file) throw new Error(`No SKILL.md for ${skill} under ${skillRoots.join(' or ')}`)
  return file
}
