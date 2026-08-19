#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const skillUrl = new URL('../SKILL.md', import.meta.url)
const policyUrl = new URL('../references/capture-policy.md', import.meta.url)
const storageUrl = new URL('../references/storage.md', import.meta.url)
const metadataUrl = new URL('../agents/openai.yaml', import.meta.url)
const scenariosUrl = new URL('../evaluations/scenarios.json', import.meta.url)
const readmeUrl = new URL('../../../../../README.md', import.meta.url)

const [skill, policy, storage, metadata, scenariosText, readme] = await Promise.all([
  readFile(skillUrl, 'utf8'),
  readFile(policyUrl, 'utf8'),
  readFile(storageUrl, 'utf8'),
  readFile(metadataUrl, 'utf8'),
  readFile(scenariosUrl, 'utf8'),
  readFile(readmeUrl, 'utf8'),
])
const scenarios = JSON.parse(scenariosText)

assert.match(skill, /capture`, `ask`, or `skip`/)
assert.match(skill, /manual learning requests/)
assert.match(skill, /candidates --repo-root/)
assert.match(skill, /Normal retrieval contains at most five active records and no evidence/)
assert.match(skill, /Current user instructions, live repository contracts, and current code always outrank stored guidance/)
assert.match(skill, /committed code-review evidence as a first-class history path/i)
assert.match(skill, /Field-guide: <Activated\|Saved candidate\|Promoted\|Reinforced>/)
assert.match(skill, /Say "undo that learning"/)
assert.match(skill, /Keep an inferred contradiction as a linked candidate/)
assert.match(skill, /use `transition` with action `supersede`, `confirmed: true`/)
assert.match(skill, /raw transcripts, prompts, credentials/)
assert.match(skill, /rejects high-signal secrets and unsafe source text at the write boundary/)
assert.match(policy, /Capture when every condition is true/)
assert.match(policy, /Ask one focused question/)
assert.match(policy, /Write nothing while the answer is pending/)
assert.match(policy, /Skip when any condition is true/)
assert.match(policy, /Run `candidates` before `submit`/)
assert.match(policy, /Exact duplicates are deterministic/)
assert.match(storage, /review record/i)
assert.match(metadata, /allow_implicit_invocation: true/)
assert.match(metadata, /durable preferences, corrections, repeated misses, and manual learning/)
assert.doesNotMatch(metadata, /only after review feedback/)
assert.match(readme, /obvious durable user preferences, corrections, and repeated misses/)
assert.doesNotMatch(readme, /records? a\s+lesson only after a code-review correction/i)

assert.equal(scenarios.schemaVersion, 1)
assert.deepEqual(
  new Set(scenarios.scenarios.map(({ category }) => category)),
  new Set(['obvious', 'ambiguous', 'temporary', 'repeated', 'contradictory', 'manual', 'privacy', 'audit']),
)
for (const scenario of scenarios.scenarios) {
  assert.deepEqual(scenario.hosts, ['claude', 'codex'])
  assert.match(scenario.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assert.ok(['capture', 'ask', 'skip', 'audit'].includes(scenario.expectedDecision))
}
assert.equal(scenarios.scenarios.find(({ category }) => category === 'ambiguous').expectedDecision, 'ask')
assert.equal(scenarios.scenarios.find(({ category }) => category === 'temporary').expectedDecision, 'skip')
assert.equal(scenarios.scenarios.find(({ category }) => category === 'privacy').expectedDecision, 'skip')
assert.equal(scenarios.scenarios.find(({ category }) => category === 'audit').readOnly, true)

console.log('Field Guide contract is valid.')
