// Prompt functions, tests, and assertion for the retrieval eval. Each prompt gives
// the model the global guidance and the Field Guide skill, which hold the retrieval
// and citation rules under test.
import { rulesEval } from './rules.mjs'

export const {
  prepare: prepareRetrieval,
  base: baseRetrieval,
  head: headRetrieval,
  tests: retrievalTests,
  score: scoreRetrieval,
} = rulesEval({
  ruleFiles: [
    'host-config/guidance/core.md',
    'plugins/field-guide/skills/field-guide/SKILL.md',
  ],
  scenarioFile: 'tests/host-config/retrieval-scenarios.json',
  role: 'You are a coding agent that follows the guidance below. The Field Guide plugin is installed.',
})
