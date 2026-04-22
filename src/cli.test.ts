import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runCli } from './cli.js'

let testRoot: string
let repoRoot: string
let homeDir: string

describe('runCli', () => {
  beforeEach(async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-cli-test-'))
    repoRoot = join(testRoot, 'repo')
    homeDir = join(testRoot, 'home')
    await mkdir(join(repoRoot, 'globals'), { recursive: true })
    await mkdir(join(repoRoot, 'plugins', 'filip-stack', 'scripts'), { recursive: true })
    await writeFile(join(repoRoot, 'globals/AGENTS.md'), 'agents')
    await writeFile(join(repoRoot, 'globals/CLAUDE.md'), 'claude')
    await writeFile(join(repoRoot, 'plugins', 'filip-stack', 'scripts', 'project-notes-hook.mjs'), '#!/usr/bin/env node\n')
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('syncs globals by default', async () => {
    const messages: string[] = []

    await expect(
      runCli({
        argv: [],
        repoRoot,
        homeDir,
        log: (message) => messages.push(message),
        error: () => {},
      }),
    ).resolves.toBe(0)

    expect(messages.join('\n')).toContain('Synced Globals')
    await expect(readFile(join(homeDir, '.codex/AGENTS.md'), 'utf8')).resolves.toBe('agents')
    await expect(readFile(join(homeDir, '.claude/CLAUDE.md'), 'utf8')).resolves.toBe('claude')
  })

  it('rejects unknown flags through yargs', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['--unknown'],
        repoRoot,
        homeDir,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Unknown argument: unknown'))
  })

  it('runs setup against the provided rc file', async () => {
    const rcFile = join(testRoot, '.zshrc')

    await expect(
      runCli({
        argv: ['setup', '--rc-file', rcFile, '--alias', 'filip-stack'],
        repoRoot,
        homeDir,
        log: () => {},
        error: () => {},
      }),
    ).resolves.toBe(0)

    await expect(readFile(rcFile, 'utf8')).resolves.toContain(
      'alias filip-stack="node ' + join(repoRoot, 'dist/cli.js') + '"',
    )
  })

  it('expands home paths for setup rc files', async () => {
    await expect(
      runCli({
        argv: ['setup', '--rc-file', '~/.testrc'],
        repoRoot,
        homeDir,
        log: () => {},
        error: () => {},
      }),
    ).resolves.toBe(0)

    await expect(readFile(join(homeDir, '.testrc'), 'utf8')).resolves.toContain(
      'alias filip-stack="node ' + join(repoRoot, 'dist/cli.js') + '"',
    )
  })

  it('allows --globals with setup only as an error', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['setup', '--globals'],
        repoRoot,
        homeDir,
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
        argv: ['--dry-run'],
        repoRoot,
        homeDir,
        log: (message) => messages.push(message),
        error: () => {},
      }),
    ).resolves.toBe(0)

    expect(messages.join('\n')).toContain('Dry Run')
    expect(messages.join('\n')).toContain('Globals')
  })

  it('syncs Codex hooks through the codex-hooks command', async () => {
    const messages: string[] = []

    await expect(
      runCli({
        argv: ['codex-hooks'],
        repoRoot,
        homeDir,
        log: (message) => messages.push(message),
        error: () => {},
      }),
    ).resolves.toBe(0)

    expect(messages.join('\n')).toContain('Synced Codex Hooks')
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.toContain(
      'project-notes-hook.mjs',
    )
  })

  it('renders dry-run markdown for codex-hooks', async () => {
    const messages: string[] = []

    await expect(
      runCli({
        argv: ['codex-hooks', '--dry-run'],
        repoRoot,
        homeDir,
        log: (message) => messages.push(message),
        error: () => {},
      }),
    ).resolves.toBe(0)

    expect(messages.join('\n')).toContain('Dry Run')
    expect(messages.join('\n')).toContain('Codex Hooks')
  })

  it('rejects sync flags with codex-hooks', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['codex-hooks', '--globals'],
        repoRoot,
        homeDir,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('codex-hooks cannot be combined with sync scope flags'),
    )
  })

  it('rejects setup-only options for codex-hooks', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['codex-hooks', '--rc-file', join(testRoot, '.zshrc')],
        repoRoot,
        homeDir,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('--rc-file and --alias can only be used with setup'),
    )
  })

})
