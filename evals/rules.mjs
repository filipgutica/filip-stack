// Builds the rules evals. Each test names the guidance files its prompt sends in
// `vars.files`, read at EVAL_BASE_REF (`baseRules`) or from the working tree
// (`headRules`), and asks the model to pick one of the scenario's options.
// - `rulesEval` builds an eval over a fixed set of files, such as workflow-rules.
// - `skillRulesTests` sends the SKILL.md of the skill whose test file holds each scenario.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scenarioTests, scenariosIn, scoreChoice } from './host-guidance.mjs'
import { parseReply } from './reply.mjs'
import { evalOptions, readSkillScenarios, skillFile } from './skill-scenarios.mjs'

const repoRoot = new URL('../', import.meta.url).pathname

// Reads lazily and once per version and file list, so loading a rules module runs no git command.
const rendered = new Map()
const renderFiles = (version, files) => {
  const key = `${version}\n${files}`
  if (!rendered.has(key)) {
    const list = files.split('\n')
    const ref = process.env.EVAL_BASE_REF ?? 'origin/main'
    const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    // A bad ref throws here; a rule file the base does not have yet is left out of the base.
    if (version === 'base') git('rev-parse', '--verify', `${ref}^{commit}`)
    const atBase = new Set(version === 'base' ? git('ls-tree', '-r', '--name-only', ref, '--', ...list).split('\n') : list)
    const read = (file) => (version === 'head' ? readFileSync(join(repoRoot, file), 'utf8') : git('show', `${ref}:${file}`))
    rendered.set(key, list.filter((file) => atBase.has(file)).map((file) => `# ${file}\n\n${read(file)}`).join('\n\n'))
  }
  return rendered.get(key)
}

// Reads every file the selected tests send, so a read error fails before any model call.
const prepareRules = ({ tests, noBase }) => {
  for (const { vars } of tests) for (const version of noBase ? ['head'] : ['base', 'head']) renderFiles(version, vars.files)
}

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

// `vars.files` is a newline-separated string: promptfoo expands an array var into
// separate tests. `metadata.options` holds the keys the assertion classifies against.
const ruleTests = ({ scenarios, role, files }) => scenarioTests({ scenarios, role, question })
  .map((test, index) => ({
    ...test,
    vars: { ...test.vars, files: files.join('\n') },
    metadata: { ...test.metadata, options: Object.keys(scenarios[index].options) },
  }))

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

export const rulesEval = ({ ruleFiles, scenarioFile, role }) => ({
  prepare: prepareRules,
  base: baseRules,
  head: headRules,
  tests: () => ruleTests({ scenarios: scenariosIn(scenarioFile), role, files: ruleFiles }),
  score: scoreRule,
})

export const skillRulesTests = () => {
  const { skill: only } = evalOptions()
  return readSkillScenarios()
    .filter(({ skill, rules }) => rules.length > 0 && (!only || skill === only))
    .flatMap(({ skill, rules }) => ruleTests({ scenarios: rules, role: `You are a coding agent running the ${skill} skill below.`, files: [skillFile(skill)] })
      .map((test) => ({ ...test, metadata: { ...test.metadata, owner: skill } })))
}
