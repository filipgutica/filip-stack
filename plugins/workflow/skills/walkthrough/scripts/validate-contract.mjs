#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8')
const patterns = await readFile(new URL('../references/presentation-patterns.md', import.meta.url), 'utf8')
const metadata = await readFile(new URL('../agents/openai.yaml', import.meta.url), 'utf8')
const readme = await readFile(new URL('../../../../../README.md', import.meta.url), 'utf8')
const packageJson = JSON.parse(await readFile(new URL('../../../../../package.json', import.meta.url), 'utf8'))

assert.match(skill, /^name: walkthrough$/m)
assert.match(skill, /^disable-model-invocation: true$/m)
assert.match(skill, /last completed agent turn/i)
assert.match(skill, /working tree/i)
assert.match(skill, /branch.+merge base/i)
assert.match(skill, /read-only/i)
assert.match(skill, /Do not edit files, commit, push, publish, or change external state/i)
assert.match(skill, /one coherent slice at a time/i)
assert.match(skill, /one focused question/i)
assert.match(skill, /Pause for the user's response before the next slice/i)
assert.match(skill, /account for every changed file/i)
assert.match(skill, /verify.+live code.+before classifying/i)
assert.match(skill, /implementation authority/i)
assert.match(skill, /\$workflow:coordinator/)
assert.match(skill, /concern, question, or proposal does not grant implementation authority/i)
assert.match(skill, /pause the walkthrough/i)
assert.match(skill, /record the current slice and coverage state/i)
assert.match(skill, /complete the authorized implementation, verification, and review cycle/i)
assert.match(skill, /refresh the selected diff and coverage map/i)
assert.match(skill, /revisit each changed or superseded slice/i)
assert.match(skill, /resume the walkthrough/i)
assert.match(skill, /Humanizer/i)
assert.match(skill, /\$workflow:ste-writing/)
assert.match(skill, /presentation-patterns\.md/)
assert.match(skill, /covered areas and files/i)
assert.match(skill, /unresolved questions or risks/i)
assert.match(skill, /verification evidence and limits/i)

assert.match(patterns, /code snippet/i)
assert.match(patterns, /inline diff/i)
assert.match(patterns, /table/i)
assert.match(patterns, /Mermaid diagram/i)
assert.match(patterns, /Change:/)
assert.match(patterns, /Behavior:/)
assert.match(patterns, /Decision:/)
assert.match(patterns, /Evidence:/)
assert.match(patterns, /Risk:/)
assert.match(patterns, /Question:/)
assert.match(patterns, /explicitly authorizes a correction/i)
assert.match(patterns, /authorized correction cycle/i)

assert.match(metadata, /display_name: "Walkthrough"/)
assert.match(metadata, /allow_implicit_invocation: false/)
assert.match(readme, /`walkthrough`/)
assert.match(readme, /manual-only.+`walkthrough`|`walkthrough`.+manual-only/i)
assert.equal(
  packageJson.scripts['test:walkthrough'],
  'node plugins/workflow/skills/walkthrough/scripts/validate-contract.mjs',
)
assert.match(packageJson.scripts.check, /test:walkthrough/)

console.log('Walkthrough skill contract passed.')
