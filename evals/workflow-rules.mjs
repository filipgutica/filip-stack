// Prompt functions, tests, and assertion for the Workflow rules eval. Each prompt
// gives the model the Workflow files that hold the rules under test, read at
// EVAL_BASE_REF (`baseRules`) or from the working tree (`headRules`).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scenarioTests, scoreChoice } from './host-guidance.mjs'
import { parseReply } from './reply.mjs'

const repoRoot = new URL('../', import.meta.url).pathname
const scenarioFile = 'tests/workflow/workflow-rules-scenarios.json'
const ruleFiles = [
  'plugins/workflow/skills/engineering/references/delegation-and-review.md',
  'plugins/workflow/skills/engineering/references/testing-and-debugging.md',
  'plugins/workflow/skills/test-audit/SKILL.md',
]

// Reads lazily and once per version, so loading this module runs no git command.
const rendered = new Map()
const renderRules = (version) => {
  if (!rendered.has(version)) {
    const ref = process.env.EVAL_BASE_REF ?? 'origin/main'
    const read = (file) => (version === 'head'
      ? readFileSync(join(repoRoot, file), 'utf8')
      : execFileSync('git', ['-C', repoRoot, 'show', `${ref}:${file}`], { encoding: 'utf8' }))
    rendered.set(version, ruleFiles.map((file) => `# ${file}\n\n${read(file)}`).join('\n\n'))
  }
  return rendered.get(version)
}
// Reads both versions, so a bad base ref fails before any model call.
export const prepareRules = () => Boolean(renderRules('base') && renderRules('head'))

const messages = ({ version, vars }) => [
  { role: 'system', content: `${vars.role}\n\n${renderRules(version)}` },
  { role: 'user', content: vars.question },
]
export const baseRules = ({ vars }) => messages({ version: 'base', vars })
export const headRules = ({ vars }) => messages({ version: 'head', vars })

// Each scenario lists its own options as { key: description }.
const optionKeys = Object.fromEntries(JSON.parse(readFileSync(join(repoRoot, scenarioFile), 'utf8')).scenarios
  .map(({ id, options }) => [id, Object.keys(options)]))

export const workflowRulesTests = () => scenarioTests({
  file: scenarioFile,
  role: 'You are a coding agent that follows the Workflow guidance below.',
  question: ({ task, options }) => [
    task,
    `Choose your next action. Do not do it. Reply with only JSON: {"action": "<one of: ${Object.entries(options).map(([key, description]) => `${key} (${description})`).join(', ')}>"}.`,
  ].join('\n\n'),
})

// Models sometimes echo the option's description, so match on the key prefix.
export const scoreWorkflowRule = (output, context) => {
  const reply = parseReply(output)
  const action = String(reply.action ?? '')
  const choice = reply.invalid !== undefined
    ? `invalid reply "${reply.invalid}"`
    : optionKeys[context.test.metadata.scenario].find((key) => action.startsWith(key)) ?? `unknown action ${JSON.stringify(reply.action)}`
  return scoreChoice({ choice, context })
}
