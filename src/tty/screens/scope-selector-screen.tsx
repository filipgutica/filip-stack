import { Text } from 'ink'

import type { Scope } from '../../scopes.js'
import { SelectorScreen } from '../components/selector-screen.js'
import { scopeOptions } from '../state.js'

type ScopeSelectorScreenProps = {
  cursor: number
  selectedScopes: Set<Scope>
}

export const ScopeSelectorScreen = ({ cursor, selectedScopes }: ScopeSelectorScreenProps) => (
  <SelectorScreen title="Select scopes" instructions="Use up/down to move, space to toggle, enter to continue.">
    {scopeOptions.map((option, index) => (
      <Text key={option.value}>
        {index === cursor ? '>' : ' '} [{selectedScopes.has(option.value) ? 'x' : ' '}] {option.label}
      </Text>
    ))}
  </SelectorScreen>
)
