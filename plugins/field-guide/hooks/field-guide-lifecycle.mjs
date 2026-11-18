#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

// The Field Guide modules load only after an event needs them, so a PostToolUse call for an
// unrelated command exits without parsing them.
let fieldGuide
const loadFieldGuide = async () => {
  const { appendAnalyticsEvent } = await import('../skills/field-guide/scripts/field-guide-analytics.mjs')
  const {
    confirmFromPrompt, eventInjection, isMainThread, originOf, promptInjection, sessionStartInjection, storeVersionNotice,
  } = await import('../skills/field-guide/scripts/field-guide.mjs')
  fieldGuide = { appendAnalyticsEvent, confirmFromPrompt, eventInjection, isMainThread, originOf, promptInjection, sessionStartInjection, storeVersionNotice }
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
 * guidance; a near miss keeps the normal flow and adds the note for the agent only.
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
  const systemMessage = confirmed?.systemMessage ? { systemMessage: confirmed.systemMessage } : {}
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

// The two command substitutions the hook reads past: `$(cat <<'EOF'` with its body up to the
// first delimiter line and a `)` on the next, and a one-line `$(…)` with no quotes, parentheses,
// expansions, redirects, or separators. Each becomes the word `$_`, which is never a literal
// path or PR; any other heredoc, substitution, or backtick makes the command unrecognized.
const heredocSubstitution = /\$\([^\S\n]*cat[^\S\n]+<<[^\S\n]*(['"]?)([A-Za-z_]\w*)\1[^\S\n]*\n(?:(?!\2\n)[^\n]*\n)*\2\n[^\S\n]*\)/gu
const plainSubstitution = /\$\([^'"()`$<>;&|\n]*\)/gu
// One separator run or one word. A word joins plain characters, escapes, quoted spans, and a
// redirect's `>&`, so `echo "gh pr merge"` has the words `echo` and `gh pr merge`. A parenthesis
// matches neither, so a subshell stops the scan.
const shellToken = /[^\S\n]*(?:(?<separator>[;&|\n][;&|\s]*)|(?<word>(?:'[^']*'|"(?:[^"\\]|\\[\s\S])*"|\\[\s\S]|[<>]&|[^\s'"\\;&|()])+))/uy
const unquote = (word) => word.replace(
  /'([^']*)'|"((?:[^"\\]|\\[\s\S])*)"|\\([\s\S])/gu,
  (_, single, double, escaped) => single ?? double?.replace(/\\([\s\S])/gu, '$1') ?? escaped,
)

/**
 * Splits a shell command into simple commands, each with its unquoted words and the separator
 * after it without whitespace ('' for a newline, null at the end). Returns null for text it
 * cannot split, including a comment and any substitution it does not read past. This recognizes
 * commands; it is not a shell parser.
 */
const simpleCommands = (command) => {
  const text = command.replace(heredocSubstitution, '$$_').replace(plainSubstitution, '$$_')
  if (/<<|\$\(|`/u.test(text)) return null
  const commands = [{ words: [], next: null }]
  let end = 0
  shellToken.lastIndex = 0
  for (let match = shellToken.exec(text); match; match = shellToken.exec(text)) {
    end = shellToken.lastIndex
    if (match.groups.word?.startsWith('#')) return null
    if (match.groups.word !== undefined) commands.at(-1).words.push(unquote(match.groups.word))
    else {
      commands.at(-1).next = match.groups.separator.replace(/\s/gu, '')
      commands.push({ words: [], next: null })
    }
  }
  if (text.slice(end).trim() !== '') return null
  // A trailing newline or `;` ends the command; a trailing `&` stays and fails the `&&` check.
  if (commands.at(-1).words.length === 0 && commands.length > 1) {
    commands.pop()
    if (['', ';'].includes(commands.at(-1).next)) commands.at(-1).next = null
  }
  return commands.filter(({ words }) => words.length > 0)
}

// Drops leading `NAME=value` assignments and `env` or `command` prefixes.
const withoutPrefixes = (words) => {
  const start = words.findIndex((word) => !/^[A-Za-z_][A-Za-z0-9_]*=/u.test(word) && !['env', 'command'].includes(basename(word)))
  return start < 0 ? [] : words.slice(start)
}

// Returns the script of `bash -c '…'`, `zsh -i -c '…'`, and similar wrappers, or null. Every word
// before the script must be an option, and none may be `-n` or `-o`, which can stop it running.
const wrappedScript = (command) => {
  if (!['sh', 'bash', 'zsh'].includes(basename(command[0] ?? ''))) return null
  const script = command.findIndex((word, index) => index > 0 && !word.startsWith('-'))
  const options = command.slice(1, script)
  if (script < 0 || !options.some((word) => /^-[A-Za-z]*c/u.test(word)) || options.some((word) => /^-[A-Za-z]*[no]/u.test(word))) return null
  return command[script]
}

// A path the hook can resolve without the shell: no expansion, globbing, or `cd -`.
const literalPath = (word) => word !== undefined && !/^[-~]|[$*?[\]{}]/u.test(word)

// Only `cd <literal path> &&` changes the directory; any other `cd`, `pushd`, or `popd` makes it unknown.
const directoryAfter = ({ command, next, dir }) => {
  if (!['cd', 'pushd', 'popd'].includes(command[0])) return dir
  const literal = command[0] === 'cd' && command.length === 2 && next === '&&' && literalPath(command[1])
  return dir !== null && literal ? resolve(dir, command[1]) : null
}

/**
 * Lists a script's simple commands with the directory each runs in, opening shell wrappers one
 * level. A wrapper's last command takes the wrapper's separator, because its exit status is the
 * wrapper's. A wrapper's `cd` stays inside the wrapper; an unknown directory is null.
 */
const chainOf = ({ script, cwd, nested = false }) => {
  const commands = simpleCommands(script)
  if (commands === null) return null
  const chain = []
  let dir = cwd
  for (const { words, next } of commands) {
    const command = withoutPrefixes(words)
    const inner = nested ? null : wrappedScript(command)
    if (inner !== null) {
      const innerChain = chainOf({ script: inner, cwd: dir, nested: true })
      if (!innerChain?.length) return null
      innerChain.at(-1).next ??= next
      chain.push(...innerChain)
      continue
    }
    chain.push({ command, next, dir })
    dir = directoryAfter({ command, next, dir })
  }
  return chain
}

// A cheap check that runs before any parsing: every recognized command names gh or the CLI.
const mayNameEvent = /\bgh\b|field-guide\.(?:sh|mjs)/u
const fieldGuideScript = /^field-guide\.(?:sh|mjs)$/u
const hashOf = (text) => createHash('sha256').update(text).digest('hex')
const ghEvents = new Map([['pr merge', 'pr-merged'], ['stack merge', 'pr-merged'], ['pr create', 'pr-created']])
// Help, a dry run, a browser form, and turning off auto-merge create or merge nothing.
const nonActions = ['--help', '-h', '--dry-run', '--web', '-w', '--disable-auto']
const pullRequestUrl = /^https?:\/\/([^/\s]+\/[^/\s]+\/[^/\s]+)\/pull\/(\d+)(?:[/?#]\S*)?$/u

// The `gh pr merge` options that take a separate value, from `gh pr merge --help`.
const valueOptions = ['-A', '--author-email', '-b', '--body', '-F', '--body-file', '--match-head-commit', '-t', '--subject', '-R', '--repo']

// The positional PR of a `gh pr merge` by number or URL; null for the current branch.
const positionalOf = (words) => words.slice(3).find((word, index, rest) => !word.startsWith('-') && !valueOptions.includes(rest[index - 1]))
const pullRequestOf = (words) => {
  const target = positionalOf(words) ?? ''
  const url = pullRequestUrl.exec(target)
  if (url) return { repo: url[1], number: url[2] }
  return /^#?\d+$/u.test(target) ? { repo: null, number: target.replace(/^#/u, '') } : null
}

// The `-R`, `--repo`, or `--repo=` value as host/owner/repo, or null.
const repoFlagOf = (words) => {
  const index = words.findIndex((word) => word === '-R' || word === '--repo')
  const repo = index >= 0 ? words[index + 1] : words.find((word) => word.startsWith('--repo='))?.slice('--repo='.length)
  return repo === undefined ? null : repo.split('/').length === 2 ? `github.com/${repo}` : repo
}

// Option spellings the hook does not read: a short-option cluster or attached value that includes
// a value option, and `--flag=value` for a flag that takes no value.
const unreadOption = (word) => (/^-[^-]./u.test(word) && /[AFRbt]/u.test(word.slice(1)))
  || (/^--[^=]+=/u.test(word) && !valueOptions.includes(word.slice(0, word.indexOf('='))))

const ghEventFor = ({ command, dir }) => {
  const event = ghEvents.get(command.slice(1, 3).join(' '))
  if (!event || command.some(unreadOption)) return null
  const merge = command[1] === 'pr' && event === 'pr-merged'
  // A substitution or variable in the PR position can name another PR or repository.
  if (merge && positionalOf(command)?.includes('$')) return null
  const pullRequest = merge ? pullRequestOf(command) : null
  const repo = pullRequest?.repo ?? repoFlagOf(command)
  return { event, dir, repo, pullRequest, queuedMerge: event === 'pr-merged' && command.includes('--auto') }
}

// A retrieve has no PR: the agent asked for that output, so it gets the marked lines every time.
const retrieveEventFor = ({ command, dir }) => {
  // The script runs directly or as a node, sh, or bash script; elsewhere it is only an argument.
  const script = fieldGuideScript.test(basename(command[0])) ? 0
    : ['node', 'sh', 'bash'].includes(basename(command[0])) && fieldGuideScript.test(basename(command[1] ?? '')) ? 1 : -1
  // Another guide root is not the store this hook reads.
  if (script < 0 || command[script + 1] !== 'retrieve' || command.some((word) => word.startsWith('--guide-root'))) return null
  const valueOf = (option) => (command.includes(option) ? command[command.indexOf(option) + 1] ?? null : undefined)
  const event = valueOf('--event')
  const repoRoot = valueOf('--repo-root')
  if (typeof event !== 'string' || repoRoot === null) return null
  const root = repoRoot === undefined ? dir : dir !== null && literalPath(repoRoot) ? resolve(dir, repoRoot) : null
  return { event, dir: root, pullRequest: null, queuedMerge: false }
}

// Returns the Field Guide event a simple command stands for, or null.
const eventFor = ({ command, dir }) => {
  if (command.length === 0 || command.some((word) => nonActions.includes(word))) return null
  return basename(command[0]) === 'gh' ? ghEventFor({ command, dir }) : retrieveEventFor({ command, dir })
}

/**
 * Lists the Field Guide events in a PostToolUse Bash call that a zero exit proves ran and
 * succeeded: no `||` anywhere, and only `&&` after the event's command. Returns none when the
 * events' repository is unknown or differs. Loads no module.
 */
const toolEvents = (input) => {
  const command = input.tool_input?.command
  if (typeof command !== 'string' || typeof input.cwd !== 'string' || !mayNameEvent.test(command)) return []
  // A background command returns when it starts, so its result proves nothing.
  if (input.tool_input.run_in_background === true || input.tool_response?.backgroundTaskId !== undefined) return []
  // GH_REPO and GH_HOST change the repository gh acts on.
  if (/\bGH_(?:REPO|HOST)=/u.test(command)) return []
  const chain = chainOf({ script: command, cwd: input.cwd }) ?? []
  if (chain.some(({ next }) => next === '||')) return []
  const events = chain
    .map((entry, index) => (chain.slice(index).every(({ next }) => next === '&&' || next === null) ? eventFor(entry) : null))
    .filter(Boolean)
  return events.every(({ dir }) => dir !== null && dir === events[0].dir) ? events : []
}

// Claude reports failures as PostToolUseFailure; these checks cover the other result shapes.
const commandFailed = (response) => {
  if (typeof response === 'string') return /^(?:Exit code:|Process exited with code) *[1-9]/mu.test(response)
  if (!response || typeof response !== 'object') return false
  return response.interrupted === true || response.is_error === true || response.isError === true
    || [response.exit_code, response.exitCode].some((code) => typeof code === 'number' && code !== 0)
    || (typeof response.error === 'string' && response.error.length > 0)
}

// Codex sends a failed command to PostToolUse too, with a response of any type, so a Codex event
// needs a zero exit: the first exit line of the output text, which precedes the command's own
// output, or a numeric exit code field.
const codexSucceeded = (response) => (typeof response === 'string'
  ? /^(?:Exit code:|Process exited with code) *(\d+)/mu.exec(response)?.[1] === '0'
  : [response?.exit_code, response?.exitCode, response?.metadata?.exit_code].includes(0))

/**
 * Injects one block of event-tagged guidance in a main thread only. A merge that names its PR
 * injects once per PR per session; other events inject every time.
 */
const toolOutput = ({ input, events }) => {
  if (typeof input.session_id !== 'string' || !mainThreadFor(input) || !hasGuide()) return {}
  try {
    const repoRoot = events[0].dir
    const origin = events.some(({ repo, pullRequest }) => repo || pullRequest) ? fieldGuide.originOf({ repoRoot }).toLowerCase() : ''
    // A PR URL or `--repo` outside the directory's origin leaves the project unknown.
    if (events.some(({ repo }) => repo && repo.toLowerCase() !== origin)) return {}
    const state = readSessionState(input.session_id)
    // The key names the PR as host/owner/repo#number, so its number and URL forms match.
    // A queued merge has not happened yet, so it leaves the PR pending.
    const keyed = events.map((event) => ({ ...event, key: event.pullRequest && origin && !event.queuedMerge ? hashOf(`${event.event}\0${origin}#${event.pullRequest.number}`) : null }))
    const pending = keyed.filter(({ key }, index) => key === null || (!state.eventKeys.includes(key) && keyed.findIndex((other) => other.key === key) === index))
    if (pending.length === 0) return {}
    const injection = fieldGuide.eventInjection({
      repoRoot,
      events: unique(pending.map(({ event }) => event)),
      queuedMerge: pending.some(({ queuedMerge }) => queuedMerge),
      mainThread: true,
    })
    // With nothing tagged, the event records nothing, so a later one can still inject.
    if (!injection) return {}
    // Write state before returning text so a failed write never repeats injection.
    writeSessionState(input.session_id, {
      ...state,
      injectedIds: unique([...state.injectedIds, ...injection.guidanceIds]),
      eventKeys: [...state.eventKeys, ...pending.map(({ key }) => key).filter(Boolean)],
      sharedIds: unique([...state.sharedIds, ...injection.sharedIds]),
    })
    return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: injection.text } }
  } catch {
    // A failed retrieval, state read, or state write suppresses guidance and records nothing.
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
    if (events.length === 0) return {}
    if (hostName() === 'codex' ? !codexSucceeded(input.tool_response) : commandFailed(input.tool_response)) return {}
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
