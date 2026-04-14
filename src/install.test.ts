import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { installPlugins } from './install.js'

let testRoot: string
let repoRoot: string
let homeDir: string
let buildOutputRoot: string

const createCodexInstallRecorder = () => {
  const calls: Array<{ homeDir: string; marketplacePath: string; pluginName: string; clientVersion: string }> = []

  const installCodexPlugin = async ({
    homeDir,
    marketplacePath,
    pluginName,
    clientVersion,
  }: {
    homeDir: string
    marketplacePath: string
    pluginName: string
    clientVersion: string
  }) => {
    calls.push({ homeDir, marketplacePath, pluginName, clientVersion })
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
    const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')) as { version: string }

    await installPlugins({
      repoRoot,
      homeDir,
      buildOutputRoot,
      target: 'codex',
      installCodexPlugin,
    })

    await expect(readFile(join(homeDir, 'plugins/filip-stack/.codex-plugin/plugin.json'), 'utf8')).resolves.toContain('"name": "filip-stack"')
    await expect(readFile(join(homeDir, 'plugins/filip-stack/hooks/hooks.json'), 'utf8')).resolves.toContain('coordinator-hook.mjs')
    await expect(readFile(join(homeDir, 'plugins/filip-stack/hooks/hooks.json'), 'utf8')).resolves.toContain('project-notes-hook.mjs')
    await expect(readFile(join(homeDir, '.agents/plugins/marketplace.json'), 'utf8')).resolves.toContain('"name": "filip-stack-local"')
    await expect(readFile(join(homeDir, '.codex/config.toml'), 'utf8')).resolves.toContain('[plugins."filip-stack@filip-stack-local"]')
    expect(calls).toEqual([
      {
        homeDir,
        marketplacePath: join(homeDir, '.agents', 'plugins', 'marketplace.json'),
        pluginName: 'filip-stack',
        clientVersion: packageJson.version,
      },
    ])
  })
})
