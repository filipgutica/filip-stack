import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const skillUrl = new URL('../SKILL.md', import.meta.url)
const formatUrl = new URL('../references/default-format.md', import.meta.url)
const implementationFlowUrl = new URL('../../coordinator/references/implementation-flow.md', import.meta.url)

const [skill, format, implementationFlow] = await Promise.all([
  readFile(skillUrl, 'utf8'),
  readFile(formatUrl, 'utf8'),
  readFile(implementationFlowUrl, 'utf8'),
])

assert.match(skill, /explicit user format first/i)
assert.match(skill, /otherwise[^\n]*repository template takes precedence/i)
assert.match(skill, /if neither exists[^\n]*default-format\.md/i)
assert.match(skill, /humanizer[^\n]*then[^\n]*ste-writing[^\n]*strict/i)
assert.match(format, /only when the user does not provide a format and the repository has no active PR template/i)
assert.match(format, /^## Summary$/m)
assert.match(format, /^## Changes$/m)
assert.match(format, /Closes <ticket>/)
assert.match(format, /omit that line when no ticket is known/i)
assert.match(format, /omit[^\n]*validation[^\n]*unless[^\n]*request/i)
assert.match(implementationFlow, /\$workflow:writing-pr-descriptions/)
assert.doesNotMatch(implementationFlow, /Open a draft pull request with this body:/)

console.log('Writing PR Descriptions contract is valid.')
