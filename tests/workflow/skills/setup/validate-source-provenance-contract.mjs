#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { repositoryRoot, workflowSkillRoot } from '../../plugin-paths.mjs'

const setupRoot = workflowSkillRoot('setup')
const read = (path) => readFile(new URL(path, setupRoot), 'utf8')

const [
  storage,
  ledger,
  planningFlow,
  implementationFlow,
  specFormat,
  plans,
  tickets,
  specToTickets,
  prDescriptions,
  readme,
] = await Promise.all([
  read('references/storage.md'),
  read('../branch-task-planner/SKILL.md'),
  read('../coordinator/references/planning-flow.md'),
  read('../coordinator/references/implementation-flow.md'),
  read('../writing-specs/references/erd-format.md'),
  read('../writing-plans/SKILL.md'),
  read('../writing-tickets/SKILL.md'),
  read('../spec-to-tickets/SKILL.md'),
  read('../writing-pr-descriptions/SKILL.md'),
  readFile(new URL('README.md', repositoryRoot), 'utf8'),
])

const localTickets = storage.split('\n## ').find((section) => section.startsWith('Local tickets\n'))
const ledgerSources = ledger.match(/Add this Sources block before Context:\n\n```md\n([\s\S]*?)\n```/)?.[1]

assert.ok(localTickets, 'Storage must define the Local tickets section')
assert.ok(ledgerSources, 'The branch ledger must contain the required Sources block')

assert.match(storage, /^## Durable source links$/m)
assert.match(storage, /Only durable, retrievable artifacts are sources\./)
assert.match(storage, /first persisted artifact.*`Direct request`/i)
assert.match(storage, /Local artifacts use relative links/i)
assert.match(storage, /Jira and GitHub work items use verified HTTPS links/i)
assert.match(storage, /must not link.*machine-local/i)
assert.match(storage, /ledger.*commit boundaries/i)
assert.match(storage, /ticket.*scope.*acceptance criteria/i)
assert.match(storage, /specification.*shared requirements.*design/i)
assert.match(storage, /brainstorm.*rationale/i)
assert.match(storage, /flow can skip a specification, plan, or ticket/i)
assert.match(storage, /one ledger.*repository.*branch/i)
assert.match(localTickets, /New local Markdown tickets must include `topic` and `source` frontmatter strings/)
assert.match(localTickets, /`Direct request`, a relative Markdown link, or a verified HTTPS Markdown link/)
assert.match(localTickets, /Existing local tickets without `source` remain valid/)
assert.doesNotMatch(localTickets, /^source:\s*["']?(?:file:\/\/|\/|~\/|[A-Za-z]:\\)/m)

assert.match(ledger, /^## Sources$/m)
assert.match(ledger, /Primary work item/i)
assert.match(ledger, /Specification.*optional/i)
assert.match(ledger, /Implementation plan.*optional/i)
assert.match(ledger, /`Direct request`/)
assert.match(ledger, /one top-level task per intended commit/i)
assert.deepEqual(ledgerSources.match(/^- .+$/gm), [
  '- Topic: [TOPIC.md](<relative-topic-link-from-setup>)',
  '- Primary work item: [Jira MA-1234](https://example.atlassian.net/browse/MA-1234), [SPEC.md](<relative-specification-link-from-setup>), [PLAN.md](<relative-plan-link-from-setup>), or `Direct request`',
  '- Specification (optional): [SPEC.md](<relative-specification-link-from-setup>)',
  '- Implementation plan (optional): [PLAN.md](<relative-plan-link-from-setup>)',
])
assert.doesNotMatch(ledgerSources, /file:\/\/|\/Users\/|~\/|session[-_ ]?id/i)

assert.match(planningFlow, /Each persisted local artifact links to `TOPIC\.md`/i)
assert.match(planningFlow, /External tickets use tracker-native hierarchy and links/i)
assert.match(implementationFlow, /primary work item.*ambiguous.*durable source/i)
assert.match(specFormat, /\| Source \|/)
assert.match(plans, /Start `Context` with `Source: <nearest durable source>`/)
assert.match(tickets, /local Markdown ticket.*source/i)
assert.match(tickets, /must not link to a machine-local/i)
assert.match(specToTickets, /new local ticket.*durable source/i)
assert.match(specToTickets, /External tickets use tracker-native hierarchy and links/i)
assert.match(specToTickets, /must not link to a machine-local source/i)
assert.match(prDescriptions, /source.*ticket.*otherwise.*shareable/i)
assert.match(readme, /Durable source links/i)

console.log('Workflow durable-source provenance contract passed.')
