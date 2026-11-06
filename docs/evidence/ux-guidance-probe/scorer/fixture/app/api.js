// Mock API for the fixture. Scenarios come from the page URL, so checks can reach every state:
//   ?keys=3          start with three keys (default: none)
//   ?fail=create     createKey always rejects, as when the service is down
//   ?fail=once       the first create fails; a retry succeeds
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
let creates = 0
export const createKey = async (name) => {
  creates += 1
  const attempt = creates
  await wait()
  if (params.get('fail') === 'create' || (params.get('fail') === 'once' && attempt === 1)) throw new Error('The key service is unavailable. Try again in a minute.')
  const secret = `sk_live_${String(keys.length + 1).padStart(32, '0')}`
  const key = { id: `key_${keys.length + 1}`, name, created: '2026-11-06', last4: secret.slice(-4) }
  keys.unshift(key)
  return { ...key, secret }
}
