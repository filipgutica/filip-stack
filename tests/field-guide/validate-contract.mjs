#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'
import { fieldGuidePluginRoot, fieldGuideSkillRoot, repositoryRoot } from './plugin-paths.mjs'

const skillRoot = fieldGuideSkillRoot
const skillUrl = new URL('SKILL.md', skillRoot)
const policyUrl = new URL('references/capture-policy.md', skillRoot)
const storageUrl = new URL('references/storage.md', skillRoot)
const metadataUrl = new URL('agents/openai.yaml', skillRoot)
const scenariosUrl = new URL('contract-scenarios.json', import.meta.url)
const memorySchemaUrl = new URL('schemas/memory-v1.schema.json', skillRoot)
const submissionSchemaUrl = new URL('schemas/submission-v1.schema.json', skillRoot)
const maintenanceSchemaUrl = new URL('schemas/maintenance-v1.schema.json', skillRoot)
const lifecycleSchemaUrl = new URL('schemas/lifecycle-v1.schema.json', skillRoot)
const retrievalSchemaUrl = new URL('schemas/retrieval-v1.schema.json', skillRoot)
const lifecycleHooksUrl = new URL('references/lifecycle-hooks.md', skillRoot)
const readmeUrl = new URL('README.md', repositoryRoot)
const hooksUrl = new URL('hooks/hooks.json', fieldGuidePluginRoot)
const hookAdapterUrl = new URL('hooks/field-guide-lifecycle.mjs', fieldGuidePluginRoot)
const codexManifestUrl = new URL('.codex-plugin/plugin.json', fieldGuidePluginRoot)

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
assert.match(skill, /Use the task language as the query/)
assert.match(skill, /Do not guess a subject or broaden a query merely to force a result/)
assert.match(skill, /Current user instructions, live repository contracts, and current code always outrank stored guidance/)
assert.match(skill, /committed code-review evidence as a first-class history path/i)
assert.match(skill, /Field-guide: <Activated\|Saved candidate\|Promoted\|Reinforced>/)
assert.match(skill, /Say "undo that learning"/)
assert.match(skill, /Keep an inferred contradiction as a linked candidate/)
assert.match(skill, /use `transition` with action `supersede`, `confirmed: true`/)
assert.match(skill, /raw transcripts, prompts, credentials/)
assert.match(skill, /rejects high-signal secrets and unsafe source text at the write boundary/)
assert.match(skill, /standalone Field Guide plugin hooks add bounded lifecycle guidance at\s+`UserPromptSubmit`/)
assert.match(skill, /instruct one `capture`, `ask`, or `skip` evaluation\s+before the final response/)
assert.match(skill, /does not register a `Stop` continuation/)
assert.match(skill, /End-of-task evaluation is\s+instructed but not enforced/)
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
assert.match(policy, /current repository is evidence context, not an automatic scope signal/i)
assert.match(policy, /If the resulting guidance remains correct and useful across unrelated repositories, use shared scope/)
assert.match(policy, /If applying it elsewhere could be wrong because it relies on a repository-specific contract, use project scope/)
assert.match(policy, /inferred shared learning still requires independent evidence from two repository identities and `generic: true`/i)
assert.match(policy, /authoritative in current global or project instructions/)
assert.match(policy, /remove the current task, patch, branch, migration, compatibility shim, and temporary condition/i)
assert.match(policy, /Rewording a temporary implementation detail as a general sentence does not make it durable/)
assert.match(storage, /review record/i)
assert.match(storage, /does not define scope or activation for machine-recorded guidance in `memory\.md`/)
assert.match(storage, /explicit portable user preference becomes active shared guidance immediately/)
assert.match(storage, /two or more meaningful terms requires at least two complete-term matches/)
assert.match(storage, /reports a null subject when no hint was used/)
assert.match(storage, /Existing subject-based calls continue to return the requested subject/)
assert.match(metadata, /allow_implicit_invocation: true/)
assert.match(metadata, /durable preferences, corrections, repeated misses, and manual learning/)
assert.doesNotMatch(metadata, /only after review feedback/)
assert.match(readme, /Field Guide is a separate, optional plugin/)
assert.match(readme, /durable preferences,\s+corrections, and recurring lessons/)
assert.match(readme, /Installing it opts into its `UserPromptSubmit` lifecycle/)
assert.match(readme, /Workflow does not invoke or depend on Field Guide/)
assert.doesNotMatch(readme, /records? a\s+lesson only after a code-review correction/i)
assert.deepEqual(Object.keys(hooks.hooks).sort(), ['UserPromptSubmit'])
assert.ok(!('hooks' in codexManifest))
assert.match(hooks.hooks.UserPromptSubmit[0].hooks[0].command, /^\/bin\/sh .*\$\{PLUGIN_ROOT:-\$\{CLAUDE_PLUGIN_ROOT\}\}.*run-node\.sh.*--fail-open/)
assert.match(hookAdapter, /process\.env\.PLUGIN_ROOT/)
assert.match(hookAdapter, /process\.env\.CLAUDE_PLUGIN_ROOT/)
assert.match(hookAdapter, /if \(input\.hook_event_name === 'Stop'\) return \{\}/)
assert.doesNotMatch(hookAdapter, /transcript_path|last_assistant_message|\.field-guide/)
assert.doesNotMatch(hookAdapter, /field-guide\.sh|\/Users\//)
assert.match(lifecycleHooks, /`PLUGIN_ROOT`/)
assert.match(lifecycleHooks, /`CLAUDE_PLUGIN_ROOT`/)
assert.match(lifecycleHooks, /Claude and Codex register only the `UserPromptSubmit` hook/)
assert.match(lifecycleHooks, /returns an empty object for direct Stop input/)

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
assert.equal(scenarios.scenarios.find(({ id }) => id === 'end-task-durable-correction').expectedDecision, 'capture')
assert.equal(scenarios.scenarios.find(({ id }) => id === 'end-task-ambiguous-learning').expectedDecision, 'ask')
assert.equal(scenarios.scenarios.find(({ id }) => id === 'end-task-no-learning').expectedDecision, 'skip')
assert.equal(scenarios.scenarios.find(({ id }) => id === 'end-task-no-learning').preservesTaskResponse, true)
const expectedScopeScenarios = [
  {
    id: 'portable-preference-stated-during-project',
    category: 'obvious',
    hosts: ['claude', 'codex'],
    userMessage: 'Prefer named constants for non-obvious domain thresholds.',
    expectedDecision: 'capture',
    expectedScope: 'shared',
    expectedState: 'active',
    requiresNotice: true,
  },
  {
    id: 'authoritative-preference-duplicate',
    category: 'obvious',
    hosts: ['claude', 'codex'],
    userMessage: 'Prefer destructured object parameters for functions with optional or configuration-style inputs.',
    authoritativeSource: 'global-instructions',
    expectedDecision: 'skip',
    requiresNotice: false,
  },
  {
    id: 'durable-repository-caveat',
    category: 'obvious',
    hosts: ['claude', 'codex'],
    userMessage: "In this repository's fixture catalog, update an existing entry when it covers the same scenario. Add an entry only when the test contract requires an independent case.",
    expectedDecision: 'capture',
    expectedScope: 'project',
    expectedState: 'active',
    requiresNotice: true,
  },
  {
    id: 'task-local-repository-detail',
    category: 'temporary',
    hosts: ['claude', 'codex'],
    userMessage: 'For this fixture patch, update the row we changed earlier.',
    expectedDecision: 'skip',
    requiresNotice: false,
  },
  {
    id: 'temporary-compatibility-shim',
    category: 'temporary',
    hosts: ['claude', 'codex'],
    userMessage: 'Remember to strip legacy aliases at the request boundary while this compatibility shim is in place.',
    expectedDecision: 'skip',
    requiresNotice: false,
  },
  {
    id: 'durable-ambiguous-scope',
    category: 'ambiguous',
    hosts: ['claude', 'codex'],
    userMessage: 'Remember that I prefer updating existing entries instead of adding new ones.',
    expectedDecision: 'ask',
    expectedQuestionFocus: 'shared-or-project-scope',
    requiresNotice: false,
  },
]
for (const expected of expectedScopeScenarios) {
  assert.deepEqual(scenarios.scenarios.find(({ id }) => id === expected.id), expected)
}
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
