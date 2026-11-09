import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

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
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(([, block]) => block).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
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
  { name: 'navigation row', pattern: /^\.navlist\b/, pages: ['docs.html', 'reference.html'] },
  { name: 'checkbox and radio', pattern: /^\.check\b/, pages: ['reference.html'] },
  { name: 'badge', pattern: /^\.badge\b/, pages: ['reference.html'] },
  { name: 'alert', pattern: /^\.alert\b/, pages: ['reference.html'] },
  { name: 'code block and command plate', pattern: /^\.code\b/, pages: ['reference.html'] },
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

test('example pages copy the catalogue rules for the shared controls and components they use unchanged', () => {
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

// Depth lives in tokens.css. A page's shadow is none, a tokens.css variable, or a zero-blur line in a
// token colour: a focus ring, a divider, or a selection bar. --depth passes because the guard checks
// each place a page sets it. Custom properties named like a shadow are checked too, so a page cannot
// hide a literal behind its own variable.
const tokenNames = new Set([...read('tokens.css').matchAll(/^\s*(--[\w-]+):/gm)].map((match) => match[1]))
const isToken = (reference) => reference === '--depth' || tokenNames.has(reference)
const isShadowLayerAllowed = (layer) => {
  const match = layer.match(/^(?:inset )?(?:-?[\d.]+(?:px)? -?[\d.]+(?:px)?(?: 0(?:px)?(?: -?[\d.]+(?:px)?)?)? )?var\((--[\w-]+)\)$/)
  return Boolean(match) && isToken(match[1])
}
const isShadowAllowed = (value) => value === 'none' || selectors(value).every(isShadowLayerAllowed)

// Lists each declaration in a page's style blocks and inline styles that isViolation flags, as
// "file: selector { declaration }".
const flaggedDeclarations = ({ file, html, isViolation }) => {
  const inline = [...html.matchAll(/\bstyle=(["'])([\s\S]*?)\1/g)].map(([, , body]) => ({ context: '', selector: '[style]', body }))
  return [...cssRules(html), ...inline].flatMap(({ context, selector, body }) =>
    body.split(';').map((declaration) => declaration.trim()).filter(Boolean)
      .map((declaration) => declaration.match(/^([\w-]+)\s*:\s*(.+)$/))
      .filter((match) => match && isViolation(match[1], match[2]))
      .map(([declaration]) => `${file}: ${`${context} ${selector}`.trim()} { ${declaration} }`))
}

const shadowLiterals = (page, html) => flaggedDeclarations({
  file: page,
  html,
  isViolation: (property, value) => /^(?:box-shadow|--depth|--[\w-]*shadow[\w-]*)$/.test(property) && !isShadowAllowed(value.replace(/\s*!important$/, '')),
})

test('the depth guard reads every style block and both inline quote forms', () => {
  const planted = `<style>.a { box-shadow: var(--shadow-raise) }</style><style media="all">.b { box-shadow: 0 4px 12px black }</style>
    <p style='box-shadow: 0 4px 12px black'></p><p style="box-shadow: none"></p>`
  assert.equal(shadowLiterals('planted.html', planted).length, 2)
})

test('pages take depth from tokens.css: no literal shadow outside a focus ring, divider, or selection bar', () => {
  const pages = readdirSync(dir).filter((file) => file.endsWith('.html'))
  assert.ok(pages.includes('components.html') && pages.includes('reference.html'))
  assert.deepEqual(pages.flatMap((page) => shadowLiterals(page, read(page))), [])
})

// Focus is one ink ring for every role. An outline that draws uses var(--focus), an outline-color is
// var(--focus) or CanvasText (for forced colors), and --focus is the text colour, or the terminal text
// on a dark plate. A per-role ring colour, set directly or by redefining --focus, fails.
const focusRules = [
  { property: /^outline$/, allowed: (value) => /^(?:none|0)$/.test(value) || /^2px solid var\(--focus\)$/.test(value) },
  { property: /^outline-color$/, allowed: (value) => value === 'var(--focus)' || value === 'CanvasText' },
  { property: /^--focus$/, allowed: (value) => value === 'var(--text)' || value === 'var(--terminal-text)' },
]
const focusColourDrift = (file, html) => flaggedDeclarations({
  file,
  html,
  isViolation: (name, value) => focusRules.some(({ property, allowed }) => property.test(name) && !allowed(value)),
})

test('the focus guard catches a per-role ring colour, set directly or through --focus', () => {
  const planted = `<style>.btn:focus-visible { outline: 2px solid var(--accent) } .tab { outline-color: var(--link) }
    .btn.danger { --focus: var(--danger) } .ok { outline: 2px solid var(--focus); outline-color: CanvasText } .off { outline: none }</style>
    <p style="--focus: var(--project-dark)"></p>`
  assert.equal(focusColourDrift('planted.html', planted).length, 4)
})

test('every focus ring is the one ink ring: no per-role ring colour on any page or in tokens.css', () => {
  const pages = readdirSync(dir).filter((file) => file.endsWith('.html'))
  const sources = [...pages.map((page) => [page, read(page)]), ['tokens.css', `<style>${read('tokens.css')}</style>`]]
  assert.deepEqual(sources.flatMap(([file, html]) => focusColourDrift(file, html)), [])
})

test('keeps the page background and text colour outside the base layer, so a host reset cannot win', () => {
  // A host's unlayered body reset outranks any layered rule, so these two must stay unlayered.
  const unlayered = read('tokens.css').replace(/@layer base \{[\s\S]*$/, '')
  assert.match(unlayered, /^body \{ background: var\(--bg\); color: var\(--text\); \}$/m)
})

// Type, spacing, and control sizes are rem, so text and controls follow the reader's font-size
// setting. Hairlines, focus rings, shadows, and breakpoints stay px and are not checked here.
const remProperty = /^(?:font-size|font|--text-[\w-]+|--space-[\w-]+|--control-[\w-]+|--row)$/
const pxSizes = (file, html) => flaggedDeclarations({
  file,
  html,
  isViolation: (property, value) => remProperty.test(property) && /\d(?:\.\d+)?px\b/.test(value),
})

test('the rem guard catches a px font size, font shorthand, or size token, in style blocks and inline', () => {
  const planted = `<style>.a { font-size: 18px } .b { font: 600 12px / 1.2 var(--font-sans) } :root { --space-9: 6px; --row: 36px }
    .ok { font-size: 1.125rem; font: inherit; border: 1px solid; box-shadow: 0 1px 2px black; --shadow-x: 0 1px 2px black; width: 16px }</style>
    <p style="font-size: 14px"></p><p style="font-size: var(--text-sm)"></p>`
  assert.equal(pxSizes('planted.html', planted).length, 5)
})

test('type, spacing, and control sizes are rem on every page, in tokens.css, and in the report stylesheet', () => {
  const pages = readdirSync(dir).filter((file) => file.endsWith('.html'))
  const sources = [
    ...pages.map((page) => [page, read(page)]),
    ...['tokens.css', 'visualizations/report.css'].map((file) => [file, `<style>${read(file)}</style>`]),
  ]
  assert.deepEqual(sources.flatMap(([file, html]) => pxSizes(file, html)), [])
})
