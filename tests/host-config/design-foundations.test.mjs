import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dir = new URL('../../host-config/design-language/', import.meta.url)
const read = (file) => readFileSync(new URL(file, dir), 'utf8')

test('the foundations catalogue shows every token that tokens.css defines', () => {
  const lightRoot = read('tokens.css').match(/^:root \{([\s\S]*?)^\}/m)[1]
  const tokens = [...lightRoot.matchAll(/^\s*(--[\w-]+):/gm)].map((match) => match[1])
  const page = read('reference.html')
  assert.ok(tokens.length > 0)
  const missing = tokens.filter((token) => !page.includes(`data-token="${token}"`))
  assert.deepEqual(missing, [])
})

test('the component catalogue has one section per component spec, in the same layer', () => {
  const slug = (title) => title.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-')
  const specs = [...read('components.md').matchAll(/^## (.+)\n\nLayer: (Core|Identity)\./gm)]
    .map(([, title, layer]) => ({ id: slug(title), layer }))
  const sections = [...read('components.html').matchAll(/<section class="component" id="([\w-]+)" data-layer="(Core|Identity)"/g)]
    .map(([, id, layer]) => ({ id, layer }))
  assert.ok(specs.length > 0)
  assert.deepEqual(sections, specs)
})
