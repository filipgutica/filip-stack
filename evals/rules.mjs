// Prompt functions, tests, and assertion for the rules guidance tests. Each prompt
// gives the model the files that hold the rules under test, read at EVAL_BASE_REF
// (`baseRules`) or from the working tree (`headRules`):
// - workflow-rules: the Workflow files that hold rules no other test covers.
// - skill-rules: the SKILL.md of the standalone skill, or Field Guide, that owns each scenario.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scenarioTests, scenariosIn, scoreChoice } from './host-guidance.mjs'
import { parseReply } from './reply.mjs'
import { evalOptions, readSkillScenarios, skillFile } from './skill-scenarios.mjs'

const repoRoot = new URL('../', import.meta.url).pathname
const workflowScenarioFile = 'tests/workflow/workflow-rules-scenarios.json'
const workflowRuleFiles = [
  'plugins/workflow/skills/engineering/references/delegation-and-review.md',
  'plugins/workflow/skills/engineering/references/testing-and-debugging.md',
  'plugins/workflow/skills/test-audit/SKILL.md',
]

// A file missing at a version renders empty, so a new skill's rules fail at the base.
const readAt = (version, file) => {
  if (version === 'head') return existsSync(join(repoRoot, file)) ? readFileSync(join(repoRoot, file), 'utf8') : ''
  try {
    return execFileSync('git', ['-C', repoRoot, 'show', `${process.env.EVAL_BASE_REF ?? 'origin/main'}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    return ''
  }
}

// Reads lazily and once per process, so loading this module runs no git command.
const rendered = new Map()
const renderFiles = (version, files) => {
  const key = `${version}\n${files}`
  if (!rendered.has(key)) rendered.set(key, files.split('\n').map((file) => `# ${file}\n\n${readAt(version, file)}`).join('\n\n'))
  return rendered.get(key)
}

// Reads every file the selected tests send, so a read error fails before any model call.
export const prepareRules = ({ tests, noBase }) => {
  for (const { vars } of tests) for (const version of noBase ? ['head'] : ['base', 'head']) renderFiles(version, vars.files)
}

// `vars.files` is a newline-separated string: promptfoo expands an array var into separate tests.
const messages = ({ version, vars }) => [
  { role: 'system', content: `${vars.role}\n\n${renderFiles(version, vars.files)}` },
  { role: 'user', content: vars.question },
]
export const baseRules = ({ vars }) => messages({ version: 'base', vars })
export const headRules = ({ vars }) => messages({ version: 'head', vars })

const question = ({ task, options }) => [
  task,
  `Choose your next action. Do not do it. Reply with only JSON: {"action": "<one of: ${Object.entries(options).map(([key, description]) => `${key} (${description})`).join(', ')}>"}.`,
].join('\n\n')

// Adds the rule files and the option keys the assertion classifies against.
const withRules = ({ files, options }) => (test) => ({ ...test, vars: { ...test.vars, files: files.join('\n') }, metadata: { ...test.metadata, options: Object.keys(options) } })

export const workflowRulesTests = () => {
  const scenarios = scenariosIn(workflowScenarioFile)
  return scenarioTests({ scenarios, role: 'You are a coding agent that follows the Workflow guidance below.', question })
    .map((test, index) => withRules({ files: workflowRuleFiles, options: scenarios[index].options })(test))
}

export const skillRulesTests = () => {
  const { skill: only } = evalOptions()
  return readSkillScenarios()
    .filter(({ skill }) => !only || skill === only)
    .flatMap(({ skill, rules }) => scenarioTests({ scenarios: rules, role: `You are a coding agent running the ${skill} skill below.`, question })
      .map((test, index) => withRules({ files: [skillFile(skill)], options: rules[index].options })({ ...test, metadata: { ...test.metadata, owner: skill } })))
}

// Models sometimes echo the option's description, so match on the key prefix. The
// longest key matches first, so "designer" is not read as a "design" option.
export const scoreRule = (output, context) => {
  const reply = parseReply(output)
  const action = String(reply.action ?? '')
  const keys = context.test.metadata.options.toSorted((a, b) => b.length - a.length)
  const choice = reply.invalid !== undefined
    ? `invalid reply "${reply.invalid}"`
    : keys.find((key) => action.startsWith(key)) ?? `unknown action ${JSON.stringify(reply.action)}`
  return scoreChoice({ choice, context })
}
