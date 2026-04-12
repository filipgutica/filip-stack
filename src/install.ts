import { execFile as execFileCallback } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { buildPlugins } from './plugin-build.js'
import {
  installCodexPluginViaAppServer,
  type CodexPluginInstaller,
} from './codex-app-server.js'

export type InstallTarget = 'claude' | 'codex' | 'all'

type InstallOptions = {
  repoRoot: string
  homeDir: string
  buildOutputRoot?: string
  runCommand?: CommandRunner
  installCodexPlugin?: CodexPluginInstaller
}

type CommandRunner = (input: {
  command: string
  args: string[]
  env?: NodeJS.ProcessEnv
}) => Promise<void>

const execFile = promisify(execFileCallback)

const ensureDirectory = async (path: string) => {
  await mkdir(path, { recursive: true })
}

const runCommand: CommandRunner = async ({ command, args, env }) => {
  await execFile(command, args, {
    env: env ?? process.env,
  })
}

const writeJson = async ({ path, value }: { path: string; value: unknown }) => {
  await ensureDirectory(dirname(path))
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

const readJsonObject = async ({ path }: { path: string }) => {
  try {
    const content = await readFile(path, 'utf8')
    const parsed = JSON.parse(content)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {}

  return {}
}

const upsertClaudeSettings = async ({
  homeDir,
  marketplacePath,
}: {
  homeDir: string
  marketplacePath: string
}) => {
  const settingsPath = join(homeDir, '.claude', 'settings.json')
  const settings = await readJsonObject({ path: settingsPath })
  const marketplaces =
    typeof settings.extraKnownMarketplaces === 'object'
    && settings.extraKnownMarketplaces !== null
    && !Array.isArray(settings.extraKnownMarketplaces)
      ? { ...(settings.extraKnownMarketplaces as Record<string, unknown>) }
      : {}
  const enabledPlugins =
    typeof settings.enabledPlugins === 'object'
    && settings.enabledPlugins !== null
    && !Array.isArray(settings.enabledPlugins)
      ? { ...(settings.enabledPlugins as Record<string, unknown>) }
      : {}

  marketplaces['local-plugins'] = {
    source: {
      source: 'directory',
      path: marketplacePath,
    },
  }
  enabledPlugins['filip-stack@local-plugins'] = true

  settings.extraKnownMarketplaces = marketplaces
  settings.enabledPlugins = enabledPlugins

  await writeJson({ path: settingsPath, value: settings })
}

const upsertCodexMarketplace = async ({
  homeDir,
}: {
  homeDir: string
}) => {
  const marketplacePath = join(homeDir, '.agents', 'plugins', 'marketplace.json')
  const existing = await readJsonObject({ path: marketplacePath })
  const plugins = Array.isArray(existing.plugins) ? existing.plugins : []
  const nextEntry = {
    name: 'filip-stack',
    source: {
      source: 'local',
      path: './plugins/filip-stack',
    },
    policy: {
      installation: 'AVAILABLE',
      authentication: 'ON_INSTALL',
    },
    category: 'Productivity',
  }

  const withoutExisting = plugins.filter((plugin) => {
    return typeof plugin !== 'object' || plugin === null || (plugin as { name?: unknown }).name !== 'filip-stack'
  })

  await writeJson({
    path: marketplacePath,
    value: {
      name: typeof existing.name === 'string' ? existing.name : 'filip-stack-local',
      interface:
        typeof existing.interface === 'object' && existing.interface !== null && !Array.isArray(existing.interface)
          ? existing.interface
          : { displayName: 'Filip Stack Local' },
      plugins: [...withoutExisting, nextEntry],
    },
  })
}

const upsertCodexConfig = async ({ homeDir }: { homeDir: string }) => {
  const configPath = join(homeDir, '.codex', 'config.toml')
  const existing = await readFile(configPath, 'utf8').catch(() => '')
  const pluginBlock = '[plugins."filip-stack@filip-stack-local"]\nenabled = true\n'

  if (existing.includes('[plugins."filip-stack@filip-stack-local"]')) {
    const next = existing.replace(
      /\[plugins\."filip-stack@filip-stack-local"\][\s\S]*?(?=\n\[|$)/,
      pluginBlock.trimEnd(),
    )
    await ensureDirectory(dirname(configPath))
    await writeFile(configPath, next.endsWith('\n') ? next : `${next}\n`)
    return
  }

  const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n\n' : '\n'
  await ensureDirectory(dirname(configPath))
  await writeFile(configPath, `${existing}${separator}${pluginBlock}`)
}

const syncClaude = async ({
  homeDir,
  marketplacePath,
  runCommand,
}: {
  homeDir: string
  marketplacePath: string
  runCommand: CommandRunner
}) => {
  await upsertClaudeSettings({ homeDir, marketplacePath })

  const env = { ...process.env, HOME: homeDir }

  try {
    await runCommand({
      command: 'claude',
      args: ['plugin', 'marketplace', 'update', 'local-plugins'],
      env,
    })
  } catch {
    await runCommand({
      command: 'claude',
      args: ['plugin', 'marketplace', 'add', marketplacePath],
      env,
    })
  }

  try {
    await runCommand({
      command: 'claude',
      args: ['plugin', 'update', 'filip-stack@local-plugins'],
      env,
    })
  } catch {
    await runCommand({
      command: 'claude',
      args: ['plugin', 'install', 'filip-stack@local-plugins'],
      env,
    })
  }
}

const syncCodex = async ({
  homeDir,
  codexOutputRoot,
  installCodexPlugin = installCodexPluginViaAppServer,
}: {
  homeDir: string
  codexOutputRoot: string
  installCodexPlugin?: CodexPluginInstaller
}) => {
  const marketplaceSourceRoot = join(homeDir, 'plugins', 'filip-stack')
  const marketplacePath = join(homeDir, '.agents', 'plugins', 'marketplace.json')

  await rm(marketplaceSourceRoot, { recursive: true, force: true })
  await ensureDirectory(dirname(marketplaceSourceRoot))
  await cp(codexOutputRoot, marketplaceSourceRoot, { recursive: true, force: true })
  await upsertCodexMarketplace({ homeDir })
  await upsertCodexConfig({ homeDir })
  await installCodexPlugin({
    homeDir,
    marketplacePath,
    pluginName: 'filip-stack',
  })
}

type SyncPluginsOptions = InstallOptions & { target: InstallTarget }

const syncPlugins = async ({
  repoRoot,
  homeDir,
  buildOutputRoot,
  target,
  runCommand: commandRunner = runCommand,
  installCodexPlugin = installCodexPluginViaAppServer,
}: SyncPluginsOptions) => {
  const buildResult = await buildPlugins({ repoRoot, outputRoot: buildOutputRoot })

  if (target === 'claude' || target === 'all') {
    await syncClaude({
      homeDir,
      marketplacePath: buildResult.claudeMarketplaceRoot,
      runCommand: commandRunner,
    })
  }

  if (target === 'codex' || target === 'all') {
    await syncCodex({
      homeDir,
      codexOutputRoot: buildResult.codexOutputRoot,
      installCodexPlugin,
    })
  }
}

export const installPlugins = async (options: SyncPluginsOptions) => syncPlugins(options)

export const updatePlugins = async (options: SyncPluginsOptions) => syncPlugins(options)
