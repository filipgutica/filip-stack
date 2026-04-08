import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runCli } from './cli.js'
import type { RunSyncResult } from './run.js'
import type { Scope } from './scopes.js'

let testRoot: string
let repoRoot: string
let homeDir: string

const inkRunner = vi.fn<
  (options: {
    repoRoot: string
    homeDir: string
    runSync: (options: { scopes: Scope[]; dryRun: boolean }) => Promise<RunSyncResult>
  }) => Promise<number>
>()

describe('runCli', () => {
  beforeEach(async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-cli-test-'))
    repoRoot = join(testRoot, 'repo')
    homeDir = join(testRoot, 'home')
    inkRunner.mockReset()
    inkRunner.mockResolvedValue(0)
    await mkdir(join(repoRoot, 'skills/reviewer'), { recursive: true })
    await mkdir(join(repoRoot, 'hooks/codex/scripts'), { recursive: true })
    await mkdir(join(repoRoot, 'hooks/claude/scripts'), { recursive: true })
    await mkdir(join(repoRoot, 'globals'), { recursive: true })
    await writeFile(join(repoRoot, 'skills/reviewer/SKILL.md'), 'reviewer')
    await writeFile(join(repoRoot, 'hooks/codex/hooks.json'), JSON.stringify({ hooks: {} }, null, 2))
    await writeFile(join(repoRoot, 'hooks/claude/hooks.json'), JSON.stringify({ hooks: {} }, null, 2))
    await writeFile(join(repoRoot, 'globals/AGENTS.md'), 'agents')
    await writeFile(join(repoRoot, 'globals/CLAUDE.md'), 'claude')
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('routes no-arg tty mode into ink', async () => {
    await expect(
      runCli({
        argv: [],
        repoRoot,
        homeDir,
        isTty: true,
        runInkApp: inkRunner,
        log: () => {},
        error: () => {},
      }),
    ).resolves.toBe(0)

    expect(inkRunner).toHaveBeenCalledTimes(1)
  })

  it('does not use ink for explicit args', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['--unknown'],
        repoRoot,
        homeDir,
        isTty: true,
        runInkApp: inkRunner,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)

    expect(inkRunner).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Unknown argument: unknown'))
  })

  it('falls back to command mode for no-arg non-tty execution', async () => {
    const messages: string[] = []

    await expect(
      runCli({
        argv: [],
        repoRoot,
        homeDir,
        isTty: false,
        runInkApp: inkRunner,
        log: (message) => messages.push(message),
        error: () => {},
      }),
    ).resolves.toBe(0)

    expect(inkRunner).not.toHaveBeenCalled()
    expect(messages.join('\n')).toContain('Sync Complete')
  })

  it('rejects unknown flags through yargs', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['--unknown'],
        repoRoot,
        homeDir,
        isTty: false,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Unknown argument: unknown'))
  })

  it('rejects all combined with an individual scope', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['--all', '--skills'],
        repoRoot,
        homeDir,
        isTty: false,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('--all cannot be combined with --skills, --hooks, or --globals'),
    )
  })

  it('runs setup against the provided rc file', async () => {
    const rcFile = join(testRoot, '.zshrc')

    await expect(
      runCli({
        argv: ['setup', '--rc-file', rcFile, '--alias', 'filip-stack'],
        repoRoot,
        homeDir,
        isTty: false,
        log: () => {},
        error: () => {},
      }),
    ).resolves.toBe(0)

    await expect(readFile(rcFile, 'utf8')).resolves.toContain(
      'alias filip-stack="' + join(repoRoot, 'bin/filip-stack') + '"',
    )
  })

  it('expands home paths for setup rc files', async () => {
    await expect(
      runCli({
        argv: ['setup', '--rc-file', '~/.testrc'],
        repoRoot,
        homeDir,
        isTty: false,
        log: () => {},
        error: () => {},
      }),
    ).resolves.toBe(0)

    await expect(readFile(join(homeDir, '.testrc'), 'utf8')).resolves.toContain(
      'alias filip-stack="' + join(repoRoot, 'bin/filip-stack') + '"',
    )
  })

  it('rejects sync scope flags for setup', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['setup', '--skills'],
        repoRoot,
        homeDir,
        isTty: false,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('setup cannot be combined with sync scope flags'),
    )
  })

  it('rejects setup-only options for sync', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['--rc-file', join(testRoot, '.zshrc')],
        repoRoot,
        homeDir,
        isTty: false,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('--rc-file and --alias can only be used with setup'),
    )
  })

  it('renders dry-run markdown in command mode', async () => {
    const messages: string[] = []

    await expect(
      runCli({
        argv: ['--hooks', '--dry-run'],
        repoRoot,
        homeDir,
        isTty: false,
        log: (message) => messages.push(message),
        error: () => {},
      }),
    ).resolves.toBe(0)

    expect(messages.join('\n')).toContain('Dry Run')
    expect(messages.join('\n')).toContain('Codex Hooks')
  })
})
