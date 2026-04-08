import { Box, Text } from 'ink'

import type { Scope } from '../../scopes.js'
import { scopeOptions } from '../state.js'

type ScopeSelectorScreenProps = {
  cursor: number
  selectedScopes: Set<Scope>
}

export const ScopeSelectorScreen = ({ cursor, selectedScopes }: ScopeSelectorScreenProps) => (
  <Box flexDirection="column">
    <Text bold>Select scopes</Text>
    <Text dimColor>Use up/down to move, space to toggle, enter to continue.</Text>
    <Box marginTop={1} flexDirection="column">
      {scopeOptions.map((option, index) => {
        const pointer = index === cursor ? '>' : ' '
        const checked = selectedScopes.has(option.value) ? 'x' : ' '
        return (
          <Text key={option.value}>
            {pointer} [{checked}] {option.label}
          </Text>
        )
      })}
    </Box>
  </Box>
)
