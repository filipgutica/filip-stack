// Tests for the host rules eval: host guidance rules that no other test covers,
// such as where a thread does its work. Each prompt gives the model its host's
// rendered global guidance, which holds those rules, so host-rules.yaml uses
// host-guidance.mjs's prompts and rules.mjs's `scoreRule`.
import { rulesEval } from './rules.mjs'

export const { tests: hostRulesTests } = rulesEval({
  ruleFiles: [],
  scenarioFile: 'tests/host-config/host-rules-scenarios.json',
  role: 'You are a coding agent in T3 Code. You can run git commands, and you can call t3_worktree_handoff to move this thread into a new worktree.',
})
