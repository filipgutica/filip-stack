import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { runHook } from '../../hooks/shared/project-notes-hook.mjs'

let testRoot = null

const createGitRepoRoot = async () => {
  testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-notes-hook-'))
  await mkdir(join(testRoot, '.git'))
  await runHook({
    host: 'codex',
    event: 'SessionStart',
    payload: { cwd: testRoot },
    cwd: testRoot,
    env: { CODEX_THREAD_ID: 'thread-1' },
  })

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

afterEach(async () => {
  if (testRoot !== null) {
    await rm(testRoot, { recursive: true, force: true })
    testRoot = null
  }
})

describe('project notes hook', () => {
  it('creates the .notes structure on session start inside a git repo', async () => {
    const repoRoot = await createGitRepoRoot()

    await expect(readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')).resolves.toContain(
      '"sessionId": "thread-1"',
    )
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

  it('notes plan tells Codex to have the user switch to Plan Mode and use the planner skill', async () => {
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
    expect(result.stdout.join('\n')).toContain('tell the user to switch to Plan Mode and use `$planner`')
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

  it('notes plan tells Claude to enter plan mode and use the planner skill directly', async () => {
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
    expect(result.stdout.join('\n')).toContain('Then enter plan mode and use `$planner`')
  })

  it('notes approve tells the model to update the ticket instead of mutating it in hook code', async () => {
    const repoRoot = await createGitRepoRoot()
    await bindTrackedTicket({ repoRoot })

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
    const state = await readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')
    const ticketPath = state.match(/"lastKnownTicketPath": "([^"]+)"/)?.[1]
    await expect(
      readFile(join(repoRoot, ticketPath), 'utf8'),
    ).resolves.toContain('Not started.')
  })

  it('notes complete tells the model to close the ticket instead of mutating it in hook code', async () => {
    const repoRoot = await createGitRepoRoot()
    const ticketPath = '.notes/in-progress/2026-04-08-track-hook-work.md'
    await mkdir(join(repoRoot, '.notes/in-progress'), { recursive: true })
    await writeFile(
      join(repoRoot, ticketPath),
      `---\n` +
        `title: "Track hook work"\n` +
        `ticket-id: "2026-04-08-track-hook-work"\n` +
        `session-id: "thread-1"\n` +
        `status: "in-progress"\n` +
        `created: "2026-04-08"\n` +
        `started: "2026-04-08"\n` +
        `completed: null\n` +
        `tags: ["notes"]\n` +
        `---\n\n` +
        `# Track hook work\n\n` +
        `## Planning Seed\n\n` +
        `Created from session prompt.\n\n` +
        `## Approved Plan\n\n` +
        `Use the approved plan.\n\n` +
        `## Completion Criteria\n\n` +
        `Finish the tracked hook work.\n\n` +
        `## Work Log\n\n` +
        `No work logged yet.\n\n` +
        `## Completion Summary\n\n` +
        `Not completed.\n`,
    )
    await writeFile(
      join(repoRoot, '.notes/.runtime/thread-1.json'),
      `${JSON.stringify({
        sessionId: 'thread-1',
        ticketId: '2026-04-08-track-hook-work',
        lastKnownTicketPath: ticketPath,
      }, null, 2)}\n`,
    )

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
    await mkdir(join(repoRoot, '.notes/complete'), { recursive: true })
    await writeFile(
      completedTicketPath,
      `---\n` +
        `title: "Done"\n` +
        `ticket-id: "2026-04-08-done"\n` +
        `session-id: "thread-1"\n` +
        `status: "complete"\n` +
        `created: "2026-04-08"\n` +
        `started: "2026-04-08"\n` +
        `completed: "2026-04-08"\n` +
        `tags: ["notes"]\n` +
        `---\n\n# Done\n\n## Planning Seed\n\nDone.\n\n## Approved Plan\n\nDone.\n\n## Work Log\n\nDone.\n\n## Completion Summary\n\nDone.\n`,
    )

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
    await mkdir(join(repoRoot, '.notes/in-progress'), { recursive: true })
    await writeFile(
      join(repoRoot, ticketPath),
      `---\n` +
        `title: "Track hook work"\n` +
        `ticket-id: "2026-04-08-track-hook-work"\n` +
        `session-id: "thread-1"\n` +
        `status: "in-progress"\n` +
        `created: "2026-04-08"\n` +
        `started: "2026-04-08"\n` +
        `completed: null\n` +
        `tags: ["notes"]\n` +
        `---\n\n` +
        `# Track hook work\n\n` +
        `## Planning Seed\n\n` +
        `Created from session prompt.\n\n` +
        `## Approved Plan\n\n` +
        `Use the approved plan.\n\n` +
        `## Work Log\n\n` +
        `No work logged yet.\n\n` +
        `## Completion Summary\n\n` +
        `Not completed.\n`,
    )
    await writeFile(
      join(repoRoot, '.notes/.runtime/thread-1.json'),
      `${JSON.stringify({
        sessionId: 'thread-1',
        ticketId: '2026-04-08-track-hook-work',
        lastKnownTicketPath: ticketPath,
      }, null, 2)}\n`,
    )

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

    expect(result.stdout.join('\n')).toContain(`keep \`${ticketPath}\` updated during this turn`)
    expect(result.stdout.join('\n')).toContain('until the user explicitly says to close out the session or uses `notes complete`')
    await expect(readFile(join(repoRoot, ticketPath), 'utf8')).resolves.toContain('No work logged yet.')
  })

  it('preserves the session binding after a ticket moves from todo to in-progress', async () => {
    const repoRoot = await createGitRepoRoot()
    const oldTicketPath = '.notes/todo/2026-04-08-track-hook-work.md'
    const movedTicketPath = '.notes/in-progress/2026-04-08-track-hook-work.md'
    await mkdir(join(repoRoot, '.notes/in-progress'), { recursive: true })
    await writeFile(
      join(repoRoot, movedTicketPath),
      `---\n` +
        `title: "Track hook work"\n` +
        `ticket-id: "2026-04-08-track-hook-work"\n` +
        `session-id: "thread-1"\n` +
        `status: "in-progress"\n` +
        `created: "2026-04-08"\n` +
        `started: "2026-04-08"\n` +
        `completed: null\n` +
        `tags: ["notes"]\n` +
        `---\n\n` +
        `# Track hook work\n\n` +
        `## Planning Seed\n\n` +
        `Created from session prompt.\n\n` +
        `## Approved Plan\n\n` +
        `Use the approved plan.\n\n` +
        `## Completion Criteria\n\n` +
        `Finish the tracked hook work.\n\n` +
        `## Work Log\n\n` +
        `No work logged yet.\n\n` +
        `## Completion Summary\n\n` +
        `Not completed.\n`,
    )
    await writeFile(
      join(repoRoot, '.notes/.runtime/thread-1.json'),
      `${JSON.stringify({
        sessionId: 'thread-1',
        ticketId: '2026-04-08-track-hook-work',
        lastKnownTicketPath: oldTicketPath,
      }, null, 2)}\n`,
    )

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
    await mkdir(join(repoRoot, '.notes/complete'), { recursive: true })
    await writeFile(
      join(repoRoot, movedTicketPath),
      `---\n` +
        `title: "Track hook work"\n` +
        `ticket-id: "2026-04-08-track-hook-work"\n` +
        `session-id: "thread-1"\n` +
        `status: "complete"\n` +
        `created: "2026-04-08"\n` +
        `started: "2026-04-08"\n` +
        `completed: "2026-04-08"\n` +
        `tags: ["notes"]\n` +
        `---\n\n` +
        `# Track hook work\n\n` +
        `## Planning Seed\n\n` +
        `Created from session prompt.\n\n` +
        `## Approved Plan\n\n` +
        `Use the approved plan.\n\n` +
        `## Completion Criteria\n\n` +
        `Finish the tracked hook work.\n\n` +
        `## Work Log\n\n` +
        `Completed the tracked hook work.\n\n` +
        `## Completion Summary\n\n` +
        `Finished.\n`,
    )
    await writeFile(
      join(repoRoot, '.notes/.runtime/thread-1.json'),
      `${JSON.stringify({
        sessionId: 'thread-1',
        ticketId: '2026-04-08-track-hook-work',
        lastKnownTicketPath: oldTicketPath,
      }, null, 2)}\n`,
    )

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
    await mkdir(join(repoRoot, '.notes/in-progress'), { recursive: true })
    await writeFile(
      join(repoRoot, ticketPath),
      `---\n` +
        `title: "Track hook work"\n` +
        `ticket-id: "2026-04-08-track-hook-work"\n` +
        `session-id: "thread-1"\n` +
        `status: "in-progress"\n` +
        `created: "2026-04-08"\n` +
        `started: "2026-04-08"\n` +
        `completed: null\n` +
        `tags: ["notes"]\n` +
        `---\n\n` +
        `# Track hook work\n\n` +
        `## Planning Seed\n\n` +
        `Created from session prompt.\n\n` +
        `## Approved Plan\n\n` +
        `Use the approved plan.\n\n` +
        `## Completion Criteria\n\n` +
        `Finish the tracked hook work.\n\n` +
        `## Work Log\n\n` +
        `No work logged yet.\n\n` +
        `## Completion Summary\n\n` +
        `Not completed.\n`,
    )
    await writeFile(
      join(repoRoot, '.notes/.runtime/thread-1.json'),
      `${JSON.stringify({
        sessionId: 'thread-1',
        ticketId: null,
        lastKnownTicketPath: null,
      }, null, 2)}\n`,
    )

    const result = await runHook({
      host: 'codex',
      event: 'SessionStart',
      payload: { cwd: repoRoot },
      cwd: repoRoot,
      env: { CODEX_THREAD_ID: 'thread-1' },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain(`session bound to \`${ticketPath}\``)
    await expect(readFile(join(repoRoot, '.notes/.runtime/thread-1.json'), 'utf8')).resolves.toContain(
      '"ticketId": "2026-04-08-track-hook-work"',
    )
  })

  it('updates session-id in the ticket when a new session binds an existing ticket', async () => {
    const repoRoot = await createGitRepoRoot()
    const ticketPath = '.notes/in-progress/2026-04-08-track-hook-work.md'
    await mkdir(join(repoRoot, '.notes/in-progress'), { recursive: true })
    await writeFile(
      join(repoRoot, ticketPath),
      `---\n` +
        `title: "Track hook work"\n` +
        `ticket-id: "2026-04-08-track-hook-work"\n` +
        `session-id: "old-session"\n` +
        `status: "in-progress"\n` +
        `created: "2026-04-08"\n` +
        `started: "2026-04-08"\n` +
        `completed: null\n` +
        `tags: ["notes"]\n` +
        `---\n\n` +
        `# Track hook work\n\n` +
        `## Planning Seed\n\n` +
        `Created from session prompt.\n\n` +
        `## Approved Plan\n\n` +
        `Use the approved plan.\n\n` +
        `## Completion Criteria\n\n` +
        `Finish the tracked hook work.\n\n` +
        `## Work Log\n\n` +
        `No work logged yet.\n\n` +
        `## Completion Summary\n\n` +
        `Not completed.\n`,
    )

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
