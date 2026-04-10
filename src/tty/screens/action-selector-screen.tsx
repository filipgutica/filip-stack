import { Text } from 'ink'

import { SelectorScreen } from '../components/selector-screen.js'
import { actionOptions } from '../state.js'

type ActionSelectorScreenProps = {
  cursor: number
}

export const ActionSelectorScreen = ({ cursor }: ActionSelectorScreenProps) => (
  <SelectorScreen title="Choose action" instructions="Enter to run, escape to go back.">
    {actionOptions.map((option, index) => (
      <Text key={option.label}>
        {index === cursor ? '>' : ' '} {option.label}
      </Text>
    ))}
  </SelectorScreen>
)
