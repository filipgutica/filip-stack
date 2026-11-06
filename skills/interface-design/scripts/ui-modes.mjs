#!/usr/bin/env node
// Runs a UI's tasks in each accessibility mode: reduced motion, dark, 200% text, and grayscale.
// Usage: node ui-modes.mjs --url <url> [--url <url>] [--tasks <module>] [--modes reduced-motion,dark,text-200,grayscale]
//   [--theme-attr data-theme] [--width 375] [--project <dir>] [--out <dir>]
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
import { assertLoaded, fileStem } from './ui-check.mjs'

// The browser context options for each mode. The page-side part of each mode is in applyMode.
export const MODES = {
  'reduced-motion': { reducedMotion: 'reduce' },
  dark: { colorScheme: 'dark' },
  'text-200': {},
  grayscale: {},
}

// Runs in every document the context loads, so a mode survives links and reloads inside a task.
// After the page's own load handlers finish, it sets inline !important declarations, which no page
// stylesheet can override, then records whether the computed style shows the mode.
const applyMode = ({ mode, themeAttr }) => {
  window.addEventListener('load', () => {
    const root = document.documentElement
    // Doubles the page's own root size; text set in px does not grow, which is itself a finding.
    const fontSize = `${parseFloat(getComputedStyle(root).fontSize) * 2}px`
    setTimeout(() => {
      if (mode === 'text-200') root.style.setProperty('font-size', fontSize, 'important')
      if (mode === 'grayscale') root.style.setProperty('filter', 'grayscale(1)', 'important')
      if (mode === 'dark' && themeAttr) root.setAttribute(themeAttr, 'dark')
      // The run checks the mode again before the screenshot and after each task.
      window.__uiModeHolds = () => {
        const style = getComputedStyle(root)
        return mode === 'text-200' ? style.fontSize === fontSize
          : mode === 'grayscale' ? style.filter === 'grayscale(1)'
          : mode !== 'dark' || !themeAttr || root.getAttribute(themeAttr) === 'dark'
      }
      window.__uiModeApplied = window.__uiModeHolds()
    })
  }, { once: true })
}

// Whether the page still shows its mode; true when the page has no mode check, such as about:blank.
const modeHolds = (page) => page.evaluate(() => (window.__uiModeHolds ? window.__uiModeHolds() : true))

// Loads a URL and waits until its mode is applied. A mode that did not take cannot run, so it never
// passes without the mode.
const open = async (page, url, mode) => {
  assertLoaded(await page.goto(url, { waitUntil: 'load' }), url)
  await page.waitForFunction(() => window.__uiModeApplied !== undefined)
  if (!(await page.evaluate(() => window.__uiModeApplied))) throw new Error(`Cannot apply ${mode} mode to ${url}`)
}

export const parseArgs = (argv) => {
  const opts = { urls: [], tasks: null, modes: Object.keys(MODES), themeAttr: null, width: 375, project: process.cwd(), out: null }
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
    else if (flag === '--theme-attr') opts.themeAttr = value()
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

// A tasks module must default-export a non-empty list, so a wrong export cannot pass with no tasks.
export const validateTasks = (tasks) => {
  if (!Array.isArray(tasks) || !tasks.length || tasks.some((t) => typeof t?.name !== 'string' || typeof t?.run !== 'function')) {
    throw new Error('The tasks module must default-export a non-empty [{ name, run: async (page) => {} }]')
  }
  return tasks
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
  const tasks = opts.tasks ? validateTasks((await import(pathToFileURL(resolve(opts.tasks)).href)).default) : []
  const out = opts.out ?? join(tmpdir(), `ui-modes-${Date.now()}`)
  mkdirSync(out, { recursive: true })
  const browser = await playwright.chromium.launch()
  const results = []
  try {
    for (const mode of opts.modes) {
      for (const [index, url] of opts.urls.entries()) {
        const context = await browser.newContext({ viewport: { width: opts.width, height: 900 }, ...MODES[mode] })
        await context.addInitScript(applyMode, { mode, themeAttr: opts.themeAttr })
        const page = await context.newPage()
        await open(page, url, mode)
        if (!(await modeHolds(page))) throw new Error(`${url} removed the ${mode} mode after load`)
        const screenshot = join(out, `${fileStem(url, index)}-${mode}.png`)
        await page.screenshot({ path: screenshot, fullPage: true })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
        results.push({ mode, url, check: 'no horizontal overflow', ok: !overflow, screenshot })
        for (const task of tasks) {
          await open(page, url, mode)
          try {
            await task.run(page)
            if (!(await modeHolds(page))) throw new Error(`the page removed the ${mode} mode during the task`)
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
