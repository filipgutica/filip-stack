import { Box, Text } from 'ink'

import type { SummarySection } from '../../summary.js'

type SectionSummaryProps = {
  section: SummarySection
}

export const SectionSummary = ({ section }: SectionSummaryProps) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold>{section.title}</Text>
    <Text>Source: {section.source}</Text>
    <Text>
      Planned/updated: {section.plannedFiles} files, {section.plannedDirectories} directories
    </Text>
    <Text>Destinations:</Text>
    {section.destinations.map((destination) => (
      <Text key={destination}>  - {destination}</Text>
    ))}
    <Text>Files:</Text>
    {section.fileTargets.length > 0 ? (
      section.fileTargets.map((target) => <Text key={target}>  - {target}</Text>)
    ) : (
      <Text>  - none</Text>
    )}
  </Box>
)
