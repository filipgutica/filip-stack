#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const format = readFileSync(resolve(skillRoot, 'references/erd-format.md'), 'utf8')
const ticketSkill = readFileSync(resolve(skillRoot, '../spec-to-tickets/SKILL.md'), 'utf8')
const template = format.match(/Copy these headings in this order:\n\n```md\n([\s\S]*?)\n```/)?.[1]

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

console.log('Writing Specs ERD contract passed.')
