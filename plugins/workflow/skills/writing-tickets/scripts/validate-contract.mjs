import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const writingTickets = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8')
const specToTickets = await readFile(new URL('../../spec-to-tickets/SKILL.md', import.meta.url), 'utf8')

assert.match(writingTickets, /^## Ticket hierarchy and relationships$/m)
assert.match(writingTickets, /specification or ERD.+epic/i)
assert.match(writingTickets, /Reuse.+verified epic.+none exists/i)
assert.match(writingTickets, /story.+parent epic/i)
assert.match(writingTickets, /subtask.+complex story/i)
assert.match(writingTickets, /verified.+ticket.+link/i)
assert.match(writingTickets, /blocks/i)
assert.match(writingTickets, /is blocked by/i)
assert.match(writingTickets, /preced/i)
assert.match(writingTickets, /follow/i)
assert.match(writingTickets, /supersed/i)
assert.match(writingTickets, /superseded by/i)
assert.match(writingTickets, /publishing authority/i)

assert.match(specToTickets, /one epic.+specification or ERD/i)
assert.match(specToTickets, /Search for an existing epic/i)
assert.match(specToTickets, /stor(?:y|ies).+child/i)
assert.match(specToTickets, /subtask/i)

console.log('Writing Tickets hierarchy contract passed.')
