import assert from 'node:assert/strict'
import { test } from 'node:test'
import { add } from '../math.mjs'
import { numeric } from './support.mjs'

test('adds numeric values', () => {
  assert.ok(numeric(2))
  assert.equal(add(2, 3), 5)
})
