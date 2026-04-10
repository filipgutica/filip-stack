import type { Scope } from './scopes.js'
import type { SyncAction } from './sync.js'
import { buildRunSummary, homePath, joinLabels } from './summary.js'

export type FormatDryRunOptions = {
  actions: SyncAction[]
  scopes: Scope[]
  repoRoot: string
  homeDir: string
}

export type FormatSyncSummaryOptions = {
  actions: SyncAction[]
  scopes: Scope[]
  repoRoot: string
  homeDir: string
}

export const formatDryRun = ({ actions, scopes, repoRoot, homeDir }: FormatDryRunOptions) => {
  const summary = buildRunSummary({ actions, scopes, repoRoot, homeDir })
  const lines = ['# Dry Run', '', `No files were changed. Selected scopes: ${summary.scopeLabels.join(', ')}.`, '']

  for (const section of summary.sections) {
    const destinationLabel =
      section.destinations.length === 1
        ? `\`${section.destinations[0]}\``
        : section.destinations.map((destination) => `\`${destination}\``).join(', ')
    lines.push(`### ${section.title}`)
    lines.push(`- Source: \`${section.source}\``)
    lines.push(`- Destination: ${destinationLabel}`)
    lines.push(
      `- Planned: ${section.plannedFiles} file${section.plannedFiles === 1 ? '' : 's'}, ${section.plannedDirectories} director${section.plannedDirectories === 1 ? 'y' : 'ies'}${section.plannedDeletes > 0 ? `, ${section.plannedDeletes} deletion${section.plannedDeletes === 1 ? '' : 's'}` : ''}`,
    )

    if (section.fileTargets.length > 0) {
      lines.push('- Files:')
      lines.push(...section.fileTargets.map((target) => `  - \`${target}\``))
    } else {
      lines.push('- Files: none')
    }

    if (section.deleteTargets.length > 0) {
      lines.push('- Deletions:')
      lines.push(...section.deleteTargets.map((target) => `  - \`${target}\``))
    } else {
      lines.push('- Deletions: none')
    }

    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

export const formatSyncSummary = ({
  actions,
  scopes,
  repoRoot,
  homeDir,
}: FormatSyncSummaryOptions) => {
  const summary = buildRunSummary({ actions, scopes, repoRoot, homeDir })
  const lines = [`# Sync Complete`, '', `Synced ${joinLabels(summary.scopeLabels)}.`, '']

  for (const section of summary.sections) {
    lines.push(`## ${section.title}`)
    lines.push(
      `- Updated: ${section.plannedFiles} file${section.plannedFiles === 1 ? '' : 's'}`
    )
    if (section.plannedDeletes > 0) {
      lines.push(
        `- Deleted: ${section.plannedDeletes} item${section.plannedDeletes === 1 ? '' : 's'}`
      )
    }
    lines.push(
      `- Destination: ${section.destinations
        .map((destination) => `\`${homePath(destination, homeDir)}\``)
        .join(', ')}`
    )
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}
