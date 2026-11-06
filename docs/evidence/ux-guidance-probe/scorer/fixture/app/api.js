// Mock API for the fixture. Scenarios come from the page URL, so checks can reach every state:
//   ?keys=3          start with three keys (default: none)
//   ?fail=create     createKey rejects, as when the service is down
//   ?delay=<ms>      response delay (default 600)
const params = new URLSearchParams(location.search)
const delay = Number(params.get('delay') ?? 600)
const wait = () => new Promise((resolve) => setTimeout(resolve, delay))
const seed = ['Production deploy', 'Staging CI', 'Local testing'].map((name, i) => ({
  id: `key_${i + 1}`,
  name,
  created: `2026-10-0${i + 2}`,
  last4: ['4f2a', '9c1d', '07be'][i],
}))
const keys = seed.slice(0, Number(params.get('keys') ?? 0))

/** Lists the account's API keys, newest first: [{ id, name, created, last4 }]. */
export const listKeys = async () => {
  await wait()
  return keys.map((k) => ({ ...k }))
}

/**
 * Creates a key. Resolves to { id, name, created, last4, secret }; the full secret is returned only here.
 * Rejects with an Error whose message is shown to users as is.
 */
export const createKey = async (name) => {
  await wait()
  if (params.get('fail') === 'create') throw new Error('The key service is unavailable. Try again in a minute.')
  const secret = `sk_live_${crypto.randomUUID().replaceAll('-', '')}`
  const key = { id: `key_${keys.length + 1}`, name, created: new Date().toISOString().slice(0, 10), last4: secret.slice(-4) }
  keys.unshift(key)
  return { ...key, secret }
}
