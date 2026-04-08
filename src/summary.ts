import { relative } from 'node:path'

import type { Scope } from './scopes.js'
import type { SyncAction } from './sync.js'

export type SummarySection = {
  title: string
  source: string
  destinations: string[]
  plannedFiles: number
  plannedDirectories: number
  fileTargets: string[]
}

export type RunSummary = {
  scopeLabels: string[]
  sections: SummarySection[]
}

type SectionConfig = {
  scope: Scope
  title: string
  source: string
  destinations: string[]
}

const scopeLabel = (scope: Scope) => {
  if (scope === 'skills') return 'Skills'
  if (scope === 'hooks') return 'Hooks'
  return 'Globals'
}

const relativePath = (path: string, root: string) => {
  const rel = relative(root, path)
  return rel === '' ? '.' : rel
}

const actionDestination = (action: SyncAction) => {
  if (action.type === 'mkdir') return action.path
  return action.destination
}

const groupActions = (actions: SyncAction[], pathPrefix: string) =>
  actions.filter((action) => {
    const path = actionDestination(action)
    return path === pathPrefix || path.startsWith(`${pathPrefix}/`)
  })

const sectionConfigs = ({ repoRoot, homeDir }: { repoRoot: string; homeDir: string }): SectionConfig[] => [
  {
    scope: 'skills',
    title: 'Skills',
    source: `${repoRoot}/skills`,
    destinations: [`${homeDir}/.agents/skills`],
  },
  {
    scope: 'hooks',
    title: 'Codex Hooks',
    source: `${repoRoot}/hooks/codex`,
    destinations: [`${homeDir}/.codex/hooks`, `${homeDir}/.codex/hooks.json`, `${homeDir}/.codex/config.toml`],
  },
  {
    scope: 'hooks',
    title: 'Claude Hooks',
    source: `${repoRoot}/hooks/claude`,
    destinations: [`${homeDir}/.claude/hooks`, `${homeDir}/.claude/settings.json`],
  },
  {
    scope: 'globals',
    title: 'Codex Global',
    source: `${repoRoot}/globals/AGENTS.md`,
    destinations: [`${homeDir}/.codex/AGENTS.md`],
  },
  {
    scope: 'globals',
    title: 'Claude Global',
    source: `${repoRoot}/globals/CLAUDE.md`,
    destinations: [`${homeDir}/.claude/CLAUDE.md`],
  },
]

export const buildRunSummary = ({
  actions,
  scopes,
  repoRoot,
  homeDir,
}: {
  actions: SyncAction[]
  scopes: Scope[]
  repoRoot: string
  homeDir: string
}): RunSummary => {
  const sections = sectionConfigs({ repoRoot, homeDir })
    .filter((section) => scopes.includes(section.scope))
    .map((section) => {
      const relevantActions = section.destinations.flatMap((destination) => groupActions(actions, destination))
      const fileTargets = relevantActions
        .filter(
          (
            action,
          ): action is Extract<SyncAction, { destination: string; type: 'copy' | 'update' }> =>
            action.type === 'copy' || action.type === 'update',
        )
        .map((action) => relativePath(action.destination, homeDir))

      return {
        title: section.title,
        source: section.source,
        destinations: section.destinations,
        plannedFiles: relevantActions.filter(
          (action) => action.type === 'copy' || action.type === 'update',
        ).length,
        plannedDirectories: relevantActions.filter((action) => action.type === 'mkdir').length,
        fileTargets,
      }
    })

  return {
    scopeLabels: scopes.map(scopeLabel),
    sections,
  }
}

export const joinLabels = (labels: string[]) => {
  if (labels.length <= 2) return labels.join(' and ')
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

export const homePath = (path: string, homeDir: string) => {
  const rel = relativePath(path, homeDir)
  return rel === '.' ? '~' : `~/${rel}`
}
