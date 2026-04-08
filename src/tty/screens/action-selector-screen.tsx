import { Box, Text } from 'ink'

import { actionOptions } from '../state.js'

type ActionSelectorScreenProps = {
  cursor: number
}

export const ActionSelectorScreen = ({ cursor }: ActionSelectorScreenProps) => (
  <Box flexDirection="column">
    <Text bold>Choose action</Text>
    <Text dimColor>Enter to run, escape to go back.</Text>
    <Box marginTop={1} flexDirection="column">
      {actionOptions.map((option, index) => {
        const pointer = index === cursor ? '>' : ' '
        return (
          <Text key={option.label}>
            {pointer} {option.label}
          </Text>
        )
      })}
    </Box>
  </Box>
)
