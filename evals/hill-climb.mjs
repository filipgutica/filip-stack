// Prompt functions, tests, and assertion for the hill-climb eval. Each prompt
// gives the model the hill-climb skill and the references its rules live in.
import { rulesEval } from './rules.mjs'

export const {
  prepare: prepareHillClimb,
  base: baseHillClimb,
  head: headHillClimb,
  tests: hillClimbTests,
  score: scoreHillClimb,
} = rulesEval({
  ruleFiles: [
    'skills/hill-climb/SKILL.md',
    'skills/hill-climb/references/guidance.md',
    'skills/hill-climb/references/score.md',
  ],
  scenarioFile: 'tests/skills/hill-climb-scenarios.json',
  role: 'You are the main thread running the hill-climb skill below. The user invoked it, and the climb card is frozen.',
})
