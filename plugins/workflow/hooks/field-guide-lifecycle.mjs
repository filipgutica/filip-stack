#!/usr/bin/env node

const promptContext = 'When the work is meaningful, use the Workflow field guide for bounded retrieval after the repository and subject are known. Before final completion, classify any durable learning as capture, ask, or skip. Capture only safe, reusable, non-authoritative guidance. Ask once when scope or durability is unclear. Skip without writing when no durable learning exists.'

const stopReason = 'This is the single end-of-task Workflow field-guide evaluation. Evaluate the completed task now and decide capture, ask, or skip. For capture, use bounded candidates and deterministic field-guide submission. For ask, ask one focused question and do not write. For skip, write no memory and reply only "<!-- field-guide: skip -->" so no status notice is visible. Do not store transcripts, prompts, credentials, proprietary code, unsafe paths, or existing repository authority.'

const outputFor = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  if (input.hook_event_name === 'UserPromptSubmit') {
    return {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: promptContext,
      },
    }
  }
  if (input.hook_event_name === 'Stop' && input.stop_hook_active !== true) {
    return { decision: 'block', reason: stopReason }
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
