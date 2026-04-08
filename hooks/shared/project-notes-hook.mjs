#!/usr/bin/env node

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'

const NOTES_DIRECTORIES = ['todo', 'in-progress', 'complete']
const PLACEHOLDERS = {
  approvedPlan: 'Not started.',
  workLog: 'No work logged yet.',
  completionSummary: 'Not completed.',
}
const sectionPattern = (heading) =>
  new RegExp(`(## ${escapeRegExp(heading)}\\n)([\\s\\S]*?)(?=\\n## |\\s*$)`)

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toDateStamp = (date = new Date()) => date.toISOString().slice(0, 10)

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'task'

const summarizeText = (value, maxLength = 160) =>
  value.replace(/\s+/g, ' ').trim().slice(0, maxLength)

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const readStdin = async () => {
  const chunks = []

  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

const parsePayload = (stdin) => {
  if (stdin.trim() === '') return {}

  try {
    const parsed = JSON.parse(stdin)
    return isObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const formatOutput = ({ host, event, exitCode, stdout }) => {
  if (stdout.length === 0) return null

  if (host === 'codex' && event === 'Stop' && exitCode === 0) {
    return `${JSON.stringify({ systemMessage: stdout.join('\n') })}\n`
  }

  return `${stdout.join('\n')}\n`
}

const outputResult = ({ host, event, exitCode, stdout = [], stderr = [] }) => {
  const formattedStdout = formatOutput({ host, event, exitCode, stdout })
  if (formattedStdout !== null) process.stdout.write(formattedStdout)
  if (stderr.length > 0) process.stderr.write(`${stderr.join('\n')}\n`)
  process.exitCode = exitCode
}

// Walk upward until we find the repo boundary so hook state always lives with
// the current project, even when the hook fires from a nested working directory.
const findRepoRoot = async (startPath) => {
  let current = resolve(startPath)

  while (true) {
    try {
      await stat(join(current, '.git'))
      return current
    } catch {}

    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

// Create the durable ticket folders plus the untracked runtime folder used for
// session bindings and transient hook state.
const ensureNotesStructure = async (repoRoot) => {
  const notesRoot = join(repoRoot, '.notes')

  await mkdir(notesRoot, { recursive: true })
  for (const directory of [...NOTES_DIRECTORIES, '.runtime']) {
    await mkdir(join(notesRoot, directory), { recursive: true })
  }

  return {
    notesRoot,
    runtimeRoot: join(notesRoot, '.runtime'),
  }
}

const sessionFilePath = ({ runtimeRoot, sessionId }) =>
  join(runtimeRoot, `${sessionId.replace(/[^a-zA-Z0-9._-]+/g, '-')}.json`)

const readOptionalFile = async (path) => {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

const loadSessionState = async ({ runtimeRoot, sessionId }) => {
  const path = sessionFilePath({ runtimeRoot, sessionId })
  const content = await readOptionalFile(path)

  if (content === null) {
    return {
      path,
      state: {
        sessionId,
        mode: 'tracked',
        ticketPath: null,
        bypassReason: null,
        pendingBypassConfirmation: false,
      },
    }
  }

  try {
    const parsed = JSON.parse(content)
    if (!isObject(parsed)) throw new Error('invalid')

    return {
      path,
      state: {
        sessionId,
        mode: parsed.mode === 'bypassed' ? 'bypassed' : 'tracked',
        ticketPath: typeof parsed.ticketPath === 'string' ? parsed.ticketPath : null,
        bypassReason: typeof parsed.bypassReason === 'string' ? parsed.bypassReason : null,
        pendingBypassConfirmation: parsed.pendingBypassConfirmation === true,
      },
    }
  } catch {
    return {
      path,
      state: {
        sessionId,
        mode: 'tracked',
        ticketPath: null,
        bypassReason: null,
        pendingBypassConfirmation: false,
      },
    }
  }
}

// Persist the current session's tracking state after each meaningful hook event
// so later hooks in the same session can continue from the same ticket.
const saveSessionState = async ({ path, state }) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`)
}

const parseFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return {}

  return Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => line.match(/^([^:]+):\s*(.*)$/))
      .filter(Boolean)
      .map((lineMatch) => [lineMatch[1].trim(), lineMatch[2].trim().replace(/^"|"$/g, '')]),
  )
}

const getSectionContent = ({ content, heading }) => {
  const match = content.match(sectionPattern(heading))
  return match ? match[2].trim() : ''
}

const hasApprovedPlan = (content) => {
  const approvedPlan = getSectionContent({ content, heading: 'Approved Plan' })
  return approvedPlan !== '' && approvedPlan !== PLACEHOLDERS.approvedPlan
}

const loadTicket = async ({ repoRoot, ticketPath }) => {
  if (ticketPath === null) return null

  const absolutePath = join(repoRoot, ticketPath)
  const content = await readOptionalFile(absolutePath)
  if (content === null) return null

  return { absolutePath, content }
}

const writeTicket = async ({ absolutePath, content }) => {
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content)
}

const listOpenTickets = async ({ repoRoot }) => {
  const notesRoot = join(repoRoot, '.notes')
  const results = []

  for (const directory of ['todo', 'in-progress']) {
    const absoluteDirectory = join(notesRoot, directory)
    const entries = await readdir(absoluteDirectory, { withFileTypes: true }).catch(() => [])

    for (const entry of entries) {
      if (!entry.isFile() || extname(entry.name) !== '.md') continue

      const absolutePath = join(absoluteDirectory, entry.name)
      const content = await readFile(absolutePath, 'utf8')
      const frontmatter = parseFrontmatter(content)
      results.push({
        title: frontmatter.title || entry.name.replace(/\.md$/, ''),
        status: frontmatter.status || directory,
        ticketPath: relative(repoRoot, absolutePath),
        hasApprovedPlan: hasApprovedPlan(content),
      })
    }
  }

  return results.sort((left, right) => left.ticketPath.localeCompare(right.ticketPath))
}

// Create a new todo ticket using the shared notes contract and bind the active
// session to it through the runtime state managed elsewhere in this hook file.
const createTicket = async ({ repoRoot, title, planningSeed }) => {
  const date = toDateStamp()
  const directory = join(repoRoot, '.notes/todo')
  const slug = slugify(title)
  let candidate = join(directory, `${date}-${slug}.md`)
  let suffix = 2

  while (await readOptionalFile(candidate) !== null) {
    candidate = join(directory, `${date}-${slug}-${suffix}.md`)
    suffix += 1
  }

  const content = `---\n` +
    `title: "${title.replace(/"/g, '\\"')}"\n` +
    `status: "todo"\n` +
    `created: "${date}"\n` +
    `started: null\n` +
    `completed: null\n` +
    `tags: ["notes"]\n` +
    `---\n\n` +
    `# ${title}\n\n` +
    `## Planning Seed\n\n` +
    `${planningSeed.trim() || 'Created from hook command.'}\n\n` +
    `## Approved Plan\n\n` +
    `${PLACEHOLDERS.approvedPlan}\n\n` +
    `## Work Log\n\n` +
    `${PLACEHOLDERS.workLog}\n\n` +
    `## Completion Summary\n\n` +
    `${PLACEHOLDERS.completionSummary}\n`

  await writeTicket({ absolutePath: candidate, content })

  return relative(repoRoot, candidate)
}

const matchTicket = ({ tickets, selector }) => {
  const normalizedSelector = selector.trim().toLowerCase()
  if (normalizedSelector === '') return null

  return (
    tickets.find(({ ticketPath }) => ticketPath.toLowerCase() === normalizedSelector)
    ?? tickets.find(({ ticketPath }) => basename(ticketPath, '.md').toLowerCase() === normalizedSelector)
    ?? tickets.find(({ title }) => title.toLowerCase() === normalizedSelector)
    ?? null
  )
}

const extractPrompt = (payload) =>
  [
    payload.prompt,
    payload.user_prompt,
    payload.input,
    payload.text,
    payload.message,
  ].find((value) => typeof value === 'string') || ''

const getToolName = (payload) =>
  [
    payload.tool_name,
    payload.toolName,
    payload.matcher,
    payload.tool,
    payload.name,
  ].find((value) => typeof value === 'string') || ''

const getCommandText = (payload) => {
  const input = isObject(payload.tool_input) ? payload.tool_input : isObject(payload.input) ? payload.input : {}
  const nested = isObject(input.command) ? input.command : {}

  return [
    payload.command,
    input.command,
    input.cmd,
    nested.command,
    input.text,
  ].find((value) => typeof value === 'string') || ''
}

const isWriteShellCommand = (payload) => {
  const command = getCommandText(payload)
  return /\b(git\s+(add|commit|push|rm|mv|restore)|mv\s|cp\s|rm\s|mkdir\s|touch\s|tee\s|cat\s+>|echo\s+.+>|sed\s+-i|perl\s+-i|pnpm\s+install|npm\s+install|yarn\s+add)\b/.test(command)
}

// Codex only exposes Bash interception today, so treat Bash as best-effort and
// look for obviously mutating shell commands. This is intentionally conservative
// and does not claim to catch every possible write hidden behind shell wrappers.
const isMutatingBashCommand = (payload) => {
  return isWriteShellCommand(payload)
}

// Claude exposes explicit write/edit tool names, so prefer those strong signals
// instead of trying to infer every mutation from shell text alone.
const isClaudeMutatingToolUse = (payload) => {
  const toolName = getToolName(payload)
  if (/(edit|write|multiedit|notebookedit|apply_patch|create_file|delete_file)/i.test(toolName)) return true
  if (/bash/i.test(toolName)) return isMutatingBashCommand(payload)
  return false
}

// Host-specific gate: Claude can block explicit write tools; Codex is limited
// to a best-effort Bash heuristic based on current hook support.
const isMutatingToolUse = ({ host, payload }) => {
  const toolName = getToolName(payload)

  if (host === 'claude') return isClaudeMutatingToolUse(payload)
  if (/bash/i.test(toolName)) return isMutatingBashCommand(payload)

  return false
}

const blockingMessage = ({ ticketBound, hasPlan }) => {
  if (!ticketBound) {
    return [
      'Project notes tracking blocked mutating work: no ticket is bound to this session.',
      'Use one of these prompts first:',
      '- `notes create: <title>` to create and bind a new ticket',
      '- `notes use: <ticket>` to bind an existing todo/in-progress ticket',
      '- `notes bypass` to bypass the gate for this session only',
    ]
  }

  if (!hasPlan) {
    return [
      'Project notes tracking blocked mutating work: the bound ticket does not have an approved plan yet.',
      'Use one of these prompts first:',
      '- `notes plan: <seed>` to start planning for this ticket',
      '- `notes approve` after the plan has been reviewed and approved',
      '- `notes bypass` to bypass the gate for this session only',
    ]
  }

  return []
}

const resolveSessionId = ({ host, payload, env }) =>
  (
    env.CODEX_THREAD_ID
    || payload.session_id
    || payload.sessionId
    || payload.thread_id
    || payload.threadId
    || `${host}-session`
  ).toString()

// UserPromptSubmit is the main control surface for notes automation. It lets a
// session create/bind tickets, request planning, approve plans, or
// enter a temporary bypass mode.
const handleUserPrompt = async ({ host, repoRoot, state, sessionStatePath, payload, stdout, stderr }) => {
  const prompt = extractPrompt(payload).trim()

  if (prompt.toLowerCase() === 'notes bypass') {
    state.pendingBypassConfirmation = true
    await saveSessionState({ path: sessionStatePath, state })
    stdout.push('Project notes tracking: next prompt will be stored as the bypass reason for this session. Send `cancel` to abort.')
    return { exitCode: 0 }
  }

  if (state.pendingBypassConfirmation) {
    state.pendingBypassConfirmation = false
    if (prompt.toLowerCase() === 'cancel') {
      await saveSessionState({ path: sessionStatePath, state })
      stdout.push('Project notes tracking: session bypass request cancelled.')
      return { exitCode: 0 }
    }

    state.mode = 'bypassed'
    state.bypassReason = prompt === '' ? 'No reason provided.' : summarizeText(prompt, 240)
    await saveSessionState({ path: sessionStatePath, state })
    stdout.push(`Project notes tracking: mutating-work gate bypassed for this session. Reason: ${state.bypassReason}`)
    return { exitCode: 0 }
  }

  if (prompt.toLowerCase().startsWith('notes create:')) {
    const title = prompt.slice('notes create:'.length).trim()
    if (title === '') {
      stderr.push('Project notes tracking: `notes create:` requires a title.')
      return { exitCode: 1 }
    }

    const ticketPath = await createTicket({
      repoRoot,
      title,
      planningSeed: `Created from session prompt.\n\nOriginal request: ${title}`,
    })
    state.ticketPath = ticketPath
    state.mode = 'tracked'
    state.bypassReason = null
    await saveSessionState({ path: sessionStatePath, state })
    stdout.push(`Project notes tracking: created and bound ticket \`${ticketPath}\`.`)
    return { exitCode: 0 }
  }

  if (prompt.toLowerCase().startsWith('notes use:')) {
    const selector = prompt.slice('notes use:'.length).trim()
    const tickets = await listOpenTickets({ repoRoot })
    const match = matchTicket({ tickets, selector })

    if (match === null) {
      stderr.push(`Project notes tracking: could not find an open ticket matching \`${selector}\`.`)
      return { exitCode: 1 }
    }

    state.ticketPath = match.ticketPath
    state.mode = 'tracked'
    state.bypassReason = null
    await saveSessionState({ path: sessionStatePath, state })
    stdout.push(`Project notes tracking: bound this session to \`${match.ticketPath}\`.`)
    return { exitCode: 0 }
  }

  if (prompt.toLowerCase() === 'notes approve') {
    if (state.ticketPath === null) {
      stderr.push('Project notes tracking: bind or create a ticket before approving a plan.')
      return { exitCode: 1 }
    }

    const loadedTicket = await loadTicket({ repoRoot, ticketPath: state.ticketPath })
    if (loadedTicket === null) {
      state.ticketPath = null
      await saveSessionState({ path: sessionStatePath, state })
      stderr.push('Project notes tracking: the bound ticket no longer exists. Bind or create a new ticket.')
      return { exitCode: 1 }
    }

    stdout.push(
      `Project notes tracking: update \`${state.ticketPath}\` by writing the approved plan into \`## Approved Plan\`, updating frontmatter status to \`in-progress\`, setting \`started: "${toDateStamp()}"\` if needed, and moving the ticket into \`.notes/in-progress/\`.`,
    )
    return { exitCode: 0 }
  }

  if (prompt.toLowerCase().startsWith('notes plan:')) {
    const planSeed = prompt.slice('notes plan:'.length).trim()
    if (state.ticketPath === null) {
      stderr.push('Project notes tracking: bind or create a ticket before starting planning.')
      return { exitCode: 1 }
    }
    if (planSeed === '') {
      stderr.push('Project notes tracking: `notes plan:` requires a non-empty planning seed.')
      return { exitCode: 1 }
    }

    const loadedTicket = await loadTicket({ repoRoot, ticketPath: state.ticketPath })
    if (loadedTicket === null) {
      state.ticketPath = null
      await saveSessionState({ path: sessionStatePath, state })
      stderr.push('Project notes tracking: the bound ticket no longer exists. Bind or create a new ticket.')
      return { exitCode: 1 }
    }

    state.mode = 'tracked'
    state.bypassReason = null
    await saveSessionState({ path: sessionStatePath, state })
    if (host === 'claude') {
      stdout.push(
        `Project notes tracking: update \`${state.ticketPath}\` by appending this seed under \`## Planning Seed\`: ${planSeed}\nThen enter plan mode and use \`$planner\` with that seed.`,
      )
    } else {
      stdout.push(
        `Project notes tracking: update \`${state.ticketPath}\` by appending this seed under \`## Planning Seed\`: ${planSeed}\nThen tell the user to switch to Plan Mode and use \`$planner\` with that seed.`,
      )
    }
    return { exitCode: 0 }
  }

  if (state.ticketPath !== null) {
    const loadedTicket = await loadTicket({ repoRoot, ticketPath: state.ticketPath })
    if (loadedTicket === null) {
      state.ticketPath = null
      await saveSessionState({ path: sessionStatePath, state })
      stderr.push('Project notes tracking: the bound ticket no longer exists. Bind or create a new ticket.')
      return { exitCode: 1 }
    }

    if (hasApprovedPlan(loadedTicket.content)) {
      stdout.push(
        `Project notes tracking: keep \`${state.ticketPath}\` updated during this turn. Append a short Work Log entry in plain language when you complete a meaningful chunk of work, and do not include raw tool commands.`,
      )
    }
  }

  if (state.ticketPath === null) {
    const tickets = await listOpenTickets({ repoRoot })
    const summary = tickets.length === 0
      ? 'No open tickets found. Use `notes create: <title>` to start tracking this session.'
      : `Open tickets: ${tickets.map(({ ticketPath }) => `\`${ticketPath}\``).join(', ')}. Use \`notes use: <ticket>\` or \`notes create: <title>\`.`
    stdout.push(`Project notes tracking: no ticket is currently bound to this session. ${summary}`)
  }

  return { exitCode: 0 }
}

export const runHook = async ({
  host,
  event,
  payload,
  cwd,
  env,
} = {}) => {
  const stdout = []
  const stderr = []
  const repoRoot = await findRepoRoot(payload?.cwd || cwd || process.cwd())
  if (repoRoot === null) return { exitCode: 0, stdout, stderr }

  const { runtimeRoot } = await ensureNotesStructure(repoRoot)
  const sessionId = resolveSessionId({ host, payload, env })
  const { path: sessionStatePath, state } = await loadSessionState({ runtimeRoot, sessionId })

  if (event === 'SessionStart') {
    const tickets = await listOpenTickets({ repoRoot })
    if (state.ticketPath !== null) {
      stdout.push(`Project notes tracking: session bound to \`${state.ticketPath}\`.`)
    } else if (tickets.length === 0) {
      stdout.push('Project notes tracking: no open ticket is bound to this session. Use `notes create: <title>` to start one.')
    } else {
      stdout.push(`Project notes tracking: no ticket is bound to this session. Open tickets: ${tickets.map(({ ticketPath }) => `\`${ticketPath}\``).join(', ')}.`)
    }

    await saveSessionState({ path: sessionStatePath, state })
    return { exitCode: 0, stdout, stderr }
  }

  if (event === 'UserPromptSubmit') {
    const result = await handleUserPrompt({ host, repoRoot, state, sessionStatePath, payload, stdout, stderr })
    return { ...result, stdout, stderr }
  }

  if (event === 'PreToolUse') {
    if (!isMutatingToolUse({ host, payload }) || state.mode === 'bypassed') {
      return { exitCode: 0, stdout, stderr }
    }

    const loadedTicket = await loadTicket({ repoRoot, ticketPath: state.ticketPath })
    const ticketBound = loadedTicket !== null
    const planApproved = ticketBound ? hasApprovedPlan(loadedTicket.content) : false

    if (!ticketBound || !planApproved) {
      stderr.push(...blockingMessage({ ticketBound, hasPlan: planApproved }))
      await saveSessionState({ path: sessionStatePath, state })
      return { exitCode: 2, stdout, stderr }
    }

    return { exitCode: 0, stdout, stderr }
  }

  if (event === 'PostToolUse') {
    return { exitCode: 0, stdout, stderr }
  }

  if (event === 'Stop') {
    return { exitCode: 0, stdout, stderr }
  }

  return { exitCode: 0, stdout, stderr }
}

export { formatOutput }

const main = async () => {
  const [host = 'codex', event = 'SessionStart'] = process.argv.slice(2)
  const stdin = await readStdin()
  const payload = parsePayload(stdin)
  const result = await runHook({
    host,
    event,
    payload,
    cwd: process.cwd(),
    env: process.env,
  })

  outputResult({ host, event, ...result })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const [host = 'codex', event = 'SessionStart'] = process.argv.slice(2)
    outputResult({
      host,
      event,
      exitCode: 1,
      stderr: [`Project notes tracking hook failed: ${error instanceof Error ? error.message : String(error)}`],
    })
  })
}
