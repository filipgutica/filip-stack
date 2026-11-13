// Tests for the handoff eval: the goal line that starts the Current state footer,
// and when to rename the thread. Each prompt gives the model its host's rendered
// global guidance, which holds those rules, so handoff.yaml uses host-guidance.mjs's
// prompts and rules.mjs's `scoreRule`.
import { rulesEval } from './rules.mjs'

export const { tests: handoffTests } = rulesEval({
  ruleFiles: [],
  scenarioFile: 'tests/host-config/handoff-scenarios.json',
  role: 'You are the main thread, ending a turn of a task the user authorized.',
})
