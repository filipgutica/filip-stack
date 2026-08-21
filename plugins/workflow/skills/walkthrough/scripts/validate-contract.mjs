#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8')
const patterns = await readFile(new URL('../references/presentation-patterns.md', import.meta.url), 'utf8')
const log = await readFile(new URL('../references/walkthrough-log.md', import.meta.url), 'utf8')
const scenarios = JSON.parse(await readFile(new URL('../evaluations/scenarios.json', import.meta.url), 'utf8'))
const metadata = await readFile(new URL('../agents/openai.yaml', import.meta.url), 'utf8')
const readme = await readFile(new URL('../../../../../README.md', import.meta.url), 'utf8')
const packageJson = JSON.parse(await readFile(new URL('../../../../../package.json', import.meta.url), 'utf8'))

assert.match(skill, /^name: walkthrough$/m)
assert.match(skill, /^disable-model-invocation: true$/m)
assert.match(skill, /last completed agent turn/i)
assert.match(skill, /working tree/i)
assert.match(skill, /branch.+merge base/i)
assert.match(skill, /read-only/i)
assert.match(skill, /Do not edit repository files, commit, push, or publish/i)
assert.match(skill, /external-artifact authority for one walkthrough log/i)
assert.match(skill, /does not grant setup, topic creation, specification, plan, ticket, implementation/i)
assert.match(skill, /creates one curated topic log by default/i)
assert.match(skill, /Create no log before source and topic confirmation/i)
assert.match(skill, /start-walkthrough/)
assert.match(skill, /update-walkthrough/)
assert.match(skill, /summary table/i)
assert.match(skill, /slice name, brief description, and current status/i)
assert.match(skill, /chronological running log/i)
assert.match(skill, /selects the first unresolved slice/i)
assert.match(skill, /after the user resolves a slice/i)
assert.match(skill, /If the user stops early, preserve the unresolved next slice/i)
assert.match(skill, /rejects high-signal credentials, absolute home paths, code fences, and role-labeled transcript lines/i)
assert.match(skill, /one coherent slice at a time/i)
assert.match(skill, /one focused question/i)
assert.match(skill, /Pause for the user's response before the next slice/i)
assert.match(skill, /account for every changed file/i)
assert.match(skill, /verify.+live code.+before classifying/i)
assert.match(skill, /implementation authority/i)
assert.match(skill, /\$workflow:coordinator/)
assert.match(skill, /concern, question, or proposal does not grant implementation authority/i)
assert.match(skill, /pause the walkthrough/i)
assert.match(skill, /record the current slice and coverage state/i)
assert.match(skill, /complete the authorized implementation, verification, and review cycle/i)
assert.match(skill, /refresh the selected diff and coverage map/i)
assert.match(skill, /revisit each changed or superseded slice/i)
assert.match(skill, /resume the walkthrough/i)
assert.match(skill, /Humanizer/i)
assert.match(skill, /\$workflow:ste-writing/)
assert.match(skill, /presentation-patterns\.md/)
assert.match(skill, /covered areas and files/i)
assert.match(skill, /unresolved questions or risks/i)
assert.match(skill, /verification evidence and limits/i)

assert.match(patterns, /code snippet/i)
assert.match(patterns, /inline diff/i)
assert.match(patterns, /table/i)
assert.match(patterns, /Mermaid diagram/i)
assert.match(patterns, /Change:/)
assert.match(patterns, /Behavior:/)
assert.match(patterns, /Decision:/)
assert.match(patterns, /Evidence:/)
assert.match(patterns, /Risk:/)
assert.match(patterns, /Question:/)
assert.match(patterns, /explicitly authorizes a correction/i)
assert.match(patterns, /authorized correction cycle/i)
assert.match(patterns, /Do not store the file list or the full conversational map/i)

assert.match(log, /topics\/open\/<topic-id>\/walkthroughs\/<date>-<sequence>-<slug>\.md/)
assert.match(log, /repository identity, branch, merge base, head, and comparison range/i)
assert.match(log, /after the user resolves each slice/i)
assert.match(log, /`## Slices` table/)
assert.match(log, /`## Running log`/)
assert.match(log, /initial status is `unresolved`/i)
assert.match(log, /Do not use `complete` as a slice name/i)
assert.match(log, /first unresolved table row as the next slice/i)
assert.match(log, /covered, changed, or remains unresolved/i)
assert.match(log, /Do not store a raw transcript, prompt, response, hidden reasoning, full diff, code excerpt/i)
assert.match(log, /machine-local repository path/i)
assert.match(log, /link to `\.\.\/TOPIC\.md`/)
assert.match(log, /Resume the same log after context compaction/i)
assert.match(log, /selects `complete` only when no unresolved row remains/i)

assert.match(metadata, /display_name: "Walkthrough"/)
assert.match(metadata, /short_description: "Review changes interactively and save a curated topic log"/)
assert.match(metadata, /allow_implicit_invocation: false/)
assert.match(readme, /`walkthrough`/)
assert.match(readme, /manual-only.+`walkthrough`|`walkthrough`.+manual-only/i)
assert.equal(
  packageJson.scripts['test:walkthrough'],
  'node plugins/workflow/skills/walkthrough/scripts/validate-contract.mjs',
)
assert.match(packageJson.scripts.check, /test:walkthrough/)

assert.equal(scenarios.schemaVersion, 1)
assert.deepEqual(
  scenarios.scenarios.map(({ id }) => id),
  [
    'explicit-branch-walkthrough',
    'missing-topic-without-setup-authority',
    'implicit-review-request',
    'authorized-correction',
    'early-stop',
    'unsafe-log-content',
  ],
)
assert.equal(scenarios.scenarios[1].expectedLog, 'conversation-only')
assert.ok(scenarios.scenarios[0].expectedLogSections.includes('slice-summary-table'))
assert.ok(scenarios.scenarios[0].expectedLogSections.includes('running-log'))
assert.equal(scenarios.scenarios[0].expectedInitialSliceStatus, 'unresolved')
assert.equal(scenarios.scenarios[2].expectedActivation, false)
assert.equal(scenarios.scenarios[3].implementationInsideWalkthrough, false)
assert.equal(scenarios.scenarios[4].mustNotMarkComplete, true)
assert.equal(scenarios.scenarios[4].expectedTableState, 'remaining-slices-unresolved')
assert.ok(scenarios.scenarios[5].forbiddenStoredContent.includes('raw-transcript'))

console.log('Walkthrough skill contract passed.')
