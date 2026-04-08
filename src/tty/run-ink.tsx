import React from 'react'
import { render } from 'ink'

import type { RunSyncResult } from '../run.js'
import type { Scope } from '../scopes.js'
import { App } from './app.js'

export type RunInkAppOptions = {
  repoRoot: string
  homeDir: string
  runSync: (options: { scopes: Scope[]; dryRun: boolean }) => Promise<RunSyncResult>
}

export const runInkApp = async ({ repoRoot, homeDir, runSync }: RunInkAppOptions) => {
  render(<App repoRoot={repoRoot} homeDir={homeDir} runSync={runSync} />)
  return 0
}
