import { copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type SyncAction =
  | { type: 'mkdir'; path: string }
  | { type: 'copy'; source: string; destination: string }
  | { type: 'update'; source: string; destination: string; detail: string }

export type SyncOptions = {
  repoRoot: string
  homeDir: string
  dryRun: boolean
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
