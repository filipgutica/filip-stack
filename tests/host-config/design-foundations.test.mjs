import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dir = new URL('../../host-config/design-language/', import.meta.url)
const read = (file) => readFileSync(new URL(file, dir), 'utf8')

test('the foundations catalogue shows every token that tokens.css defines', () => {
  const lightRoot = read('tokens.css').match(/^:root \{([\s\S]*?)^\}/m)[1]
  const tokens = [...lightRoot.matchAll(/^\s*(--[\w-]+):/gm)].map((match) => match[1])
  const page = read('reference.html')
  // The first and last tokens prove the whole light block was parsed.
  assert.equal(tokens[0], '--bg')
  assert.equal(tokens.at(-1), '--ease-out')
  const missing = tokens.filter((token) => !page.includes(`data-token="${token}"`))
  assert.deepEqual(missing, [])
})
