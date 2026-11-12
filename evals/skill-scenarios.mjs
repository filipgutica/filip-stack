// Reads the per-skill guidance test files in tests/skills/scenarios/<skill>.json and
// the options `run.mjs` passes to promptfoo through the environment.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const scenariosDir = new URL('../tests/skills/scenarios/', import.meta.url).pathname

// Returns [{ skill, routing, rules }], one entry per file.
export const readSkillScenarios = () => readdirSync(scenariosDir).filter((file) => file.endsWith('.json')).sort()
  .map((file) => ({ skill: file.replace(/\.json$/u, ''), routing: [], rules: [], ...JSON.parse(readFileSync(join(scenariosDir, file), 'utf8')) }))

// `--no-base` runs only the working tree; `--skill <name>` narrows to one skill's scenarios.
export const evalOptions = () => ({ noBase: process.env.EVAL_NO_BASE === '1', skill: process.env.EVAL_SKILL || null })
