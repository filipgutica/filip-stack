// Prompt functions, test generator, and assertion for the routing guidance test.
// The `baseSkills` and `headSkills` prompts read every skill a model can route to
// (Workflow, standalone, and Field Guide) at EVAL_BASE_REF and in the working tree.
// A scenario becomes up to two tests: a skill step, where the model picks a skill
// from the catalog, and a reference step, where it lists the reference files the
// expected skill's body points it to.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSkill } from '../scripts/skill-frontmatter.mjs'
import { parseReply } from './reply.mjs'
import { evalOptions, readSkillScenarios } from './skill-scenarios.mjs'

const repoRoot = new URL('../', import.meta.url).pathname
const skillRoots = ['plugins/workflow/skills', 'skills', 'plugins/field-guide/skills']
const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// A root that does not exist at the base ref has no skills there.
const listAtRef = (ref, root) => {
  try {
    return git(['ls-tree', '--name-only', `${ref}:${root}`]).split('\n').filter(Boolean)
  } catch {
    return []
  }
}
const readSkills = {
  base: () => {
    const ref = process.env.EVAL_BASE_REF ?? 'origin/main'
    return skillRoots.flatMap((root) => listAtRef(ref, root)
      .map((name) => parseSkill(git(['show', `${ref}:${root}/${name}/SKILL.md`]))))
  },
  head: () => skillRoots.flatMap((root) => readdirSync(join(repoRoot, root), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => parseSkill(readFileSync(join(repoRoot, root, entry.name, 'SKILL.md'), 'utf8')))),
}

// Reads lazily and once per process, so loading this module runs no git command.
const loaded = new Map()
const skillsAt = (version) => {
  if (!loaded.has(version)) loaded.set(version, readSkills[version]())
  return loaded.get(version)
}
const catalogAt = (version) => skillsAt(version).filter((skill) => !skill.manual).map((skill) => `- ${skill.name}: ${skill.description}`).join('\n')

// What differs between the base ref and the working tree: the catalog a model routes
// from, and the bodies that hold each skill's reference pointers.
export const routingChanges = () => {
  const baseBodies = new Map(skillsAt('base').map((skill) => [skill.name, skill.body]))
  return {
    catalog: catalogAt('base') !== catalogAt('head'),
    bodies: skillsAt('head').filter((skill) => baseBodies.get(skill.name) !== skill.body).map((skill) => skill.name).sort(),
  }
}

const messages = ({ version, vars }) => {
  const skills = skillsAt(version)
  if (vars.step === 'skill') {
    const catalog = catalogAt(version)
    return [
      { role: 'system', content: `You are the skill router of a coding agent. Available skills:\n${catalog}\n\nA skill applies when its description matches the user's request. Reply with only JSON: {"skill": "<name>"} for the one skill to load, or {"skill": null} when no skill applies.` },
      { role: 'user', content: vars.prompt },
    ]
  }
  // A skill missing at this version has no body, so the model has no references to name.
  const body = skills.find(({ name }) => name === vars.skill)?.body ?? ''
  return [
    { role: 'system', content: `You follow the skill instructions below. Its linked reference files are not loaded yet.\n\n${body}\n\nList the linked reference files you would read before acting on the user's request. Reply with only JSON: {"references": ["<file name>"]}, or {"references": []} when none are needed.` },
    { role: 'user', content: vars.prompt },
  ]
}
export const baseSkills = ({ vars }) => messages({ version: 'base', vars })
export const headSkills = ({ vars }) => messages({ version: 'head', vars })

// Every routing scenario, each with the skill whose test file holds it. A Workflow
// scenario belongs to the skill it expects.
const allScenarios = () => [
  ...JSON.parse(readFileSync(join(repoRoot, 'tests/workflow/contract-scenarios.json'), 'utf8')).scenarios
    .map((scenario) => ({ ...scenario, owner: scenario.expectedSkill })),
  ...readSkillScenarios().flatMap(({ skill, routing }) => routing.map((scenario) => ({ activation: 'implicit', ...scenario, owner: skill }))),
]
export const routingSkills = () => new Set(allScenarios().flatMap(({ owner, expectedSkill, alsoAccept = [] }) => [owner, expectedSkill, ...alsoAccept]).filter(Boolean))

const testsFor = ({ id, prompt, activation, expectedSkill, alsoAccept = [], expectedReference, owner }) => {
  const metadata = { scenario: id, owner, expects: [[expectedSkill ?? 'no skill', ...alsoAccept].join(' or '), expectedReference].filter(Boolean).join(' / ') }
  return [
    // Explicit scenarios load their skill by name, so they test only the reference step.
    ...activation === 'explicit' ? [] : [{ description: `${id} skill`, vars: { step: 'skill', prompt }, metadata: { ...metadata, expectedSkill, alsoAccept } }],
    ...expectedReference ? [{ description: `${id} reference`, vars: { step: 'reference', prompt, skill: expectedSkill }, metadata: { ...metadata, expectedSkill, expectedReference } }] : [],
  ]
}

// In a comparison, a skill step runs only when the catalog changed, and a reference
// step only when its skill's body changed. A step the base cannot offer, a skill
// missing from its catalog or a body missing from its files, must pass in the
// working tree. Without a base, every selected test runs.
const compare = (tests) => {
  const { catalog, bodies } = routingChanges()
  const base = skillsAt('base')
  const atBase = {
    skill: new Set(base.filter((skill) => !skill.manual).map((skill) => skill.name)),
    reference: new Set(base.map((skill) => skill.name)),
  }
  return tests
    .filter(({ vars, metadata }) => (vars.step === 'skill' ? catalog : bodies.includes(metadata.expectedSkill)))
    .map((test) => ({ ...test, metadata: { ...test.metadata, needsNewGuidance: test.metadata.expectedSkill !== null && !atBase[test.vars.step].has(test.metadata.expectedSkill) } }))
}

export const routingTests = () => {
  const { noBase, skill } = evalOptions()
  const tests = allScenarios()
    .filter(({ owner, expectedSkill, alsoAccept = [] }) => !skill || [owner, expectedSkill, ...alsoAccept].includes(skill))
    .flatMap(testsFor)
  return noBase ? tests : compare(tests)
}

// The skill step passes on the expected skill or one it also accepts; a missing
// field fails, because only an explicit null means no skill applies. The reference
// step passes when the listed references include the expected file.
export const scoreRouting = (output, context) => {
  const reply = parseReply(output)
  const { expectedSkill, alsoAccept, expectedReference } = context.test.metadata
  if (reply.invalid !== undefined) return { pass: false, score: 0, reason: `invalid reply "${reply.invalid}"` }
  if (context.vars.step === 'skill') {
    const pass = reply.skill === expectedSkill || alsoAccept.includes(reply.skill)
    return { pass, score: pass ? 1 : 0, reason: `skill ${JSON.stringify(reply.skill)}` }
  }
  const references = Array.isArray(reply.references) ? reply.references.map((path) => String(path).split('/').at(-1)) : []
  const pass = references.includes(expectedReference)
  return { pass, score: pass ? 1 : 0, reason: `references ${references.join(', ') || 'none'}` }
}
