#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { repositoryRoot, workflowSkillRoot } from '../../plugin-paths.mjs'

const skillRoot = workflowSkillRoot('walkthrough')
const skill = await readFile(new URL('SKILL.md', skillRoot), 'utf8')
const patterns = await readFile(new URL('references/presentation-patterns.md', skillRoot), 'utf8')
const log = await readFile(new URL('references/walkthrough-log.md', skillRoot), 'utf8')
const scenarios = JSON.parse(await readFile(new URL('contract-scenarios.json', import.meta.url), 'utf8'))
const metadata = await readFile(new URL('agents/openai.yaml', skillRoot), 'utf8')
const setup = await readFile(new URL('../setup/SKILL.md', skillRoot), 'utf8')
const storage = await readFile(new URL('../setup/references/storage.md', skillRoot), 'utf8')
const readme = await readFile(new URL('README.md', repositoryRoot), 'utf8')
const packageJson = JSON.parse(await readFile(new URL('package.json', repositoryRoot), 'utf8'))
const assertContainsAll = (content, patterns) => {
  const missing = patterns.filter((pattern) => !pattern.test(content))
  assert.deepEqual(missing, [])
}

assertContainsAll(skill, [
  /^name: walkthrough$/m,
  /^disable-model-invocation: true$/m,
  /last completed agent turn/i,
  /working tree/i,
  /branch.+merge base/i,
  /read-only/i,
  /Do not edit repository files, commit, push, or publish/i,
  /external-artifact authority for one walkthrough log/i,
  /does not grant setup, topic creation, specification, plan, ticket, implementation/i,
  /creates one curated topic log by default/i,
  /Create no log before source and topic confirmation/i,
  /start-walkthrough/,
  /--reviewer user/,
  /update-walkthrough/,
  /summary table/i,
  /slice name, brief description, and current status/i,
  /chronological running log/i,
  /corrections table/i,
  /valid finding requires a correction or change/i,
  /even when the user has not granted implementation authority/i,
  /Mark the correction `resolved`/i,
  /Mark it `deferred`/i,
  /Keep a correction `open`/i,
  /returns to an open correction before it selects the first unresolved slice/i,
  /after the user resolves a slice/i,
  /If the user stops early, preserve the unresolved next slice/i,
  /rejects high-signal credentials, absolute home paths, code fences, and role-labeled transcript lines/i,
  /one coherent slice at a time/i,
  /one focused question/i,
  /Pause for the user's response before the next slice/i,
  /account for every changed file/i,
  /verify.+live code.+before classifying/i,
  /implementation authority/i,
  /\$workflow:coordinator/,
  /concern, question, or proposal does not grant implementation authority/i,
  /pause the walkthrough/i,
  /record the current slice, coverage state/i,
  /complete the authorized implementation, verification, and review cycle/i,
  /refresh the selected diff and coverage map/i,
  /revisit each changed or superseded slice/i,
  /resume the walkthrough/i,
  /Humanizer/i,
  /\$workflow:ste-writing/,
  /presentation-patterns\.md/,
  /covered areas and files/i,
  /unresolved questions or risks/i,
  /verification evidence and limits/i,
])

assertContainsAll(patterns, [
  /code snippet/i,
  /inline diff/i,
  /table/i,
  /Mermaid diagram/i,
  /Change:/,
  /Behavior:/,
  /Decision:/,
  /Evidence:/,
  /Risk:/,
  /Question:/,
  /explicitly authorizes a correction/i,
  /authorized correction cycle/i,
  /Do not store the file list or the full conversational map/i,
])

assertContainsAll(log, [
  /topics\/open\/<topic-id>\/walkthroughs\/<date>-<sequence>-<slug>\.md/,
  /repository identity, branch, merge base, head, and comparison range/i,
  /Reviewer as `user` or `agent`/i,
  /legacy logs without the field remain valid/i,
  /after the reviewer resolves each slice/i,
  /`## Slices` table/,
  /`## Corrections` table/,
  /stable ID, slice name, correction, and status/i,
  /`open`.+still needs work/i,
  /`resolved`.+verification are complete/i,
  /`deferred`.+postponed/i,
  /--correction <text>/i,
  /--correction-id <id>/i,
  /Existing logs without a `## Corrections` section remain valid/i,
  /`## Running log`/,
  /initial status is `unresolved`/i,
  /Do not use `complete` as a slice name/i,
  /first open correction before any unresolved table row/i,
  /covered, changed, or remains unresolved/i,
  /Corrections: <id>.+Corrections: none/i,
  /Do not store a raw transcript, prompt, response, hidden reasoning, full diff, code excerpt/i,
  /machine-local repository path/i,
  /link to `\.\.\/TOPIC\.md`/,
  /Resume the same log after context compaction/i,
  /selects `complete` only when no open correction and no unresolved row remain/i,
  /--refresh-range --base-ref <ref>/i,
  /stale branch range/i,
])

assertContainsAll(metadata, [
  /display_name: "Walkthrough"/,
  /short_description: "Review changes interactively and save a curated topic log"/,
  /allow_implicit_invocation: false/,
])
assertContainsAll(setup, [
  /--correction <text> --correction-status open/,
  /--correction-id <id> --correction-status <resolved\|deferred>/,
  /Use that ID with `--correction-id`/i,
  /--refresh-range --base-ref <ref>/i,
  /before marking.+resolved/i,
])
assertContainsAll(storage, [
  /corrections table follows the summary table/i,
  /Existing logs without this table remain valid/i,
  /first open correction before any unresolved table row/i,
  /recorded head.+ancestor/i,
])
assertContainsAll(readme, [
  /`walkthrough`/,
  /manual-only.+`walkthrough`|`walkthrough`.+manual-only/i,
])
assert.equal(
  packageJson.scripts['test:walkthrough'],
  'node tests/workflow/skills/walkthrough/validate-contract.mjs',
)
assert.match(packageJson.scripts.check, /test:walkthrough/)

assert.equal(scenarios.schemaVersion, 1)
const scenarioById = Object.fromEntries(scenarios.scenarios.map((scenario) => [scenario.id, scenario]))
assert.equal(scenarios.scenarios.length, 7)
assert.ok(scenarioById['valid-correction-without-implementation-authority'])
assert.equal(scenarios.scenarios[1].expectedLog, 'conversation-only')
assert.ok(scenarios.scenarios[0].expectedLogSections.includes('slice-summary-table'))
assert.ok(scenarios.scenarios[0].expectedLogSections.includes('running-log'))
assert.equal(scenarios.scenarios[0].expectedInitialSliceStatus, 'unresolved')
assert.equal(scenarios.scenarios[2].expectedActivation, false)
assert.equal(scenarios.scenarios[3].implementationInsideWalkthrough, false)
assert.deepEqual(scenarios.scenarios[3].expectedCorrectionStatus, ['open', 'resolved'])
assert.equal(scenarios.scenarios[4].expectedCorrectionStatus, 'open')
assert.equal(scenarios.scenarios[4].repositoryWrite, false)
assert.equal(scenarios.scenarios[5].mustNotMarkComplete, true)
assert.equal(scenarios.scenarios[5].expectedTableState, 'remaining-slices-unresolved')
assert.equal(scenarios.scenarios[5].expectedCorrectionState, 'preserved')
assert.ok(scenarios.scenarios[6].forbiddenStoredContent.includes('raw-transcript'))

console.log('Walkthrough skill contract passed.')
