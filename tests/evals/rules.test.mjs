import assert from 'node:assert/strict'
import test from 'node:test'
import { scoreRule } from '../../evals/rules.mjs'

const context = { test: { metadata: { options: ['design', 'designer'], accept: ['designer'] } }, provider: { label: 'claude' } }

test('a rule reply matches the longest option key it starts with', () => {
  assert.equal(scoreRule('{"action": "designer"}', context).pass, true)
  assert.equal(scoreRule('{"action": "designer (have a separate designer agent build the council)"}', context).pass, true)
  assert.deepEqual(scoreRule('{"action": "design (choose the members yourself)"}', context), { pass: false, score: 0, reason: 'design' })
})
