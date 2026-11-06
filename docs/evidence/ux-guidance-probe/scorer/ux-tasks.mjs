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

// Returns the visible new secret, or null; a hidden input does not count as shown.
const shownSecret = (page) => page.evaluate(() => {
  const secret = /sk_live_[0-9a-f]{8,}/
  const fields = [...document.querySelectorAll('input, textarea')].filter((el) =>
    el.type !== 'hidden' && el.checkVisibility() && el.getBoundingClientRect().width > 0)
  return [document.body.innerText, ...fields.map((el) => el.value)].map((text) => text.match(secret)?.[0]).find(Boolean) ?? null
})
const secretShown = async (page) => (await shownSecret(page)) !== null
// The brief lists each key with its name, created date and last four characters. A list entry is any
// visible element that shows the name and the last four of the shown secret, whatever its markup; a
// message that only names the key is not one. Elements that also hold the full secret are skipped.
const listed = async (page, name) => {
  const secret = await shownSecret(page)
  if (!secret) return false
  return page.evaluate(({ name, secret }) => [...document.body.querySelectorAll('*')].some((el) => {
    const text = el.innerText ?? ''
    return text.includes(name) && text.includes(secret.slice(-4)) && !text.includes(secret) &&
      el.checkVisibility() && el.getBoundingClientRect().width > 0
  }), { name, secret })
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
