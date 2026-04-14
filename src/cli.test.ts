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
    await writeFile(join(repoRoot, 'globals/AGENTS.md'), 'agents')
    await writeFile(join(repoRoot, 'globals/CLAUDE.md'), 'claude')
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
      'alias filip-stack="' + join(repoRoot, 'bin/filip-stack') + '"',
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
      'alias filip-stack="' + join(repoRoot, 'bin/filip-stack') + '"',
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

  it('rejects invalid install targets', async () => {
    const error = vi.fn()

    await expect(
      runCli({
        argv: ['install', 'bad-target'],
        repoRoot,
        homeDir,
        log: () => {},
        error,
      }),
    ).resolves.toBe(2)

    expect(error).toHaveBeenCalledWith(expect.stringContaining('target must be: codex'))
  })

  it('accepts a valid install target', async () => {
    const messages: string[] = []
    const codexInstallCalls: Array<{ homeDir: string; marketplacePath: string; pluginName: string; clientVersion: string }> = []
    const packageJson = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as { version: string }

    await mkdir(join(homeDir, '.claude'), { recursive: true })
    await mkdir(join(homeDir, '.codex'), { recursive: true })
    await writeFile(join(homeDir, '.claude/settings.json'), '{}')
    await writeFile(join(homeDir, '.codex/hooks.json'), JSON.stringify({ hooks: {} }, null, 2))

    await expect(
      runCli({
        argv: ['install', 'codex'],
        repoRoot: process.cwd(),
        homeDir,
        log: (message) => messages.push(message),
        error: () => {},
        installCodexPlugin: async ({ homeDir, marketplacePath, pluginName, clientVersion }) => {
          codexInstallCalls.push({ homeDir, marketplacePath, pluginName, clientVersion })
        },
      }),
    ).resolves.toBe(0)

    expect(messages.join('\n')).toContain('Plugin Install Complete')
    expect(messages.join('\n')).toContain('Installed Codex local plugin bridge configuration.')
    expect(messages.join('\n')).not.toContain('Claude local settings now point')
    await expect(readFile(join(homeDir, 'plugins/filip-stack/.codex-plugin/plugin.json'), 'utf8')).resolves.toContain('"name": "filip-stack"')
    expect(codexInstallCalls).toEqual([
      {
        homeDir,
        marketplacePath: join(homeDir, '.agents', 'plugins', 'marketplace.json'),
        pluginName: 'filip-stack',
        clientVersion: packageJson.version,
      },
    ])
  })
})
