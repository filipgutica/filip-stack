// Runs the frozen ui-check CLI after each populated navigation reaches visible seeded rows.
// Usage: node ready-check.mjs <ui-check.mjs> --url ... --project <Playwright project> ...
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [script, ...args] = process.argv.slice(2)
const project = args[args.indexOf('--project') + 1]
const { chromium } = createRequire(join(resolve(project), 'package.json'))('playwright')
const launch = chromium.launch.bind(chromium)
chromium.launch = async (...options) => {
  const browser = await launch(...options)
  const newContext = browser.newContext.bind(browser)
  browser.newContext = async (...contextOptions) => {
    const context = await newContext(...contextOptions)
    context.on('page', (page) => {
      const goto = page.goto.bind(page)
      page.goto = async (url, opts) => {
        const response = await goto(url, opts)
        if (new URL(url).searchParams.get('keys') === '3') {
          for (const name of ['Production deploy', 'Staging CI', 'Local testing']) {
            await page.getByText(name, { exact: false }).first().waitFor({ state: 'visible', timeout: 5000 })
          }
        }
        return response
      }
    })
    return context
  }
  return browser
}
process.argv = [process.argv[0], resolve(script), ...args]
await import(pathToFileURL(resolve(script)).href)
