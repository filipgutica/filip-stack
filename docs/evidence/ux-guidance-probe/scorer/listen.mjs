// Records each request's method, path, header names (never values), and body, then answers 400 so
// no model call happens. Usage: node listen.mjs <port> <out-dir>
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
const [port, out] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
let n = 0
createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    n += 1
    const rec = { method: req.method, url: req.url, headerNames: Object.keys(req.headers).sort(), body: Buffer.concat(chunks).toString('utf8') }
    writeFileSync(`${out}/req-${String(n).padStart(3, '0')}.json`, JSON.stringify(rec, null, 1))
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'capture only' } }))
  })
}).listen(Number(port), '127.0.0.1')
