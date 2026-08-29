#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8')
const flow = await readFile(new URL('../references/implementation-flow.md', import.meta.url), 'utf8')
const investigationFlow = await readFile(new URL('../references/investigation-flow.md', import.meta.url), 'utf8')
const subagentTemplates = await readFile(new URL('../references/subagent-templates.md', import.meta.url), 'utf8')
const metadata = await readFile(new URL('../agents/openai.yaml', import.meta.url), 'utf8')
const branchPlanner = await readFile(new URL('../../branch-task-planner/SKILL.md', import.meta.url), 'utf8')
const branchPlannerMetadata = await readFile(new URL('../../branch-task-planner/agents/openai.yaml', import.meta.url), 'utf8')
const implementation = await readFile(new URL('../../implementation/SKILL.md', import.meta.url), 'utf8')
const implementationMetadata = await readFile(new URL('../../implementation/agents/openai.yaml', import.meta.url), 'utf8')
const reviewCycle = await readFile(new URL('../../review-cycle/SKILL.md', import.meta.url), 'utf8')
const reviewCycleMetadata = await readFile(new URL('../../review-cycle/agents/openai.yaml', import.meta.url), 'utf8')
const scenarios = JSON.parse(await readFile(new URL('../evaluations/scenarios.json', import.meta.url), 'utf8'))
const readme = await readFile(new URL('../../../../../README.md', import.meta.url), 'utf8')
const packageJson = JSON.parse(await readFile(new URL('../../../../../package.json', import.meta.url), 'utf8'))

assert.match(skill, /Named-work-item end-to-end authority/)
assert.match(skill, /ticket, specification, or plan/i)
assert.match(skill, /active slice/i)
assert.match(skill, /outcome, boundary, and verification signal/i)
assert.match(skill, /decision-complete/i)
assert.match(skill, /material scope conflict/i)

assert.match(flow, /named-work-item end-to-end route/i)
assert.match(flow, /direct execution or plan composition/i)
assert.match(flow, /Do not create individual tickets/i)
assert.match(flow, /Recommend deferral and continue the active slice/i)
assert.match(flow, /Do not record deferred work until the user selects and authorizes a destination/i)
assert.match(flow, /Explicit priority replacement/i)
assert.match(flow, /user acceptance checkpoint/i)
assert.match(investigationFlow, /user-invoked code review.*select one reviewer tier/is)

assert.match(subagentTemplates, /user-invoked code review/i)
assert.match(subagentTemplates, /Correctness:/)
assert.match(subagentTemplates, /Coding standards:/)
assert.match(subagentTemplates, /Efficiency:/)
assert.match(subagentTemplates, /Reuse:/)
assert.match(subagentTemplates, /Do not create separate reviewer agents unless distinct risk justifies independent review/i)

assert.match(branchPlanner, /named-work-item end-to-end/i)
assert.match(branchPlanner, /ticket, specification, or plan/i)
assert.match(branchPlanner, /Primary work item:.*SPEC\.md.*PLAN\.md/s)
assert.match(branchPlannerMetadata, /named-work-item/i)

assert.match(implementation, /active slice/i)
assert.match(implementation, /conceptual change/i)
assert.match(implementation, /commit or verification boundary/i)
assert.match(implementation, /product or architecture decision/i)
assert.match(implementation, /adjacent cleanup/i)
assert.match(implementationMetadata, /active slice/i)

assert.match(reviewCycle, /compare the final diff with the active slice/i)
assert.match(reviewCycle, /preserve unrelated user changes/i)
assert.match(reviewCycle, /user acceptance checkpoint/i)
assert.match(reviewCycle, /accept, revise, inspect, or delegate acceptance/i)
assert.match(reviewCycleMetadata, /active slice/i)
assert.match(reviewCycleMetadata, /user acceptance/i)

assert.match(metadata, /Named-work-item end-to-end authority/)
assert.match(readme, /Named-work-item end-to-end authority/)

assert.equal(packageJson.scripts['test:coordinator'], 'node plugins/workflow/skills/coordinator/scripts/validate-contract.mjs')
assert.match(packageJson.scripts.check, /test:coordinator/)

assert.equal(scenarios.schemaVersion, 1)
assert.deepEqual(
  scenarios.scenarios.map(({ id }) => id),
  [
    'bounded-specification-direct',
    'specification-to-plan',
    'bounded-plan-direct',
    'named-ticket',
    'meaningful-active-slice',
    'mid-slice-status',
    'mid-slice-independent-change',
    'mid-slice-product-decision',
    'explicit-priority-replacement',
    'default-acceptance',
    'end-to-end-acceptance',
    'tiny-fast-path',
    'user-invoked-code-review',
  ],
)
assert.equal(scenarios.scenarios[0].createTickets, false)
assert.equal(scenarios.scenarios[1].composePlan, true)
assert.deepEqual(scenarios.scenarios[4].requiredFields, ['outcome', 'boundary', 'verification'])
assert.equal(scenarios.scenarios[6].writeDeferredWork, false)
assert.equal(scenarios.scenarios[9].commitAllowed, false)
assert.equal(scenarios.scenarios[10].commitAllowed, true)
assert.equal(scenarios.scenarios[11].requiresVisibleActiveSlice, false)
assert.deepEqual(
  scenarios.scenarios[12].requiredLenses,
  ['correctness', 'coding-standards', 'efficiency', 'reuse'],
)
assert.equal(scenarios.scenarios[12].expectedRoute, 'one-independent-reviewer')
assert.equal(scenarios.scenarios[12].separateReviewerPerLens, false)

console.log('Coordinator active-slice contract passed.')
