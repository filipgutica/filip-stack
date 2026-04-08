import { Box, Text } from 'ink'

type ErrorScreenProps = {
  message: string
}

export const ErrorScreen = ({ message }: ErrorScreenProps) => (
  <Box flexDirection="column">
    <Text color="red" bold>
      Run failed
    </Text>
    <Text>{message}</Text>
    <Text dimColor>Press escape to go back or q to exit.</Text>
  </Box>
)
