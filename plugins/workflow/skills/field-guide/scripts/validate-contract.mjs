#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'

const skillUrl = new URL('../SKILL.md', import.meta.url)
const policyUrl = new URL('../references/capture-policy.md', import.meta.url)
const storageUrl = new URL('../references/storage.md', import.meta.url)
const metadataUrl = new URL('../agents/openai.yaml', import.meta.url)
const scenariosUrl = new URL('../evaluations/scenarios.json', import.meta.url)
const memorySchemaUrl = new URL('../schemas/memory-v1.schema.json', import.meta.url)
const submissionSchemaUrl = new URL('../schemas/submission-v1.schema.json', import.meta.url)
const maintenanceSchemaUrl = new URL('../schemas/maintenance-v1.schema.json', import.meta.url)
const lifecycleSchemaUrl = new URL('../schemas/lifecycle-v1.schema.json', import.meta.url)
const retrievalSchemaUrl = new URL('../schemas/retrieval-v1.schema.json', import.meta.url)
const lifecycleHooksUrl = new URL('../references/lifecycle-hooks.md', import.meta.url)
const readmeUrl = new URL('../../../../../README.md', import.meta.url)
const hooksUrl = new URL('../../../hooks/hooks.json', import.meta.url)
const hookAdapterUrl = new URL('../../../hooks/field-guide-lifecycle.mjs', import.meta.url)
const codexManifestUrl = new URL('../../../.codex-plugin/plugin.json', import.meta.url)

const [skill, policy, storage, metadata, scenariosText, memorySchemaText, submissionSchemaText, maintenanceSchemaText, lifecycleSchemaText, retrievalSchemaText, lifecycleHooks, readme, hooksText, hookAdapter, codexManifestText] = await Promise.all([
  readFile(skillUrl, 'utf8'),
  readFile(policyUrl, 'utf8'),
  readFile(storageUrl, 'utf8'),
  readFile(metadataUrl, 'utf8'),
  readFile(scenariosUrl, 'utf8'),
  readFile(memorySchemaUrl, 'utf8'),
  readFile(submissionSchemaUrl, 'utf8'),
  readFile(maintenanceSchemaUrl, 'utf8'),
  readFile(lifecycleSchemaUrl, 'utf8'),
  readFile(retrievalSchemaUrl, 'utf8'),
  readFile(lifecycleHooksUrl, 'utf8'),
  readFile(readmeUrl, 'utf8'),
  readFile(hooksUrl, 'utf8'),
  readFile(hookAdapterUrl, 'utf8'),
  readFile(codexManifestUrl, 'utf8'),
])
const scenarios = JSON.parse(scenariosText)
const hooks = JSON.parse(hooksText)
const codexManifest = JSON.parse(codexManifestText)
const memorySchema = JSON.parse(memorySchemaText)
const submissionSchema = JSON.parse(submissionSchemaText)
const maintenanceSchema = JSON.parse(maintenanceSchemaText)
const lifecycleSchema = JSON.parse(lifecycleSchemaText)
const retrievalSchema = JSON.parse(retrievalSchemaText)

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
assert.match(skill, /Claude's plugin hook adds bounded lifecycle guidance at `UserPromptSubmit`/)
assert.match(skill, /instructs one `capture`, `ask`, or `skip` evaluation before the final response/)
assert.match(skill, /does not register a Codex lifecycle hook/)
assert.match(skill, /Claude hook does not register a `Stop` continuation/)
assert.match(skill, /End-of-task evaluation is instructed but not enforced/)
assert.match(skill, /field-guide\.sh/)
assert.match(skill, /--input-json/)
assert.doesNotMatch(skill, /node scripts\/field-guide\.mjs/)
assert.match(policy, /Capture when every condition is true/)
assert.match(policy, /Ask one focused question/)
assert.match(policy, /Write nothing while the answer is pending/)
assert.match(policy, /Skip when any condition is true/)
assert.match(policy, /Run `candidates` before `submit`/)
assert.match(policy, /Exact duplicates are deterministic/)
assert.match(policy, /At the end of meaningful work, decide `capture`, `ask`, or `skip`/)
assert.match(policy, /A `Stop` continuation does not enforce it/)
assert.match(storage, /review record/i)
assert.match(metadata, /allow_implicit_invocation: true/)
assert.match(metadata, /durable preferences, corrections, repeated misses, and manual learning/)
assert.doesNotMatch(metadata, /only after review feedback/)
assert.match(readme, /obvious durable user preferences, corrections, and repeated misses/)
assert.match(readme, /does not register Codex lifecycle hooks/)
assert.match(readme, /`suppressOutput` is not implemented/)
assert.match(readme, /does not register a `Stop` continuation/)
assert.match(readme, /End-of-task evaluation is instructed but not enforced/)
assert.match(readme, /evaluation is\s+not enforced by a Stop continuation/i)
assert.doesNotMatch(readme, /records? a\s+lesson only after a code-review correction/i)
assert.deepEqual(Object.keys(hooks.hooks).sort(), ['UserPromptSubmit'])
assert.deepEqual(codexManifest.hooks, [])
assert.match(hooks.hooks.UserPromptSubmit[0].hooks[0].command, /^\/bin\/sh .*run-node\.sh.*--fail-open/)
assert.match(hookAdapter, /process\.env\.PLUGIN_ROOT/)
assert.match(hookAdapter, /process\.env\.CLAUDE_PLUGIN_ROOT/)
assert.match(hookAdapter, /if \(input\.hook_event_name === 'Stop'\) return \{\}/)
assert.doesNotMatch(hookAdapter, /transcript_path|last_assistant_message|\.field-guide/)
assert.doesNotMatch(hookAdapter, /field-guide\.sh|\/Users\//)
assert.match(lifecycleHooks, /`PLUGIN_ROOT`/)
assert.match(lifecycleHooks, /`CLAUDE_PLUGIN_ROOT`/)
assert.match(lifecycleHooks, /Codex does not register Workflow lifecycle hooks/)
assert.match(lifecycleHooks, /returns an empty object for direct Stop input/)

assert.equal(scenarios.schemaVersion, 1)
assert.deepEqual(
  new Set(scenarios.scenarios.map(({ category }) => category)),
  new Set(['obvious', 'ambiguous', 'temporary', 'repeated', 'contradictory', 'manual', 'privacy', 'audit']),
)
for (const scenario of scenarios.scenarios) {
  const expectedHosts = scenario.id.startsWith('end-task-') ? ['claude'] : ['claude', 'codex']
  assert.deepEqual(scenario.hosts, expectedHosts)
  assert.match(scenario.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assert.ok(['capture', 'ask', 'skip', 'audit'].includes(scenario.expectedDecision))
}
assert.equal(scenarios.scenarios.find(({ category }) => category === 'ambiguous').expectedDecision, 'ask')
assert.equal(scenarios.scenarios.find(({ category }) => category === 'temporary').expectedDecision, 'skip')
assert.equal(scenarios.scenarios.find(({ category }) => category === 'privacy').expectedDecision, 'skip')
assert.equal(scenarios.scenarios.find(({ category }) => category === 'audit').readOnly, true)
assert.equal(scenarios.scenarios.find(({ id }) => id === 'end-task-durable-correction').expectedDecision, 'capture')
assert.equal(scenarios.scenarios.find(({ id }) => id === 'end-task-ambiguous-learning').expectedDecision, 'ask')
assert.equal(scenarios.scenarios.find(({ id }) => id === 'end-task-no-learning').expectedDecision, 'skip')
assert.equal(scenarios.scenarios.find(({ id }) => id === 'end-task-no-learning').preservesTaskResponse, true)
for (const { lifecycleEvent, enforcement, id } of scenarios.scenarios.filter(({ id }) => id.startsWith('end-task-'))) {
  assert.equal(lifecycleEvent, 'UserPromptSubmit', id)
  assert.equal(enforcement, 'instructed-not-enforced', id)
}

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false })
ajv.addSchema(memorySchema)
const validateSubmissionSchema = ajv.compile(submissionSchema)
const validateMaintenanceSchema = ajv.compile(maintenanceSchema)
const validateLifecycleSchema = ajv.compile(lifecycleSchema)
ajv.compile(retrievalSchema)
const validSubmission = {
  schemaVersion: 1,
  decision: 'capture',
  confidence: 'high',
  scope: 'project',
  subjectKey: 'testing',
  learning: 'Prefer focused schema tests.',
  evidence: {
    summary: 'The user stated a durable preference.',
    pointers: [{
      kind: 'conversation',
      client: 'codex',
      threadId: 'thread-1',
      turnId: 'turn-1',
      url: 'https://example.com/thread/1',
    }],
  },
}
assert.equal(validateSubmissionSchema(validSubmission), true, JSON.stringify(validateSubmissionSchema.errors))
const invalidSubmissions = [
  { mutate: (value) => { value.evidence.pointers[0].messageId = 'message-1' } },
  { mutate: (value) => { value.evidence.pointers[0].url = 'https://example.com/thread?secret=value' } },
  { mutate: (value) => { value.evidence.pointers[0].url = 'https://example.com/thread#fragment' } },
  { mutate: (value) => { value.evidence.pointers[0].url = 'https://example.com/%252FUsers%252Fexample%252Fsecret' } },
  { mutate: (value) => { value.evidence.pointers[0].threadId = `ghp_${'a'.repeat(24)}` } },
  { mutate: (value) => { value.evidence.pointers[0].threadId = '%2FUsers%2Fexample%2Fprivate' } },
  { mutate: (value) => { value.evidence.pointers[0].threadId = 'PASSWORD=secret' } },
  { mutate: (value) => { value.learning = 'PASSWORD=secret' } },
  { mutate: (value) => { value.learning = 'Read https://example.com/%252FUsers%252Fexample%252Fprivate.md' } },
  { mutate: (value) => { value.evidence.pointers = [{ kind: 'local-artifact', repositoryIdentity: 'repo', path: '/Users/example/file.md', contentDigest: `sha256:${'a'.repeat(64)}` }] } },
  { mutate: (value) => { value.evidence.pointers = [{ kind: 'local-artifact', repositoryIdentity: 'repo', path: '../file.md', contentDigest: `sha256:${'a'.repeat(64)}` }] } },
  { mutate: (value) => { value.evidence.pointers = [{ kind: 'commit', repositoryIdentity: 'repo', commit: 'abc' }] } },
]
for (const { mutate } of invalidSubmissions) {
  const input = structuredClone(validSubmission)
  mutate(input)
  assert.equal(validateSubmissionSchema(input), false, JSON.stringify(input))
}
const reviewSubmission = structuredClone(validSubmission)
reviewSubmission.evidence.pointers = [{
  kind: 'review',
  provider: 'github',
  repositoryIdentity: 'github.com/example/repo',
  pullRequestNumber: 1,
  commentId: 'comment-1',
  url: 'https://github.com/example/repo/pull/1#discussion_r1',
}]
assert.equal(validateSubmissionSchema(reviewSubmission), true, JSON.stringify(validateSubmissionSchema.errors))

const archiveMaintenance = {
  schemaVersion: 1,
  action: 'archive',
  targetIds: [`guidance:v1:${'a'.repeat(64)}`],
  reason: 'The user approved archival.',
}
assert.equal(validateMaintenanceSchema(archiveMaintenance), true, JSON.stringify(validateMaintenanceSchema.errors))
assert.equal(validateMaintenanceSchema({ schemaVersion: 1, action: 'repair-cache', reason: 'Repair the derived cache.' }), true)
assert.equal(validateMaintenanceSchema({ schemaVersion: 1, action: 'repair-cache', targetIds: archiveMaintenance.targetIds, reason: 'Invalid targets.' }), false)
assert.equal(validateMaintenanceSchema({ ...archiveMaintenance, apply: true }), false)
const supersedeLifecycle = {
  schemaVersion: 1,
  action: 'supersede',
  targetId: `guidance:v1:${'a'.repeat(64)}`,
  replacementId: `guidance:v1:${'b'.repeat(64)}`,
  confirmed: true,
  reason: 'The user confirmed the correction.',
  source: 'user',
}
assert.equal(validateLifecycleSchema(supersedeLifecycle), true, JSON.stringify(validateLifecycleSchema.errors))
assert.equal(validateLifecycleSchema({ ...supersedeLifecycle, confirmed: false }), false)
assert.equal(validateLifecycleSchema({ ...supersedeLifecycle, action: 'activate' }), false)

console.log('Field Guide contract is valid.')
