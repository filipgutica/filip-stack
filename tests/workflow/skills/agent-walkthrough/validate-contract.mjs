#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { repositoryRoot, workflowSkillRoot } from '../../plugin-paths.mjs'

const skillRoot = workflowSkillRoot('agent-walkthrough')
const skill = await readFile(new URL('SKILL.md', skillRoot), 'utf8')
const protocol = await readFile(new URL('references/presenter-protocol.md', skillRoot), 'utf8')
const metadata = await readFile(new URL('agents/openai.yaml', skillRoot), 'utf8')
const coordinatorRoot = workflowSkillRoot('coordinator')
const coordinator = await readFile(new URL('SKILL.md', coordinatorRoot), 'utf8')
const flow = await readFile(new URL('references/implementation-flow.md', coordinatorRoot), 'utf8')
const templates = await readFile(new URL('references/subagent-templates.md', coordinatorRoot), 'utf8')
const reviewCycle = await readFile(new URL('../review-cycle/SKILL.md', skillRoot), 'utf8')
const setup = await readFile(new URL('../setup/SKILL.md', skillRoot), 'utf8')
const storage = await readFile(new URL('../setup/references/storage.md', skillRoot), 'utf8')
const scenarios = JSON.parse(await readFile(new URL('contract-scenarios.json', import.meta.url), 'utf8'))
const readme = await readFile(new URL('README.md', repositoryRoot), 'utf8')
const packageJson = JSON.parse(await readFile(new URL('package.json', repositoryRoot), 'utf8'))

const assertContainsAll = (content, patterns) => {
  assert.deepEqual(patterns.filter((pattern) => !pattern.test(content)), [])
}

assertContainsAll(skill, [
  /^name: agent-walkthrough$/m,
  /explicitly requests an automated agent walkthrough/i,
  /named-work-item end-to-end/i,
  /branch-level integration risk/i,
  /read-only presenter/i,
  /fresh.+presenter/i,
  /non-critic profile/i,
  /main thread.+staff reviewer/i,
  /reuse the same presenter/i,
  /one coherent slice at a time/i,
  /exact.+base.+head.+range/is,
  /pull request.+base and head SHAs/is,
  /checkout is at the verified head/i,
  /does not replace.+review tier/i,
  /does not grant implementation authority/i,
  /material product or architecture decision.+user/is,
  /route.+correction.+\$workflow:coordinator/is,
  /revisit.+affected.+slice/i,
  /--reviewer agent/,
  /separate.+correction/i,
  /Use `none` when no correction was made/i,
  /--refresh-range --base-ref <ref>/i,
  /Refresh.+before.+resolved/is,
  /Do not store.+raw transcript/is,
  /presenter-protocol\.md/,
])
assert.doesNotMatch(skill, /^disable-model-invocation: true$/m)

assertContainsAll(protocol, [
  /Role: presenter/,
  /read-only/i,
  /account for every changed file/i,
  /one focused question/i,
  /facts, inferences, and open questions/i,
  /do not edit or accept/i,
])
assertContainsAll(metadata, [
  /display_name: "Agent Walkthrough"/,
  /allow_implicit_invocation: true/,
])
assertContainsAll(coordinator, [
  /Presenter.+read-only/is,
  /selected agent-walkthrough log/i,
])
assertContainsAll(flow, [
  /\$workflow:agent-walkthrough/,
  /after branch-level checks/i,
  /before final acceptance/i,
  /public contract.+producer.+consumer/is,
  /migration, compatibility, or rollout/i,
  /Do not select.+isolated.+documentation/is,
])
assertContainsAll(templates, [
  /Presenter template/,
  /Role: presenter/,
  /non-critic/i,
  /same presenter/i,
])
assert.match(reviewCycle, /Agent Walkthrough.+does not satisfy.+independent review tier/is)
assert.match(setup, /--reviewer <user\|agent>/)
assert.match(setup, /--refresh-range --base-ref <ref>/)
assert.match(storage, /Reviewer.+user.+agent/i)
assert.match(storage, /first open correction before any unresolved table row/i)
assert.match(storage, /recorded head.+ancestor/i)
assert.match(storage, /merge base.+unchanged/i)
assert.match(readme, /`agent-walkthrough`/)

assert.equal(
  packageJson.scripts['test:agent-walkthrough'],
  'node tests/workflow/skills/agent-walkthrough/validate-contract.mjs',
)
assert.match(packageJson.scripts.check, /test:agent-walkthrough/)

assert.equal(scenarios.schemaVersion, 1)
const byId = Object.fromEntries(scenarios.scenarios.map((scenario) => [scenario.id, scenario]))
assert.equal(scenarios.scenarios.length, 9)
assert.equal(byId['explicit-branch-agent-walkthrough'].presenterProfileClass, 'read-only-non-critic')
assert.equal(byId['complex-end-to-end-route'].requiredReviewTierPreserved, true)
assert.equal(byId['routine-end-to-end-route'].expectedActivation, false)
assert.equal(byId['pull-request-range'].providerSpecificWorkflow, false)
assert.equal(byId['clarification-follow-up'].newPresenterAllowed, false)
assert.equal(byId['bounded-correction'].presenterCanEdit, false)
assert.deepEqual(byId['bounded-correction'].expectedCorrectionStatuses, ['open', 'resolved'])
assert.equal(byId['bounded-correction'].refreshBeforeResolution, true)
assert.equal(byId['bounded-correction'].historyContinuity, 'append-only-same-base')
assert.equal(byId['material-decision'].expectedAction, 'return-to-user')
assert.ok(byId['unsafe-log-request'].forbiddenStoredContent.includes('raw-transcript'))
assert.equal(byId['plain-code-review'].expectedRoute, 'normal-review-tier')

console.log('Agent Walkthrough contract passed.')
