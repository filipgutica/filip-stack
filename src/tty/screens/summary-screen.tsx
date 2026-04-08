import { Box, Text } from 'ink'
import Markdown from '@inkkit/ink-markdown'

import type { RunSyncResult } from '../../run.js'
import { formatDryRun, formatSyncSummary } from '../../output.js'

type SummaryScreenProps = {
  result: RunSyncResult
  repoRoot: string
  homeDir: string
}

export const SummaryScreen = ({ result, repoRoot, homeDir }: SummaryScreenProps) => {
  const markdown = result.dryRun
    ? formatDryRun({
        actions: result.actions,
        scopes: result.scopes,
        repoRoot,
        homeDir,
      })
    : formatSyncSummary({
        actions: result.actions,
        scopes: result.scopes,
        repoRoot,
        homeDir,
      })

  return (
    <Box flexDirection="column">
      <Text bold>{result.dryRun ? 'Dry Run' : 'Sync Complete'}</Text>
      <Text dimColor>Press q to exit or escape to start over.</Text>
      <Box marginTop={1} flexDirection="column">
        <Markdown>{markdown}</Markdown>
      </Box>
    </Box>
  )
}
