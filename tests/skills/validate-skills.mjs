#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDevelopmentOnlyPluginPath } from '../../scripts/plugin-payload-policy.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const standaloneRoot = join(repoRoot, 'skills')

const exists = async (path) => stat(path).then(() => true, () => false)
const words = (content) => content.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)?.length ?? 0
const skillDirs = async (root) => (await readdir(root, { withFileTypes: true }).catch(() => []))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => join(root, entry.name))
const frontmatterOf = (skill) => skill.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? ''
const isInternal = (frontmatter) => /^metadata:\n(?:[ \t]+.*\n)*?[ \t]+internal:\s*true\s*$/mu.test(`${frontmatter}\n`)

// Supports the single-line and folded (`>-`, `|`) descriptions used in this repository.
const descriptionOf = (frontmatter) => {
  const match = `${frontmatter}\n`.match(/^description:[ \t]*(.*)\n((?:[ \t]+.*\n|[ \t]*\n)*)/mu)
  if (!match) return ''
  return /^[>|][1-9+-]{0,2}\s*(?:#.*)?$/u.test(match[1]) ? match[2] : match[1]
}

// Plugin and repository-development skills must not install on their own through the skills CLI.
const hiddenSkillDirs = [
  ...await skillDirs(join(repoRoot, '.agents/skills')),
  ...(await Promise.all((await skillDirs(join(repoRoot, 'plugins'))).map((plugin) => skillDirs(join(plugin, 'skills'))))).flat(),
]
const hiddenNames = new Set()
for (const dir of hiddenSkillDirs) {
  const frontmatter = frontmatterOf(await readFile(join(dir, 'SKILL.md'), 'utf8'))
  assert.ok(isInternal(frontmatter), `${relative(repoRoot, dir)} must set metadata.internal: true`)
  hiddenNames.add(frontmatter.match(/^name:\s*(\S+)$/mu)?.[1])
}

const standaloneDirs = await skillDirs(standaloneRoot)
for (const dir of standaloneDirs) {
  const name = relative(standaloneRoot, dir)
  const skill = await readFile(join(dir, 'SKILL.md'), 'utf8')
  const frontmatter = frontmatterOf(skill)

  assert.match(frontmatter, new RegExp(`^name: ${name}$`, 'mu'), `${name} frontmatter name must match its directory`)
  assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, `${name} is not a valid skill name`)
  assert.ok(!hiddenNames.has(name), `${name} shadows a plugin or repository skill of the same name`)
  const description = descriptionOf(frontmatter)
  // A plain YAML scalar ends at `: ` or ` #`, so hosts and the skills CLI cannot parse such a description.
  const plain = frontmatter.match(/^description:[ \t]*([^'"|>\s].*)$/mu)?.[1]
  if (plain) assert.doesNotMatch(plain, /: | #/u, `${name} description needs quotes or a block scalar for ': ' or ' #'`)
  assert.ok(words(description) > 0, `${name} is missing a description`)
  assert.ok(words(description) <= 80, `${name} description exceeds 80 words`)
  // Agent Skills guidance; Workflow's tighter word budgets apply only inside its plugin.
  assert.ok(skill.split('\n').length <= 500, `${name}/SKILL.md exceeds 500 lines`)
  assert.ok(!isInternal(frontmatter), `${name} is a standalone skill and must not be internal`)

  const referenceEntries = await readdir(join(dir, 'references'), { withFileTypes: true }).catch(() => [])
  for (const entry of referenceEntries) {
    assert.ok(entry.isFile(), `${name}/references must stay one level deep`)
    const reference = await readFile(join(dir, 'references', entry.name), 'utf8')
    assert.ok(words(reference) <= 1200, `${name}/references/${entry.name} exceeds 1,200 words`)
  }

  const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
  for (const file of files) {
    const path = relative(dir, file)
    assert.ok(!isDevelopmentOnlyPluginPath(path), `${name}/${path} is a development-only asset`)
    const content = await readFile(file, 'utf8')
    assert.doesNotMatch(content, /\$(?:workflow|field-guide):/u, `${name}/${path} depends on a plugin skill`)
    if (!path.endsWith('.md')) continue
    // The skills CLI copies only the skill directory, so every relative link must stay inside it.
    const targets = [
      ...content.matchAll(/\]\(\s*(?:<([^>\n]*)>|([^)\s]+))(?:\s+[^)]*)?\)/gu),
      ...content.matchAll(/^ {0,3}\[[^\]]+\]:\s*(?:<([^>\n]*)>|(\S+))/gmu),
    ].map((match) => (match[1] ?? match[2]).replace(/#.*$/u, ''))
    for (const target of targets) {
      if (target === '' || /^[a-z][a-z0-9+.-]*:/iu.test(target)) continue
      const linked = resolve(dirname(file), target)
      assert.ok(!relative(dir, linked).startsWith('..'), `${name}/${path} links outside the skill: ${target}`)
      assert.ok(await exists(linked), `${name}/${path} links to missing ${target}`)
    }
  }

  const notices = join(dir, 'THIRD_PARTY_NOTICES.md')
  if (await exists(notices)) {
    const content = await readFile(notices, 'utf8')
    assert.match(content, /^Source: \S+/mu, `${name} notices must record the upstream source`)
    assert.match(content, /^Baseline: `[0-9a-f]{7,40}`/mu, `${name} notices must record the baseline commit`)
  }

  const metadataPath = join(dir, 'agents/openai.yaml')
  if (await exists(metadataPath)) {
    const metadata = await readFile(metadataPath, 'utf8')
    const manual = /^disable-model-invocation: true$/mu.test(frontmatter)
    const implicit = metadata.match(/allow_implicit_invocation:\s*(true|false)/u)?.[1]
    if (manual) assert.equal(implicit, 'false', `${name} is manual-only, so Codex must not invoke it implicitly`)
    else assert.notEqual(implicit, 'false', `${name} disables implicit invocation only for Codex`)
    for (const [, target] of metadata.matchAll(/\$([a-z0-9:-]+)/gu)) {
      assert.equal(target, name, `${name}/agents/openai.yaml must invoke the skill as $${name}`)
    }
  }
}

console.log(`Standalone skill contracts passed (${standaloneDirs.length} skills, ${hiddenSkillDirs.length} hidden).`)
