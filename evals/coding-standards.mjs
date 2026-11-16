// Tests for the coding standards eval. Each prompt gives the model the coding
// standards, the Engineering skill, whose minimality rule a coding standard can pull
// against, and the review guidance that applies them: the Reviewer role and full
// send's council gate, so a scenario can test reviewer and council behavior.
// coding-standards.yaml uses rules.mjs's prompts and `scoreRule`.
import { rulesEval } from './rules.mjs'

export const { tests: codingStandardsTests } = rulesEval({
  ruleFiles: [
    'host-config/agents/CODING_STANDARDS.md',
    'plugins/workflow/skills/engineering/SKILL.md',
    'host-config/agents/roles.md',
    'skills/full-send/references/council-gate.md',
  ],
  scenarioFile: 'tests/host-config/coding-standards-scenarios.json',
  role: 'You are a coding agent that follows the coding standards, roles, and review guidance below.',
})
