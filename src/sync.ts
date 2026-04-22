import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { readOptionalFile } from './fs.js'

export type SyncAction =
  | { type: 'mkdir'; path: string }
  | { type: 'copy'; source: string; destination: string }
  | { type: 'update'; source: string; destination: string; detail: string }

export type SyncOptions = {
  repoRoot: string
  homeDir: string
  dryRun: boolean
}

type HookCommand = {
  type: 'command'
  command: string
}

type HookMatcher = {
  hooks: HookCommand[]
}

type HooksConfig = {
  hooks: Record<string, HookMatcher[]>
}

const pathExists = async (path: string) => {
  try {
    await stat(path)
    return true
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ENOENT') {
      return false
    }

    throw caughtError
  }
}

const copyGlobalFile = async ({
  source,
  destination,
  dryRun,
  actions,
}: {
  source: string
  destination: string
  dryRun: boolean
  actions: SyncAction[]
}) => {
  const destinationDirectory = dirname(destination)

  if (!(await pathExists(destinationDirectory))) {
    actions.push({ type: 'mkdir', path: destinationDirectory })
    if (!dryRun) {
      await mkdir(destinationDirectory, { recursive: true })
    }
  }

  actions.push({
    type: await pathExists(destination)
      ? 'update'
      : 'copy',
    source,
    destination,
    detail: 'sync global guidance file',
  })

  if (!dryRun) {
    await copyFile(source, destination)
  }
}

export const syncGlobals = async ({
  repoRoot,
  homeDir,
  dryRun,
}: SyncOptions): Promise<SyncAction[]> => {
  const actions: SyncAction[] = []

  await copyGlobalFile({
    source: join(repoRoot, 'globals', 'AGENTS.md'),
    destination: join(homeDir, '.codex', 'AGENTS.md'),
    dryRun,
    actions,
  })

  await copyGlobalFile({
    source: join(repoRoot, 'globals', 'CLAUDE.md'),
    destination: join(homeDir, '.claude', 'CLAUDE.md'),
    dryRun,
    actions,
  })

  return actions
}

const codexHooksPath = (homeDir: string) => join(homeDir, '.codex', 'hooks.json')

const managedHookCommand = ({
  repoRoot,
  event,
}: {
  repoRoot: string
  event: 'UserPromptSubmit' | 'Stop'
}) => `node "${join(repoRoot, 'plugins', 'filip-stack', 'scripts', 'project-notes-hook.mjs')}" codex ${event}`

const emptyHooksConfig = (): HooksConfig => ({ hooks: {} })

const parseHooksConfig = (raw: string | null): HooksConfig => {
  if (raw === null) return emptyHooksConfig()

  try {
    const parsed = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('hooks' in parsed) ||
      typeof parsed.hooks !== 'object' ||
      parsed.hooks === null ||
      Array.isArray(parsed.hooks)
    ) {
      return emptyHooksConfig()
    }

    const hooks = Object.entries(parsed.hooks).reduce<Record<string, HookMatcher[]>>((acc, [key, value]) => {
      if (Array.isArray(value)) {
        acc[key] = value as HookMatcher[]
      }
      return acc
    }, {})

    return { hooks }
  } catch {
    return emptyHooksConfig()
  }
}

const isManagedHookCommand = (command: string) =>
  command.includes('project-notes-hook.mjs') && command.includes(' codex ')

const upsertManagedHook = ({
  config,
  event,
  command,
}: {
  config: HooksConfig
  event: 'UserPromptSubmit' | 'Stop'
  command: string
}) => {
  const existingMatchers = Array.isArray(config.hooks[event]) ? config.hooks[event] : []
  const retainedMatchers = existingMatchers.flatMap((matcher) => {
    if (!matcher || typeof matcher !== 'object' || !Array.isArray(matcher.hooks)) return [matcher]

    const hooks = matcher.hooks.filter((hook) => !(
      hook &&
      typeof hook === 'object' &&
      hook.type === 'command' &&
      typeof hook.command === 'string' &&
      isManagedHookCommand(hook.command)
    ))

    return hooks.length > 0 ? [{ ...matcher, hooks }] : []
  })

  config.hooks[event] = [
    ...retainedMatchers,
    {
      hooks: [
        {
          type: 'command',
          command,
        },
      ],
    },
  ]
}

export const syncCodexHooks = async ({
  repoRoot,
  homeDir,
  dryRun,
}: SyncOptions): Promise<SyncAction[]> => {
  const actions: SyncAction[] = []
  const destination = codexHooksPath(homeDir)
  const destinationDirectory = dirname(destination)

  if (!(await pathExists(destinationDirectory))) {
    actions.push({ type: 'mkdir', path: destinationDirectory })
    if (!dryRun) {
      await mkdir(destinationDirectory, { recursive: true })
    }
  }

  const existingContent = await readOptionalFile(destination)
  const nextConfig = parseHooksConfig(existingContent)

  upsertManagedHook({
    config: nextConfig,
    event: 'UserPromptSubmit',
    command: managedHookCommand({ repoRoot, event: 'UserPromptSubmit' }),
  })
  upsertManagedHook({
    config: nextConfig,
    event: 'Stop',
    command: managedHookCommand({ repoRoot, event: 'Stop' }),
  })

  actions.push({
    type: existingContent === null ? 'copy' : 'update',
    source: join(repoRoot, 'plugins', 'filip-stack', 'scripts', 'project-notes-hook.mjs'),
    destination,
    detail: 'sync Codex project-notes hooks',
  })

  if (!dryRun) {
    await writeFile(destination, `${JSON.stringify(nextConfig, null, 2)}\n`)
  }

  return actions
}
