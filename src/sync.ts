import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

import { readOptionalFile } from './fs.js'
import type { Scope } from './scopes.js'

export type SyncAction =
  | { type: 'mkdir'; path: string }
  | { type: 'copy'; source: string; destination: string }
  | { type: 'update'; destination: string; source?: string; detail: string }
  | { type: 'delete'; path: string; detail: string }

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

type HookMatchers = Record<string, unknown[]>

type FileEntry = {
  source: string
  destination: string
}

type ManagedHookState = {
  scripts: string[]
  commands: string[]
}

type ManagedManifest = {
  version: 1
  repo: 'filip-stack'
  skills: string[]
  hooks: {
    codex: ManagedHookState
    claude: ManagedHookState
  }
}

const MANIFEST_VERSION = 1 as const
const MANIFEST_REPO = 'filip-stack' as const

const createEmptyManagedManifest = (): ManagedManifest => ({
  version: MANIFEST_VERSION,
  repo: MANIFEST_REPO,
  skills: [],
  hooks: {
    codex: { scripts: [], commands: [] },
    claude: { scripts: [], commands: [] },
  },
})

const cloneManagedManifest = (manifest: ManagedManifest): ManagedManifest => ({
  version: manifest.version,
  repo: manifest.repo,
  skills: [...manifest.skills],
  hooks: {
    codex: {
      scripts: [...manifest.hooks.codex.scripts],
      commands: [...manifest.hooks.codex.commands],
    },
    claude: {
      scripts: [...manifest.hooks.claude.scripts],
      commands: [...manifest.hooks.claude.commands],
    },
  },
})

const uniqueSortedStrings = (values: string[]) => [...new Set(values)].sort()

const recordAction = (action: SyncAction, actions: SyncAction[]) => {
  actions.push(action)
}

const pathExists = async (path: string): Promise<boolean> => {
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

const isHookObject = (value: unknown): value is { hooks: HookMatchers } => {
  if (typeof value !== 'object' || value === null) return false
  if (!('hooks' in value)) return false

  const hooks = (value as { hooks: unknown }).hooks
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) return false

  return Object.values(hooks).every((entries) => Array.isArray(entries))
}

const isHookEntry = (value: unknown): value is { hooks: unknown[] } => {
  if (typeof value !== 'object' || value === null || !('hooks' in value)) return false
  return Array.isArray((value as { hooks: unknown }).hooks)
}

const isCommandEntry = (value: unknown): value is { command: string } => {
  if (typeof value !== 'object' || value === null || !('command' in value)) return false
  return typeof (value as { command: unknown }).command === 'string'
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

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return uniqueSortedStrings(value.filter((entry): entry is string => typeof entry === 'string'))
}

const parseManagedHookState = (value: unknown): ManagedHookState => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { scripts: [], commands: [] }
  }

  const state = value as Record<string, unknown>
  return {
    scripts: parseStringArray(state.scripts),
    commands: parseStringArray(state.commands),
  }
}

const parseManagedManifest = ({
  content,
  path,
}: {
  content: string
  path: string
}): ManagedManifest => {
  const parsed = parseJsonObject({ content, path })

  if (parsed.version !== MANIFEST_VERSION) {
    throw new Error(`Unsupported sync manifest version: ${path}`)
  }

  if (parsed.repo !== MANIFEST_REPO) {
    throw new Error(`Unexpected sync manifest repository id: ${path}`)
  }

  return {
    version: MANIFEST_VERSION,
    repo: MANIFEST_REPO,
    skills: parseStringArray(parsed.skills),
    hooks: {
      codex: parseManagedHookState(
        typeof parsed.hooks === 'object' && parsed.hooks !== null && !Array.isArray(parsed.hooks)
          ? (parsed.hooks as { codex?: unknown }).codex
          : undefined,
      ),
      claude: parseManagedHookState(
        typeof parsed.hooks === 'object' && parsed.hooks !== null && !Array.isArray(parsed.hooks)
          ? (parsed.hooks as { claude?: unknown }).claude
          : undefined,
      ),
    },
  }
}

const readManagedManifest = async ({ path }: { path: string }): Promise<ManagedManifest> => {
  const content = await readOptionalFile(path)
  if (content === null) return createEmptyManagedManifest()

  return parseManagedManifest({ content, path })
}

const writeManagedManifest = async ({
  path,
  manifest,
  dryRun,
}: {
  path: string
  manifest: ManagedManifest
  dryRun: boolean
}) => {
  if (dryRun) return

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`)
}

const collectHookCommands = ({ hooks }: { hooks: HookMatchers }) => {
  const commands: string[] = []

  for (const entries of Object.values(hooks)) {
    for (const entry of entries) {
      if (!isHookEntry(entry)) continue

      for (const nestedHook of entry.hooks) {
        if (!isCommandEntry(nestedHook)) continue
        commands.push(nestedHook.command)
      }
    }
  }

  return uniqueSortedStrings(commands)
}

const collectManagedSkillNames = async ({ repoRoot }: { repoRoot: string }) => {
  const skillsRoot = join(repoRoot, 'skills')
  if (!(await pathExists(skillsRoot))) return []

  const entries = await readdir(skillsRoot, { withFileTypes: true })
  const skillNames: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillRoot = join(skillsRoot, entry.name)
    if (await pathExists(join(skillRoot, 'SKILL.md'))) {
      skillNames.push(entry.name)
    }
  }

  return uniqueSortedStrings(skillNames)
}

const collectDirectoryFileEntries = async (
  sourceRoot: string,
  destinationRoot: string,
): Promise<FileEntry[]> => {
  if (!(await pathExists(sourceRoot))) return []

  const entries = await readdir(sourceRoot, { withFileTypes: true })
  const files: FileEntry[] = []

  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue

    const sourcePath = join(sourceRoot, entry.name)
    const destinationPath = join(destinationRoot, relative(sourceRoot, sourcePath))

    if (entry.isDirectory()) {
      files.push(...(await collectDirectoryFileEntries(sourcePath, destinationPath)))
      continue
    }

    if (entry.isFile()) {
      files.push({ source: sourcePath, destination: destinationPath })
      continue
    }

    const sourceStats = await stat(sourcePath)
    if (sourceStats.isFile()) {
      files.push({ source: sourcePath, destination: destinationPath })
    }
  }

  return files
}

const copyDirectoryEntries = async ({ entries, options }: { entries: FileEntry[]; options: CopyOptions }) => {
  for (const entry of entries) {
    await ensureDirectory(dirname(entry.destination), options)
    recordAction({ type: 'copy', source: entry.source, destination: entry.destination }, options.actions)

    if (!options.dryRun) {
      await copyFile(entry.source, entry.destination)
    }
  }
}

const syncDirectory = async ({
  sourceRoot,
  destinationRoot,
  options,
}: {
  sourceRoot: string
  destinationRoot: string
  options: CopyOptions
}): Promise<FileEntry[]> => {
  if (!(await pathExists(sourceRoot))) return []

  await ensureDirectory(destinationRoot, options)
  const entries = await collectDirectoryFileEntries(sourceRoot, destinationRoot)
  await copyDirectoryEntries({ entries, options })
  return entries
}

const ensureDirectory = async (path: string, options: CopyOptions) => {
  if (options.ensuredDirectories.has(path)) return

  options.ensuredDirectories.add(path)
  recordAction({ type: 'mkdir', path }, options.actions)

  if (!options.dryRun) {
    await mkdir(path, { recursive: true })
  }
}

const deleteManagedPath = async ({
  path,
  detail,
  options,
}: {
  path: string
  detail: string
  options: CopyOptions
}) => {
  if (!(await pathExists(path))) return

  recordAction({ type: 'delete', path, detail }, options.actions)

  if (!options.dryRun) {
    await rm(path, { recursive: true, force: true })
  }
}

const deleteManagedPaths = async ({
  paths,
  detail,
  options,
}: {
  paths: string[]
  detail: string
  options: CopyOptions
}) => {
  for (const path of uniqueSortedStrings(paths)) {
    await deleteManagedPath({ path, detail, options })
  }
}

const difference = (current: string[], next: string[]) => {
  const nextSet = new Set(next)
  return current.filter((value) => !nextSet.has(value))
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

const pruneManagedHookMatchers = ({
  existing,
  staleCommands,
}: {
  existing: HookMatchers
  staleCommands: Set<string>
}): HookMatchers => {
  if (staleCommands.size === 0) return existing

  const prunedEntries = Object.entries(existing)
    .map(([eventName, entries]) => {
      const nextEntries = entries.flatMap((entry) => {
        if (!isHookEntry(entry)) return [entry]

        const remainingNestedHooks = entry.hooks.filter(
          (nestedHook) => !isCommandEntry(nestedHook) || !staleCommands.has(nestedHook.command),
        )

        if (remainingNestedHooks.length === 0) return []

        return [{ ...entry, hooks: remainingNestedHooks }]
      })

      return [eventName, nextEntries] as const
    })
    .filter(([, entries]) => entries.length > 0)

  return Object.fromEntries(prunedEntries)
}

const hasConfiguredHooks = ({ hooks }: { hooks: HookMatchers }) =>
  Object.values(hooks).some((entries) => entries.length > 0)

const mergeHookJsonFile = async ({
  sourcePath,
  destinationPath,
  dryRun,
  detail,
  staleCommands,
  actions,
}: {
  sourcePath: string
  destinationPath: string
  dryRun: boolean
  detail: string
  staleCommands: Set<string>
  actions: SyncAction[]
}) => {
  const sourceContent = await readOptionalFile(sourcePath)
  const sourceHooks = sourceContent === null ? { hooks: {} } : parseHookFile({ content: sourceContent, path: sourcePath })
  const existingContent = await readOptionalFile(destinationPath)

  if (sourceContent === null && existingContent === null) return
  if (existingContent === null && !hasConfiguredHooks(sourceHooks)) return

  const existingHooks =
    existingContent === null
      ? { hooks: {} }
      : parseHookFile({ content: existingContent, path: destinationPath })
  const merged = {
    hooks: mergeHookMatchers({
      existing: pruneManagedHookMatchers({
        existing: existingHooks.hooks,
        staleCommands,
      }),
      incoming: sourceHooks.hooks,
    }),
  }
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
  staleCommands,
  actions,
}: {
  sourcePath: string
  destinationPath: string
  dryRun: boolean
  staleCommands: Set<string>
  actions: SyncAction[]
}) => {
  const sourceContent = await readOptionalFile(sourcePath)
  const sourceHooks = sourceContent === null ? { hooks: {} } : parseHookFile({ content: sourceContent, path: sourcePath })
  const existingContent = await readOptionalFile(destinationPath)

  if (sourceContent === null && existingContent === null) return
  if (existingContent === null && !hasConfiguredHooks(sourceHooks)) return

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
    hooks: mergeHookMatchers({
      existing: pruneManagedHookMatchers({
        existing: existingHooks,
        staleCommands,
      }),
      incoming: sourceHooks.hooks,
    }),
  }
  const nextContent = `${JSON.stringify(mergedSettings, null, 2)}\n`

  if (existingContent === nextContent) return

  recordAction(
    {
      type: 'update',
      destination: destinationPath,
      source: sourcePath,
      detail: 'merge Claude hooks config',
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

const syncSkills = async ({
  repoRoot,
  homeDir,
  options,
  previousManifest,
  nextManifest,
}: {
  repoRoot: string
  homeDir: string
  options: CopyOptions
  previousManifest: ManagedManifest
  nextManifest: ManagedManifest
}) => {
  const currentSkillNames = await collectManagedSkillNames({ repoRoot })
  const currentSkillSet = new Set(currentSkillNames)
  const staleSkillPaths = difference(previousManifest.skills, currentSkillNames).map((skillName) =>
    join(homeDir, '.agents/skills', skillName),
  )

  await syncDirectory({
    sourceRoot: join(repoRoot, 'skills'),
    destinationRoot: join(homeDir, '.agents/skills'),
    options,
  })
  await deleteManagedPaths({
    paths: staleSkillPaths,
    detail: 'delete stale managed skill',
    options,
  })

  nextManifest.skills = uniqueSortedStrings([...currentSkillSet])
}

const syncHookHost = async ({
  repoRoot,
  homeDir,
  host,
  sourceRoot,
  destinationRoot,
  sourceConfigPath,
  destinationConfigPath,
  previousManifest,
  nextManifest,
  options,
}: {
  repoRoot: string
  homeDir: string
  host: 'codex' | 'claude'
  sourceRoot: string
  destinationRoot: string
  sourceConfigPath: string
  destinationConfigPath: string
  previousManifest: ManagedManifest
  nextManifest: ManagedManifest
  options: CopyOptions
}) => {
  const firstEntries = await syncDirectory({
    sourceRoot: join(repoRoot, 'hooks/shared'),
    destinationRoot,
    options,
  })
  const hostEntries = await syncDirectory({
    sourceRoot,
    destinationRoot,
    options,
  })

  const currentScriptDestinations = uniqueSortedStrings([
    ...firstEntries.map((entry) => entry.destination),
    ...hostEntries.map((entry) => entry.destination),
  ])
  const staleScriptPaths = difference(previousManifest.hooks[host].scripts, currentScriptDestinations)
  await deleteManagedPaths({
    paths: staleScriptPaths,
    detail: 'delete stale managed hook script',
    options,
  })

  const sourceContent = await readOptionalFile(sourceConfigPath)
  const sourceHooks = sourceContent === null ? { hooks: {} } : parseHookFile({ content: sourceContent, path: sourceConfigPath })
  const currentCommands = collectHookCommands({ hooks: sourceHooks.hooks })
  const staleCommands = new Set(difference(previousManifest.hooks[host].commands, currentCommands))

  if (host === 'claude') {
    await mergeClaudeSettingsFile({
      sourcePath: sourceConfigPath,
      destinationPath: destinationConfigPath,
      dryRun: options.dryRun,
      staleCommands,
      actions: options.actions,
    })
  } else {
    await mergeHookJsonFile({
      sourcePath: sourceConfigPath,
      destinationPath: destinationConfigPath,
      dryRun: options.dryRun,
      detail: 'merge Codex hooks config',
      staleCommands,
      actions: options.actions,
    })
  }

  if (host === 'codex') {
    if (sourceContent !== null && hasConfiguredHooks(sourceHooks)) {
      await ensureCodexHooksFeature({
        destinationPath: join(homeDir, '.codex/config.toml'),
        dryRun: options.dryRun,
        actions: options.actions,
      })
    }
  }

  nextManifest.hooks[host] = {
    scripts: currentScriptDestinations,
    commands: currentCommands,
  }
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
  const manifestPath = join(homeDir, '.filip-stack/sync-manifest.json')
  const shouldTrackManagedArtifacts = selectedScopes.has('skills') || selectedScopes.has('hooks')
  const previousManifest = shouldTrackManagedArtifacts
    ? await readManagedManifest({ path: manifestPath })
    : createEmptyManagedManifest()
  const nextManifest = shouldTrackManagedArtifacts
    ? cloneManagedManifest(previousManifest)
    : createEmptyManagedManifest()

  if (selectedScopes.has('skills')) {
    await syncSkills({
      repoRoot,
      homeDir,
      options,
      previousManifest,
      nextManifest,
    })
  }

  if (selectedScopes.has('hooks')) {
    await syncHookHost({
      repoRoot,
      homeDir,
      host: 'codex',
      sourceRoot: join(repoRoot, 'hooks/codex/scripts'),
      destinationRoot: join(homeDir, '.codex/hooks'),
      sourceConfigPath: join(repoRoot, 'hooks/codex/hooks.json'),
      destinationConfigPath: join(homeDir, '.codex/hooks.json'),
      previousManifest,
      nextManifest,
      options,
    })

    await syncHookHost({
      repoRoot,
      homeDir,
      host: 'claude',
      sourceRoot: join(repoRoot, 'hooks/claude/scripts'),
      destinationRoot: join(homeDir, '.claude/hooks'),
      sourceConfigPath: join(repoRoot, 'hooks/claude/hooks.json'),
      destinationConfigPath: join(homeDir, '.claude/settings.json'),
      previousManifest,
      nextManifest,
      options,
    })
  }

  if (selectedScopes.has('globals')) {
    await copySingleFile(join(repoRoot, 'globals/AGENTS.md'), join(homeDir, '.codex/AGENTS.md'), options)
    await copySingleFile(
      join(repoRoot, 'globals/CLAUDE.md'),
      join(homeDir, '.claude/CLAUDE.md'),
      options,
    )
  }

  if (selectedScopes.has('skills') || selectedScopes.has('hooks')) {
    await writeManagedManifest({ path: manifestPath, manifest: nextManifest, dryRun })
  }

  return actions
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
