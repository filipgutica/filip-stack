import React, { useEffect, useMemo, useState } from 'react'
import { useApp, useInput } from 'ink'

import type { Scope } from '../scopes.js'
import type { RunSyncResult } from '../run.js'
import {
  actionOptions,
  createInitialTtyState,
  getSelectedScopes,
  moveCursor,
  scopeOptions,
  toggleScopeSelection,
} from './state.js'
import { ActionSelectorScreen, ErrorScreen, RunningScreen, ScopeSelectorScreen, SummaryScreen } from './screens/index.js'

type RunExecutor = (options: { scopes: Scope[]; dryRun: boolean }) => Promise<RunSyncResult>

type AppProps = {
  repoRoot: string
  homeDir: string
  runSync: RunExecutor
}

export const App = ({ repoRoot, homeDir, runSync }: AppProps) => {
  const { exit } = useApp()
  const initialState = useMemo(() => createInitialTtyState(), [])
  const [screen, setScreen] = useState(initialState.screen)
  const [scopeCursor, setScopeCursor] = useState(initialState.scopeCursor)
  const [actionCursor, setActionCursor] = useState(initialState.actionCursor)
  const [selectedScopes, setSelectedScopes] = useState(initialState.selectedScopes)
  const [pendingAction, setPendingAction] = useState<boolean | null>(initialState.pendingAction)
  const [result, setResult] = useState<RunSyncResult | null>(initialState.result)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialState.errorMessage)

  const scopes = useMemo(() => getSelectedScopes(selectedScopes), [selectedScopes])

  useInput((input, key) => {
    if (input === 'q') {
      exit()
      return
    }

    if (screen === 'scopes') {
      if (key.upArrow) {
        setScopeCursor((current) => moveCursor({ current, length: scopeOptions.length, direction: 'up' }))
        return
      }
      if (key.downArrow) {
        setScopeCursor((current) => moveCursor({ current, length: scopeOptions.length, direction: 'down' }))
        return
      }
      if (input === ' ') {
        const target = scopeOptions[scopeCursor].value
        setSelectedScopes((current) => toggleScopeSelection({ selectedScopes: current, target }))
        return
      }
      if (key.return && selectedScopes.size > 0) {
        setScreen('action')
      }
      return
    }

    if (screen === 'action') {
      if (key.escape) {
        setScreen('scopes')
        return
      }
      if (key.upArrow) {
        setActionCursor((current) => moveCursor({ current, length: actionOptions.length, direction: 'up' }))
        return
      }
      if (key.downArrow) {
        setActionCursor((current) => moveCursor({ current, length: actionOptions.length, direction: 'down' }))
        return
      }
      if (key.return) {
        setPendingAction(actionOptions[actionCursor].dryRun)
        setScreen('running')
      }
      return
    }

    if (screen === 'result' && key.escape) {
      setResult(null)
      setErrorMessage(null)
      setPendingAction(null)
      setScreen('scopes')
    }
  })

  useEffect(() => {
    if (screen !== 'running' || pendingAction === null) return

    let cancelled = false

    const run = async () => {
      try {
        const nextResult = await runSync({
          scopes,
          dryRun: pendingAction,
        })
        if (cancelled) return
        setResult(nextResult)
        setErrorMessage(null)
      } catch (caughtError) {
        if (cancelled) return
        setErrorMessage(caughtError instanceof Error ? caughtError.message : String(caughtError))
      } finally {
        if (!cancelled) {
          setScreen('result')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [screen, pendingAction, runSync, scopes])

  if (errorMessage !== null) return <ErrorScreen message={errorMessage} />
  if (screen === 'scopes') return <ScopeSelectorScreen cursor={scopeCursor} selectedScopes={selectedScopes} />
  if (screen === 'action') return <ActionSelectorScreen cursor={actionCursor} />
  if (screen === 'running') return <RunningScreen dryRun={pendingAction} />
  if (result !== null) return <SummaryScreen result={result} repoRoot={repoRoot} homeDir={homeDir} />
  return null
}
