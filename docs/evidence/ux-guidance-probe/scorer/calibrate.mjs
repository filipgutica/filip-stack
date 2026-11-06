// Free browser regressions against local calibration pages; no model endpoint is used.
// Usage: node calibrate.mjs <calibration-dir> <Playwright-project> [tasks-module]
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const [calibration, project, taskFile = join(dirname(fileURLToPath(import.meta.url)), 'ux-tasks.mjs')] = process.argv.slice(2)
const { chromium } = createRequire(join(resolve(project), 'package.json'))('playwright')
const tasks = (await import(pathToFileURL(resolve(taskFile)).href)).default
const cases = JSON.parse(readFileSync(join(calibration, 'build-cases.json'), 'utf8'))
const server = spawn(process.execPath, [fileURLToPath(new URL('serve.mjs', import.meta.url)), join(calibration, 'build'), '47899'])
let browser
try {
  for (let attempt = 0; ; attempt += 1) {
    try { await fetch('http://127.0.0.1:47899/reference1/'); break } catch (err) {
      if (attempt === 50) throw err
      await new Promise((done) => setTimeout(done, 100))
    }
  }
  browser = await chromium.launch()
  let total = 0
  const mismatches = []
  for (const [name, expected] of Object.entries(cases)) {
    for (const [index, task] of tasks.entries()) {
      if (!expected.tasks.includes(index)) continue
      const page = await browser.newPage({ viewport: { width: 375, height: 900 } })
      await page.goto(`http://127.0.0.1:47899/${name}/?keys=0`)
      let error = null
      try { await task.run(page) } catch (err) { error = err.message }
      await page.close()
      if (Boolean(error) !== expected.fails.includes(index)) mismatches.push(`${name}: ${task.name}: ${error ?? 'unexpected pass'}`)
      console.log(`checked ${name}: ${task.name}${error ? ' (rejected)' : ''}`)
      total += 1
    }
  }
  // The defect exists only after the delayed list arrives; scanning the shell must not pass.
  const out = mkdtempSync(join(tmpdir(), 'ux-ready-'))
  const check = fileURLToPath(new URL('../../../../skills/interface-design/scripts/ui-check.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('ready-check.mjs', import.meta.url)), check,
    '--url', 'http://127.0.0.1:47899/delayed-overflow/?keys=3&delay=4000', '--widths', '375', '--themes', 'light',
    '--project', project, '--out', out], { encoding: 'utf8', timeout: 30000 })
  assert.equal(result.status, 1, `The populated overflow must fail ui-check: ${result.stderr}`)
  assert.equal(JSON.parse(readFileSync(join(out, 'results.json'), 'utf8')).summary.overflow, 1)
  total += 1
  assert.deepEqual(mismatches, [], 'Calibration mismatches')
  console.log(`${total} calibration outcomes matched`)
} finally {
  await browser?.close()
  server.kill()
}
