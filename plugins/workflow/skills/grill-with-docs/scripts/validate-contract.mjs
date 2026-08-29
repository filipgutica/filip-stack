#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8')
const domainDocs = await readFile(new URL('../references/domain-docs.md', import.meta.url), 'utf8')
const upstream = await readFile(new URL('../references/upstream.md', import.meta.url), 'utf8')
const metadata = await readFile(new URL('../agents/openai.yaml', import.meta.url), 'utf8')
const coordinator = await readFile(new URL('../../coordinator/SKILL.md', import.meta.url), 'utf8')
const scenarios = JSON.parse(await readFile(new URL('../evaluations/scenarios.json', import.meta.url), 'utf8'))
const packageJson = JSON.parse(await readFile(new URL('../../../../../package.json', import.meta.url), 'utf8'))

const assertMatches = (content, patterns) => {
  for (const pattern of patterns) assert.match(content, pattern)
}

assertMatches(skill, [
  /^disable-model-invocation: true$/m,
  /explicit invocation grants repository-document authority/i,
  /selected existing documentation/i,
  /exactly one question at a time/i,
  /recommended answer/i,
  /update the grill log/i,
  /hard to reverse, surprising without context, and based on a real tradeoff/i,
  /does not permit code, configuration, specification, plan, ticket/i,
  /preserve unrelated changes/i,
])

assertMatches(domainDocs, [
  /smallest existing document whose audience needs the resolved information/i,
  /resolve existing documentation and ADR paths through symlinks/i,
  /resolved target or parent to remain inside the live Git root/i,
  /Do not create a general documentation file under this authority/i,
  /Preserve the document's audience, format, and scope/i,
  /Use an existing `CONTEXT\.md`, glossary, or `CONTEXT-MAP\.md` only when the repository already relies on that convention/i,
  /If any condition is false, keep the decision in the grill log and conversation/i,
  /Do not silently rewrite historical rationale/i,
])

assertMatches(upstream, [
  /mattpocock\/skills\/blob\/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76\/skills\/engineering\/grill-with-docs\/SKILL\.md/,
  /mattpocock\/skills\/blob\/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76\/skills\/engineering\/domain-modeling\/SKILL\.md/,
  /mattpocock\/skills\/blob\/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76\/skills\/engineering\/domain-modeling\/CONTEXT-FORMAT\.md/,
  /mattpocock\/skills\/blob\/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76\/skills\/engineering\/domain-modeling\/ADR-FORMAT\.md/,
  /License: MIT/,
])

assertMatches(metadata, [
  /allow_implicit_invocation: false/,
  /\$workflow:grill-with-docs/,
])

assertMatches(coordinator, [
  /Repository-document authority/,
  /selected existing repository documentation and qualifying ADR files/i,
])

assert.equal(scenarios.schemaVersion, 1)
assert.deepEqual(
  scenarios.scenarios.map(({ id }) => id),
  [
    'explicit-grill-with-docs',
    'generic-grill-request',
    'implicit-domain-doc-request',
    'existing-readme-update',
    'ordinary-reversible-decision',
    'qualifying-architecture-decision',
    'unauthorized-code-change',
    'escaping-document-path',
    'missing-document-owner',
  ],
)
assert.equal(scenarios.scenarios[0].expectedQuestionMode, 'one-at-a-time')
assert.equal(scenarios.scenarios[1].expectedActivation, false)
assert.equal(scenarios.scenarios[2].expectedActivation, false)
assert.equal(scenarios.scenarios[3].sessionState, 'active-grill-with-docs')
assert.equal(scenarios.scenarios[3].expectedDocumentKind, 'readme')
assert.equal(scenarios.scenarios[4].adrWrite, false)
assert.deepEqual(
  scenarios.scenarios[5].requiredGates,
  ['costly-to-reverse', 'surprising-without-context', 'real-tradeoff'],
)
assert.equal(scenarios.scenarios[6].repositoryCodeWrite, false)
assert.equal(scenarios.scenarios[7].repositoryDocumentWrite, false)
assert.equal(scenarios.scenarios[8].repositoryDocumentWrite, false)

assert.equal(packageJson.scripts['test:grill-with-docs'], 'node plugins/workflow/skills/grill-with-docs/scripts/validate-contract.mjs')
assert.match(packageJson.scripts.check, /test:grill-with-docs/)

console.log('Grill With Docs contract passed.')
