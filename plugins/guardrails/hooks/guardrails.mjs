#!/usr/bin/env node
// PreToolUse guardrails for shell commands. Denies AI attribution in commits and pull
// requests, and asks before a pull request merge or a 1Password CLI call.
// Any internal error exits 0 with no decision, so a hook bug never blocks work.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const MAX_WRAPPER_DEPTH = 5

const AI_NAME = String.raw`(?:claude|codex|gpt|openai|anthropic|copilot|gemini)`
const CO_AUTHOR_LINE = new RegExp(String.raw`^\s*co-authored-by:.*${AI_NAME}`, 'iu')
const GENERATED_LINE = new RegExp(String.raw`^\s*(?:🤖\s*)?generated (?:with|by)\b.*${AI_NAME}`, 'iu')

const DENY_ATTRIBUTION = {
  permissionDecision: 'deny',
  permissionDecisionReason: 'Commit and pull request text must not contain AI attribution: a Co-Authored-By line naming an AI, or a "Generated with" footer. Remove the AI attribution line(s) and retry.',
}
const ASK_MERGE = 'Merging a pull request needs explicit user authorization.'
const ASK_ONE_PASSWORD = '1Password CLI access needs user approval. State the exact vault, item, and field (or search query), why you need it, and the scope of data you will retrieve.'

// --- Shell tokenizer ---------------------------------------------------------
// Splits a script into simple commands, each a list of words after quote removal.
// Command substitutions, backticks, and process substitutions are parsed as commands
// too, and their raw text stays in the surrounding word. Heredoc bodies are skipped:
// they are data, and the attribution scan reads them from the raw script.

const readAnsiC = (src, start) => {
  const escapes = { n: '\n', t: '\t', r: '\r' }
  let text = ''
  let i = start
  while (i < src.length && src[i] !== "'") {
    if (src[i] === '\\' && i + 1 < src.length) {
      text += escapes[src[i + 1]] ?? src[i + 1]
      i += 2
    } else {
      text += src[i]
      i += 1
    }
  }
  return { text, end: i + 1 }
}

const closingBacktick = (src, start) => {
  let i = start
  while (i < src.length && src[i] !== '`') i += src[i] === '\\' ? 2 : 1
  return Math.min(i, src.length)
}

const parse = (src, start = 0, nested = false) => {
  const commands = []
  let words = []
  let word = null
  let isRedirectTarget = false
  let pendingHeredocs = []
  let depth = 0
  let i = start

  const append = (text) => {
    word = (word ?? '') + text
  }
  const endWord = () => {
    if (word === null) return
    if (!isRedirectTarget) words.push(word)
    isRedirectTarget = false
    word = null
  }
  const endCommand = () => {
    endWord()
    if (words.length > 0) commands.push(words)
    words = []
  }
  // Parses $( … ) or <( … ) starting at the opening parenthesis and keeps its raw text.
  const substitution = (from, open) => {
    const inner = parse(src, open + 1, true)
    commands.push(...inner.commands)
    append(src.slice(from, inner.end + 1))
    return inner.end + 1
  }
  const backticks = (from) => {
    const close = closingBacktick(src, from + 1)
    commands.push(...parse(src.slice(from + 1, close).replaceAll('\\`', '`')).commands)
    append(src.slice(from, close + 1))
    return close + 1
  }
  const doubleQuoted = (from) => {
    append('')
    let j = from
    while (j < src.length && src[j] !== '"') {
      if (src[j] === '\\' && '$`"\\\n'.includes(src[j + 1] ?? 'x')) {
        if (src[j + 1] !== '\n') append(src[j + 1])
        j += 2
      } else if (src[j] === '$' && src[j + 1] === '(') {
        j = substitution(j, j + 1)
      } else if (src[j] === '`') {
        j = backticks(j)
      } else {
        append(src[j])
        j += 1
      }
    }
    return j + 1
  }
  const heredocOperator = (from) => {
    let j = from
    const stripTabs = src[j] === '-'
    if (stripTabs) j += 1
    while (src[j] === ' ' || src[j] === '\t') j += 1
    let delimiter = ''
    while (j < src.length && !' \t\n;&|<>()'.includes(src[j])) {
      if (src[j] === "'" || src[j] === '"') {
        const close = src.indexOf(src[j], j + 1)
        const end = close === -1 ? src.length : close
        delimiter += src.slice(j + 1, end)
        j = end + 1
      } else if (src[j] === '\\') {
        delimiter += src[j + 1] ?? ''
        j += 2
      } else {
        delimiter += src[j]
        j += 1
      }
    }
    pendingHeredocs.push({ delimiter, stripTabs })
    return j
  }
  const skipHeredocBodies = (from) => {
    let j = from
    for (const { delimiter, stripTabs } of pendingHeredocs) {
      while (j < src.length) {
        const newline = src.indexOf('\n', j)
        const lineEnd = newline === -1 ? src.length : newline
        const line = src.slice(j, lineEnd)
        j = lineEnd + 1
        if ((stripTabs ? line.replace(/^\t+/u, '') : line) === delimiter) break
      }
    }
    pendingHeredocs = []
    return j
  }

  while (i < src.length) {
    const c = src[i]
    const next = src[i + 1]
    if (c === '\\') {
      if (next !== '\n') append(next ?? '')
      i += 2
    } else if (c === "'") {
      const close = src.indexOf("'", i + 1)
      const end = close === -1 ? src.length : close
      append(src.slice(i + 1, end))
      i = end + 1
    } else if (c === '$' && next === "'") {
      const { text, end } = readAnsiC(src, i + 2)
      append(text)
      i = end
    } else if (c === '"') {
      i = doubleQuoted(i + 1)
    } else if (c === '$' && next === '(') {
      i = substitution(i, i + 1)
    } else if ((c === '<' || c === '>') && next === '(') {
      i = substitution(i, i + 1)
    } else if (c === '`') {
      i = backticks(i)
    } else if (c === '#' && word === null) {
      const newline = src.indexOf('\n', i)
      i = newline === -1 ? src.length : newline
    } else if (c === '\n') {
      endCommand()
      i = skipHeredocBodies(i + 1)
    } else if (c === ' ' || c === '\t') {
      endWord()
      i += 1
    } else if (c === '&' && next === '>') {
      endWord()
      isRedirectTarget = true
      i += src[i + 2] === '>' ? 3 : 2
    } else if (c === ';' || c === '&' || c === '|') {
      endCommand()
      i += next === c || (c === '|' && next === '&') ? 2 : 1
    } else if (c === '(') {
      endCommand()
      depth += 1
      i += 1
    } else if (c === ')') {
      if (nested && depth === 0) {
        endCommand()
        return { commands, end: i }
      }
      endCommand()
      depth = Math.max(0, depth - 1)
      i += 1
    } else if (src.startsWith('<<<', i)) {
      // A here-string's word stays an ordinary word, so the attribution scan sees it.
      endWord()
      i += 3
    } else if (c === '<' && next === '<') {
      endWord()
      i = heredocOperator(i + 2)
    } else if (c === '<' || c === '>') {
      // A file descriptor number such as the 2 in 2>&1 belongs to the redirection.
      if (word !== null && /^\d+$/u.test(word)) word = null
      endWord()
      isRedirectTarget = true
      i += 1
      while (i < src.length && '<>&|'.includes(src[i])) i += 1
    } else {
      append(c)
      i += 1
    }
  }
  endCommand()
  return { commands, end: src.length }
}

// --- Command classification ---------------------------------------------------

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/u
const TRANSPARENT_PREFIXES = new Set(['!', '{', '}', 'if', 'then', 'else', 'elif', 'do', 'while', 'until', 'time', 'nohup', 'command', 'exec'])
const SHELLS = new Set(['bash', 'zsh', 'sh', 'dash', 'ksh'])

// Drops variable assignments and prefixes that run the next word as the command.
const commandArgv = (words) => {
  let k = 0
  while (k < words.length) {
    if (TRANSPARENT_PREFIXES.has(words[k]) || ASSIGNMENT.test(words[k])) {
      k += 1
    } else if (words[k] === 'env') {
      k += 1
      while (k < words.length && (words[k].startsWith('-') || ASSIGNMENT.test(words[k]))) k += 1
    } else {
      break
    }
  }
  const argv = words.slice(k)
  if (argv.length > 0) argv[0] = basename(argv[0])
  return argv
}

// Returns the script of `bash -c '…'`, `zsh -i -c '…'`, and similar wrappers.
const wrappedScript = (argv) => {
  if (!SHELLS.has(argv[0])) return null
  let hasScriptFlag = false
  for (let k = 1; k < argv.length; k += 1) {
    const arg = argv[k]
    if (arg.startsWith('--')) continue
    if (/^[-+][A-Za-z]+$/u.test(arg)) {
      if (arg.startsWith('-') && arg.includes('c')) hasScriptFlag = true
      if (arg === '-o' || arg === '+o') k += 1
      continue
    }
    return hasScriptFlag ? arg : null
  }
  return null
}

const collectCommands = (script, depth = 0) => parse(script).commands.flatMap((words) => {
  const argv = commandArgv(words)
  const inner = wrappedScript(argv)
  const nested = inner !== null && depth < MAX_WRAPPER_DEPTH ? collectCommands(inner, depth + 1) : []
  return [{ argv, words }, ...nested]
})

// Values of one option, in long (`--file x`, `--file=x`) and short (`-F x`, `-Fx`, `-aF x`) forms.
// `shortWithValue` lists every short option that consumes a value, so `-m "-Fx"` is not misread.
const optionValues = ({ args, long, short, shortWithValue }) => {
  const values = []
  for (let k = 0; k < args.length; k += 1) {
    const arg = args[k]
    if (arg === '--') break
    if (arg.startsWith('--')) {
      const equals = arg.indexOf('=')
      const name = equals === -1 ? arg : arg.slice(0, equals)
      if (long.includes(name)) values.push(equals === -1 ? args[(k += 1)] : arg.slice(equals + 1))
      continue
    }
    if (!arg.startsWith('-')) continue
    for (let p = 1; p < arg.length; p += 1) {
      if (!shortWithValue.includes(arg[p])) continue
      const value = p + 1 < arg.length ? arg.slice(p + 1) : args[(k += 1)]
      if (arg[p] === short) values.push(value)
      break
    }
  }
  // `-` reads standard input, which the script scan already covers.
  return values.filter((value) => typeof value === 'string' && value !== '' && value !== '-')
}

const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env'])

const gitSubcommand = (argv) => {
  for (let k = 1; k < argv.length; k += 1) {
    if (GIT_OPTIONS_WITH_VALUE.has(argv[k])) k += 1
    else if (!argv[k].startsWith('-')) return { name: argv[k], args: argv.slice(k + 1) }
  }
  return null
}

const GH_API_OPTIONS_WITH_VALUE = new Set(['-H', '--header', '-q', '--jq', '-t', '--template', '--hostname', '--cache', '-p', '--preview'])

const ghApi = (args) => {
  let method = null
  let endpoint = null
  let hasInput = false
  const fields = []
  for (let k = 0; k < args.length; k += 1) {
    const arg = args[k]
    if (arg === '-X' || arg === '--method') method = args[(k += 1)] ?? ''
    else if (arg.startsWith('--method=')) method = arg.slice('--method='.length)
    else if (/^-X./u.test(arg)) method = arg.slice(2)
    else if (['-f', '-F', '--field', '--raw-field'].includes(arg)) fields.push({ typed: ['-F', '--field'].includes(arg), value: args[(k += 1)] ?? '' })
    else if (/^--(?:raw-)?field=/u.test(arg)) fields.push({ typed: arg.startsWith('--field='), value: arg.slice(arg.indexOf('=') + 1) })
    else if (arg === '--input') {
      hasInput = true
      k += 1
    } else if (GH_API_OPTIONS_WITH_VALUE.has(arg)) k += 1
    else if (!arg.startsWith('-')) endpoint ??= arg
  }
  const defaultMethod = fields.length > 0 || hasInput ? 'POST' : 'GET'
  return { method: (method || defaultMethod).toUpperCase(), endpoint: endpoint ?? '', fields }
}

const PULL_OR_ISSUE_ENDPOINT = /(?:^|\/)(?:pulls|issues)(?:\/|$)/u
const MERGE_ENDPOINT = /(?:^|\/)pulls\/[^/]+\/merge\/?(?:\?|$)/u

// Returns the message files of a commit or pull request write, or null when argv is neither.
const attributionTarget = (argv) => {
  if (argv[0] === 'git') {
    const subcommand = gitSubcommand(argv)
    if (subcommand?.name !== 'commit') return null
    return optionValues({ args: subcommand.args, long: ['--file'], short: 'F', shortWithValue: 'mFcCt' })
  }
  if (argv[0] !== 'gh') return null
  const [, group, action] = argv
  if ((group === 'pr' && ['create', 'edit', 'comment'].includes(action)) || (group === 'issue' && action === 'comment')) {
    return optionValues({ args: argv.slice(3), long: ['--body-file'], short: 'F', shortWithValue: 'F' })
  }
  if (group !== 'api') return null
  const api = ghApi(argv.slice(2))
  if (api.method === 'GET' || !PULL_OR_ISSUE_ENDPOINT.test(api.endpoint)) return null
  return api.fields.filter(({ typed }) => typed).map(({ value }) => /^body=@(.+)$/su.exec(value)?.[1]).filter(Boolean)
}

const isMerge = (argv) => {
  if (argv[0] !== 'gh') return false
  if (argv[1] === 'pr' && argv[2] === 'merge') return true
  if (argv[1] !== 'api') return false
  const api = ghApi(argv.slice(2))
  return api.method === 'PUT' && MERGE_ENDPOINT.test(api.endpoint)
}

// --- Attribution scan ---------------------------------------------------------

const readMessageFile = ({ path, cwd }) => {
  const expanded = path.startsWith('~/') ? join(homedir(), path.slice(2)) : path
  try {
    return readFileSync(resolve(cwd, expanded), 'utf8')
  } catch {
    // An unreadable message file cannot be inspected; allow rather than block on a guess.
    return ''
  }
}

// Lines split on real newlines and on literal \n, which printf and echo -e expand.
const hasAttribution = (text) => text
  .split(/\r?\n|\\n/u)
  .some((line) => CO_AUTHOR_LINE.test(line) || GENERATED_LINE.test(line))

// A word such as `body=…` or `--body=…` carries its text after the first `=`.
const wordTexts = (word) => (word.includes('=') ? [word, word.slice(word.indexOf('=') + 1)] : [word])

const evaluate = ({ command, cwd }) => {
  const commands = collectCommands(command)
  const messageFiles = commands.map(({ argv }) => attributionTarget(argv)).filter((files) => files !== null)
  if (messageFiles.length > 0) {
    // Scan the whole script, not only the target's arguments: the message can arrive
    // through a pipe, a heredoc, or a file written earlier in the same command. The raw
    // script holds heredoc bodies line for line; words hold quoted and $'…' text.
    const texts = [
      command,
      ...commands.flatMap(({ words }) => words.flatMap(wordTexts)),
      ...messageFiles.flat().map((path) => readMessageFile({ path, cwd })),
    ]
    if (texts.some(hasAttribution)) return DENY_ATTRIBUTION
  }
  const reasons = [
    commands.some(({ argv }) => isMerge(argv)) && ASK_MERGE,
    commands.some(({ argv }) => argv[0] === 'op') && ASK_ONE_PASSWORD,
  ].filter(Boolean)
  return reasons.length > 0 ? { permissionDecision: 'ask', permissionDecisionReason: reasons.join(' ') } : null
}

const main = () => {
  const input = JSON.parse(readFileSync(0, 'utf8'))
  const command = input?.tool_input?.command
  if (typeof command !== 'string') return
  const decision = evaluate({ command, cwd: typeof input.cwd === 'string' ? input.cwd : process.cwd() })
  // Codex sets PLUGIN_ROOT and does not support `ask` yet: it reports a hook error and runs
  // the command. Its execpolicy rules prompt for these commands instead.
  if (decision === null || (decision.permissionDecision === 'ask' && process.env.PLUGIN_ROOT)) return
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...decision } })}\n`)
}

try {
  main()
} catch {
  // Fail open: a parse or runtime error leaves the normal permission flow in charge.
}
