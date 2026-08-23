#!/usr/bin/env node

const hostFor = () => {
  if (process.env.PLUGIN_ROOT) return 'codex'
  if (process.env.CLAUDE_PLUGIN_ROOT) return 'claude'
  return null
}

const promptContext = 'Before your final response, privately choose capture, ask, or skip for durable learning. For capture or skip, preserve the normal task response. Skip uses no tools, writes nothing, and adds nothing. If capture is warranted, follow the Workflow field-guide skill and append only its concise change notice. If ask is warranted, reply with only one focused question; do not explain or offer options. Add no other lifecycle or storage text. This evaluation is advisory.'

const outputFor = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  if (input.hook_event_name === 'Stop') return {}
  if (input.hook_event_name === 'UserPromptSubmit') {
    if (!hostFor()) return {}
    return {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: promptContext,
      },
    }
  }
  return {}
}

let stdin = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  stdin += chunk
})
process.stdin.on('end', () => {
  let output = {}
  try {
    output = outputFor(JSON.parse(stdin))
  } catch {
    output = {}
  }
  process.stdout.write(`${JSON.stringify(output)}\n`)
})
process.stdin.resume()
