import { type ReactNode } from 'react'
import { Box, Text } from 'ink'

type SelectorScreenProps = {
  title: string
  instructions: string
  children: ReactNode
}

export const SelectorScreen = ({ title, instructions, children }: SelectorScreenProps) => (
  <Box flexDirection="column">
    <Text bold>{title}</Text>
    <Text dimColor>{instructions}</Text>
    <Box marginTop={1} flexDirection="column">
      {children}
    </Box>
  </Box>
)
