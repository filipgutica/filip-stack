// Screenshots each build's screen states for the judges, at the same views for every build.
// Usage: node capture-states.mjs --url <base url> --out <dir> [--project <dir with playwright>]
// Writes <out>/<state>-<view>.png and <out>/states.json, which records any step that failed.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const base = arg('url')
const out = arg('out')
const { chromium } = createRequire(join(resolve(arg('project', process.cwd())), 'package.json'))('playwright')

const SETTLE = 1500
const fill = async (page, name) => {
  await page.getByLabel('Key name', { exact: true }).fill(name, { timeout: 3000 })
}
const create = (page) => page.getByRole('button', { name: 'Create key', exact: true }).click({ timeout: 3000 })

export const STATES = [
  { name: 's1-empty', query: '?keys=0', act: async () => {} },
  { name: 's2-validation', query: '?keys=0', act: create },
  { name: 's3-server-error', query: '?keys=0&fail=create', act: async (page) => { await fill(page, 'CI runner'); await create(page) } },
  { name: 's4-success', query: '?keys=0', act: async (page) => { await fill(page, 'Deploy bot'); await create(page) } },
  { name: 's5-populated', query: '?keys=3', act: async () => {} },
]
export const VIEWS = [
  { name: '1280-light', width: 1280, scheme: 'light' },
  { name: '375-light', width: 375, scheme: 'light' },
  { name: '375-dark', width: 375, scheme: 'dark' },
]

if (base && out) {
  mkdirSync(out, { recursive: true })
  const browser = await chromium.launch()
  const record = []
  for (const view of VIEWS) {
    for (const state of STATES) {
      const context = await browser.newContext({ viewport: { width: view.width, height: 800 }, colorScheme: view.scheme })
      const page = await context.newPage()
      const entry = { state: state.name, view: view.name, error: null }
      try {
        await page.goto(new URL(state.query, base).href)
        await page.waitForTimeout(SETTLE)
        await state.act(page)
        await page.waitForTimeout(SETTLE)
      } catch (err) {
        entry.error = String(err.message).split('\n')[0]
      }
      await page.screenshot({ path: join(out, `${state.name}-${view.name}.png`), fullPage: true })
      record.push(entry)
      await context.close()
    }
  }
  await browser.close()
  writeFileSync(join(out, 'states.json'), JSON.stringify(record, null, 1))
  console.log(`${record.filter((r) => !r.error).length}/${record.length} states reached`)
}
