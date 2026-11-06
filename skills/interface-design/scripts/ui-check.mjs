#!/usr/bin/env node
// Checks a running UI at each URL, width, and theme: screenshots, axe-core WCAG 2.2 AA, horizontal
// overflow, and computed values that match no design token.
// Usage: node ui-check.mjs --url <url> [--url <url>] [--widths 320,375,1280] [--themes light,dark]
//   [--theme-attr data-theme] [--tokens <css file>] [--fail-on-tokens] [--project <dir>] [--out <dir>]
// Playwright and @axe-core/playwright resolve from --project (default: the current directory).
// Writes <out>/results.json and one PNG per combination. Prints the accessibility violation count as
// the last line. Exits 1 when a check fails and 2 when a check cannot run.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

export const parseArgs = (argv) => {
  const opts = { urls: [], widths: [375, 1280], themes: ['light', 'dark'], themeAttr: null, tokens: null, failOnTokens: false, project: process.cwd(), out: null }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    const value = () => {
      const next = argv[++i]
      if (next === undefined) throw new Error(`${flag} needs a value`)
      return next
    }
    if (flag === '--url') opts.urls.push(value())
    else if (flag === '--widths') opts.widths = value().split(',').map(Number)
    else if (flag === '--themes') opts.themes = value().split(',')
    else if (flag === '--theme-attr') opts.themeAttr = value()
    else if (flag === '--tokens') opts.tokens = value()
    else if (flag === '--fail-on-tokens') opts.failOnTokens = true
    else if (flag === '--project') opts.project = value()
    else if (flag === '--out') opts.out = value()
    else throw new Error(`Unknown option ${flag}`)
  }
  if (!opts.urls.length) throw new Error('Pass at least one --url')
  if (opts.widths.some((w) => !Number.isInteger(w) || w <= 0)) throw new Error('--widths takes positive integers')
  if (opts.themes.some((t) => t !== 'light' && t !== 'dark')) throw new Error('--themes takes light and dark')
  return opts
}

// Every custom property in a CSS file, such as `--space-2: 8px;`, as { name, value }.
export const tokenValues = (css) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].map((m) => ({ name: m[1], value: m[2].trim() }))

// A screenshot file stem that stays unique when two URLs share a path, such as `/?a` and `/?b`.
export const fileStem = (url, index) => `${index + 1}-${new URL(url).pathname.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'home'}`

// Fails the run with exit 2 when the page did not load, so an error page is never checked as a pass.
export const assertLoaded = (response, url) => {
  if (response && !response.ok()) throw Object.assign(new Error(`Cannot check ${url}: HTTP ${response.status()}`), { blocked: true })
}

// Runs in the page. Resolves each token through the page, so aliases such as var(--a) resolve, then
// lists computed colors, font sizes, radii, and spacing that match none of them. Tokens in `em` are
// resolved against each element's own font size, or its parent's for font-size.
const offTokenScan = (tokens) => {
  const root = getComputedStyle(document.documentElement)
  const resolved = tokens.map(({ name, value }) => root.getPropertyValue(name).trim() || value).filter((v) => !v.includes('var('))
  const emFactors = resolved.map((v) => /^(-?\d*\.?\d+)em$/.exec(v)).filter(Boolean).map((m) => Number(m[1]))
  const probe = document.createElement('div')
  document.body.append(probe)
  const known = new Set()
  for (const raw of resolved) {
    for (const prop of ['color', 'font-size', 'border-top-left-radius', 'padding-top']) {
      // An invalid value is rejected here, so it never falls back to an inherited value.
      probe.style.setProperty(prop, raw)
      if (probe.style.getPropertyValue(prop)) known.add(getComputedStyle(probe).getPropertyValue(prop))
      probe.style.removeProperty(prop)
    }
  }
  probe.remove()
  const ignore = new Set(['0px', 'rgba(0, 0, 0, 0)', 'normal', 'auto'])
  const checks = [
    ['color', 'color'], ['background-color', 'color'], ['font-size', 'font-size'],
    ['border-top-left-radius', 'radius'], ['padding-top', 'spacing'], ['padding-left', 'spacing'], ['row-gap', 'spacing'],
  ]
  const px = (v) => Math.round(parseFloat(v) * 100) / 100
  const found = new Map()
  for (const el of [document.body, ...document.body.querySelectorAll('*')]) {
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    if (style.display === 'none' || style.visibility === 'hidden' || !rect.width || !rect.height) continue
    for (const [prop, kind] of checks) {
      const value = style.getPropertyValue(prop)
      if (ignore.has(value) || known.has(value)) continue
      if (kind !== 'color' && emFactors.length) {
        const base = parseFloat(getComputedStyle(prop === 'font-size' ? el.parentElement ?? el : el).fontSize)
        if (emFactors.some((f) => px(`${f * base}px`) === px(value))) continue
      }
      const key = `${kind} ${value}`
      const entry = found.get(key) ?? { kind, value, count: 0, sample: '' }
      entry.count += 1
      entry.sample ||= el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList.length ? `.${[...el.classList].join('.')}` : '')
      found.set(key, entry)
    }
  }
  return [...found.values()]
}

// One pass or fail summary across every combination, for the exit code and the last output line.
export const summarize = (runs, { failOnTokens }) => {
  const axe = runs.reduce((n, r) => n + r.axe.reduce((m, v) => m + v.nodes.length, 0), 0)
  const overflow = runs.filter((r) => r.overflow).length
  const tokens = runs.reduce((n, r) => n + (r.offToken?.length ?? 0), 0)
  const failed = axe > 0 || overflow > 0 || (failOnTokens && tokens > 0)
  return { axe, overflow, tokens, violations: axe + overflow, failed }
}

const load = (project) => {
  const req = createRequire(join(resolve(project), 'package.json'))
  const pick = (names) => {
    for (const name of names) {
      try { return req(name) } catch {}
    }
    return null
  }
  const playwright = pick(['playwright', '@playwright/test'])
  const axe = pick(['@axe-core/playwright'])
  const missing = [!playwright && 'playwright or @playwright/test', !axe && '@axe-core/playwright'].filter(Boolean)
  if (missing.length) throw new Error(`Cannot run: install ${missing.join(' and ')} in ${resolve(project)}`)
  return { chromium: playwright.chromium, AxeBuilder: axe.default ?? axe.AxeBuilder }
}

const run = async (opts) => {
  const { chromium, AxeBuilder } = load(opts.project)
  const tokens = opts.tokens ? tokenValues(readFileSync(opts.tokens, 'utf8')) : null
  const out = opts.out ?? join(tmpdir(), `ui-check-${Date.now()}`)
  mkdirSync(out, { recursive: true })
  const browser = await chromium.launch()
  const runs = []
  try {
    for (const [index, url] of opts.urls.entries()) {
      for (const width of opts.widths) {
        for (const theme of opts.themes) {
          // A fresh context per combination, so each screenshot comes from a fresh page load.
          const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme })
          const page = await context.newPage()
          assertLoaded(await page.goto(url, { waitUntil: 'load' }), url)
          if (opts.themeAttr) await page.evaluate(([attr, value]) => document.documentElement.setAttribute(attr, value), [opts.themeAttr, theme])
          const screenshot = join(out, `${fileStem(url, index)}-${width}-${theme}.png`)
          await page.screenshot({ path: screenshot, fullPage: true })
          const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
          const offToken = tokens ? await page.evaluate(offTokenScan, tokens) : null
          runs.push({
            url, width, theme, screenshot, overflow, offToken,
            axe: result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) })),
          })
          await context.close()
        }
      }
    }
  } finally {
    await browser.close()
  }
  const summary = summarize(runs, opts)
  const unchecked = ['Non-text contrast of control boundaries and states (WCAG 1.4.11)', 'Target size (WCAG 2.5.8)', 'Keyboard paths and focus order', 'Task success']
  if (!tokens) unchecked.push('Design tokens (pass --tokens)')
  writeFileSync(join(out, 'results.json'), `${JSON.stringify({ summary, unchecked, runs }, null, 2)}\n`)
  console.log(`axe violations: ${summary.axe} nodes; horizontal overflow: ${summary.overflow} of ${runs.length} pages; off-token values: ${tokens ? summary.tokens : 'not checked'}`)
  console.log(`Not checked: ${unchecked.join('; ')}`)
  console.log(`Results: ${join(out, 'results.json')}`)
  console.log(summary.violations)
  return summary.failed ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await run(parseArgs(process.argv.slice(2)))
  } catch (err) {
    console.error(err.message)
    process.exitCode = 2
  }
}
