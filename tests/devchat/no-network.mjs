// Preload for devchat tests (`node --import`). Every network entry point records its name in the
// file `DEVCHAT_TEST_NETWORK_LOG` names and throws. A user-code import of a network module is
// recorded too, so a test can assert that a command neither imports nor calls one.
import dgram from 'node:dgram'
import dns from 'node:dns'
import { appendFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { registerHooks, syncBuiltinESMExports } from 'node:module'
import net from 'node:net'
import tls from 'node:tls'

const log = process.env.DEVCHAT_TEST_NETWORK_LOG
if (!log) throw new Error('DEVCHAT_TEST_NETWORK_LOG is required')
const record = (name) => appendFileSync(log, `${name}\n`)
const deny = (name) => () => {
  record(name)
  throw new Error(`devchat test: network call blocked: ${name}`)
}

globalThis.fetch = deny('fetch')
net.Socket.prototype.connect = deny('net.Socket.connect')
net.connect = deny('net.connect')
net.createConnection = deny('net.createConnection')
tls.connect = deny('tls.connect')
for (const [name, module] of [['http', http], ['https', https]]) {
  module.request = deny(`${name}.request`)
  module.get = deny(`${name}.get`)
}
dns.lookup = deny('dns.lookup')
dns.promises.lookup = deny('dns.promises.lookup')
dgram.createSocket = deny('dgram.createSocket')
syncBuiltinESMExports()

// The imports above ran before this registration, so only the code under test is recorded.
const networkModules = new Set(['net', 'tls', 'http', 'https', 'http2', 'dgram', 'dns', 'dns/promises', 'undici'])
registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (networkModules.has(specifier.replace(/^node:/u, ''))) record(`import ${specifier}`)
    return nextResolve(specifier, context)
  },
})
