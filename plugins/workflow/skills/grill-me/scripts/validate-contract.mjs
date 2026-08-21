#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skill = readFileSync(resolve(root, 'SKILL.md'), 'utf8')
const log = readFileSync(resolve(root, 'references/grill-log.md'), 'utf8')
const assertMatches = (content, patterns) => {
  for (const pattern of patterns) assert.match(content, pattern)
}

assertMatches(skill, [
  /explicit `\$workflow:grill-me` invocation creates a curated topic log by default/i,
  /update the grill log before asking the next question/i,
  /Create no log before topic confirmation/i,
  /authority only for one grill log/i,
])
assertMatches(log, [
  /topics\/open\/<topic-id>\/grills\/<date>-<sequence>-<slug>\.md/,
  /after each resolved answer/i,
  /Keep each recorded field on one line/,
  /focused question/,
  /recommendation/,
  /user's decision/,
  /decision rationale/,
  /next unresolved question/,
  /Do not store a raw transcript, hidden reasoning/i,
  /Resume the same log after context compaction/i,
  /link to `\.\.\/TOPIC\.md`/,
])

console.log('Grill Me persistence contract passed.')
