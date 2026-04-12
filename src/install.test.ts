import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { installPlugins, updatePlugins } from './install.js'

let testRoot: string
let repoRoot: string
let homeDir: string
let buildOutputRoot: string

const createCommandRecorder = ({
  failMarketplaceUpdate = false,
  failPluginUpdate = false,
}: {
  failMarketplaceUpdate?: boolean
  failPluginUpdate?: boolean
} = {}) => {
  const calls: Array<{ command: string; args: string[]; env?: NodeJS.ProcessEnv }> = []

  const runCommand = async ({
    command,
    args,
    env,
  }: {
    command: string
    args: string[]
    env?: NodeJS.ProcessEnv
  }) => {
    calls.push({ command, args, env })

    if (failMarketplaceUpdate && args.join(' ') === 'plugin marketplace update local-plugins') {
      throw new Error('marketplace not configured')
    }

    if (failPluginUpdate && args.join(' ') === 'plugin update filip-stack@local-plugins') {
      throw new Error('plugin not installed')
    }
  }

  return { calls, runCommand }
}

const createCodexInstallRecorder = () => {
  const calls: Array<{ homeDir: string; marketplacePath: string; pluginName: string }> = []

  const installCodexPlugin = async ({
    homeDir,
    marketplacePath,
    pluginName,
  }: {
    homeDir: string
    marketplacePath: string
    pluginName: string
  }) => {
    calls.push({ homeDir, marketplacePath, pluginName })
  }

  return { calls, installCodexPlugin }
}

describe('install/update plugins', () => {
  beforeEach(async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-install-test-'))
    repoRoot = process.cwd()
    homeDir = join(testRoot, 'home')
    buildOutputRoot = join(testRoot, 'dist-plugins')
    await mkdir(join(homeDir, '.claude'), { recursive: true })
    await mkdir(join(homeDir, '.codex'), { recursive: true })
    await writeFile(join(homeDir, '.claude', 'settings.json'), '{}')
    await writeFile(join(homeDir, '.codex', 'hooks.json'), JSON.stringify({ hooks: {} }, null, 2))
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('installs codex plugin and updates codex config', async () => {
    const { calls, installCodexPlugin } = createCodexInstallRecorder()

    await installPlugins({
      repoRoot,
      homeDir,
      buildOutputRoot,
      target: 'codex',
      installCodexPlugin,
    })

    await expect(readFile(join(homeDir, 'plugins/filip-stack/.codex-plugin/plugin.json'), 'utf8')).resolves.toContain('"name": "filip-stack"')
    await expect(readFile(join(homeDir, '.agents/plugins/marketplace.json'), 'utf8')).resolves.toContain('"name": "filip-stack-local"')
    await expect(readFile(join(homeDir, '.codex/config.toml'), 'utf8')).resolves.toContain('[plugins."filip-stack@filip-stack-local"]')
    expect(calls).toEqual([
      {
        homeDir,
        marketplacePath: join(homeDir, '.agents', 'plugins', 'marketplace.json'),
        pluginName: 'filip-stack',
      },
    ])
  })

  it('installs claude plugin through settings-based local registration', async () => {
    const { calls, runCommand } = createCommandRecorder({
      failMarketplaceUpdate: true,
      failPluginUpdate: true,
    })

    await installPlugins({
      repoRoot,
      homeDir,
      buildOutputRoot,
      target: 'claude',
      runCommand,
    })

    const settings = await readFile(join(homeDir, '.claude/settings.json'), 'utf8')

    expect(settings).toContain('"local-plugins"')
    expect(settings).toContain('"source": "directory"')
    expect(settings).toContain('"filip-stack@local-plugins": true')
    expect(settings).toContain('"path":')
    expect(settings).toContain(join(testRoot, 'marketplaces', 'claude', 'filip-stack-local'))
    expect(calls.map(({ command, args }) => `${command} ${args.join(' ')}`)).toEqual([
      `claude plugin marketplace update local-plugins`,
      `claude plugin marketplace add ${join(testRoot, 'marketplaces', 'claude', 'filip-stack-local')}`,
      `claude plugin update filip-stack@local-plugins`,
      `claude plugin install filip-stack@local-plugins`,
    ])
  })

  it('updates claude plugin by refreshing the local plugin path registration', async () => {
    const { calls, runCommand } = createCommandRecorder()

    await updatePlugins({
      repoRoot,
      homeDir,
      buildOutputRoot,
      target: 'claude',
      runCommand,
    })

    const settings = await readFile(join(homeDir, '.claude/settings.json'), 'utf8')

    expect(settings).toContain('"filip-stack@local-plugins": true')
    expect(settings).toContain(join(testRoot, 'marketplaces', 'claude', 'filip-stack-local'))
    expect(calls.map(({ command, args }) => `${command} ${args.join(' ')}`)).toEqual([
      'claude plugin marketplace update local-plugins',
      'claude plugin update filip-stack@local-plugins',
    ])
  })
})
