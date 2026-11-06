import assert from 'node:assert/strict'
import test from 'node:test'
import { summarize as summarizeCheck, tokenValues } from '../../skills/interface-design/scripts/ui-check.mjs'
import { summarize as summarizeModes } from '../../skills/interface-design/scripts/ui-modes.mjs'

test('reads token values from custom properties and skips commented-out ones', () => {
  const css = ':root { --text: #1a1a1a; /* --old: red; */ --space-2: 8px; --mix: color-mix(in srgb, var(--text) 50%, white) }'
  assert.deepEqual(tokenValues(css), ['#1a1a1a', '8px', 'color-mix(in srgb, var(--text) 50%, white)'])
})

test('fails ui-check on axe or overflow findings, and on tokens only when asked', () => {
  const run = (axeNodes, overflow, offToken) => ({ axe: axeNodes ? [{ nodes: Array(axeNodes).fill('x') }] : [], overflow, offToken })
  const tokensOnly = [run(0, false, [{ kind: 'color', value: 'red' }])]
  assert.equal(summarizeCheck(tokensOnly, { failOnTokens: false }).failed, false)
  assert.equal(summarizeCheck(tokensOnly, { failOnTokens: true }).failed, true)
  // The score line counts axe nodes plus pages that overflow.
  const both = summarizeCheck([run(2, true, null), run(0, false, null)], { failOnTokens: false })
  assert.deepEqual([both.violations, both.failed], [3, true])
})

test('fails ui-modes unless every check passes in every mode', () => {
  assert.equal(summarizeModes([{ ok: true }, { ok: true }]).failed, false)
  assert.deepEqual(summarizeModes([{ ok: true }, { ok: false }]), { passed: 1, total: 2, failed: true })
})
