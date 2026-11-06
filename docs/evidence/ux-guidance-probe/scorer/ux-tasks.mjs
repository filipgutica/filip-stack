// User-boundary tasks for the frozen ui-modes runner. Each starts at ?keys=0 in a fresh load.
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

const fieldReportsError = (page) => field(page).evaluate((el) => {
  // :user-invalid distinguishes native validation after interaction from an untouched required field.
  if (el.matches(':user-invalid') && el.validationMessage) return true
  const ids = `${el.getAttribute('aria-errormessage') ?? ''} ${el.getAttribute('aria-describedby') ?? ''}`.split(/\s+/).filter(Boolean)
  return el.getAttribute('aria-invalid') === 'true' && ids.some((id) => {
    const error = document.getElementById(id)
    return error?.checkVisibility() && error.textContent.trim().length > 0
  })
})

const secretShown = (page) => page.evaluate(() => {
  const secret = /sk_live_[0-9a-f]{8,}/
  return secret.test(document.body.innerText) || [...document.querySelectorAll('input, textarea')].some((el) =>
    el.type !== 'hidden' && el.checkVisibility() && el.getBoundingClientRect().width > 0 && secret.test(el.value))
})
// A list entry is a visible row or list item that names the key; a status message that names it is not.
const listed = async (page, name) => {
  for (const role of ['row', 'listitem']) {
    const entries = page.getByRole(role).filter({ hasText: name })
    if (await entries.evaluateAll((els) => els.some((el) => el.checkVisibility() && el.getBoundingClientRect().width > 0))) return true
  }
  return false
}
const FAILURE = /unavailable|error|fail|couldn.t|could not|try again|went wrong|problem/i
const failureLines = (page) => page.evaluate((source) =>
  document.body.innerText.split('\n').map((line) => line.trim()).filter((line) => new RegExp(source, 'i').test(line)), FAILURE.source)

export default [
  {
    name: 'an empty name is refused with an error tied to the field',
    run: async (page) => {
      await field(page).waitFor({ state: 'visible', timeout: TIMEOUT })
      // A pre-existing aria reference or status cannot stand in for a current validation response.
      if (await fieldReportsError(page)) throw new Error('The empty field already reports an error before submission')
      await button(page).click()
      await waitFor(() => fieldReportsError(page), 'a current error tied to Key name')
      if (await secretShown(page)) throw new Error('A key was created from an empty name')
    },
  },
  {
    name: 'creating a key shows its secret and lists it',
    run: async (page) => {
      await field(page).fill('Deploy bot', { timeout: TIMEOUT })
      await button(page).click()
      await waitFor(() => secretShown(page), 'the visible new secret')
      await waitFor(() => listed(page, 'Deploy bot'), 'the visible new key in the list')
    },
  },
  {
    name: 'a failed create keeps the name and a second submission succeeds',
    run: async (page) => {
      const url = new URL(page.url())
      url.searchParams.set('fail', 'once')
      await page.goto(url.href)
      await field(page).fill('CI runner', { timeout: TIMEOUT })
      const before = await failureLines(page)
      await button(page).click()
      await waitFor(async () => (await failureLines(page)).some((line) => !before.includes(line)), 'a new visible failure')
      if ((await field(page).inputValue()) !== 'CI runner') throw new Error('The name was lost after the failure')
      await button(page).click({ timeout: TIMEOUT })
      await waitFor(() => secretShown(page), 'the retry to show a secret')
      await waitFor(() => listed(page, 'CI runner'), 'the retried key in the visible list')
    },
  },
]
