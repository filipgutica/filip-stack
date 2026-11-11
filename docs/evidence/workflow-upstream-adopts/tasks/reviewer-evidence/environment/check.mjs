import assert from 'node:assert/strict'
import { retry } from './retry.mjs'

assert.equal(await retry(async () => 7), 7)
let calls = 0
assert.equal(await retry(async () => {
  if (++calls === 1) throw new Error('first failure')
  return 9
}), 9)
assert.equal(calls, 2)
await assert.rejects(retry(async () => { throw new Error('still failing') }), /still failing/)
console.log('PASS: initial success; retry success; second failure propagates')
