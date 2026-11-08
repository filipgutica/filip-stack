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

// Flattens a page's <style> into rules, each with its @media or @supports context.
const cssRules = (html) => {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '')
  const squash = (text) => text.replace(/\s+/g, ' ').trim()
  const rules = []
  const context = []
  let start = 0
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] === '{') {
      const prelude = squash(css.slice(start, i))
      if (prelude.startsWith('@')) {
        context.push(prelude)
        start = i + 1
        continue
      }
      const end = css.indexOf('}', i)
      rules.push({ context: context.join(' '), selector: prelude, body: squash(css.slice(i + 1, end)) })
      i = end
      start = end + 1
    } else if (css[i] === '}') {
      context.pop()
      start = i + 1
    }
  }
  return rules
}

// Splits a selector list on its top-level commas.
const selectors = (list) => {
  const parts = []
  let depth = 0
  let part = ''
  for (const char of list) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(part.trim())
      part = ''
    } else part += char
  }
  return [...parts, part.trim()]
}

// A page that copies a shared control copies the catalogue's rule unchanged. Each selector is
// checked on its own, with its @media context, so a list that mixes in page selectors cannot hide a
// drifted control rule. Focus selectors are left out: each page lists its own controls in one focus
// rule, by role. Each family names the pages that must copy it; any other page that copies it is
// checked too.
const families = [
  { name: 'button and quiet action', pattern: /^(?:a)?\.btn\b|^\.quiet-action\b|^:where\(\.quiet-action\)/, pages: ['reference.html', 'docs.html', 'product.html'] },
  { name: 'segmented control', pattern: /^\.segmented\b/, pages: ['reference.html'] },
  { name: 'tabs', pattern: /^\.tab(?:list)?\b/, pages: ['reference.html'] },
  { name: 'navigation row', pattern: /^\.navlist\b/, pages: ['docs.html'] },
]
const perSelector = (rules) =>
  rules.flatMap(({ context, selector, body }) => selectors(selector).map((part) => ({ context, selector: part, list: selector, body })))
const key = ({ context, selector, body }) => `${context} ${selector} { ${body} }`.trim()

// Page sizing rules that touch a shared control on purpose: touch targets grow at tablet width,
// including the sized buttons and segmented controls that the catalogue keeps at their size.
const sizingExemptions = [
  { page: 'reference.html', context: '@media (max-width: 800px)', selector: '.btn[data-size]', body: 'min-height: var(--control-lg); min-width: var(--control-lg);' },
  { page: 'reference.html', context: '@media (max-width: 800px)', selector: '.segmented button', body: 'min-height: var(--control-lg); min-width: var(--control-lg);' },
]

test('example pages copy the catalogue button, quiet action, segmented, tab, and navigation row rules unchanged', () => {
  const catalogue = new Set(perSelector(cssRules(read('components.html'))).map(key))
  const exempt = new Set(sizingExemptions.map(({ page, ...rule }) => `${page} ${key(rule)}`))
  for (const page of ['reference.html', 'docs.html', 'product.html']) {
    const rules = perSelector(cssRules(read(page))).filter(({ selector }) => !selector.includes(':focus-visible'))
    for (const { name, pattern, pages } of families) {
      const copied = rules.filter(({ selector }) => pattern.test(selector))
      if (pages.includes(page)) assert.ok(copied.length > 0, `${page} has no ${name} rules`)
      const drifted = copied
        .filter((rule) => !catalogue.has(key(rule)) && !exempt.has(`${page} ${key(rule)}`))
        .map((rule) => `${key(rule)}${rule.list === rule.selector ? '' : `  (from the list "${rule.list}")`}`)
      assert.deepEqual(drifted, [], `${page} ${name} selectors that differ from components.html`)
    }
  }
})
