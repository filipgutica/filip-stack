#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { workflowPluginRoot, workflowSkillRoot } from './plugin-paths.mjs'

const expectedSkills = [
  'engineering',
  'grill-me',
  'planning',
  'review',
  'technical-writing',
  'walkthrough',
]
const manualSkills = new Set(['grill-me', 'walkthrough'])
const rootPath = fileURLToPath(workflowPluginRoot)
const skillBodies = new Map()
const skillReferences = new Map()
const skillReferenceBodies = new Map()

const exists = async (url) => stat(url).then(() => true, () => false)
const words = (content) => content.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)?.length ?? 0

const skillEntries = await readdir(new URL('skills/', workflowPluginRoot), { withFileTypes: true })
const actualSkills = skillEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
assert.deepEqual(actualSkills, expectedSkills, 'Workflow must expose exactly the six v2 skills')

let totalSkillWords = 0
for (const name of expectedSkills) {
  const skillRoot = workflowSkillRoot(name)
  const skill = await readFile(new URL('SKILL.md', skillRoot), 'utf8')
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? ''
  const body = skill.replace(/^---\n[\s\S]*?\n---\n?/u, '')
  const description = frontmatter.match(/^description:\s*(.+)$/mu)?.[1] ?? ''
  const count = words(skill)
  totalSkillWords += count
  skillBodies.set(name, body)

  assert.match(frontmatter, new RegExp(`^name: ${name}$`, 'm'))
  assert.match(frontmatter, /^description:\s*\S.+$/m)
  assert.ok(words(description) <= 80, `${name} description exceeds 80 words`)
  assert.ok(count <= 900, `${name}/SKILL.md exceeds 900 words (${count})`)
  assert.doesNotMatch(body, /\$workflow:/u, `${name} chains to another public Workflow skill`)

  const metadata = await readFile(new URL('agents/openai.yaml', skillRoot), 'utf8')
  assert.match(metadata, new RegExp(`\\$workflow:${name.replaceAll('-', '\\-')}`))
  assert.match(
    metadata,
    new RegExp(`allow_implicit_invocation: ${manualSkills.has(name) ? 'false' : 'true'}`),
  )

  if (manualSkills.has(name)) {
    assert.match(frontmatter, /^disable-model-invocation: true$/m)
  } else {
    assert.doesNotMatch(frontmatter, /^disable-model-invocation: true$/m)
  }

  const referencesUrl = new URL('references/', skillRoot)
  const referenceEntries = await readdir(referencesUrl, { withFileTypes: true }).catch(() => [])
  const referenceBodies = new Map()
  for (const entry of referenceEntries) {
    assert.ok(entry.isFile(), `${name}/references must stay one level deep`)
    const reference = await readFile(new URL(entry.name, referencesUrl), 'utf8')
    assert.ok(words(reference) <= 1200, `${name}/references/${entry.name} exceeds 1,200 words`)
    referenceBodies.set(entry.name, reference)
  }
  skillReferenceBodies.set(name, referenceBodies)

  const links = [...skill.matchAll(/\]\((references\/[^)]+)\)/gu)].map((match) => match[1])
  skillReferences.set(name, new Set(links.map((link) => link.replace('references/', ''))))
  for (const link of links) {
    assert.ok(await exists(new URL(link, skillRoot)), `${name}/SKILL.md links to missing ${link}`)
  }
}
assert.ok(totalSkillWords <= 3500, `Top-level skills exceed 3,500 words (${totalSkillWords})`)

const requiredContracts = {
  engineering: [
    /production owner, and the nearest existing test/u,
    /State the smallest plan.*owner.*verification signal/u,
    /Do nothing when no change is needed/u,
    /Run the nearest existing test that observes the requested contract.*record the baseline/u,
    /Fix the production owner before changing a correct existing test/u,
    /Change an existing test only when repository evidence proves/u,
    /new or corrected behavior lacks suitable coverage, add one focused observable test/u,
    /Make the smallest causal change/u,
    /standard library.*native platform or framework.*installed dependency/u,
    /one clear owner per responsibility/u,
    /extend existing seams/u,
    /Avoid speculative options, abstractions, dependencies, and adjacent cleanup/u,
    /Minimality must not remove correctness, data integrity, type safety, runtime validation, error handling, security, accessibility, or meaningful tests/u,
    /Rerun the same test and only the affected existing checks/u,
    /Stop when the contract passes/u,
    /Read \[testing and debugging\].*new or corrected behavior, a behavior-preserving refactor, or an unexplained failure/u,
    /Read \[verification tools\].*only when/u,
    /Read \[delegation and review\].*independent owned units or after meaningful edits/u,
    /Meaningful changes use a separate reviewer when available/u,
    /broad, ambiguous, security-sensitive, public-contract, concurrency, or ownership/u,
    /Do not use review as a substitute for a blocked or failed test/u,
    /Map every completion claim to an exact command result or bounded direct evidence/u,
    /Do not report unavailable evidence as passed/u,
    /Do not commit, push, publish, deploy/u,
  ],
  planning: [
    /Select one mode/u,
    /Load only the reference for the selected mode/u,
    /observable completion signal/u,
    /Persist it only when the user requests/u,
  ],
  review: [
    /This route is read-only/u,
    /does not authorize fixes, file edits/u,
    /checks and exact results, and limitations for every review/u,
    /Existing authorization remains valid/u,
  ],
  'grill-me': [
    /Ask exactly one consequential question/u,
    /Do not turn the interview into a generic checklist/u,
    /read-only except for an authorized grill log/u,
  ],
  'technical-writing': [
    /Do not invent behavior, verification, ownership, or rationale/u,
    /Apply \[Simplified Technical English guidance\]\(references\/technical-prose\.md\)/u,
    /code, commands, and identifiers are unchanged/u,
  ],
  walkthrough: [
    /Present one coherent slice at a time/u,
    /read-only except for an authorized walkthrough log/u,
    /every changed file is covered/u,
    /Do not treat silence/u,
  ],
}
for (const [name, patterns] of Object.entries(requiredContracts)) {
  for (const pattern of patterns) {
    assert.match(skillBodies.get(name), pattern, `${name} is missing required workflow guidance`)
  }
}

const requiredReferenceContracts = {
  engineering: {
    'testing-and-debugging.md': [
      /Identify suitable existing coverage.*recording the baseline/u,
      /write one focused test for the requested observable behavior/u,
      /same focused coverage again.*compare it with the baseline/u,
      /Behavior-preserving refactor/u,
      /Trace the value, state, or control flow backward to its owner/u,
    ],
    'delegation-and-review.md': [
      /one outcome/u,
      /owned files or a read-only responsibility/u,
      /The main thread owns integration, scope, and acceptance/u,
      /Broad, ambiguous, security-sensitive, or public-contract changes use an adversarial reviewer/u,
    ],
    'verification-tools.md': [
      /Verification record/u,
      /Do not report a blocked, rejected, timed-out, or unavailable check as passed/u,
    ],
  },
  planning: {
    'plan.md': [
      /## Context/u,
      /## Goal/u,
      /## Non-goals/u,
      /## Success criteria/u,
      /## Bounded subtasks/u,
      /## Files touched/u,
      /## Verification commands/u,
      /## Risks \/ assumptions \/ open questions/u,
      /Each subtask must name/u,
      /owned files or surface/u,
      /narrow verification signal/u,
    ],
    'spec.md': [
      /## Requirements/u,
      /## Design and ownership/u,
      /## Component changes/u,
      /## Verification/u,
    ],
    'tasks-and-tickets.md': [
      /Execution-ready gate/u,
      /verify the current behavior, owner, and location/u,
      /Evidence needed before this is execution-ready/u,
      /one independently reviewable outcome/u,
      /Tracker hierarchy and relationships/u,
      /Verify the project, issue type, parent, ticket key, URL, and relationship direction/u,
      /External parent/u,
      /Story or issue/u,
      /Subtask/u,
      /Source and code links/u,
      /first material reference to code/u,
      /Never put a machine-local path in a ticket/u,
      /Critic pass/u,
      /Could an engineer follow every instruction literally/u,
      /evidence, necessity, clarity, ownership, hierarchy, relationships, duplication, scope, and verification/u,
      /separate reviewer when available/u,
    ],
  },
}
for (const [skillName, references] of Object.entries(requiredReferenceContracts)) {
  for (const [referenceName, patterns] of Object.entries(references)) {
    const reference = skillReferenceBodies.get(skillName)?.get(referenceName)
    assert.ok(reference, `${skillName} is missing required reference ${referenceName}`)
    for (const pattern of patterns) {
      assert.match(reference, pattern, `${skillName}/${referenceName} is missing required guidance`)
    }
  }
}

const codexManifest = JSON.parse(await readFile(new URL('.codex-plugin/plugin.json', workflowPluginRoot), 'utf8'))
assert.equal(codexManifest.skills, './skills')
assert.ok(!('hooks' in codexManifest), 'Workflow v2 must not register runtime hooks')
assert.ok(codexManifest.interface.defaultPrompt.length <= 3, 'Codex shows at most three starter prompts')
assert.ok(
  codexManifest.interface.defaultPrompt.every((prompt) => prompt.length <= 128),
  'Codex starter prompts must not be truncated',
)
assert.ok(!await exists(new URL('hooks/', workflowPluginRoot)), 'Workflow v2 must not package hooks')
assert.ok(!await exists(new URL('scripts/run-node.sh', workflowPluginRoot)), 'Workflow v2 must not package a Node launcher')

const runtimeFiles = await readdir(rootPath, { recursive: true })
assert.deepEqual(
  runtimeFiles.filter((path) => /(?:engineering-workflow|field-guide)\.mjs$/u.test(path)),
  [],
  'Workflow v2 must not package custom storage or Field Guide runtimes',
)

const scenarios = JSON.parse(await readFile(new URL('contract-scenarios.json', import.meta.url), 'utf8'))
assert.equal(scenarios.schemaVersion, 1)
assert.ok(scenarios.scenarios.length >= 15)
assert.equal(new Set(scenarios.scenarios.map((scenario) => scenario.id)).size, scenarios.scenarios.length)
for (const scenario of scenarios.scenarios) {
  assert.ok(
    scenario.expectedSkill === null || expectedSkills.includes(scenario.expectedSkill),
    `${scenario.id} names an unknown skill`,
  )
  assert.ok(['explicit', 'implicit', 'none'].includes(scenario.activation), `${scenario.id} has an invalid activation`)
  if (scenario.expectedReference !== null) {
    assert.ok(
      skillReferences.get(scenario.expectedSkill)?.has(scenario.expectedReference),
      `${scenario.id} expects an unlinked reference`,
    )
  }
}
for (const name of expectedSkills) {
  assert.ok(scenarios.scenarios.some((scenario) => scenario.expectedSkill === name), `${name} has no positive scenario`)
}
for (const name of manualSkills) {
  const matching = scenarios.scenarios.filter((scenario) => scenario.expectedSkill === name)
  assert.ok(matching.length > 0)
  assert.ok(matching.every((scenario) => scenario.activation === 'explicit'))
  assert.ok(scenarios.scenarios.some((scenario) => scenario.id === `${name.replace('-me', '')}-near-miss`))
}
assert.ok(
  scenarios.scenarios.some((scenario) => (
    scenario.id === 'engineering-near-miss'
    && scenario.expectedSkill === null
    && scenario.activation === 'none'
  )),
  'engineering needs an explanation-only negative routing scenario',
)
for (const mode of ['exploration', 'specification', 'plan', 'tasks', 'tickets']) {
  assert.ok(scenarios.scenarios.some((scenario) => scenario.expectedSkill === 'planning' && scenario.mode === mode))
}
for (const id of ['write-ticket-hierarchy', 'review-ticket-draft']) {
  assert.ok(
    scenarios.scenarios.some((scenario) => (
      scenario.id === id
      && scenario.expectedSkill === 'planning'
      && scenario.expectedReference === 'tasks-and-tickets.md'
    )),
    `planning is missing ticket scenario ${id}`,
  )
}

console.log('Workflow v2 structural contracts passed.')
