#!/usr/bin/env node
// PreToolUse guardrails for shell commands. Denies AI attribution in commits and pull
// requests, and asks before a 1Password CLI call.
// Any internal error exits 0 with no decision, so a hook bug never blocks work.
import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const MAX_WRAPPER_DEPTH = 5
const MAX_MESSAGE_FILE_BYTES = 256 * 1024

const AI_NAME = String.raw`(?:claude|codex|gpt|openai|anthropic|copilot|gemini)`
const CO_AUTHOR_LINE = new RegExp(String.raw`^\s*co-authored-by:.*${AI_NAME}`, 'iu')
const GENERATED_LINE = new RegExp(String.raw`^\s*(?:🤖\s*)?generated (?:with|by)\b.*${AI_NAME}`, 'iu')
const FENCE_LINE = /^\s*(`{3,}|~{3,})/u

const DENY_ATTRIBUTION = {
  permissionDecision: 'deny',
  permissionDecisionReason: 'Commit and pull request text must not contain AI attribution: a Co-Authored-By line naming an AI, or a "Generated with" footer. Remove the AI attribution line(s) and retry.',
}
const DENY_CODEX_UNPROMPTABLE = {
  permissionDecision: 'deny',
  permissionDecisionReason: 'This command needs user approval, and Codex can ask only for a plain `op …` command. Run it as its own command, with no shell wrapper, variable prefix, full path, or redirection, so Codex prompts the user. If the plain form is also denied, stop and ask the user to run it.',
}
const ASK_ONE_PASSWORD = '1Password CLI access needs user approval. State the exact vault, item, and field (or search query), why you need it, and the scope of data you will retrieve.'

// --- Shell tokenizer ---------------------------------------------------------
// Splits a script into simple commands. A command keeps its words after quote removal,
// the heredoc and here-string text attached to it, the operator before it, and the
// command before it. Commands inside $( … ), backticks, process substitutions, and
// unquoted heredocs are parsed too; their raw text stays in the surrounding word.

// `substitution` is the raw $( … ), <( … ), or backtick text a command ran inside, if any.
const newCommand = ({ separator, previous }) => ({ words: [], stdin: [], separator, previous, substitution: null })

const createTokenizer = ({ src, start = 0, nested = false }) => ({
  src,
  i: start,
  nested,
  depth: 0,
  closed: false,
  commands: [],
  last: null,
  current: newCommand({ separator: null, previous: null }),
  word: null,
  // 'redirect' drops the next word; 'herestring' attaches it to the command's stdin.
  target: null,
  pendingHeredocs: [],
})

const append = (t, text) => {
  t.word = (t.word ?? '') + text
}

const endWord = (t) => {
  if (t.word === null) return
  if (t.target === 'herestring') t.current.stdin.push(t.word)
  else if (t.target === null) t.current.words.push(t.word)
  t.target = null
  t.word = null
}

const endCommand = (t, separator) => {
  endWord(t)
  if (t.current.words.length > 0) {
    t.commands.push(t.current)
    t.last = t.current
  }
  t.current = newCommand({ separator, previous: t.last })
}

// Keeps the substitution's commands and its raw text, which stays in the surrounding word.
const addSubstitution = (t, { commands, end }) => {
  const raw = t.src.slice(t.i, end + 1)
  for (const command of commands) command.substitution ??= raw
  t.commands.push(...commands)
  append(t, raw)
  t.i = end + 1
}

const readSubstitution = (t) => {
  const inner = parse(t.src, t.i + 2, true)
  addSubstitution(t, inner)
}

const readBacktick = (t) => {
  let close = t.i + 1
  while (close < t.src.length && t.src[close] !== '`') close += t.src[close] === '\\' ? 2 : 1
  addSubstitution(t, { commands: parse(t.src.slice(t.i + 1, close).replaceAll('\\`', '`')).commands, end: close })
}

// Reads text where $( … ) and backticks run: a double-quoted string up to `closing`,
// or a whole unquoted heredoc body when `closing` is undefined.
const readExpanding = (t, closing) => {
  append(t, '')
  while (t.i < t.src.length && t.src[t.i] !== closing) {
    const [c, next] = [t.src[t.i], t.src[t.i + 1]]
    if (c === '\\' && next !== undefined && '$`"\\\n'.includes(next)) {
      append(t, next === '\n' ? '' : next)
      t.i += 2
    } else if (c === '$' && next === '(') readSubstitution(t)
    else if (c === '`') readBacktick(t)
    else {
      append(t, c)
      t.i += 1
    }
  }
  t.i += 1
}

const readAnsiC = (t) => {
  const escapes = { n: '\n', t: '\t', r: '\r' }
  append(t, '')
  t.i += 2
  while (t.i < t.src.length && t.src[t.i] !== "'") {
    const escaped = t.src[t.i] === '\\' && t.i + 1 < t.src.length
    append(t, escaped ? escapes[t.src[t.i + 1]] ?? t.src[t.i + 1] : t.src[t.i])
    t.i += escaped ? 2 : 1
  }
  t.i += 1
}

const HEREDOC_WORD_END = /[\s;&|<>()]/u

// Reads one part of a heredoc delimiter: a quoted string, an escaped character, or a plain character.
const readDelimiterPart = (t) => {
  const c = t.src[t.i]
  const close = c === "'" || c === '"' ? t.src.indexOf(c, t.i + 1) : -1
  if (close !== -1) {
    const text = t.src.slice(t.i + 1, close)
    t.i = close + 1
    return { text, quoted: true }
  }
  const escaped = c === '\\'
  t.i += escaped ? 2 : 1
  return { text: escaped ? t.src[t.i - 1] ?? '' : c, quoted: escaped }
}

// Reads a heredoc delimiter word with quote removal: <<EOF, <<'EOF', <<E"OF", <<E\OF.
// A quoted or escaped part anywhere in the word makes the body literal text.
const readHeredocDelimiter = (t) => {
  let delimiter = ''
  let quoted = false
  while (t.i < t.src.length && !HEREDOC_WORD_END.test(t.src[t.i])) {
    const part = readDelimiterPart(t)
    delimiter += part.text
    quoted ||= part.quoted
  }
  return { delimiter, quoted }
}

const readHeredocOperator = (t) => {
  endWord(t)
  t.i += 2
  const stripTabs = t.src[t.i] === '-'
  if (stripTabs) t.i += 1
  while (t.src[t.i] === ' ' || t.src[t.i] === '\t') t.i += 1
  const { delimiter, quoted } = readHeredocDelimiter(t)
  t.pendingHeredocs.push({ delimiter, stripTabs, expands: !quoted, owner: t.current })
}

// Returns the body, or null when no closing delimiter follows. Then the scan resumes at
// the body's first line, so a misread delimiter cannot hide the rest of the script.
const readHeredocBody = (t, { delimiter, stripTabs }) => {
  const start = t.i
  const lines = []
  while (t.i < t.src.length) {
    const newline = t.src.indexOf('\n', t.i)
    const end = newline === -1 ? t.src.length : newline
    const line = t.src.slice(t.i, end)
    t.i = end + 1
    if ((stripTabs ? line.replace(/^\t+/u, '') : line) === delimiter) return lines.join('\n')
    lines.push(line)
  }
  t.i = start
  return null
}

const substitutionsIn = (text) => {
  const t = createTokenizer({ src: text })
  readExpanding(t, undefined)
  return t.commands
}

const attachHeredocBodies = (t) => {
  for (const heredoc of t.pendingHeredocs) {
    const body = readHeredocBody(t, heredoc)
    if (body === null) break
    heredoc.owner.stdin.push(body)
    if (heredoc.expands) t.commands.push(...substitutionsIn(body))
  }
  t.pendingHeredocs = []
}

const scanEscape = (t) => {
  if (t.src[t.i] !== '\\') return false
  const next = t.src[t.i + 1]
  if (next !== '\n') append(t, next ?? '')
  t.i += 2
  return true
}

const scanSingleQuote = (t) => {
  if (t.src[t.i] !== "'") return false
  const close = t.src.indexOf("'", t.i + 1)
  const end = close === -1 ? t.src.length : close
  append(t, t.src.slice(t.i + 1, end))
  t.i = end + 1
  return true
}

const scanQuoted = (t) => {
  if (t.src.startsWith("$'", t.i)) readAnsiC(t)
  else if (t.src[t.i] === '"') {
    t.i += 1
    readExpanding(t, '"')
  } else return false
  return true
}

const scanSubstitution = (t) => {
  if (t.src[t.i + 1] !== '(' || !'$<>'.includes(t.src[t.i])) return false
  readSubstitution(t)
  return true
}

const scanBacktick = (t) => {
  if (t.src[t.i] !== '`') return false
  readBacktick(t)
  return true
}

const scanComment = (t) => {
  if (t.src[t.i] !== '#' || t.word !== null) return false
  const newline = t.src.indexOf('\n', t.i)
  t.i = newline === -1 ? t.src.length : newline
  return true
}

const scanNewline = (t) => {
  if (t.src[t.i] !== '\n') return false
  endCommand(t, '\n')
  t.i += 1
  attachHeredocBodies(t)
  return true
}

const scanBlank = (t) => {
  if (t.src[t.i] !== ' ' && t.src[t.i] !== '\t') return false
  endWord(t)
  t.i += 1
  return true
}

const scanRedirection = (t) => {
  const { src, i } = t
  if (src.startsWith('<<<', i)) {
    endWord(t)
    t.target = 'herestring'
    t.i += 3
  } else if (src.startsWith('<<', i)) readHeredocOperator(t)
  else if (src[i] === '<' || src[i] === '>' || src.startsWith('&>', i)) {
    // A file descriptor number such as the 2 in 2>&1 belongs to the redirection.
    if (/^\d+$/u.test(t.word ?? '')) t.word = null
    endWord(t)
    t.target = 'redirect'
    t.i += 1
    while (t.i < src.length && '<>&|'.includes(src[t.i])) t.i += 1
  } else return false
  return true
}

const OPERATORS = ['&&', '||', '|&', ';;', ';', '&', '|']

const scanOperator = (t) => {
  const operator = OPERATORS.find((candidate) => t.src.startsWith(candidate, t.i))
  if (operator === undefined) return false
  endCommand(t, operator === '|&' ? '|' : operator)
  t.i += operator.length
  return true
}

const scanParenthesis = (t) => {
  const c = t.src[t.i]
  if (c !== '(' && c !== ')') return false
  endCommand(t, c)
  // A subshell's commands, such as its `cd`, do not chain to the commands after it.
  if (c === ')') {
    t.last = null
    t.current.previous = null
  }
  if (c === ')' && t.nested && t.depth === 0) {
    t.closed = true
    return true
  }
  t.depth = Math.max(0, t.depth + (c === '(' ? 1 : -1))
  t.i += 1
  return true
}

const SCANNERS = [scanEscape, scanSingleQuote, scanQuoted, scanSubstitution, scanBacktick, scanComment, scanNewline, scanBlank, scanRedirection, scanOperator, scanParenthesis]

const parse = (src, start = 0, nested = false) => {
  const t = createTokenizer({ src, start, nested })
  while (t.i < src.length && !t.closed) {
    if (!SCANNERS.some((scan) => scan(t))) {
      append(t, src[t.i])
      t.i += 1
    }
  }
  if (!t.closed) endCommand(t, null)
  return { commands: t.commands, end: t.closed ? t.i : src.length }
}

// --- Command classification ---------------------------------------------------

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/u
const TRANSPARENT_PREFIXES = new Set(['!', '{', '}', 'if', 'then', 'else', 'elif', 'do', 'while', 'until', 'time', 'nohup', 'command', 'exec'])
const SHELLS = new Set(['bash', 'zsh', 'sh', 'dash', 'ksh'])
const SHELL_OPTION = /^[-+][A-Za-z]+$/u

// Drops variable assignments and prefixes that run the next word as the command.
const commandArgv = (words) => {
  let k = 0
  while (k < words.length) {
    if (TRANSPARENT_PREFIXES.has(words[k]) || ASSIGNMENT.test(words[k])) k += 1
    else if (words[k] === 'env') {
      k += 1
      while (k < words.length && (words[k].startsWith('-') || ASSIGNMENT.test(words[k]))) k += 1
    } else break
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
    if (!arg.startsWith('--') && !SHELL_OPTION.test(arg)) return hasScriptFlag ? arg : null
    hasScriptFlag ||= /^-[A-Za-z]*c/u.test(arg)
    if (arg === '-o' || arg === '+o') k += 1
  }
  return null
}

const collectCommands = (script, depth = 0) => parse(script).commands.flatMap((command) => {
  const argv = commandArgv(command.words)
  const inner = wrappedScript(argv)
  const nested = inner !== null && depth < MAX_WRAPPER_DEPTH ? collectCommands(inner, depth + 1) : []
  return [{ argv, command }, ...nested]
})

// Reads `--name value` or `--name=value`. Returns the index of the last argument used.
const readLongOption = ({ args, k, long, add }) => {
  const equals = args[k].indexOf('=')
  const name = equals === -1 ? args[k] : args[k].slice(0, equals)
  if (!(name in long)) return k
  if (equals !== -1) {
    add(long[name], args[k].slice(equals + 1))
    return k
  }
  add(long[name], args[k + 1])
  return k + 1
}

// Reads a short option cluster such as `-m value`, `-mvalue`, or `-am value`.
const readShortCluster = ({ args, k, short, add }) => {
  const arg = args[k]
  const p = [...arg.slice(1)].findIndex((flag) => flag in short) + 1
  if (p === 0) return k
  if (p + 1 < arg.length) {
    add(short[arg[p]], arg.slice(p + 1))
    return k
  }
  add(short[arg[p]], args[k + 1])
  return k + 1
}

// Collects option values by name. `short` and `long` map every option that takes a value
// to the name it is collected under, or to null to skip the value.
const parseOptions = (args, { short, long }) => {
  const values = { positional: [] }
  const add = (name, value) => {
    if (name !== null) (values[name] ??= []).push(value ?? '')
  }
  for (let k = 0; k < args.length; k += 1) {
    const arg = args[k]
    if (arg === '--') {
      values.positional.push(...args.slice(k + 1))
      break
    }
    if (arg.startsWith('--')) k = readLongOption({ args, k, long, add })
    else if (arg.startsWith('-') && arg.length > 1) k = readShortCluster({ args, k, short, add })
    else values.positional.push(arg)
  }
  return values
}

const GIT_COMMIT_OPTIONS = {
  short: { m: 'message', F: 'file', c: null, C: null, t: null },
  long: { '--message': 'message', '--file': 'file', '--trailer': 'message' },
}
const GH_BODY_OPTIONS = {
  short: { b: 'message', F: 'file', t: null, B: null, H: null, a: null, l: null, m: null, p: null, r: null, T: null, R: null },
  long: { '--body': 'message', '--body-file': 'file' },
}
const GH_API_OPTIONS = {
  short: { X: 'method', f: 'rawField', F: 'field', H: null, q: null, t: null, p: null },
  long: { '--method': 'method', '--raw-field': 'rawField', '--field': 'field', '--input': 'input', '--header': null, '--jq': null, '--template': null, '--hostname': null, '--cache': null, '--preview': null },
}
const GIT_OPTIONS_WITH_VALUE = new Set(['-c', '--git-dir', '--work-tree', '--namespace', '--config-env'])
const GH_BODY_WRITES = new Set(['pr create', 'pr edit', 'pr comment', 'issue create', 'issue edit', 'issue comment'])
const PULL_OR_ISSUE_ENDPOINT = /(?:^|\/)(?:pulls|issues)(?:\/|$)/u
const MESSAGE_FIELD = /^(?:body|title)=/su

const gitSubcommand = (argv) => {
  const dirs = []
  for (let k = 1; k < argv.length; k += 1) {
    if (argv[k] === '-C') dirs.push(argv[(k += 1)] ?? '')
    else if (GIT_OPTIONS_WITH_VALUE.has(argv[k])) k += 1
    else if (!argv[k].startsWith('-')) return { name: argv[k], args: argv.slice(k + 1), dirs }
  }
  return null
}

// The gh arguments after `gh`, without options such as `-R owner/repo` placed before the subcommand.
const ghArgs = (argv) => {
  const args = argv.slice(1)
  while (args.length > 0 && args[0].startsWith('-')) {
    const option = args.shift()
    if (option === '-R' || option === '--repo') args.shift()
  }
  return args
}

const ghApi = (args) => {
  const options = parseOptions(args, GH_API_OPTIONS)
  const sendsData = Boolean(options.rawField || options.field || options.input)
  const method = options.method?.at(-1) || (sendsData ? 'POST' : 'GET')
  return { method: method.toUpperCase(), endpoint: options.positional[0] ?? '', options }
}

const afterEquals = (field) => field.slice(field.indexOf('=') + 1)

const apiMessageSources = ({ rawField = [], field = [], input = [] }) => {
  const typed = field.filter((value) => MESSAGE_FIELD.test(value)).map(afterEquals)
  return {
    texts: [...rawField.filter((value) => MESSAGE_FIELD.test(value)).map(afterEquals), ...typed.filter((value) => !value.startsWith('@'))],
    files: typed.filter((value) => value.startsWith('@')).map((value) => value.slice(1)),
    jsonFiles: input,
  }
}

const ghMessageSources = (argv) => {
  const [group, ...args] = ghArgs(argv)
  if (GH_BODY_WRITES.has(`${group} ${args[0]}`)) {
    const options = parseOptions(args.slice(1), GH_BODY_OPTIONS)
    return { texts: options.message ?? [], files: options.file ?? [] }
  }
  if (group !== 'api') return null
  const api = ghApi(args)
  if (api.method === 'GET' || !PULL_OR_ISSUE_ENDPOINT.test(api.endpoint)) return null
  return apiMessageSources(api.options)
}

// The message text, message files, and directories of a commit or pull request write, or null.
const messageSources = (argv) => {
  if (argv[0] === 'gh') return ghMessageSources(argv)
  if (argv[0] !== 'git') return null
  const subcommand = gitSubcommand(argv)
  if (subcommand?.name !== 'commit') return null
  const options = parseOptions(subcommand.args, GIT_COMMIT_OPTIONS)
  return { texts: options.message ?? [], files: options.file ?? [], dirs: subcommand.dirs }
}

// --- Attribution scan ---------------------------------------------------------

const SEQUENTIAL = new Set(['&&', ';', '\n'])

// Directories from `cd <dir>` commands that run before this one in the same chain.
const chainDirs = (command) => {
  const dirs = []
  for (let link = command; SEQUENTIAL.has(link.separator) && link.previous; link = link.previous) {
    const [name, dir] = commandArgv(link.previous.words)
    if (name === 'cd' && dir) dirs.unshift(dir)
  }
  return dirs
}

const expandHome = (path) => (path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(1)) : path)

// Reads a regular message file up to the size cap. The non-blocking open keeps a FIFO from
// hanging the hook; anything unreadable is allowed rather than blocked on a guess.
const readMessageFile = (path) => {
  let fd
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK)
    const stats = fstatSync(fd)
    return stats.isFile() && stats.size <= MAX_MESSAGE_FILE_BYTES ? readFileSync(fd, 'utf8') : ''
  } catch {
    return ''
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

// `gh api --input` sends JSON: inspect its body and title.
const jsonMessageTexts = (text) => {
  if (!text.trimStart().startsWith('{')) return []
  try {
    const value = JSON.parse(text)
    return [value?.body, value?.title].filter((field) => typeof field === 'string')
  } catch {
    return []
  }
}

const isAttribution = (line) => CO_AUTHOR_LINE.test(line) || GENERATED_LINE.test(line)

// A fence closes only on the same character, repeated at least as many times as it opened.
const closesFence = (marker, fence) => marker?.[0] === fence[0] && marker.length >= fence.length

// Lines split on real newlines and on literal \n, which printf and echo -e expand.
// Lines inside fenced Markdown code blocks are examples, not attribution.
const hasAttributionLine = (text) => {
  let fence = null
  for (const line of text.split(/\r?\n|\\n/u)) {
    const marker = FENCE_LINE.exec(line)?.[1]
    if (fence !== null) fence = closesFence(marker, fence) ? null : fence
    else if (marker) fence = marker
    else if (isAttribution(line)) return true
  }
  return false
}

// Text that reaches the command on stdin: its heredoc or here-string, and the command piping into it.
const stdinTexts = (command) => {
  const producer = command.separator === '|' ? command.previous : null
  return [...command.stdin, ...(producer ? [...producer.words, ...producer.stdin] : [])]
}

// File contents, where `-` stands for the command's stdin.
const readSources = ({ paths, dir, stdin }) => paths.flatMap((path) => (
  path === '-' ? stdin : [readMessageFile(resolve(dir, expandHome(path)))]
))

// Words of the substitutions that a message value contains, such as $(printf …) or <(printf …).
const substitutionWords = (values, entries) => entries
  .filter(({ command }) => command.substitution !== null && values.some((value) => value.includes(command.substitution)))
  .flatMap(({ command }) => command.words)

// The write's own message sources: its message options, the substitutions inside them, its
// message files, and its stdin when a message file is `-`. JSON inputs count only for body and title.
const writeHasAttribution = ({ argv, command }, { cwd, entries }) => {
  const sources = messageSources(argv)
  if (sources === null) return false
  const { texts, files, jsonFiles = [], dirs = [] } = sources
  const dir = resolve(cwd, ...chainDirs(command).map(expandHome), ...dirs.map(expandHome))
  const stdin = stdinTexts(command)
  return [
    ...texts,
    ...substitutionWords([...texts, ...files, ...jsonFiles], entries),
    ...readSources({ paths: files, dir, stdin }),
    ...readSources({ paths: jsonFiles, dir, stdin }).flatMap(jsonMessageTexts),
  ].some(hasAttributionLine)
}

// --- Decision -----------------------------------------------------------------

// Codex execpolicy prefix in host-config/codex/rules/filip-stack.rules.
const CODEX_RULE_PREFIX = 'op'
const SHELL_SYNTAX = /[\n$`<>|&;()\\*?]/u

// True when Codex's prefix rule can match the command: one plain command, no shell syntax.
// Without shell syntax the script is a single command, so its first entry is the whole command.
const isCodexRuleForm = (command, entries) => !SHELL_SYNTAX.test(command.trim())
  && entries[0]?.command.words[0] === CODEX_RULE_PREFIX

const evaluate = ({ command, cwd, codex }) => {
  const entries = collectCommands(command)
  if (entries.some((entry) => writeHasAttribution(entry, { cwd, entries }))) return DENY_ATTRIBUTION
  if (!entries.some(({ argv }) => argv[0] === 'op')) return null
  // Codex does not support `ask` in hooks yet; its execpolicy rule prompts for the plain form.
  if (codex) return isCodexRuleForm(command, entries) ? null : DENY_CODEX_UNPROMPTABLE
  return { permissionDecision: 'ask', permissionDecisionReason: ASK_ONE_PASSWORD }
}

const main = () => {
  const input = JSON.parse(readFileSync(0, 'utf8'))
  const command = input?.tool_input?.command
  if (typeof command !== 'string') return
  const cwd = typeof input.cwd === 'string' ? input.cwd : process.cwd()
  // Codex sets PLUGIN_ROOT; Claude Code sets only CLAUDE_PLUGIN_ROOT.
  const decision = evaluate({ command, cwd, codex: Boolean(process.env.PLUGIN_ROOT) })
  if (decision === null) return
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...decision } })}\n`)
}

try {
  main()
} catch {
  // Fail open: a parse or runtime error leaves the normal permission flow in charge.
}
