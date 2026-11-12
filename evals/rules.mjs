// Builds a rules eval: each prompt gives the model a fixed set of guidance files,
// read at EVAL_BASE_REF (`base`) or from the working tree (`head`), and asks it to
// pick one of a scenario's options.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scenarioTests, scoreChoice } from './host-guidance.mjs'
import { parseReply } from './reply.mjs'

const repoRoot = new URL('../', import.meta.url).pathname

export const rulesEval = ({ ruleFiles, scenarioFile, role }) => {
  // Reads lazily and once per version, so loading a rules module runs no git command.
  const rendered = new Map()
  const renderRules = (version) => {
    if (!rendered.has(version)) {
      const ref = process.env.EVAL_BASE_REF ?? 'origin/main'
      const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      // A bad ref throws here; a rule file the base does not have yet is left out of the base.
      if (version === 'base') git('rev-parse', '--verify', `${ref}^{commit}`)
      const atBase = new Set(version === 'base' ? git('ls-tree', '-r', '--name-only', ref, '--', ...ruleFiles).split('\n') : ruleFiles)
      const read = (file) => (version === 'head' ? readFileSync(join(repoRoot, file), 'utf8') : git('show', `${ref}:${file}`))
      rendered.set(version, ruleFiles.filter((file) => atBase.has(file)).map((file) => `# ${file}\n\n${read(file)}`).join('\n\n'))
    }
    return rendered.get(version)
  }

  const messages = ({ version, vars }) => [
    { role: 'system', content: `${vars.role}\n\n${renderRules(version)}` },
    { role: 'user', content: vars.question },
  ]

  // Each scenario lists its own options as { key: description }.
  const optionKeys = Object.fromEntries(JSON.parse(readFileSync(join(repoRoot, scenarioFile), 'utf8')).scenarios
    .map(({ id, options }) => [id, Object.keys(options)]))

  return {
    // Reads both versions, so a bad base ref fails before any model call.
    prepare: () => Boolean(renderRules('base') && renderRules('head')),
    base: ({ vars }) => messages({ version: 'base', vars }),
    head: ({ vars }) => messages({ version: 'head', vars }),
    tests: () => scenarioTests({
      file: scenarioFile,
      role,
      question: ({ task, options }) => [
        task,
        `Choose your next action. Do not do it. Reply with only JSON: {"action": "<one of: ${Object.entries(options).map(([key, description]) => `${key} (${description})`).join(', ')}>"}.`,
      ].join('\n\n'),
    }),
    // Models sometimes echo the option's description, so match on the key prefix.
    score: (output, context) => {
      const reply = parseReply(output)
      const action = String(reply.action ?? '')
      const choice = reply.invalid !== undefined
        ? `invalid reply "${reply.invalid}"`
        : optionKeys[context.test.metadata.scenario].find((key) => action.startsWith(key)) ?? `unknown action ${JSON.stringify(reply.action)}`
      return scoreChoice({ choice, context })
    },
  }
}
