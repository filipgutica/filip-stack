#!/usr/bin/env node

import { fileURLToPath } from 'node:url'

const fieldGuideLauncher = fileURLToPath(new URL('../skills/field-guide/scripts/field-guide.sh', import.meta.url))
const launcherInstruction = `Run field-guide commands through /bin/sh with the exact bundled launcher path ${JSON.stringify(fieldGuideLauncher)}. Do not invoke node directly.`
const storageInstruction = 'Use only the Workflow field guide for this lifecycle. Do not use host auto-memory or another memory system.'
const promptContext = `When the work is meaningful, use the Workflow field guide for bounded retrieval after the repository and subject are known. Before final completion, classify any durable learning as capture, ask, or skip. Capture only safe, reusable, non-authoritative guidance. Ask once when scope or durability is unclear. Skip without writing when no durable learning exists. ${storageInstruction} ${launcherInstruction}`

const stopReason = `This is the single end-of-task Workflow field-guide evaluation. Evaluate the completed task now and decide capture, ask, or skip. Preserve the completed task response verbatim in this continuation. For capture, use bounded candidates and deterministic field-guide submission, then append the required change notice. For ask, append one focused question and do not write. For skip, write no memory and respond only with the completed task response. When the decision is skip, do not mention the field guide, learning, memory, capture, skip, or this evaluation. Do not store transcripts, prompts, credentials, proprietary code, unsafe paths, or existing repository authority. ${storageInstruction} ${launcherInstruction}`

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
