// Gate tasks for the build task, run by interface-design's ui-modes.mjs in every mode. They rely only on
// what the brief fixes (the `Key name` label, the `Create key` button, and the mock API's URL scenarios)
// and accept any markup that meets them. Each task starts from a fresh load of the URL (?keys=0).
const TIMEOUT = 5000

const field = (page) => page.getByLabel('Key name', { exact: true })
const button = (page) => page.getByRole('button', { name: 'Create key', exact: true })

const waitFor = async (check, what) => {
  const end = Date.now() + TIMEOUT
  while (Date.now() < end) {
    if (await check()) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Timed out waiting for ${what}`)
}

// The field reports an error: aria-invalid, an aria-errormessage, or native constraint validation.
const fieldReportsError = (page) =>
  field(page).evaluate((el) => el.getAttribute('aria-invalid') === 'true' || Boolean(el.getAttribute('aria-errormessage')) || el.matches(':invalid'))

// The secret is on screen as text or as the value of a field, such as a read-only input.
const secretShown = (page) =>
  page.evaluate(() => {
    const secret = /sk_live_[0-9a-f]{8,}/
    return secret.test(document.body.innerText) || [...document.querySelectorAll('input, textarea')].some((el) => secret.test(el.value))
  })

// Text that names a failure, in a live region or anywhere on the page that did not say so before.
const FAILURE = /unavailable|error|fail|couldn.t|could not|try again|went wrong|problem/i
const failureShown = (page, before) =>
  page.evaluate(({ source, before }) => {
    const failure = new RegExp(source, 'i')
    const live = [...document.querySelectorAll('[role=alert], [role=status], [aria-live]')].some((el) => failure.test(el.textContent))
    const lines = document.body.innerText.split('\n').filter((line) => failure.test(line) && !before.includes(line))
    return live || lines.length > 0
  }, { source: FAILURE.source, before })

export default [
  {
    name: 'an empty name is refused with an error tied to the field',
    run: async (page) => {
      await field(page).waitFor({ timeout: TIMEOUT })
      await button(page).click()
      await waitFor(() => fieldReportsError(page), 'the Key name field to report an error')
      if (await secretShown(page)) throw new Error('A key was created from an empty name')
    },
  },
  {
    name: 'creating a key shows its secret and lists it',
    run: async (page) => {
      await field(page).fill('Deploy bot')
      await button(page).click()
      await waitFor(() => secretShown(page), 'the new secret')
      await waitFor(async () => (await page.getByText('Deploy bot').count()) > 0, 'the new key in the list')
    },
  },
  {
    name: 'a failed create keeps the name and lets the user retry',
    run: async (page) => {
      const url = new URL(page.url())
      url.searchParams.set('fail', 'create')
      await page.goto(url.href)
      await field(page).fill('CI runner')
      const before = await page.evaluate(() => document.body.innerText.split('\n'))
      await button(page).click()
      await waitFor(() => failureShown(page, before), 'the failure to be shown')
      if ((await field(page).inputValue()) !== 'CI runner') throw new Error('The name was lost after the failure')
      await waitFor(() => button(page).isEnabled(), 'Create key to be enabled again')
    },
  },
]
