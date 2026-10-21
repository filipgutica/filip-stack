#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { workflowPluginRoot, workflowSkillRoot } from './plugin-paths.mjs'

const expectedSkills = [
  'checkpoint',
  'engineering',
  'grill-me',
  'planning',
  'review',
  'simplify',
  'technical-writing',
  'test-audit',
  'walkthrough',
]
const manualSkills = new Set(['checkpoint', 'grill-me', 'simplify', 'walkthrough'])
const rootPath = fileURLToPath(workflowPluginRoot)
const skillBodies = new Map()
const skillReferences = new Map()
const skillReferenceBodies = new Map()

const exists = async (url) => stat(url).then(() => true, () => false)
const words = (content) => content.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)?.length ?? 0

const skillEntries = await readdir(new URL('skills/', workflowPluginRoot), { withFileTypes: true })
const actualSkills = skillEntries
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => entry.name)
  .sort()
assert.deepEqual(actualSkills, expectedSkills, 'Workflow must expose the declared v2 skill inventory')

let totalSkillWords = 0
let otherSkillWords = 0
for (const name of expectedSkills) {
  const skillRoot = workflowSkillRoot(name)
  const skill = await readFile(new URL('SKILL.md', skillRoot), 'utf8')
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? ''
  const body = skill.replace(/^---\n[\s\S]*?\n---\n?/u, '')
  const description = frontmatter.match(/^description:\s*(.+)$/mu)?.[1] ?? ''
  const count = words(skill)
  totalSkillWords += count
  if (name !== 'simplify') otherSkillWords += count
  skillBodies.set(name, body)

  assert.match(frontmatter, new RegExp(`^name: ${name}$`, 'm'))
  assert.match(frontmatter, /^description:\s*\S.+$/m)
  assert.ok(words(description) <= 80, `${name} description exceeds 80 words`)
  assert.ok(count <= 900, `${name}/SKILL.md exceeds 900 words (${count})`)
  const publicCalls = [...body.matchAll(/\$workflow:([a-z-]+)/gu)].map((match) => match[1])
  assert.ok(
    publicCalls.every((target) => ['engineering', 'review'].includes(name) && target === 'test-audit'),
    `${name} has an undeclared public skill dependency`,
  )

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
assert.ok(otherSkillWords <= 3500, `Skills other than Simplify exceed 3,500 words (${otherSkillWords})`)
assert.ok(totalSkillWords <= 4000, `Top-level skills exceed 4,000 words (${totalSkillWords})`)

// Lock only authority boundaries and the few rules other skills or global
// guidance depend on; routing behavior is covered by contract scenarios.
const requiredContracts = {
  engineering: [
    /Fix the production owner before changing a correct existing test/u,
    /new bug regression test fails on the pre-fix code for the expected reason/u,
    /Minimality must not remove correctness, data integrity, type safety, runtime validation, error handling, security, accessibility, or meaningful tests/u,
    /\[coverage record\]\(\.\.\/test-audit\/references\/value-criteria\.md#coverage-record\)/u,
    /Invoke \$workflow:test-audit for an explicit test audit or cleanup, substantial coverage changes, or uncertainty/u,
    /Read \[delegation and review\]\(references\/delegation-and-review\.md\)/u,
    /Do not report unavailable evidence as passed/u,
    /Do not commit, push, publish, deploy/u,
  ],
  planning: [
    /Load only the reference for the selected mode/u,
    /Planning does not authorize code changes, commits, publishing, or tracker edits/u,
    /Persist it only when the user requests/u,
  ],
  review: [
    /This route is read-only/u,
    /does not authorize fixes, file edits/u,
    /check the change against their relevant\s+requirements/u,
    /Invoke \$workflow:test-audit when requested, when coverage changes are substantial, or when test value or preservation is uncertain/u,
    /\[delegation and review\]\(\.\.\/engineering\/references\/delegation-and-review\.md\)/u,
    /checks and exact results, and limitations for every review/u,
  ],
  'grill-me': [
    /Ask exactly one consequential question/u,
    /read-only except for an authorized grill log/u,
  ],
  'technical-writing': [
    /Do not invent behavior, verification, ownership, or rationale/u,
    /code, commands, and identifiers are unchanged/u,
  ],
  simplify: [
    /Run only when the user invokes this skill/u,
    /three independent, read-only assessments/u,
    /report the incomplete review and stop before editing/u,
    /Keep one writer in the main thread/u,
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
  walkthrough: {
    'presentation-patterns.md': [
      /Lesson:.*\nExample:.*\nTry it:.*\nObserve:/u,
      /Agent execution requires existing authorization/u,
      /Keep expected results separate from observed results/u,
    ],
    'walkthrough-log.md': [
      /Keep exercise outcomes separate from acceptance/u,
    ],
  },
  engineering: {
    'delegation-and-review.md': [
      /The main thread owns integration, scope, and acceptance/u,
      /Review is independent only when a reviewer that did not author the change/u,
      /Advice and planning do not replace required review/u,
    ],
    'verification-tools.md': [
      /Do not report a blocked, rejected, timed-out, or unavailable check as passed/u,
    ],
  },
  planning: {
    'tickets.md': [
      /Evidence needed before this is execution-ready/u,
      /Never put a machine-local path in a ticket/u,
    ],
  },
  'test-audit': {
    'value-criteria.md': [
      /the last proof of a current behavior or acceptance criterion/u,
      /## Coverage record/u,
      /removed test: one remaining test that runs the removed case's inputs/u,
      /when the contract itself is obsolete/u,
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
for (const mode of ['exploration', 'specification', 'plan', 'tickets']) {
  assert.ok(scenarios.scenarios.some((scenario) => scenario.expectedSkill === 'planning' && scenario.mode === mode))
}
for (const id of ['write-ticket-hierarchy', 'review-ticket-draft']) {
  assert.ok(
    scenarios.scenarios.some((scenario) => (
      scenario.id === id
      && scenario.expectedSkill === 'planning'
      && scenario.expectedReference === 'tickets.md'
    )),
    `planning is missing ticket scenario ${id}`,
  )
}

console.log('Workflow v2 structural contracts passed.')
