// Prompt functions, tests, and assertion for the Workflow rules eval. Each prompt
// gives the model the Workflow files that hold the rules under test.
import { rulesEval } from './rules.mjs'

export const {
  prepare: prepareRules,
  base: baseRules,
  head: headRules,
  tests: workflowRulesTests,
  score: scoreWorkflowRule,
} = rulesEval({
  ruleFiles: [
    'plugins/workflow/skills/engineering/references/delegation-and-review.md',
    'plugins/workflow/skills/engineering/references/testing-and-debugging.md',
    'plugins/workflow/skills/test-audit/SKILL.md',
    'plugins/workflow/skills/planning/SKILL.md',
    'plugins/workflow/skills/planning/references/spec.md',
    'plugins/workflow/skills/planning/references/tickets.md',
  ],
  scenarioFile: 'tests/workflow/workflow-rules-scenarios.json',
  role: 'You are a coding agent that follows the Workflow guidance below.',
})
