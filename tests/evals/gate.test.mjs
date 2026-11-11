import assert from 'node:assert/strict'
import test from 'node:test'
import { gate } from '../../evals/gate.mjs'

const provider = { id: 'openai:chat:claude-opus-5-5', label: 'claude' }

// Builds promptfoo result rows for one scenario: `passes` lists, per version, whether each attempt passed.
const rows = ({ scenario = 'case', needsNewGuidance = false, passes, steps = 1 }) => Object.entries(passes).flatMap(([label, attempts]) =>
  attempts.flatMap((pass, repeatIndex) => Array.from({ length: steps }, (_, step) => ({
    provider,
    prompt: { label },
    repeatIndex,
    testIdx: step,
    success: Array.isArray(pass) ? pass[step] : pass,
    failureReason: 0,
    testCase: { metadata: { scenario, expects: { claude: 'decide' }, needsNewGuidance } },
    gradingResult: { componentResults: [{ reason: 'decide' }] },
  }))))

const run = (options) => gate({ results: rows(options), attempts: options.passes.base.length })

test('a scenario regresses when the working tree passes fewer attempts than the base', () => {
  assert.equal(run({ passes: { base: [true, true], 'working tree': [true, false] } }).regressions, 1)
  assert.equal(run({ passes: { base: [true, false], 'working tree': [true, false] } }).regressions, 0)
})

test('a needsNewGuidance scenario must gain unless the working tree passes every attempt', () => {
  assert.equal(run({ needsNewGuidance: true, passes: { base: [true, false], 'working tree': [true, false] } }).regressions, 1)
  assert.equal(run({ needsNewGuidance: true, passes: { base: [false, false], 'working tree': [true, false] } }).regressions, 0)
  assert.equal(run({ needsNewGuidance: true, passes: { base: [true, true], 'working tree': [true, true] } }).regressions, 0)
})

test('an attempt with several tests passes only when every test passes', () => {
  const { tables } = run({ steps: 2, passes: { base: [[true, true]], 'working tree': [[true, false]] } })
  assert.deepEqual(tables[0].rows.map(({ base, head }) => [base, head]), [[1, 0]])
})

test('provider errors and missing attempts stop the gate instead of counting as failures', () => {
  const errored = rows({ passes: { base: [true], 'working tree': [true] } })
  errored[0].failureReason = 2
  errored[0].error = 'HTTP 500'
  assert.throws(() => gate({ results: errored, attempts: 1 }), /errored.*HTTP 500/u)
  assert.throws(() => gate({ results: rows({ passes: { base: [true], 'working tree': [true] } }), attempts: 2 }), /expected 2/u)
})
