#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { fieldGuidePluginRoot, fieldGuideSkillRoot, repositoryRoot } from './plugin-paths.mjs'

const exists = async (url) => stat(url).then(() => true, () => false)
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'))

assert.ok(await exists(fieldGuidePluginRoot), 'Field Guide must be a standalone plugin')
assert.ok(await exists(new URL('SKILL.md', fieldGuideSkillRoot)), 'Field Guide plugin must include its skill')
assert.ok(await exists(new URL('scripts/field-guide.mjs', fieldGuideSkillRoot)), 'Field Guide utility must move with the skill')
assert.ok(await exists(new URL('hooks/hooks.json', fieldGuidePluginRoot)), 'Field Guide must own its lifecycle hook')
assert.ok(await exists(new URL('scripts/run-node.sh', fieldGuidePluginRoot)), 'Field Guide must own its Node launcher')

const [codexManifest, claudeManifest, codexMarketplace, claudeMarketplace, skill, hook] = await Promise.all([
  readJson(new URL('.codex-plugin/plugin.json', fieldGuidePluginRoot)),
  readJson(new URL('.claude-plugin/plugin.json', fieldGuidePluginRoot)),
  readJson(new URL('.agents/plugins/marketplace.json', repositoryRoot)),
  readJson(new URL('.claude-plugin/marketplace.json', repositoryRoot)),
  readFile(new URL('SKILL.md', fieldGuideSkillRoot), 'utf8'),
  readFile(new URL('hooks/hooks.json', fieldGuidePluginRoot), 'utf8'),
])

for (const manifest of [codexManifest, claudeManifest]) {
  assert.equal(manifest.name, 'field-guide')
  assert.equal(manifest.skills, './skills')
}
assert.ok(!('hooks' in codexManifest), 'Codex discovers the default hook without an unsupported manifest field')

const expectedEntry = {
  name: 'field-guide',
  source: { source: 'local', path: './plugins/field-guide' },
  policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
  category: 'Productivity',
}
assert.deepEqual(codexMarketplace.plugins.find(({ name }) => name === 'field-guide'), expectedEntry)
assert.deepEqual(
  claudeMarketplace.plugins.find(({ name }) => name === 'field-guide'),
  { name: 'field-guide', source: './plugins/field-guide' },
)

assert.match(skill, /\$field-guide:field-guide/u)
assert.doesNotMatch(skill, /\$workflow:field-guide/u)
assert.match(hook, /\$\{PLUGIN_ROOT:-\$\{CLAUDE_PLUGIN_ROOT\}\}/u)
assert.match(hook, /scripts\/run-node\.sh/u)
assert.match(hook, /hooks\/field-guide-lifecycle\.mjs/u)

assert.ok(!await exists(new URL('skills/field-guide/', new URL('../workflow/', fieldGuidePluginRoot))))
assert.ok(!await exists(new URL('hooks/', new URL('../workflow/', fieldGuidePluginRoot))))

console.log('Standalone Field Guide plugin boundary passed.')
