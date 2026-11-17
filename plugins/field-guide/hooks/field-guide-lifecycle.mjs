#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

// The Field Guide modules load only after an event needs them, so a PostToolUse call for an
// unrelated command exits without parsing them.
let fieldGuide
const loadFieldGuide = async () => {
  const { appendAnalyticsEvent } = await import('../skills/field-guide/scripts/field-guide-analytics.mjs')
  const {
    confirmFromPrompt, eventInjection, isMainThread, promptInjection, sessionStartInjection, storeVersionNotice,
  } = await import('../skills/field-guide/scripts/field-guide.mjs')
  fieldGuide = { appendAnalyticsEvent, confirmFromPrompt, eventInjection, isMainThread, promptInjection, sessionStartInjection, storeVersionNotice }
}

const isSupportedHost = () => Boolean(process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT)
const hostName = () => (process.env.PLUGIN_ROOT ? 'codex' : 'claude')
const guideRoot = () => join(homedir(), '.field-guide')
const mainThreadFor = (input) => fieldGuide.isMainThread({ agentId: input.agent_id, env: process.env })

const promptContext = 'Before your final response, privately choose capture, ask, or skip for durable learning. Capture a clear, durable user preference, correction, or independently repeated miss, as a short paraphrase in your own words. Ask when the intended behavior, durability, scope, or relationship to stored guidance is unclear. Skip temporary or task-specific details, rules already in current instructions, and sensitive content such as credentials, personal data, or proprietary code, even when asked to remember it. Preserve the normal task response for every decision. Skip uses no tools, writes nothing, and adds nothing. If capture is warranted, follow $field-guide:field-guide and append only its concise change notice. If ask is warranted, append one focused learning question and write no memory while awaiting the answer. Learning must not delay or replace the task result. Add no other lifecycle or storage text.'

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

// eventKeys hold SHA-256 hashes of each injected event and target; sharedIds name the shared
// records the session received, which a compaction injects again. State from an older plugin
// lacks both.
const newSessionState = () => ({ injectedIds: [], promptPending: true, eventKeys: [], sharedIds: [] })
const readSessionState = (sessionId) => {
  try {
    const state = JSON.parse(readFileSync(sessionStatePath(sessionId), 'utf8'))
    if (Array.isArray(state.injectedIds) && typeof state.promptPending === 'boolean') {
      return {
        ...state,
        eventKeys: Array.isArray(state.eventKeys) ? state.eventKeys : [],
        sharedIds: Array.isArray(state.sharedIds) ? state.sharedIds : [],
      }
    }
  } catch {
    // A missing or unreadable state means no injection has happened yet.
  }
  return newSessionState()
}
const unique = (values) => [...new Set(values)]

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

const recordInjection = ({ trigger, injection }) => fieldGuide.appendAnalyticsEvent({
  guideRoot: guideRoot(),
  event: { type: 'injection', projectKey: injection.projectKey, trigger, guidanceIds: injection.guidanceIds },
})

/**
 * Injects project guidance and the subject index at startup, clear, and after compaction.
 * A compaction also injects the shared records the session received, and keeps the event keys.
 */
const sessionStartContext = (input) => {
  if (typeof input.session_id !== 'string' || typeof input.cwd !== 'string' || !hasGuide()) return null
  // A new session has a new ID, so state at startup belongs to a parent session:
  // Codex subagent hooks reuse the parent's session ID. Keep the parent's state.
  if (input.source === 'startup' && existsSync(sessionStatePath(input.session_id))) return null
  try {
    const kept = input.source === 'compact' ? readSessionState(input.session_id) : newSessionState()
    let injection = null
    try {
      injection = fieldGuide.sessionStartInjection({ repoRoot: input.cwd, mainThread: mainThreadFor(input), restoreIds: kept.sharedIds })
    } catch {
      // Failed retrieval still starts the session and permits state pruning.
    }
    // Write state before returning text so a failed write never repeats injection.
    writeSessionState(input.session_id, {
      injectedIds: injection?.guidanceIds ?? [],
      promptPending: true,
      eventKeys: kept.eventKeys,
      sharedIds: kept.sharedIds,
    })
    pruneSessionStates()
    if (!injection) return null
    recordInjection({ trigger: 'session-start', injection })
    return injection.text
  } catch {
    // A state-write or pruning failure suppresses guidance and never blocks the session.
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
      injection = fieldGuide.promptInjection({ repoRoot: input.cwd, prompt: input.prompt, excludeIds: state.injectedIds, mainThread: mainThreadFor(input) })
    } catch {
      // Failed retrieval consumes this attempt so later prompts do not retry.
    }
    writeSessionState(input.session_id, {
      ...state,
      injectedIds: [...state.injectedIds, ...(injection?.guidanceIds ?? [])],
      promptPending: false,
      sharedIds: unique([...state.sharedIds, ...(injection?.sharedIds ?? [])]),
    })
    if (!injection) return null
    recordInjection({ trigger: 'prompt', injection })
    return injection.text
  } catch {
    // A state-read or state-write failure suppresses guidance and never blocks the prompt.
    return null
  }
}

/**
 * Handles a prompt that mentions `confirm fg:`. Returns null for any other prompt. An exact
 * confirm prompt gets only this result, so it neither receives nor consumes prompt-matched
 * guidance; a near miss keeps the normal flow and adds the note.
 */
const confirmation = (input) => {
  if (typeof input.prompt !== 'string') return null
  try {
    return fieldGuide.confirmFromPrompt({ guideRoot: guideRoot(), prompt: input.prompt, mainThread: mainThreadFor(input), host: hostName() })
  } catch (error) {
    // A busy or unreadable guide confirms nothing; say which instead of failing silently.
    const text = /locked by another writer/u.test(error.message)
      ? 'Field Guide: nothing confirmed; another writer holds the guide lock, so try again.'
      : 'Field Guide: nothing confirmed; the guide or annotations.json is unreadable or newer than this plugin reads. Run validate or update the plugin.'
    return { exact: true, systemMessage: text, context: text }
  }
}

const promptOutput = (input) => {
  fieldGuide.appendAnalyticsEvent({ guideRoot: guideRoot(), event: { type: 'hook_invoked', host: hostName() } })
  const confirmed = confirmation(input)
  const systemMessage = confirmed ? { systemMessage: confirmed.systemMessage } : {}
  const parts = confirmed?.exact ? [confirmed.context] : [promptGuidanceContext(input), confirmed?.context, promptContext]
  return {
    ...systemMessage,
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: parts.filter(Boolean).join('\n\n') },
  }
}

const sessionStartOutput = (input) => {
  const additionalContext = sessionStartContext(input)
  const notice = fieldGuide.storeVersionNotice({ guideRoot: guideRoot() })
  return {
    ...(notice ? { systemMessage: notice } : {}),
    ...(additionalContext ? { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } } : {}),
  }
}

// One separator run or one word. A word joins plain characters, escapes, and quoted spans, so
// `echo "gh pr merge"` has the words `echo` and `gh pr merge`.
const shellToken = /[^\S\n]*(?:(?<separator>[;&|\n]+)|(?<word>(?:'[^']*'|"(?:[^"\\]|\\[\s\S])*"|\\[\s\S]|[^\s'"\\;&|])+))/uy
const unquote = (word) => word.replace(
  /'([^']*)'|"((?:[^"\\]|\\[\s\S])*)"|\\([\s\S])/gu,
  (_, single, double, escaped) => single ?? double?.replace(/\\([\s\S])/gu, '$1') ?? escaped,
)

/**
 * Splits a shell command at `&&`, `||`, `;`, `|`, `&`, and newlines into simple commands, each
 * a list of unquoted words. Returns null for an unclosed quote. This recognizes commands; it is
 * not a full shell parser.
 */
const simpleCommands = (command) => {
  const commands = [[]]
  let end = 0
  shellToken.lastIndex = 0
  for (let match = shellToken.exec(command); match; match = shellToken.exec(command)) {
    end = shellToken.lastIndex
    if (match.groups.word === undefined) commands.push([])
    else commands.at(-1).push(unquote(match.groups.word))
  }
  // Tokens stop only at trailing whitespace or at an unclosed quote.
  if (command.slice(end).trim() !== '') return null
  return commands.filter((words) => words.length > 0)
}

// A cheap check that runs before any parsing: every recognized command names gh or the CLI.
const mayNameEvent = /\bgh\b|field-guide\.(?:sh|mjs)/u
const fieldGuideScript = /^field-guide\.(?:sh|mjs)$/u
const hashOf = (text) => createHash('sha256').update(text).digest('hex')
const pullRequestTarget = /^(?:#?\d+|https?:\/\/\S+\/pull\/\d+\S*)$/u

// A PR number or URL (with any --repo value) names the target; otherwise the working
// directory and the command's words do. Only a hash of the target is stored.
const ghTarget = ({ words, cwd }) => {
  const pullRequest = words.find((word) => pullRequestTarget.test(word))
  if (pullRequest === undefined) return `${cwd}\0${words.join(' ')}`
  const repoIndex = words.findIndex((word) => word === '-R' || word === '--repo')
  const repo = repoIndex >= 0 ? words[repoIndex + 1] : words.find((word) => word.startsWith('--repo='))?.slice('--repo='.length)
  return `${repo ?? ''}#${pullRequest.replace(/^#/u, '').toLowerCase()}`
}

const ghEvents = new Map([['pr merge', 'pr-merged'], ['stack merge', 'pr-merged'], ['pr create', 'pr-created']])

const withoutAssignments = (words) => {
  const start = words.findIndex((word) => !/^[A-Za-z_][A-Za-z0-9_]*=/u.test(word))
  return start < 0 ? [] : words.slice(start)
}

// Returns the script of `bash -c '…'`, `zsh -i -c '…'`, and similar wrappers, or null.
const wrappedScript = (command) => {
  if (!['sh', 'bash', 'zsh'].includes(basename(command[0] ?? ''))) return null
  const flag = command.findIndex((word, index) => index > 0 && /^-[A-Za-z]*c[A-Za-z]*$/u.test(word))
  return flag < 0 ? null : command.slice(flag + 1).find((word) => !word.startsWith('-')) ?? null
}

// Lists a script's simple commands without leading assignments, opening shell wrappers one level.
const commandsIn = (script) => (simpleCommands(script) ?? []).map(withoutAssignments).flatMap((command) => {
  const inner = wrappedScript(command)
  return inner === null ? [command] : (simpleCommands(inner) ?? []).map(withoutAssignments)
})

// Returns the Field Guide event a simple command stands for, or null. A retrieve has no target:
// the agent asked for that output, so it gets the marked lines every time.
const eventFor = ({ command, cwd }) => {
  if (basename(command[0] ?? '') === 'gh') {
    const event = ghEvents.get(command.slice(1, 3).join(' '))
    if (!event) return null
    return { event, target: ghTarget({ words: command, cwd }), queuedMerge: event === 'pr-merged' && command.includes('--auto') }
  }
  const script = command.findIndex((word) => fieldGuideScript.test(basename(word)))
  if (script < 0 || command[script + 1] !== 'retrieve') return null
  const eventIndex = command.indexOf('--event', script)
  if (eventIndex < 0 || command[eventIndex + 1] === undefined) return null
  return { event: command[eventIndex + 1], target: null, queuedMerge: false }
}

/** Lists the Field Guide events in a PostToolUse Bash call, or none. Loads no module. */
const toolEvents = (input) => {
  const command = input.tool_input?.command
  if (typeof command !== 'string' || typeof input.cwd !== 'string' || !mayNameEvent.test(command)) return []
  return commandsIn(command).map((words) => eventFor({ command: words, cwd: input.cwd })).filter(Boolean)
}

// Claude reports failures as PostToolUseFailure; these checks cover the other result shapes,
// including Codex's model-facing text, which PostToolUse also receives after a non-zero exit.
const commandFailed = (response) => {
  if (typeof response === 'string') return /^(?:Exit code:|Process exited with code) *[1-9]/mu.test(response)
  if (!response || typeof response !== 'object') return false
  return response.interrupted === true || response.is_error === true || response.isError === true
    || [response.exit_code, response.exitCode].some((code) => typeof code === 'number' && code !== 0)
    || (typeof response.error === 'string' && response.error.length > 0)
}

/** Injects event-tagged guidance in a main thread only, once per event and target per session. */
const toolOutput = ({ input, events }) => {
  if (typeof input.session_id !== 'string' || !mainThreadFor(input) || !hasGuide()) return {}
  try {
    const state = readSessionState(input.session_id)
    const pending = events
      .map((event) => ({ ...event, key: event.target === null ? null : hashOf(`${event.event}\0${event.target}`) }))
      .filter(({ key }, index, all) => key === null || (!state.eventKeys.includes(key) && all.findIndex((other) => other.key === key) === index))
    if (pending.length === 0) return {}
    const injections = []
    for (const { event, queuedMerge } of pending) {
      try {
        const injection = fieldGuide.eventInjection({ repoRoot: input.cwd, event, queuedMerge, mainThread: true })
        if (injection) injections.push(injection)
      } catch {
        // Failed retrieval consumes this event so the same command does not retry.
      }
    }
    // Write state before returning text so a failed write never repeats injection.
    writeSessionState(input.session_id, {
      ...state,
      injectedIds: unique([...state.injectedIds, ...injections.flatMap(({ guidanceIds }) => guidanceIds)]),
      eventKeys: [...state.eventKeys, ...pending.map(({ key }) => key).filter(Boolean)],
      sharedIds: unique([...state.sharedIds, ...injections.flatMap(({ sharedIds }) => sharedIds)]),
    })
    if (injections.length === 0) return {}
    return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: injections.map(({ text }) => text).join('\n\n') } }
  } catch {
    // A state-read or state-write failure suppresses guidance and never blocks the tool result.
    return {}
  }
}

const outputFor = async (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  if (input.hook_event_name === 'Stop') return {}
  if (!isSupportedHost()) return {}
  if (input.hook_event_name === 'SessionStart') {
    await loadFieldGuide()
    return sessionStartOutput(input)
  }
  if (input.hook_event_name === 'UserPromptSubmit') {
    await loadFieldGuide()
    return promptOutput(input)
  }
  if (input.hook_event_name === 'PostToolUse') {
    const events = toolEvents(input)
    if (events.length === 0 || commandFailed(input.tool_response)) return {}
    await loadFieldGuide()
    return toolOutput({ input, events })
  }
  return {}
}

let stdin = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  stdin += chunk
})
process.stdin.on('end', async () => {
  let output = {}
  try {
    output = await outputFor(JSON.parse(stdin))
  } catch {
    output = {}
  }
  process.stdout.write(`${JSON.stringify(output)}\n`)
})
process.stdin.resume()
