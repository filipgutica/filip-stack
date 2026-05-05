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
    await mkdir(join(repoRoot, 'plugins', 'project-notes', 'scripts'), { recursive: true })
    await writeFile(join(repoRoot, 'plugins', 'project-notes', 'scripts', 'project-notes-hook.mjs'), '#!/usr/bin/env node\n')
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('requires the codex-hooks command', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: [],
        repoRoot,
        homeDir,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)

    expect(error).toHaveBeenCalledWith(expect.stringContaining('Usage: filip-stack codex-hooks [--dry-run]'))
  })

  it('rejects removed globals flags', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['--globals'],
        repoRoot,
        homeDir,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Unknown command: --globals'))
  })

  it('rejects removed setup command', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['setup'],
        repoRoot,
        homeDir,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Unknown command: setup'))
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

  it('renders dry-run output for codex-hooks', async () => {
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
})
