// Scripted stand-in for the Anthropic Messages API, so the exact attempt command runs end to end with
// no model call. Each /v1/messages request is saved (header names only, never values) and answered
// with the next step of the script: {"tool": name, "input": {...}} or {"text": "..."}. Requests that
// are not /v1/messages get an empty 200. Usage: node mock.mjs <port> <out-dir> <script.json>
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const [port, out, scriptPath] = process.argv.slice(2)
const script = JSON.parse(readFileSync(scriptPath, 'utf8'))
mkdirSync(out, { recursive: true })
let n = 0
let step = 0

const sse = (events) => events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')

const reply = (s) => {
  const block = s.tool
    ? { start: { type: 'tool_use', id: `toolu_${step}`, name: s.tool, input: {} }, delta: { type: 'input_json_delta', partial_json: JSON.stringify(s.input) } }
    : { start: { type: 'text', text: '' }, delta: { type: 'text_delta', text: s.text } }
  return sse([
    ['message_start', { type: 'message_start', message: { id: `msg_${step}`, type: 'message', role: 'assistant', model: 'mock', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: block.start }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: block.delta }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: s.tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }],
    ['message_stop', { type: 'message_stop' }],
  ])
}

createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    n += 1
    const body = Buffer.concat(chunks).toString('utf8')
    writeFileSync(`${out}/req-${String(n).padStart(3, '0')}.json`, JSON.stringify({ method: req.method, url: req.url, headerNames: Object.keys(req.headers).sort(), body }, null, 1))
    if (!req.url.startsWith('/v1/messages') || req.url.includes('count_tokens')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(req.url.includes('count_tokens') ? '{"input_tokens":1}' : '{}')
    }
    const s = script[Math.min(step, script.length - 1)]
    step += 1
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.end(reply(s))
  })
}).listen(Number(port), '127.0.0.1')
