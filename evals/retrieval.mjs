// Prompt functions, tests, and assertion for the retrieval eval. Each prompt gives
// the model its host's rendered global guidance and the Field Guide skill, which
// hold the retrieval and citation rules under test. The raw core.md is not used:
// its {{include:...}} placeholders break promptfoo's template rendering.
import { renderGuidance, scenariosIn } from './host-guidance.mjs'
import { rulesEval } from './rules.mjs'

const scenarioFile = 'tests/host-config/retrieval-scenarios.json'
const fieldGuide = rulesEval({
  ruleFiles: ['plugins/field-guide/skills/field-guide/SKILL.md'],
  scenarioFile,
  role: 'You are a coding agent that follows the guidance below. The Field Guide plugin is installed.',
})

const withHostGuidance = (version, prompt) => ({ vars, provider }) => {
  const [system, user] = prompt({ vars })
  // Only explicit hook fixtures belong in host context. Scenario tasks stay in the user message.
  const content = [renderGuidance(version)[provider.label], system.content, vars.hookContext].filter(Boolean).join('\n\n')
  return [{ ...system, content }, user]
}

export const prepareRetrieval = ({ tests, noBase }) => {
  fieldGuide.prepare({ tests, noBase })
  if (!noBase) renderGuidance('base')
  renderGuidance('head')
}
export const baseRetrieval = withHostGuidance('base', fieldGuide.base)
export const headRetrieval = withHostGuidance('head', fieldGuide.head)
export const retrievalTests = () => {
  const hookContexts = new Map(scenariosIn(scenarioFile).map(({ id, hookContext }) => [id, hookContext ?? '']))
  return fieldGuide.tests().map((test) => ({
    ...test,
    vars: { ...test.vars, hookContext: hookContexts.get(test.metadata.scenario) },
  }))
}
export const { score: scoreRetrieval } = fieldGuide
