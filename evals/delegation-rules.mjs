// Tests for the delegation rules eval: how a delegated brief and an escalation
// change, as opposed to where the work runs, which delegation scenarios score.
// Each prompt gives the model its host's rendered global guidance, which holds
// those rules, so delegation-rules.yaml uses host-guidance.mjs's prompts and
// rules.mjs's `scoreRule`.
import { rulesEval } from './rules.mjs'

export const { tests: delegationRulesTests } = rulesEval({
  ruleFiles: [],
  scenarioFile: 'tests/host-config/delegation-rules-scenarios.json',
  role: 'You are the main thread in T3 Code, partway through a task the user authorized. You can delegate to the roles and models the guidance names.',
})
