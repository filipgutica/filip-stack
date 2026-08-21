#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const format = readFileSync(resolve(skillRoot, 'references/erd-format.md'), 'utf8')
const specSkill = readFileSync(resolve(skillRoot, 'SKILL.md'), 'utf8')
const ticketSkill = readFileSync(resolve(skillRoot, '../spec-to-tickets/SKILL.md'), 'utf8')
const planningFlow = readFileSync(resolve(skillRoot, '../coordinator/references/planning-flow.md'), 'utf8')
const readme = readFileSync(resolve(skillRoot, '../../../../README.md'), 'utf8')
const template = format.match(/Copy these headings in this order:\n\n```md\n([\s\S]*?)\n```/)?.[1]
const assertMatches = (content, patterns) => {
  for (const pattern of patterns) assert.match(content, pattern)
}

assert.ok(template, 'ERD format must contain the required heading template')
assert.deepEqual(template.match(/^#{1,3} .+$/gm), [
  '# <title>',
  '## Metadata',
  '## Intro',
  '## Gates',
  '## Context',
  '## Threat Modeling',
  '## Architectural Diagram and Data Flow',
  '### Key design points',
  '### Component changes',
  '## Order of Operations / High Level Tasks',
  '## Scalability, Cost Modeling, Failure Modes, and Robustness',
  '## Open Questions',
])
assert.match(
  ticketSkill,
  /Reject a `Draft` specification or ERD, and any specification or ERD with unresolved Gates\./,
)
assert.match(ticketSkill, /Return the blocking Gates and create no tickets\./)
assert.match(format, /Set `Ticket` to a Markdown link whose label includes the external system and verified parent ID/i)
assert.match(ticketSkill, /metadata link with the system, ID, and URL/i)
assert.match(ticketSkill, /Do not require the external parent to link back to the local file/i)
assert.doesNotMatch(ticketSkill, /Link it to the source document/i)
assert.match(ticketSkill, /Require explicit external-artifact authority for the local source before changing its `Ticket` metadata/i)
assert.match(ticketSkill, /Without that authority, return the proposed link in the conversation/i)
assert.match(specSkill, /Require explicit external-artifact authority for the local source before changing its `Ticket` metadata/i)
assert.match(specSkill, /Without that authority, return the proposed link in the conversation/i)
assert.match(
  specSkill,
  /An explicit `\$workflow:writing-specs` invocation persists the specification by default/i,
)
assert.match(specSkill, /An explicit conversation-only request returns the specification in the conversation without persisting it/i)
assert.match(specSkill, /grants external-artifact authority only for the `SPEC\.md` write/i)
assert.match(specSkill, /topic discovery returns exactly one open topic/i)
assert.match(specSkill, /multiple open topics exist.*ask the user to choose a topic/i)
assert.match(specSkill, /use `\$workflow:setup` with explicit setup authority/i)
assert.match(specSkill, /state that no open topic was available for persistence/i)
assert.match(planningFlow, /An explicit `\$workflow:writing-specs` invocation persists its specification by default/i)
assert.match(planningFlow, /multiple open topics exist.*ask for a topic choice/i)
assert.match(readme, /An explicit `writing-specs` invocation writes `SPEC\.md` under an open topic by\s+default/i)
assert.match(readme, /topic must be user-identified or the only open topic/i)
assertMatches(format, [
  /Draft`, `Ready`, or `Implemented`/,
  /^## Complex contract specifications$/m,
  /Contract at a glance.*Architectural Diagram and Data Flow/is,
  /Overarching design choices.*Context/is,
  /under `Key design points`:[\s\S]*State or responsibility ownership/is,
  /under `Key design points`:[\s\S]*Contract matrix grouped by concern/is,
  /Public API reference.*inputs, models, events, methods, slots, and escape hatches/is,
  /Repository deliverables.*verification signals.*Component changes/is,
  /Give each table one purpose/,
  /Label every example as an example/,
  /Do not invent rows/,
])
assert.match(specSkill, /public contracts, state ownership, or several component boundaries/i)
for (const header of [
  '| Concern | Component owns | Host owns | Public surface |',
  '| State | Canonical owner | Update path | Persistence owner |',
  '| Rule | Rationale | Example | Verification signal |',
  '| Surface | Payload or value | Direction | Responsibility |',
  '| Required outcome | Verification signal |',
]) assert.match(format, new RegExp(header.replace(/[|]/g, '\\|')))
console.log('Writing Specs ERD contract passed.')
