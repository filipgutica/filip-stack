import type { Scope } from './scopes.js'
import { syncSetup, type SyncAction } from './sync.js'

export type RunSyncOptions = {
  repoRoot: string
  homeDir: string
  scopes: Scope[]
  dryRun: boolean
}

export type RunSyncResult = {
  actions: SyncAction[]
  scopes: Scope[]
  dryRun: boolean
}

export const runSync = async ({
  repoRoot,
  homeDir,
  scopes,
  dryRun,
}: RunSyncOptions): Promise<RunSyncResult> => {
  const actions = await syncSetup({
    repoRoot,
    homeDir,
    scopes,
    dryRun,
  })

  return {
    actions,
    scopes,
    dryRun,
  }
}
