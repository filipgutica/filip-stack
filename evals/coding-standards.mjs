// Tests for the coding standards eval. Each prompt gives the model the coding
// standards and the Engineering skill, whose minimality rule a coding standard can
// pull against, so coding-standards.yaml uses rules.mjs's prompts and `scoreRule`.
import { rulesEval } from './rules.mjs'

export const { tests: codingStandardsTests } = rulesEval({
  ruleFiles: [
    'host-config/agents/CODING_STANDARDS.md',
    'plugins/workflow/skills/engineering/SKILL.md',
  ],
  scenarioFile: 'tests/host-config/coding-standards-scenarios.json',
  role: 'You are a coding agent that follows the coding standards and Workflow guidance below.',
})
