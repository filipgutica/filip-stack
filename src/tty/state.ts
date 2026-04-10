import type { RunSyncResult } from '../run.js'
import type { Scope } from '../scopes.js'

export type TtyScreen = 'scopes' | 'action' | 'running' | 'result'

export type ScopeOption = {
  label: string
  value: Scope
}

export type ActionOption = {
  label: string
  dryRun: boolean
}

export type TtyState = {
  screen: TtyScreen
  scopeCursor: number
  actionCursor: number
  selectedScopes: Set<Scope>
  pendingAction: boolean | null
  result: RunSyncResult | null
  errorMessage: string | null
}

export const scopeOptions: ScopeOption[] = [
  { label: 'Skills', value: 'skills' },
  { label: 'Hooks', value: 'hooks' },
  { label: 'Globals', value: 'globals' },
]

export const actionOptions: ActionOption[] = [
  { label: 'Sync', dryRun: false },
  { label: 'Dry Run', dryRun: true },
]

export const moveCursor = ({
  current,
  length,
  direction,
}: {
  current: number
  length: number
  direction: 'up' | 'down'
}) => {
  if (length === 0) return 0
  if (direction === 'up') {
    return current === 0 ? length - 1 : current - 1
  }
  return current === length - 1 ? 0 : current + 1
}

export const toggleScopeSelection = ({
  selectedScopes,
  target,
}: {
  selectedScopes: Set<Scope>
  target: Scope
}) => {
  const next = new Set(selectedScopes)
  if (next.has(target)) {
    next.delete(target)
  } else {
    next.add(target)
  }
  return next
}

export const getSelectedScopes = (selectedScopes: Set<Scope>): Scope[] => Array.from(selectedScopes)
