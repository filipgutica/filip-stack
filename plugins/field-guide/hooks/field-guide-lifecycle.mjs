#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { appendAnalyticsEvent } from '../skills/field-guide/scripts/field-guide-analytics.mjs'
import { promptInjection, sessionStartInjection } from '../skills/field-guide/scripts/field-guide.mjs'

const isSupportedHost = () => Boolean(process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT)
const guideRoot = () => join(homedir(), '.field-guide')

const promptContext = 'Before your final response, privately choose capture, ask, or skip for durable learning. Preserve the normal task response for every decision. Skip uses no tools, writes nothing, and adds nothing. If capture is warranted, follow $field-guide:field-guide and append only its concise change notice. If ask is warranted, append one focused learning question and write no memory while awaiting the answer. Learning must not delay or replace the task result. Add no other lifecycle or storage text. This evaluation is advisory.'

// Per-session state records which guidance is already in context and whether
// the next prompt should get prompt-matched guidance. It lives in the user's
// own guide, never in a shared temporary directory.
const sessionsRoot = () => join(guideRoot(), 'sessions')
const sessionStateMaxAgeMs = 7 * 24 * 60 * 60 * 1000
const hasGuide = () => existsSync(join(guideRoot(), 'memory.md'))
// Matches state files and temporary files left by an interrupted write.
const sessionStateFileName = /^[0-9a-f]{64}\.json(\.\d+\.tmp)?$/
const sessionStatePath = (sessionId) => join(
  sessionsRoot(),
  `${createHash('sha256').update(sessionId).digest('hex')}.json`,
)

const readSessionState = (sessionId) => {
  try {
    const state = JSON.parse(readFileSync(sessionStatePath(sessionId), 'utf8'))
    if (Array.isArray(state.injectedIds) && typeof state.promptPending === 'boolean') return state
  } catch {
    // A missing or unreadable state means no injection has happened yet.
  }
  return { injectedIds: [], promptPending: true }
}

const writeSessionState = (sessionId, state) => {
  mkdirSync(sessionsRoot(), { recursive: true, mode: 0o700 })
  // A symlinked directory would send writes and pruning to another location.
  const stats = lstatSync(sessionsRoot())
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error('sessions must be a local directory')
  const path = sessionStatePath(sessionId)
  // Rename replaces the path itself, so a planted symlink is never followed.
  const temporaryPath = `${path}.${process.pid}.tmp`
  writeFileSync(temporaryPath, `${JSON.stringify(state)}\n`, { mode: 0o600, flag: 'wx' })
  renameSync(temporaryPath, path)
}

const pruneSessionStates = () => {
  const cutoff = Date.now() - sessionStateMaxAgeMs
  for (const name of readdirSync(sessionsRoot())) {
    if (!sessionStateFileName.test(name)) continue
    const path = join(sessionsRoot(), name)
    try {
      const stats = lstatSync(path)
      if (stats.isFile() && stats.mtimeMs < cutoff) unlinkSync(path)
    } catch {
      // Another session may remove or replace the file first; pruning is best effort.
    }
  }
}

const recordInjection = ({ trigger, injection }) => appendAnalyticsEvent({
  guideRoot: guideRoot(),
  event: { type: 'injection', projectKey: injection.projectKey, trigger, guidanceIds: injection.guidanceIds },
})

/** Injects project guidance and the subject index at startup, clear, and after compaction. */
const sessionStartContext = (input) => {
  if (typeof input.session_id !== 'string' || typeof input.cwd !== 'string' || !hasGuide()) return null
  // A new session has a new ID, so state at startup belongs to a parent session:
  // Codex subagent hooks reuse the parent's session ID. Keep the parent's state.
  if (input.source === 'startup' && existsSync(sessionStatePath(input.session_id))) return null
  try {
    let injection = null
    try {
      injection = sessionStartInjection({ repoRoot: input.cwd })
    } catch {
      // Failed retrieval still starts the session and permits state pruning.
    }
    // Write state before returning text so a failed write never repeats injection.
    writeSessionState(input.session_id, { injectedIds: injection?.guidanceIds ?? [], promptPending: true })
    pruneSessionStates()
    if (!injection) return null
    recordInjection({ trigger: 'session-start', injection })
    return injection.text
  } catch {
    return null
  }
}

/** Injects prompt-matched guidance once per session start; later prompts get none. */
const promptGuidanceContext = (input) => {
  if (typeof input.session_id !== 'string' || typeof input.cwd !== 'string' || typeof input.prompt !== 'string') return null
  if (!hasGuide()) return null
  try {
    const state = readSessionState(input.session_id)
    if (!state.promptPending) return null
    let injection = null
    try {
      injection = promptInjection({ repoRoot: input.cwd, prompt: input.prompt, excludeIds: state.injectedIds })
    } catch {
      // Failed retrieval consumes this attempt so later prompts do not retry.
    }
    writeSessionState(input.session_id, {
      injectedIds: [...state.injectedIds, ...(injection?.guidanceIds ?? [])],
      promptPending: false,
    })
    if (!injection) return null
    recordInjection({ trigger: 'prompt', injection })
    return injection.text
  } catch {
    return null
  }
}

const outputFor = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  if (input.hook_event_name === 'Stop') return {}
  if (!isSupportedHost()) return {}
  if (input.hook_event_name === 'SessionStart') {
    const additionalContext = sessionStartContext(input)
    return additionalContext ? { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } } : {}
  }
  if (input.hook_event_name === 'UserPromptSubmit') {
    appendAnalyticsEvent({
      guideRoot: guideRoot(),
      event: { type: 'hook_invoked', host: process.env.PLUGIN_ROOT ? 'codex' : 'claude' },
    })
    const guidance = promptGuidanceContext(input)
    return {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: guidance ? `${guidance}\n\n${promptContext}` : promptContext,
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
