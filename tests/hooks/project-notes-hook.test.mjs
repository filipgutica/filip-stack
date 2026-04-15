import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { runHook } from '../../plugins/filip-stack/scripts/project-notes-hook.mjs'

let testRoot = null

const createGitRepoRoot = async () => {
  testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-notes-hook-'))
  await mkdir(join(testRoot, '.git'))
  return testRoot
}

const bindTrackedTicket = async ({ repoRoot, host = 'codex', sessionId = 'thread-1' }) => {
  await runHook({
    host,
    event: 'UserPromptSubmit',
    payload: host === 'claude'
      ? { cwd: repoRoot, prompt: 'notes create: Track hook work', session_id: sessionId }
      : { cwd: repoRoot, prompt: 'notes create: Track hook work' },
    cwd: repoRoot,
    env: host === 'codex' ? { CODEX_THREAD_ID: sessionId } : {},
  })
}

const writeRuntimeState = async ({ repoRoot, sessionId, ticketId, lastKnownTicketPath }) => {
  await mkdir(join(repoRoot, '.notes/.runtime'), { recursive: true })
  await writeFile(
    join(repoRoot, `.notes/.runtime/${sessionId}.json`),
    `${JSON.stringify({ sessionId, ticketId, lastKnownTicketPath }, null, 2)}\n`,
  )
}

const writeTicketFixture = async ({
  repoRoot,
  ticketPath,
  title = 'Track hook work',
  ticketId = '2026-04-08-track-hook-work',
  sessionId = 'thread-1',
  status,
  created = '2026-04-08',
  started = null,
  completed = null,
  planningSeed = 'Created from session prompt.',
  approvedPlan = 'Not started.',
  completionCriteria = 'Finish the tracked hook work.',
  workLog = 'No work logged yet.',
  completionSummary = 'Not completed.',
}) => {
  await mkdir(join(repoRoot, ticketPath.split('/').slice(0, -1).join('/')), { recursive: true })
  await writeFile(
    join(repoRoot, ticketPath),
    `---\n` +
      `title: "${title}"\n` +
      `ticket-id: "${ticketId}"\n` +
      `session-id: "${sessionId}"\n` +
      `status: "${status}"\n` +
      `created: "${created}"\n` +
      `started: ${started === null ? 'null' : `"${started}"`}\n` +
      `completed: ${completed === null ? 'null' : `"${completed}"`}\n` +
      `tags: ["notes"]\n` +
      `---\n\n` +
      `# ${title}\n\n` +
      `## Planning Seed\n\n` +
      `${planningSeed}\n\n` +
      `## Approved Plan\n\n` +
      `${approvedPlan}\n\n` +
      `## Completion Criteria\n\n` +
      `${completionCriteria}\n\n` +
      `## Work Log\n\n` +
      `${workLog}\n\n` +
      `## Completion Summary\n\n` +
      `${completionSummary}\n`,
  )
}

afterEach(async () => {
  if (testRoot !== null) {
    await rm(testRoot, { recursive: true, force: true })
    testRoot = null
  }
})

describe('project notes hook', () => {
  it('creates the .notes structure when a notes command runs inside a git repo', async () => {
    const repoRoot = await createGitRepoRoot()

    await bindTrackedTicket({ repoRoot })

    await expect(readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')).resolves.toContain('"sessionId": "thread-1"')
  })

  it('creates and binds a ticket from a prompt command', async () => {
    const repoRoot = await createGitRepoRoot()

    await bindTrackedTicket({ repoRoot })

    const state = await readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')
    expect(state).toContain('"ticketId": "')
    expect(state).toContain('"lastKnownTicketPath": ".notes/todo/')
    const ticketPath = state.match(/"lastKnownTicketPath": "([^"]+)"/)?.[1]
    await expect(readFile(join(repoRoot, ticketPath), 'utf8')).resolves.toContain('session-id: "thread-1"')
    await expect(readFile(join(repoRoot, ticketPath), 'utf8')).resolves.toContain('ticket-id: "')
  })

  it('notes plan tells Codex to have the user switch to Plan Mode and use the coordinator skill', async () => {
    const repoRoot = await createGitRepoRoot()
    await bindTrackedTicket({ repoRoot })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'notes plan: Tighten notes workflow' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain('appending this seed under `## Planning Seed`: Tighten notes workflow')
    expect(result.stdout.join('\n')).toContain('tell the user to switch to Plan Mode and use `$filip-stack:coordinator`')
    const state = await readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')
    expect(state).toContain('"lastKnownTicketPath": ".notes/todo/')
    const ticketPath = state.match(/"lastKnownTicketPath": "([^"]+)"/)?.[1]
    await expect(
      readFile(join(repoRoot, ticketPath), 'utf8'),
    ).resolves.toContain('## Completion Criteria')
    await expect(
      readFile(join(repoRoot, ticketPath), 'utf8'),
    ).resolves.not.toContain('Planning request (2026-04-08): Tighten notes workflow')
  })

  it('notes plan tells Claude to enter plan mode and use the coordinator skill directly', async () => {
    const repoRoot = await createGitRepoRoot()
    await bindTrackedTicket({ repoRoot, host: 'claude', sessionId: 'claude-thread-1' })

    const result = await runHook({
      host: 'claude',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'notes plan: Tighten notes workflow', session_id: 'claude-thread-1' },
      cwd: repoRoot,
      env: {},
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain('appending this seed under `## Planning Seed`: Tighten notes workflow')
    expect(result.stdout.join('\n')).toContain('Then enter plan mode and use `$coordinator`')
  })

  it('notes approve tells the model to update the ticket instead of mutating it in hook code', async () => {
    const repoRoot = await createGitRepoRoot()
    await bindTrackedTicket({ repoRoot })
    const state = await readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')
    const ticketPath = state.match(/"lastKnownTicketPath": "([^"]+)"/)?.[1]

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'notes approve' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain('writing the approved plan into `## Approved Plan`')
    expect(result.stdout.join('\n')).toContain('moving the ticket into `.notes/in-progress/`')
    await expect(
      readFile(join(repoRoot, ticketPath), 'utf8'),
    ).resolves.toContain('Not started.')
  })

  it('reminds the model to update a bound ticket during normal prompts', async () => {
    const repoRoot = await createGitRepoRoot()
    const ticketPath = '.notes/todo/2026-04-08-track-hook-work.md'
    await writeTicketFixture({ repoRoot, ticketPath, status: 'todo', approvedPlan: 'Use the approved plan.' })
    await writeRuntimeState({
      repoRoot,
      sessionId: 'thread-1',
      ticketId: '2026-04-08-track-hook-work',
      lastKnownTicketPath: ticketPath,
    })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'continue implementing the notes workflow' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain('keep the bound ticket `.notes/todo/2026-04-08-track-hook-work.md` up to date during this turn')
    expect(result.stdout.join('\n')).toContain('Double-check whether this ticket should now move to `.notes/in-progress/`')
    expect(result.stdout.join('\n')).not.toContain('moving the ticket into `.notes/in-progress/`')
  })

  it('notes plan alone does not move a bound todo ticket to in-progress', async () => {
    const repoRoot = await createGitRepoRoot()
    await bindTrackedTicket({ repoRoot })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'notes plan: Tighten notes workflow' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain('appending this seed under `## Planning Seed`: Tighten notes workflow')
    expect(result.stdout.join('\n')).not.toContain('moving the ticket into `.notes/in-progress/`')
    const state = await readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')
    const ticketPath = state.match(/"lastKnownTicketPath": "([^"]+)"/)?.[1]
    expect(ticketPath).toContain('.notes/todo/')
  })

  it('does not require an in-progress transition when there is no accepted plan yet', async () => {
    const repoRoot = await createGitRepoRoot()
    await bindTrackedTicket({ repoRoot })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'go ahead and implement' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain('keep the bound ticket')
    expect(result.stdout.join('\n')).toContain('Double-check whether this ticket should now move to `.notes/in-progress/`')
    expect(result.stdout.join('\n')).toContain('is still in `.notes/todo/` without an approved plan')
    expect(result.stdout.join('\n')).not.toContain('accepted plan')
    expect(result.stdout.join('\n')).not.toContain('moving the ticket into `.notes/in-progress/`')
    expect(result.stdout.join('\n')).not.toContain('Append a short Work Log entry in plain language')
  })

  it('Stop blocks when a bound todo ticket already has an approved plan', async () => {
    const repoRoot = await createGitRepoRoot()
    const ticketPath = '.notes/todo/2026-04-08-track-hook-work.md'
    await writeTicketFixture({ repoRoot, ticketPath, status: 'todo', approvedPlan: 'Use the approved plan.' })
    await writeRuntimeState({
      repoRoot,
      sessionId: 'thread-1',
      ticketId: '2026-04-08-track-hook-work',
      lastKnownTicketPath: ticketPath,
    })

    const result = await runHook({
      host: 'codex',
      event: 'Stop',
      payload: { cwd: repoRoot },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toHaveLength(1)
    const payload = JSON.parse(result.stdout[0])
    expect(payload.decision).toBe('block')
    expect(payload.reason).toContain('before stopping')
    expect(payload.reason).toContain('`.notes/in-progress/`')
    expect(payload.reason).toContain('`## Work Log`')
  })

  it('Stop stays quiet when a bound todo ticket has no approved plan yet', async () => {
    const repoRoot = await createGitRepoRoot()
    await bindTrackedTicket({ repoRoot })

    const result = await runHook({
      host: 'codex',
      event: 'Stop',
      payload: { cwd: repoRoot },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toEqual([])
    expect(result.stderr).toEqual([])
  })

  it('notes complete tells the model to close the ticket instead of mutating it in hook code', async () => {
    const repoRoot = await createGitRepoRoot()
    const ticketPath = '.notes/in-progress/2026-04-08-track-hook-work.md'
    await writeTicketFixture({
      repoRoot,
      ticketPath,
      status: 'in-progress',
      started: '2026-04-08',
      approvedPlan: 'Use the approved plan.',
    })
    await writeRuntimeState({
      repoRoot,
      sessionId: 'thread-1',
      ticketId: '2026-04-08-track-hook-work',
      lastKnownTicketPath: ticketPath,
    })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'notes complete' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain('writing the close-out summary into `## Completion Summary`')
    expect(result.stdout.join('\n')).toContain('moving the ticket into `.notes/complete/`')
    await expect(readFile(join(repoRoot, ticketPath), 'utf8')).resolves.toContain('Not completed.')
  })

  it('notes use with no selector lists open tickets instead of failing', async () => {
    const repoRoot = await createGitRepoRoot()
    await bindTrackedTicket({ repoRoot })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'notes use:' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-2' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain('open tickets:')
    expect(result.stdout.join('\n')).toContain('.notes/todo/')
  })

  it('ignores completed tickets when binding by prompt', async () => {
    const repoRoot = await createGitRepoRoot()
    const completedTicketPath = join(repoRoot, '.notes/complete/2026-04-08-done.md')
    await writeTicketFixture({
      repoRoot,
      ticketPath: '.notes/complete/2026-04-08-done.md',
      title: 'Done',
      ticketId: '2026-04-08-done',
      status: 'complete',
      started: '2026-04-08',
      completed: '2026-04-08',
      planningSeed: 'Done.',
      approvedPlan: 'Done.',
      completionCriteria: 'Done.',
      workLog: 'Done.',
      completionSummary: 'Done.',
    })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'notes use: done' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr.join('\n')).toContain('could not find an open ticket')
  })

  it('UserPromptSubmit reminds the model to keep the work log updated once the ticket has an approved plan', async () => {
    const repoRoot = await createGitRepoRoot()
    const ticketPath = '.notes/in-progress/2026-04-08-track-hook-work.md'
    await writeTicketFixture({
      repoRoot,
      ticketPath,
      status: 'in-progress',
      started: '2026-04-08',
      approvedPlan: 'Use the approved plan.',
    })
    await writeRuntimeState({
      repoRoot,
      sessionId: 'thread-1',
      ticketId: '2026-04-08-track-hook-work',
      lastKnownTicketPath: ticketPath,
    })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: {
        cwd: repoRoot,
        prompt: 'continue implementing the notes workflow',
      },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.stdout.join('\n')).toContain('keep the bound ticket')
    expect(result.stdout.join('\n')).toContain(`keep \`${ticketPath}\` updated during this turn`)
    expect(result.stdout.join('\n')).toContain('until the user explicitly says to close out the session or uses `notes complete`')
    await expect(readFile(join(repoRoot, ticketPath), 'utf8')).resolves.toContain('No work logged yet.')
  })

  it('preserves the session binding after a ticket moves from todo to in-progress', async () => {
    const repoRoot = await createGitRepoRoot()
    const oldTicketPath = '.notes/todo/2026-04-08-track-hook-work.md'
    const movedTicketPath = '.notes/in-progress/2026-04-08-track-hook-work.md'
    await writeTicketFixture({
      repoRoot,
      ticketPath: movedTicketPath,
      status: 'in-progress',
      started: '2026-04-08',
      approvedPlan: 'Use the approved plan.',
    })
    await writeRuntimeState({
      repoRoot,
      sessionId: 'thread-1',
      ticketId: '2026-04-08-track-hook-work',
      lastKnownTicketPath: oldTicketPath,
    })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: {
        cwd: repoRoot,
        prompt: 'continue implementing the notes workflow',
      },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain(`keep \`${movedTicketPath}\` updated during this turn`)
    await expect(readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')).resolves.toContain(
      `"lastKnownTicketPath": "${movedTicketPath}"`,
    )
  })

  it('preserves the session binding after a ticket moves from in-progress to complete', async () => {
    const repoRoot = await createGitRepoRoot()
    const oldTicketPath = '.notes/in-progress/2026-04-08-track-hook-work.md'
    const movedTicketPath = '.notes/complete/2026-04-08-track-hook-work.md'
    await writeTicketFixture({
      repoRoot,
      ticketPath: movedTicketPath,
      status: 'complete',
      started: '2026-04-08',
      completed: '2026-04-08',
      approvedPlan: 'Use the approved plan.',
      workLog: 'Completed the tracked hook work.',
      completionSummary: 'Finished.',
    })
    await writeRuntimeState({
      repoRoot,
      sessionId: 'thread-1',
      ticketId: '2026-04-08-track-hook-work',
      lastKnownTicketPath: oldTicketPath,
    })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: {
        cwd: repoRoot,
        prompt: 'continue implementing the notes workflow',
      },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    await expect(readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')).resolves.toContain(
      `"lastKnownTicketPath": "${movedTicketPath}"`,
    )
  })

  it('restores a session binding from ticket frontmatter when runtime state is empty', async () => {
    const repoRoot = await createGitRepoRoot()
    const ticketPath = '.notes/in-progress/2026-04-08-track-hook-work.md'
    await writeTicketFixture({
      repoRoot,
      ticketPath,
      status: 'in-progress',
      started: '2026-04-08',
      approvedPlan: 'Use the approved plan.',
    })
    await writeRuntimeState({
      repoRoot,
      sessionId: 'thread-1',
      ticketId: null,
      lastKnownTicketPath: null,
    })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'continue implementing the notes workflow' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain(`keep \`${ticketPath}\` updated during this turn`)
    await expect(readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')).resolves.toContain(
      '"ticketId": "2026-04-08-track-hook-work"',
    )
  })

  it('stays quiet on normal prompts when no ticket is bound', async () => {
    const repoRoot = await createGitRepoRoot()

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'continue implementing the notes workflow' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toEqual([])
    expect(result.stderr).toEqual([])
  })

  it('updates session-id in the ticket when a new session binds an existing ticket', async () => {
    const repoRoot = await createGitRepoRoot()
    const ticketPath = '.notes/in-progress/2026-04-08-track-hook-work.md'
    await writeTicketFixture({
      repoRoot,
      ticketPath,
      status: 'in-progress',
      sessionId: 'old-session',
      started: '2026-04-08',
      approvedPlan: 'Use the approved plan.',
    })

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'notes use: 2026-04-08-track-hook-work' },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-2' },
    })

    expect(result.exitCode).toBe(0)
    await expect(readFile(join(repoRoot, ticketPath), 'utf8')).resolves.toContain('session-id: "thread-2"')
    await expect(readFile(join(repoRoot, '.notes/.runtime/thread-2.json'), 'utf8')).resolves.toContain(
      '"ticketId": "2026-04-08-track-hook-work"',
    )
  })
})
