#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDevelopmentOnlyPluginPath } from '../../scripts/plugin-payload-policy.mjs'
import { descriptionOf, frontmatterOf, isManual, parseSkill } from '../../scripts/skill-frontmatter.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const standaloneRoot = join(repoRoot, 'skills')

const exists = async (path) => stat(path).then(() => true, () => false)
const words = (content) => content.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)?.length ?? 0
const skillDirs = async (root) => (await readdir(root, { withFileTypes: true }).catch(() => []))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => join(root, entry.name))
const isInternal = (frontmatter) => /^metadata:\n(?:[ \t]+.*\n)*?[ \t]+internal:\s*true\s*$/mu.test(`${frontmatter}\n`)

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
    const manual = isManual(frontmatter)
    const implicit = metadata.match(/allow_implicit_invocation:\s*(true|false)/u)?.[1]
    if (manual) assert.equal(implicit, 'false', `${name} is manual-only, so Codex must not invoke it implicitly`)
    else assert.notEqual(implicit, 'false', `${name} disables implicit invocation only for Codex`)
    for (const [, target] of metadata.matchAll(/\$([a-z0-9:-]+)/gu)) {
      assert.equal(target, name, `${name}/agents/openai.yaml must invoke the skill as $${name}`)
    }
  }
}

// Lock the authority boundaries of standalone skills whose rules hosts or users depend on.
const requiredContracts = {
  'grill-me': {
    'SKILL.md': [
      /Ask exactly one consequential question/u,
      /read-only except for an authorized grill log/u,
    ],
  },
  'simplify-pass': {
    'SKILL.md': [
      /Run only when the user invokes this skill/u,
      /three independent, read-only assessments/u,
      /report the incomplete review and stop before editing/u,
      /Keep one writer in the main thread/u,
    ],
  },
  walkthrough: {
    'SKILL.md': [
      /Present one coherent slice at a time/u,
      /read-only except for an authorized walkthrough log/u,
      /every changed file is covered/u,
      /Do not treat silence/u,
    ],
    'references/presentation-patterns.md': [
      /Lesson:.*\nExample:.*\nTry it:.*\nObserve:/u,
      /Agent execution requires existing authorization/u,
      /Keep expected results separate from observed results/u,
    ],
    'references/walkthrough-log.md': [
      /Keep exercise outcomes separate from acceptance/u,
    ],
  },
}
for (const [name, files] of Object.entries(requiredContracts)) {
  for (const [path, patterns] of Object.entries(files)) {
    const content = await readFile(join(standaloneRoot, name, path), 'utf8')
    for (const pattern of patterns) assert.match(content, pattern, `${name}/${path} is missing required guidance`)
  }
}

// Every skill a model can route to outside Workflow has a guidance test file: routing
// scenarios that should and should not load it, and optional rule scenarios.
const scenariosRoot = join(repoRoot, 'tests/skills/scenarios')
const readSkillFile = async (dir) => parseSkill(await readFile(join(dir, 'SKILL.md'), 'utf8'))
const workflowSkills = await Promise.all((await skillDirs(join(repoRoot, 'plugins/workflow/skills'))).map(readSkillFile))
const ownSkills = await Promise.all([...standaloneDirs, join(repoRoot, 'plugins/field-guide/skills/field-guide')].map(readSkillFile))
const routable = new Set([...workflowSkills, ...ownSkills].filter((skill) => !skill.manual).map((skill) => skill.name))
const scenarioFiles = (await readdir(scenariosRoot)).filter((file) => file.endsWith('.json'))
for (const skill of ownSkills.filter((entry) => !entry.manual)) {
  assert.ok(scenarioFiles.includes(`${skill.name}.json`), `${skill.name} needs routing scenarios in tests/skills/scenarios/${skill.name}.json`)
}
const workflowScenarios = JSON.parse(await readFile(join(repoRoot, 'tests/workflow/contract-scenarios.json'), 'utf8')).scenarios
const ids = new Set(workflowScenarios.map(({ id }) => id))
// The same prompt in two scenarios could accept different answers, so each prompt appears once.
const prompts = new Set()
const addPrompt = (prompt, where) => {
  assert.ok(!prompts.has(prompt), `${where} repeats the prompt of another routing scenario`)
  prompts.add(prompt)
}
for (const { id, prompt } of workflowScenarios) addPrompt(prompt, `tests/workflow/contract-scenarios.json ${id}`)
for (const file of scenarioFiles) {
  const owner = file.replace(/\.json$/u, '')
  const skill = ownSkills.find(({ name }) => name === owner)
  assert.ok(skill, `tests/skills/scenarios/${file} names no standalone or Field Guide skill`)
  const { routing = [], rules = [] } = JSON.parse(await readFile(join(scenariosRoot, file), 'utf8'))
  for (const { id, prompt, expectedSkill, alsoAccept = [], activation, expectedReference } of routing) {
    assert.ok(id && prompt, `${file} has a routing scenario without an id or prompt`)
    addPrompt(prompt, `${file} ${id}`)
    // An explicit scenario names its skill in the prompt, so it may expect a manual-only skill.
    if (activation === 'explicit') {
      assert.equal(expectedSkill, owner, `${file} ${id} is explicit, so it must expect ${owner}`)
      assert.ok(prompt.includes(`$${owner}`), `${file} ${id} is explicit, so its prompt must name $${owner}`)
    } else {
      for (const name of [expectedSkill, ...alsoAccept].filter((name) => name !== null)) {
        assert.ok(routable.has(name), `${file} ${id} names ${name}, which no model can route to`)
      }
    }
    if (expectedReference) {
      const body = [...workflowSkills, ...ownSkills].find(({ name }) => name === expectedSkill)?.body ?? ''
      assert.ok(body.includes(`(references/${expectedReference})`), `${file} ${id} expects ${expectedReference}, which ${expectedSkill} does not link`)
    }
  }
  if (!skill.manual) {
    assert.ok(routing.some(({ expectedSkill }) => expectedSkill === owner), `${file} needs a scenario that loads ${owner}`)
    assert.ok(routing.some(({ expectedSkill }) => expectedSkill !== owner), `${file} needs a near-miss that does not load ${owner}`)
  }
  for (const { id, task, options, accept } of rules) {
    assert.ok(id && task && options, `${file} has a rule scenario without an id, task, or options`)
    assert.ok(accept.every((key) => key in options), `${file} ${id} accepts an option it does not list`)
  }
  for (const { id } of [...routing, ...rules]) {
    assert.ok(!ids.has(id), `scenario id ${id} in ${file} is not unique`)
    ids.add(id)
  }
}

console.log(`Standalone skill contracts passed (${standaloneDirs.length} skills, ${hiddenSkillDirs.length} hidden, ${scenarioFiles.length} scenario files).`)
