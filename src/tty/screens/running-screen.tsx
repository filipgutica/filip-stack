import { Box, Text } from 'ink'

type RunningScreenProps = {
  dryRun: boolean | null
}

export const RunningScreen = ({ dryRun }: RunningScreenProps) => (
  <Box flexDirection="column">
    <Text bold>{dryRun ? 'Preparing dry run...' : 'Syncing...'}</Text>
  </Box>
)
