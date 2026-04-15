#!/usr/bin/env node

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'

const NOTES_DIRECTORIES = ['todo', 'in-progress', 'complete']
const PLACEHOLDERS = {
  approvedPlan: 'Not started.',
  completionCriteria: 'Not defined yet.',
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
        ticketId: null,
        lastKnownTicketPath: null,
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
        ticketId: typeof parsed.ticketId === 'string' ? parsed.ticketId : null,
        lastKnownTicketPath: typeof parsed.lastKnownTicketPath === 'string'
          ? parsed.lastKnownTicketPath
          : (typeof parsed.ticketPath === 'string' ? parsed.ticketPath : null),
      },
    }
  } catch {
    return {
      path,
      state: {
        sessionId,
        ticketId: null,
        lastKnownTicketPath: null,
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

const serializeFrontmatterValue = (value) => {
  if (value === null) return 'null'
  if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`
  return String(value)
}

const updateFrontmatterFields = ({ content, fields }) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return content

  const lines = match[1].split('\n')
  const fieldMap = new Map(Object.entries(fields))

  const updatedLines = lines.map((line) => {
    const lineMatch = line.match(/^([^:]+):\s*(.*)$/)
    if (!lineMatch) return line

    const key = lineMatch[1].trim()
    if (!fieldMap.has(key)) return line

    const nextValue = fieldMap.get(key)
    fieldMap.delete(key)
    return `${key}: ${serializeFrontmatterValue(nextValue)}`
  })

  for (const [key, value] of fieldMap.entries()) {
    updatedLines.push(`${key}: ${serializeFrontmatterValue(value)}`)
  }

  return content.replace(match[0], `---\n${updatedLines.join('\n')}\n---\n\n`)
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

  return {
    absolutePath,
    ticketPath,
    content,
    frontmatter: parseFrontmatter(content),
  }
}

const loadAllTickets = async ({ repoRoot, directories = NOTES_DIRECTORIES }) => {
  const notesRoot = join(repoRoot, '.notes')
  const results = []

  for (const directory of directories) {
    const absoluteDirectory = join(notesRoot, directory)
    const entries = await readdir(absoluteDirectory, { withFileTypes: true }).catch(() => [])

    for (const entry of entries) {
      if (!entry.isFile() || extname(entry.name) !== '.md') continue

      const absolutePath = join(absoluteDirectory, entry.name)
      const content = await readFile(absolutePath, 'utf8')
      const frontmatter = parseFrontmatter(content)
      results.push({
        absolutePath,
        ticketPath: relative(repoRoot, absolutePath),
        content,
        frontmatter,
      })
    }
  }

  return results
}

const findTicketById = async ({ repoRoot, ticketId }) => {
  if (ticketId === null) return null

  const tickets = await loadAllTickets({ repoRoot })
  const matches = tickets.filter(({ frontmatter }) => frontmatter['ticket-id'] === ticketId)

  return matches.length === 1 ? matches[0] : null
}

const findOpenTicketBySessionId = async ({ repoRoot, sessionId }) => {
  const tickets = await loadAllTickets({ repoRoot, directories: ['todo', 'in-progress'] })
  const matches = tickets.filter(({ frontmatter }) => frontmatter['session-id'] === sessionId)

  return matches.length === 1 ? matches[0] : null
}

const bindStateToTicket = async ({ state, sessionStatePath, ticket }) => {
  state.ticketId = ticket.frontmatter['ticket-id'] || null
  state.lastKnownTicketPath = ticket.ticketPath
  await saveSessionState({ path: sessionStatePath, state })
}

const restoreSessionBinding = async ({ repoRoot, state, sessionStatePath }) => {
  if (state.ticketId !== null || state.lastKnownTicketPath !== null) return null

  const matchedTicket = await findOpenTicketBySessionId({ repoRoot, sessionId: state.sessionId })
  if (matchedTicket === null) return null

  await bindStateToTicket({ state, sessionStatePath, ticket: matchedTicket })
  return matchedTicket
}

const ensureTicketIdentity = async ({ ticket }) => {
  const nextFields = {}

  if (!ticket.frontmatter['ticket-id']) {
    nextFields['ticket-id'] = basename(ticket.ticketPath, '.md')
  }

  if (Object.keys(nextFields).length === 0) return ticket

  const nextContent = updateFrontmatterFields({
    content: ticket.content,
    fields: nextFields,
  })
  await writeTicket({ absolutePath: ticket.absolutePath, content: nextContent })

  return {
    ...ticket,
    content: nextContent,
    frontmatter: {
      ...ticket.frontmatter,
      ...nextFields,
    },
  }
}

const updateTicketSessionId = async ({ ticket, sessionId }) => {
  let ensuredTicket = await ensureTicketIdentity({ ticket })

  if (ensuredTicket.frontmatter['session-id'] === sessionId) return ensuredTicket

  const nextContent = updateFrontmatterFields({
    content: ensuredTicket.content,
    fields: { 'session-id': sessionId },
  })
  await writeTicket({ absolutePath: ensuredTicket.absolutePath, content: nextContent })

  return {
    ...ensuredTicket,
    content: nextContent,
    frontmatter: {
      ...ensuredTicket.frontmatter,
      'session-id': sessionId,
    },
  }
}

const loadBoundTicket = async ({ repoRoot, state, sessionStatePath }) => {
  let loadedTicket = null

  if (state.ticketId !== null) {
    loadedTicket = await findTicketById({ repoRoot, ticketId: state.ticketId })
  }

  if (loadedTicket === null && state.lastKnownTicketPath !== null) {
    loadedTicket = await loadTicket({ repoRoot, ticketPath: state.lastKnownTicketPath })
  }

  if (loadedTicket === null) return null

  loadedTicket = await ensureTicketIdentity({ ticket: loadedTicket })

  if (loadedTicket.frontmatter['ticket-id'] && loadedTicket.frontmatter['ticket-id'] !== state.ticketId) {
    state.ticketId = loadedTicket.frontmatter['ticket-id']
  }
  if (loadedTicket.ticketPath !== state.lastKnownTicketPath) {
    state.lastKnownTicketPath = loadedTicket.ticketPath
  }
  await saveSessionState({ path: sessionStatePath, state })

  return loadedTicket
}

const writeTicket = async ({ absolutePath, content }) => {
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content)
}

const listOpenTickets = async ({ repoRoot }) => {
  const tickets = await loadAllTickets({ repoRoot, directories: ['todo', 'in-progress'] })

  return tickets
    .map(({ ticketPath, content, frontmatter }) => ({
      title: frontmatter.title || basename(ticketPath, '.md'),
      status: frontmatter.status || dirname(ticketPath),
      ticketPath,
      ticketId: frontmatter['ticket-id'] || null,
      sessionId: frontmatter['session-id'] || null,
      hasApprovedPlan: hasApprovedPlan(content),
    }))
    .sort((left, right) => left.ticketPath.localeCompare(right.ticketPath))
}

// Create a new todo ticket using the shared notes contract and bind the active
// session to it through the runtime state managed elsewhere in this hook file.
const createTicket = async ({ repoRoot, title, planningSeed, sessionId }) => {
  const date = toDateStamp()
  const directory = join(repoRoot, '.notes/todo')
  const slug = slugify(title)
  let candidate = join(directory, `${date}-${slug}.md`)
  let suffix = 2

  while (await readOptionalFile(candidate) !== null) {
    candidate = join(directory, `${date}-${slug}-${suffix}.md`)
    suffix += 1
  }

  const ticketId = basename(candidate, '.md')

  const content = `---\n` +
    `title: "${title.replace(/"/g, '\\"')}"\n` +
    `ticket-id: "${ticketId}"\n` +
    `session-id: "${sessionId}"\n` +
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
    `## Completion Criteria\n\n` +
    `${PLACEHOLDERS.completionCriteria}\n\n` +
    `## Work Log\n\n` +
    `${PLACEHOLDERS.workLog}\n\n` +
    `## Completion Summary\n\n` +
    `${PLACEHOLDERS.completionSummary}\n`

  await writeTicket({ absolutePath: candidate, content })

  return {
    ticketId,
    ticketPath: relative(repoRoot, candidate),
  }
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

const buildApprovalGuidance = ({ ticketPath }) =>
  `Project notes tracking: update \`${ticketPath}\` by writing the approved plan into \`## Approved Plan\`, updating frontmatter status to \`in-progress\`, setting \`started: "${toDateStamp()}"\` if needed, and moving the ticket into \`.notes/in-progress/\`. Preserve \`ticket-id\` and update \`session-id\` if this session changed.`

const buildWorkLogReminder = ({ ticketPath }) =>
  `Project notes tracking: keep \`${ticketPath}\` updated during this turn. Append a short Work Log entry in plain language when you complete a meaningful chunk of work, and do not include raw tool commands. Leave the ticket in \`.notes/in-progress/\` until the user explicitly says to close out the session or uses \`notes complete\`.`

const buildPendingApprovalReminder = ({ ticketPath }) =>
  `Project notes tracking: \`${ticketPath}\` is still in \`.notes/todo/\` without an approved plan. If the plan has been accepted, implementation starts this turn, or you are already doing implementation work, first move the ticket to \`.notes/in-progress/\`, set frontmatter \`status: "in-progress"\`, stamp \`started\` if needed, write a concise summary into \`## Approved Plan\`, and then keep \`## Work Log\` updated during the turn.`

const buildBoundTicketReminder = ({ ticketPath }) =>
  `Project notes tracking: keep the bound ticket \`${ticketPath}\` up to date during this turn.`

const buildTodoTransitionNudge = ({ ticketPath }) =>
  `Project notes tracking: \`${ticketPath}\` is still in \`.notes/todo/\`. Double-check whether this ticket should now move to \`.notes/in-progress/\`, have \`status: "in-progress"\`, get \`started\` stamped if needed, and be updated in \`## Approved Plan\` and \`## Work Log\`.`

const buildStopBlockPayload = ({ reason }) =>
  JSON.stringify({
    decision: 'block',
    reason,
  })

const buildStopTransitionReason = ({ ticketPath }) =>
  `Project notes tracking: before stopping, update \`${ticketPath}\` by moving it to \`.notes/in-progress/\`, setting frontmatter status to \`in-progress\`, setting \`started: "${toDateStamp()}"\` if needed, ensuring \`## Approved Plan\` reflects the accepted plan, and appending a short \`## Work Log\` entry for this implementation turn. Preserve \`ticket-id\` and update \`session-id\` if this session changed.`

const extractPrompt = (payload) =>
  [
    payload.prompt,
    payload.user_prompt,
    payload.input,
    payload.text,
    payload.message,
  ].find((value) => typeof value === 'string') || ''

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
// session create/bind tickets, request planning, approve plans, and explicitly
// close tickets.
const handleUserPrompt = async ({ host, repoRoot, state, sessionStatePath, payload, stdout, stderr }) => {
  const prompt = extractPrompt(payload).trim()

  if (prompt.toLowerCase().startsWith('notes create:')) {
    const title = prompt.slice('notes create:'.length).trim()
    if (title === '') {
      stderr.push('Project notes tracking: `notes create:` requires a title.')
      return { exitCode: 1 }
    }

    const createdTicket = await createTicket({
      repoRoot,
      title,
      planningSeed: `Created from session prompt.\n\nOriginal request: ${title}`,
      sessionId: state.sessionId,
    })
    state.ticketId = createdTicket.ticketId
    state.lastKnownTicketPath = createdTicket.ticketPath
    await saveSessionState({ path: sessionStatePath, state })
    stdout.push(`Project notes tracking: created and bound ticket \`${createdTicket.ticketPath}\`.`)
    return { exitCode: 0 }
  }

  if (prompt.toLowerCase().startsWith('notes use:')) {
    const selector = prompt.slice('notes use:'.length).trim()
    const tickets = await listOpenTickets({ repoRoot })

    if (selector === '') {
      const summary = tickets.length === 0
        ? 'Project notes tracking: there are no open tickets to bind. Use `notes create: <title>` to start one.'
        : `Project notes tracking: open tickets: ${tickets.map(({ ticketPath }) => `\`${ticketPath}\``).join(', ')}. Use \`notes use: <ticket>\` with one of these paths, a filename stem, or a title.`
      stdout.push(summary)
      return { exitCode: 0 }
    }

    const match = matchTicket({ tickets, selector })

    if (match === null) {
      stderr.push(`Project notes tracking: could not find an open ticket matching \`${selector}\`.`)
      return { exitCode: 1 }
    }

    let loadedTicket = await loadTicket({ repoRoot, ticketPath: match.ticketPath })
    loadedTicket = await updateTicketSessionId({ ticket: loadedTicket, sessionId: state.sessionId })
    await bindStateToTicket({ state, sessionStatePath, ticket: loadedTicket })
    stdout.push(`Project notes tracking: bound this session to \`${match.ticketPath}\`.`)
    return { exitCode: 0 }
  }

  if (prompt.toLowerCase() === 'notes approve') {
    await restoreSessionBinding({ repoRoot, state, sessionStatePath })
    if (state.ticketId === null && state.lastKnownTicketPath === null) {
      stderr.push('Project notes tracking: bind or create a ticket before approving a plan.')
      return { exitCode: 1 }
    }

    const loadedTicket = await loadBoundTicket({ repoRoot, state, sessionStatePath })
    if (loadedTicket === null) {
      state.ticketId = null
      state.lastKnownTicketPath = null
      await saveSessionState({ path: sessionStatePath, state })
      stderr.push('Project notes tracking: the bound ticket no longer exists. Bind or create a new ticket.')
      return { exitCode: 1 }
    }

    stdout.push(buildApprovalGuidance({ ticketPath: loadedTicket.ticketPath }))
    return { exitCode: 0 }
  }

  if (prompt.toLowerCase() === 'notes complete') {
    await restoreSessionBinding({ repoRoot, state, sessionStatePath })
    if (state.ticketId === null && state.lastKnownTicketPath === null) {
      stderr.push('Project notes tracking: bind or create a ticket before completing it.')
      return { exitCode: 1 }
    }

    const loadedTicket = await loadBoundTicket({ repoRoot, state, sessionStatePath })
    if (loadedTicket === null) {
      state.ticketId = null
      state.lastKnownTicketPath = null
      await saveSessionState({ path: sessionStatePath, state })
      stderr.push('Project notes tracking: the bound ticket no longer exists. Bind or create a new ticket.')
      return { exitCode: 1 }
    }

    stdout.push(
      `Project notes tracking: update \`${loadedTicket.ticketPath}\` by writing the close-out summary into \`## Completion Summary\`, confirming the completion criteria are satisfied, setting \`status: "complete"\`, stamping \`completed: "${toDateStamp()}"\`, and moving the ticket into \`.notes/complete/\`. Preserve \`ticket-id\` and update \`session-id\` if this session changed.`,
    )
    return { exitCode: 0 }
  }

  if (prompt.toLowerCase().startsWith('notes plan:')) {
    const planSeed = prompt.slice('notes plan:'.length).trim()
    await restoreSessionBinding({ repoRoot, state, sessionStatePath })
    if (state.ticketId === null && state.lastKnownTicketPath === null) {
      stderr.push('Project notes tracking: bind or create a ticket before starting planning.')
      return { exitCode: 1 }
    }
    if (planSeed === '') {
      stderr.push('Project notes tracking: `notes plan:` requires a non-empty planning seed.')
      return { exitCode: 1 }
    }

    const loadedTicket = await loadBoundTicket({ repoRoot, state, sessionStatePath })
    if (loadedTicket === null) {
      state.ticketId = null
      state.lastKnownTicketPath = null
      await saveSessionState({ path: sessionStatePath, state })
      stderr.push('Project notes tracking: the bound ticket no longer exists. Bind or create a new ticket.')
      return { exitCode: 1 }
    }

    if (host === 'claude') {
      stdout.push(
        `Project notes tracking: update \`${loadedTicket.ticketPath}\` by appending this seed under \`## Planning Seed\`: ${planSeed}\nThen enter plan mode and use \`$coordinator\` with that seed.`,
      )
    } else {
      stdout.push(
        `Project notes tracking: update \`${loadedTicket.ticketPath}\` by appending this seed under \`## Planning Seed\`: ${planSeed}\nThen tell the user to switch to Plan Mode and use \`$filip-stack:coordinator\` with that seed.`,
      )
    }
    return { exitCode: 0 }
  }

  await restoreSessionBinding({ repoRoot, state, sessionStatePath })

  if (state.ticketId !== null || state.lastKnownTicketPath !== null) {
    const loadedTicket = await loadBoundTicket({ repoRoot, state, sessionStatePath })
    if (loadedTicket === null) {
      state.ticketId = null
      state.lastKnownTicketPath = null
      await saveSessionState({ path: sessionStatePath, state })
      stderr.push('Project notes tracking: the bound ticket no longer exists. Bind or create a new ticket.')
      return { exitCode: 1 }
    }

    stdout.push(buildBoundTicketReminder({ ticketPath: loadedTicket.ticketPath }))

    if (loadedTicket.frontmatter.status === 'todo') {
      stdout.push(buildTodoTransitionNudge({ ticketPath: loadedTicket.ticketPath }))
    }

    if (loadedTicket.frontmatter.status === 'todo' && !hasApprovedPlan(loadedTicket.content)) {
      stdout.push(buildPendingApprovalReminder({ ticketPath: loadedTicket.ticketPath }))
    }

    if (hasApprovedPlan(loadedTicket.content)) {
      stdout.push(buildWorkLogReminder({ ticketPath: loadedTicket.ticketPath }))
    }
  }

  return { exitCode: 0 }
}

const handleStop = async ({ repoRoot, state, sessionStatePath, stdout, stderr }) => {
  await restoreSessionBinding({ repoRoot, state, sessionStatePath })

  if (state.ticketId === null && state.lastKnownTicketPath === null) {
    return { exitCode: 0 }
  }

  const loadedTicket = await loadBoundTicket({ repoRoot, state, sessionStatePath })
  if (loadedTicket === null) {
    state.ticketId = null
    state.lastKnownTicketPath = null
    await saveSessionState({ path: sessionStatePath, state })
    stderr.push('Project notes tracking: the bound ticket no longer exists. Bind or create a new ticket.')
    return { exitCode: 1 }
  }

  if (loadedTicket.frontmatter.status === 'todo' && hasApprovedPlan(loadedTicket.content)) {
    stdout.push(buildStopBlockPayload({ reason: buildStopTransitionReason({ ticketPath: loadedTicket.ticketPath }) }))
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

  if (event === 'UserPromptSubmit') {
    const result = await handleUserPrompt({ host, repoRoot, state, sessionStatePath, payload, stdout, stderr })
    return { ...result, stdout, stderr }
  }

  if (event === 'Stop') {
    const result = await handleStop({ repoRoot, state, sessionStatePath, stdout, stderr })
    return { ...result, stdout, stderr }
  }

  return { exitCode: 0, stdout, stderr }
}

export { formatOutput }

const main = async () => {
  const [host = 'codex', event = 'UserPromptSubmit'] = process.argv.slice(2)
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
    const [host = 'codex', event = 'UserPromptSubmit'] = process.argv.slice(2)
    outputResult({
      host,
      event,
      exitCode: 1,
      stderr: [`Project notes tracking hook failed: ${error instanceof Error ? error.message : String(error)}`],
    })
  })
}
