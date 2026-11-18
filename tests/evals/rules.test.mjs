import assert from 'node:assert/strict'
import test from 'node:test'
import { headRetrieval, retrievalTests } from '../../evals/retrieval.mjs'
import { scoreRule } from '../../evals/rules.mjs'

const context = { test: { metadata: { options: ['design', 'designer'], accept: ['designer'] } }, provider: { label: 'claude' } }

test('a rule reply matches the longest option key it starts with', () => {
  assert.equal(scoreRule('{"action": "designer"}', context).pass, true)
  assert.equal(scoreRule('{"action": "designer (have a separate designer agent build the council)"}', context).pass, true)
  assert.deepEqual(scoreRule('{"action": "design (choose the members yourself)"}', context), { pass: false, score: 0, reason: 'design' })
})

test('retrieval presents fixture hook output as host context and keeps the task in the user message', () => {
  const cases = retrievalTests()
  const promptFor = (description) => {
    const { vars } = cases.find((entry) => entry.description === description)
    return headRetrieval({ vars, provider: { label: 'codex' } })
  }
  const [confirmedHost, confirmedUser] = promptFor('merge-injected-confirmed-cleanup')
  const [unconfirmedHost, unconfirmedUser] = promptFor('merge-injected-unconfirmed-cleanup')

  assert.equal(confirmedHost.role, 'system')
  assert.match(confirmedHost.content, /\n- \[confirmed\] \[pr-merged\] \[agent-autonomy\] Once a PR merges/u)
  assert.match(unconfirmedHost.content, /\n- \[pr-merged\] \[agent-autonomy\] Once a PR merges/u)
  assert.doesNotMatch(unconfirmedHost.content, /\n- \[confirmed\] \[pr-merged\] \[agent-autonomy\] Once a PR merges/u)
  assert.equal(confirmedUser.role, 'user')
  assert.match(confirmedUser.content, /Live Git checks show the worktree is clean/u)
  assert.doesNotMatch(confirmedUser.content, /\[confirmed\]/u)
  assert.deepEqual(confirmedUser, unconfirmedUser)
})
