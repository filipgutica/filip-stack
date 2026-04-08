import { mkdir, readdir, readFile, stat, copyFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

import type { Scope } from './scopes.js'

export type SyncAction =
  | { type: 'mkdir'; path: string }
  | { type: 'copy'; source: string; destination: string }
  | { type: 'update'; destination: string; source?: string; detail: string }

export type SyncOptions = {
  repoRoot: string
  homeDir: string
  scopes: Scope[]
  dryRun: boolean
}

type CopyOptions = {
  dryRun: boolean
  actions: SyncAction[]
  ensuredDirectories: Set<string>
}

const recordAction = (action: SyncAction, actions: SyncAction[]) => {
  actions.push(action)
}

const readOptionalFile = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, 'utf8')
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ENOENT') {
      return null
    }

    throw caughtError
  }
}

type HookMatchers = Record<string, unknown[]>

const isHookObject = (value: unknown): value is { hooks: HookMatchers } => {
  if (typeof value !== 'object' || value === null) return false
  if (!('hooks' in value)) return false

  const hooks = (value as { hooks: unknown }).hooks
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) return false

  return Object.values(hooks).every((entries) => Array.isArray(entries))
}

const parseHookFile = ({
  content,
  path,
}: {
  content: string
  path: string
}): { hooks: HookMatchers } => {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch (caughtError) {
    throw new Error(`Invalid JSON in hook config: ${path}`)
  }

  if (!isHookObject(parsed)) {
    throw new Error(`Hook config must contain a top-level hooks object: ${path}`)
  }

  return { hooks: parsed.hooks }
}

const parseJsonObject = ({
  content,
  path,
}: {
  content: string
  path: string
}): Record<string, unknown> => {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch (caughtError) {
    throw new Error(`Invalid JSON in config file: ${path}`)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Config file must contain a top-level JSON object: ${path}`)
  }

  return parsed as Record<string, unknown>
}

const mergeHookMatchers = ({
  existing,
  incoming,
}: {
  existing: HookMatchers
  incoming: HookMatchers
}): HookMatchers => {
  const merged: HookMatchers = { ...existing }

  for (const [eventName, entries] of Object.entries(incoming)) {
    const current = merged[eventName] ?? []
    const seen = new Set(current.map((entry) => JSON.stringify(entry)))

    merged[eventName] = [...current]
    for (const entry of entries) {
      const key = JSON.stringify(entry)
      if (seen.has(key)) continue
      seen.add(key)
      merged[eventName].push(entry)
    }
  }

  return merged
}

const hasConfiguredHooks = ({ hooks }: { hooks: HookMatchers }) =>
  Object.values(hooks).some((entries) => entries.length > 0)

const mergeHookJsonFile = async ({
  sourcePath,
  destinationPath,
  dryRun,
  detail,
  actions,
}: {
  sourcePath: string
  destinationPath: string
  dryRun: boolean
  detail: string
  actions: SyncAction[]
}) => {
  const sourceContent = await readOptionalFile(sourcePath)
  if (sourceContent === null) return

  const sourceHooks = parseHookFile({ content: sourceContent, path: sourcePath })
  if (!hasConfiguredHooks(sourceHooks)) return

  const existingContent = await readOptionalFile(destinationPath)
  const existingHooks =
    existingContent === null
      ? { hooks: {} }
      : parseHookFile({ content: existingContent, path: destinationPath })
  const merged = { hooks: mergeHookMatchers({ existing: existingHooks.hooks, incoming: sourceHooks.hooks }) }
  const nextContent = `${JSON.stringify(merged, null, 2)}\n`

  if (existingContent === nextContent) return

  recordAction({ type: 'update', destination: destinationPath, source: sourcePath, detail }, actions)

  if (!dryRun) {
    await mkdir(dirname(destinationPath), { recursive: true })
    await writeFile(destinationPath, nextContent)
  }
}

const mergeClaudeSettingsFile = async ({
  sourcePath,
  destinationPath,
  dryRun,
  actions,
}: {
  sourcePath: string
  destinationPath: string
  dryRun: boolean
  actions: SyncAction[]
}) => {
  const sourceContent = await readOptionalFile(sourcePath)
  if (sourceContent === null) return

  const sourceHooks = parseHookFile({ content: sourceContent, path: sourcePath })
  if (!hasConfiguredHooks(sourceHooks)) return

  const existingContent = await readOptionalFile(destinationPath)
  const existingSettings =
    existingContent === null
      ? {}
      : parseJsonObject({ content: existingContent, path: destinationPath })
  const existingHooksValue = existingSettings.hooks
  const existingHooks: HookMatchers =
    typeof existingHooksValue === 'object' &&
    existingHooksValue !== null &&
    !Array.isArray(existingHooksValue) &&
    Object.values(existingHooksValue).every((entries) => Array.isArray(entries))
      ? (existingHooksValue as HookMatchers)
      : {}
  const mergedSettings = {
    ...existingSettings,
    hooks: mergeHookMatchers({ existing: existingHooks, incoming: sourceHooks.hooks }),
  }
  const nextContent = `${JSON.stringify(mergedSettings, null, 2)}\n`

  if (existingContent === nextContent) return

  recordAction(
    {
      type: 'update',
      destination: destinationPath,
      source: sourcePath,
      detail: 'merge Claude hooks settings',
    },
    actions,
  )

  if (!dryRun) {
    await mkdir(dirname(destinationPath), { recursive: true })
    await writeFile(destinationPath, nextContent)
  }
}

const ensureCodexHooksFeature = async ({
  destinationPath,
  dryRun,
  actions,
}: {
  destinationPath: string
  dryRun: boolean
  actions: SyncAction[]
}) => {
  const existingContent = (await readOptionalFile(destinationPath)) ?? ''
  const nextContent = updateCodexConfigToml(existingContent)

  if (existingContent === nextContent) return

  recordAction(
    {
      type: 'update',
      destination: destinationPath,
      detail: 'enable codex_hooks feature',
    },
    actions,
  )

  if (!dryRun) {
    await mkdir(dirname(destinationPath), { recursive: true })
    await writeFile(destinationPath, nextContent)
  }
}

const updateCodexConfigToml = (content: string) => {
  const hasTrailingNewline = content.endsWith('\n')
  const lines = content === '' ? [] : content.replace(/\n$/, '').split('\n')
  const featuresIndex = lines.findIndex((line) => line.trim() === '[features]')

  if (featuresIndex === -1) {
    if (content === '') {
      return '[features]\ncodex_hooks = true\n'
    }

    return `${content.replace(/\n?$/, '\n\n')}[features]\ncodex_hooks = true\n`
  }

  let sectionEnd = lines.length
  for (let index = featuresIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim().startsWith('[')) {
      sectionEnd = index
      break
    }
  }

  for (let index = featuresIndex + 1; index < sectionEnd; index += 1) {
    if (lines[index].trim().startsWith('codex_hooks')) {
      lines[index] = 'codex_hooks = true'
      return `${lines.join('\n')}${hasTrailingNewline ? '\n' : ''}`
    }
  }

  lines.splice(sectionEnd, 0, 'codex_hooks = true')
  return `${lines.join('\n')}${hasTrailingNewline ? '\n' : ''}`
}

const ensureDirectory = async (path: string, options: CopyOptions) => {
  if (options.ensuredDirectories.has(path)) return

  options.ensuredDirectories.add(path)
  recordAction({ type: 'mkdir', path }, options.actions)

  if (!options.dryRun) {
    await mkdir(path, { recursive: true })
  }
}

const copySingleFile = async (source: string, destination: string, options: CopyOptions) => {
  const sourceStats = await stat(source)

  if (!sourceStats.isFile()) {
    throw new Error(`Source is not a file: ${source}`)
  }

  await ensureDirectory(dirname(destination), options)
  recordAction({ type: 'copy', source, destination }, options.actions)

  if (!options.dryRun) {
    await copyFile(source, destination)
  }
}

const copyDirectoryContents = async (
  sourceRoot: string,
  destinationRoot: string,
  currentSource: string,
  options: CopyOptions,
) => {
  const entries = await readdir(currentSource, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue

    const sourcePath = join(currentSource, entry.name)
    const destinationPath = join(destinationRoot, relative(sourceRoot, sourcePath))

    if (entry.isDirectory()) {
      await ensureDirectory(destinationPath, options)
      await copyDirectoryContents(sourceRoot, destinationRoot, sourcePath, options)
      continue
    }

    if (entry.isFile()) {
      await copySingleFile(sourcePath, destinationPath, options)
      continue
    }

    const sourceStats = await stat(sourcePath)
    if (sourceStats.isFile()) {
      await copySingleFile(sourcePath, destinationPath, options)
    }
  }
}

const copyDirectory = async (sourceRoot: string, destinationRoot: string, options: CopyOptions) => {
  await ensureDirectory(destinationRoot, options)
  await copyDirectoryContents(sourceRoot, destinationRoot, sourceRoot, options)
}

export const syncSetup = async ({
  repoRoot,
  homeDir,
  scopes,
  dryRun,
}: SyncOptions): Promise<SyncAction[]> => {
  const actions: SyncAction[] = []
  const options: CopyOptions = { dryRun, actions, ensuredDirectories: new Set() }
  const selectedScopes = new Set(scopes)

  if (selectedScopes.has('skills')) {
    await copyDirectory(join(repoRoot, 'skills'), join(homeDir, '.agents/skills'), options)
  }

  if (selectedScopes.has('hooks')) {
    await copyDirectory(join(repoRoot, 'hooks/codex/scripts'), join(homeDir, '.codex/hooks'), options)
    await copyDirectory(join(repoRoot, 'hooks/claude/scripts'), join(homeDir, '.claude/hooks'), options)
    await mergeClaudeSettingsFile({
      sourcePath: join(repoRoot, 'hooks/claude/settings.json'),
      destinationPath: join(homeDir, '.claude/settings.json'),
      dryRun,
      actions,
    })
    await mergeHookJsonFile({
      sourcePath: join(repoRoot, 'hooks/codex/hooks.json'),
      destinationPath: join(homeDir, '.codex/hooks.json'),
      dryRun,
      detail: 'merge Codex hooks config',
      actions,
    })

    const codexHooksContent = await readOptionalFile(join(repoRoot, 'hooks/codex/hooks.json'))
    if (codexHooksContent !== null && hasConfiguredHooks(parseHookFile({
      content: codexHooksContent,
      path: join(repoRoot, 'hooks/codex/hooks.json'),
    }))) {
      await ensureCodexHooksFeature({
        destinationPath: join(homeDir, '.codex/config.toml'),
        dryRun,
        actions,
      })
    }
  }

  if (selectedScopes.has('globals')) {
    await copySingleFile(
      join(repoRoot, 'globals/AGENTS.md'),
      join(homeDir, '.codex/AGENTS.md'),
      options,
    )
    await copySingleFile(
      join(repoRoot, 'globals/CLAUDE.md'),
      join(homeDir, '.claude/CLAUDE.md'),
      options,
    )
  }

  return actions
}
