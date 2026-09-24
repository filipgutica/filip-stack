#!/usr/bin/env node

import { homedir } from 'node:os'
import { join } from 'node:path'
import { appendAnalyticsEvent } from '../skills/field-guide/scripts/field-guide-analytics.mjs'

const isSupportedHost = () => Boolean(process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT)

const promptContext = 'Before your final response, privately choose capture, ask, or skip for durable learning. Preserve the normal task response for every decision. Skip uses no tools, writes nothing, and adds nothing. If capture is warranted, follow $field-guide:field-guide and append only its concise change notice. If ask is warranted, append one focused learning question and write no memory while awaiting the answer. Learning must not delay or replace the task result. Add no other lifecycle or storage text. This evaluation is advisory.'

const outputFor = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  if (input.hook_event_name === 'Stop') return {}
  if (input.hook_event_name === 'UserPromptSubmit') {
    if (!isSupportedHost()) return {}
    appendAnalyticsEvent({
      guideRoot: join(homedir(), '.field-guide'),
      event: { type: 'hook_invoked', host: process.env.PLUGIN_ROOT ? 'codex' : 'claude' },
    })
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
