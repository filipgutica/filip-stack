#!/usr/bin/env node
// Runs a UI's tasks in each accessibility mode: reduced motion, dark, 200% text, and grayscale.
// Usage: node ui-modes.mjs --url <url> [--url <url>] [--tasks <module>] [--modes reduced-motion,dark,text-200,grayscale]
//   [--width 375] [--project <dir>] [--out <dir>]
// A tasks module default-exports [{ name, run: async (page) => {} }]; a task fails when run throws.
// Without --tasks, the script captures each URL in each mode for review and checks horizontal overflow.
// Playwright resolves from --project (default: the current directory). Writes <out>/results.json and a
// PNG per URL and mode. Prints the passed count as the last line. Exits 1 when any task or overflow
// check fails in any mode, and 2 when it cannot run.

import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { slug } from './ui-check.mjs'

// Each mode's browser context options and the CSS it adds after load.
export const MODES = {
  'reduced-motion': { context: { reducedMotion: 'reduce' }, css: null },
  dark: { context: { colorScheme: 'dark' }, css: null },
  // Scales text set in rem or em; text set in px does not grow, which is itself a finding.
  'text-200': { context: {}, css: 'html { font-size: 200% !important; }' },
  grayscale: { context: {}, css: 'html { filter: grayscale(1) !important; }' },
}

export const parseArgs = (argv) => {
  const opts = { urls: [], tasks: null, modes: Object.keys(MODES), width: 375, project: process.cwd(), out: null }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    const value = () => {
      const next = argv[++i]
      if (next === undefined) throw new Error(`${flag} needs a value`)
      return next
    }
    if (flag === '--url') opts.urls.push(value())
    else if (flag === '--tasks') opts.tasks = value()
    else if (flag === '--modes') opts.modes = value().split(',')
    else if (flag === '--width') opts.width = Number(value())
    else if (flag === '--project') opts.project = value()
    else if (flag === '--out') opts.out = value()
    else throw new Error(`Unknown option ${flag}`)
  }
  if (!opts.urls.length) throw new Error('Pass at least one --url')
  const unknown = opts.modes.filter((m) => !MODES[m])
  if (unknown.length) throw new Error(`Unknown mode ${unknown.join(', ')}; use ${Object.keys(MODES).join(', ')}`)
  if (!Number.isInteger(opts.width) || opts.width <= 0) throw new Error('--width takes a positive integer')
  return opts
}

// A version passes only when every task passes in every mode.
export const summarize = (results) => {
  const passed = results.filter((r) => r.ok).length
  return { passed, total: results.length, failed: passed < results.length }
}

const run = async (opts) => {
  const req = createRequire(join(resolve(opts.project), 'package.json'))
  let playwright = null
  for (const name of ['playwright', '@playwright/test']) {
    try { playwright = req(name); break } catch {}
  }
  if (!playwright) throw new Error(`Cannot run: install playwright or @playwright/test in ${resolve(opts.project)}`)
  const tasks = opts.tasks ? (await import(pathToFileURL(resolve(opts.tasks)).href)).default : null
  if (tasks && (!Array.isArray(tasks) || tasks.some((t) => typeof t.name !== 'string' || typeof t.run !== 'function'))) {
    throw new Error('The tasks module must default-export [{ name, run: async (page) => {} }]')
  }
  const out = opts.out ?? join(tmpdir(), `ui-modes-${Date.now()}`)
  mkdirSync(out, { recursive: true })
  const browser = await playwright.chromium.launch()
  const results = []
  try {
    for (const mode of opts.modes) {
      for (const url of opts.urls) {
        const context = await browser.newContext({ viewport: { width: opts.width, height: 900 }, ...MODES[mode].context })
        const page = await context.newPage()
        const prepare = async () => {
          await page.goto(url, { waitUntil: 'load' })
          if (MODES[mode].css) await page.addStyleTag({ content: MODES[mode].css })
        }
        await prepare()
        const screenshot = join(out, `${slug(url)}-${mode}.png`)
        await page.screenshot({ path: screenshot, fullPage: true })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
        results.push({ mode, url, check: 'no horizontal overflow', ok: !overflow, screenshot })
        for (const task of tasks ?? []) {
          await prepare()
          try {
            await task.run(page)
            results.push({ mode, url, check: task.name, ok: true })
          } catch (err) {
            results.push({ mode, url, check: task.name, ok: false, error: err.message })
          }
        }
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
  const summary = summarize(results)
  writeFileSync(join(out, 'results.json'), `${JSON.stringify({ summary, results }, null, 2)}\n`)
  for (const r of results.filter((x) => !x.ok)) console.log(`FAIL ${r.mode} ${r.url} ${r.check}${r.error ? `: ${r.error}` : ''}`)
  console.log(`Results: ${join(out, 'results.json')}`)
  console.log(`${summary.passed} of ${summary.total} checks passed`)
  console.log(summary.passed)
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
