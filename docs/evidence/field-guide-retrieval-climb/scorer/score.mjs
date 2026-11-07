#!/usr/bin/env node
// Field Guide retrieval scorer. Usage, from the repository root:
//   node docs/evidence/field-guide-retrieval-climb/scorer/score.mjs <prompt-set.json> [--field-guide <field-guide.mjs>] [--verbose]
// Builds a synthetic guide from records.json through the real `init` and `submit` commands, runs
// first-prompt injection (`promptInjection`) for each labeled prompt in the shop-api repository, and
// scores the injected records against the labels. The last output line is 100 × micro-F1.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'field-guide': { type: 'string', default: 'plugins/field-guide/skills/field-guide/scripts/field-guide.mjs' },
    verbose: { type: 'boolean', default: false },
  },
})
if (positionals.length !== 1) throw new Error('Usage: score.mjs <prompt-set.json> [--field-guide <path>] [--verbose]')

const fieldGuide = resolve(options['field-guide'])
const { records } = JSON.parse(readFileSync(new URL('records.json', import.meta.url), 'utf8'))
const { prompts } = JSON.parse(readFileSync(positionals[0], 'utf8'))

const root = mkdtempSync(join(tmpdir(), 'field-guide-retrieval-'))
const guideRoot = join(root, 'guide')
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' })
const createRepo = ({ name, remote }) => {
  const repoRoot = join(root, name)
  execFileSync('git', ['init', '--quiet', repoRoot])
  git(repoRoot, 'config', 'user.name', 'Retrieval Scorer')
  git(repoRoot, 'config', 'user.email', 'scorer@example.test')
  writeFileSync(join(repoRoot, 'README.md'), `# ${name}\n`)
  git(repoRoot, 'add', 'README.md')
  git(repoRoot, 'commit', '--quiet', '-m', 'chore: initialize repository')
  git(repoRoot, 'remote', 'add', 'origin', remote)
  return repoRoot
}
// Project records for shop-api apply to the scored prompts; admin-ui records must never be injected there.
const repos = {
  'shop-api': createRepo({ name: 'shop-api', remote: 'https://github.com/example/shop-api.git' }),
  'admin-ui': createRepo({ name: 'admin-ui', remote: 'https://github.com/example/admin-ui.git' }),
}
const cli = (repoRoot, ...args) => execFileSync(process.execPath, [fieldGuide, ...args, '--repo-root', repoRoot, '--guide-root', guideRoot], { stdio: 'pipe' })

for (const repoRoot of Object.values(repos)) cli(repoRoot, 'init')
for (const record of records) {
  const repoRoot = record.scope === 'other-project' ? repos['admin-ui'] : repos['shop-api']
  cli(repoRoot, 'submit', '--input-json', JSON.stringify({
    schemaVersion: 1,
    decision: 'capture',
    confidence: 'high',
    scope: record.scope === 'shared' ? 'shared' : 'project',
    subjectKey: record.subjectKey,
    learning: record.learning,
    explicitPreference: true,
    evidence: { summary: 'Synthetic retrieval fixture record.', pointers: [{ kind: 'manual', sourceLabel: 'Fixture' }] },
  }))
}

const memory = JSON.parse(readFileSync(join(guideRoot, 'memory.json'), 'utf8'))
const keyById = new Map()
for (const record of records) {
  const stored = memory.guidance.find(({ learning }) => learning === record.learning)
  if (stored?.status !== 'active') throw new Error(`${record.key} is not an active record in the built guide`)
  keyById.set(stored.id, record.key)
}

const { promptInjection } = await import(pathToFileURL(fieldGuide).href)
let truePositives = 0
let falsePositives = 0
let falseNegatives = 0
let noneFalseInjections = 0
const rows = []
for (const { id, category, prompt, relevant, acceptable = [] } of prompts) {
  const injection = promptInjection({ repoRoot: repos['shop-api'], guideRoot, prompt, excludeIds: [] })
  const injected = (injection?.guidanceIds ?? []).map((guidanceId) => keyById.get(guidanceId))
  // Acceptable records are neutral: showing one is neither a hit nor a false injection.
  const hits = injected.filter((key) => relevant.includes(key))
  const misleading = injected.filter((key) => !relevant.includes(key) && !acceptable.includes(key))
  const missed = relevant.filter((key) => !injected.includes(key))
  truePositives += hits.length
  falsePositives += misleading.length
  falseNegatives += missed.length
  if (relevant.length === 0) noneFalseInjections += misleading.length
  rows.push(`${id}\t${category}\thit ${hits.join(',') || '-'}\tfalse ${misleading.join(',') || '-'}\tmissed ${missed.join(',') || '-'}`)
}

const ratio = (numerator, denominator) => (denominator === 0 ? 1 : numerator / denominator)
const precision = ratio(truePositives, truePositives + falsePositives)
const recall = ratio(truePositives, truePositives + falseNegatives)
const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
if (options.verbose) console.log(rows.join('\n'))
console.log(`prompts ${prompts.length}  hits ${truePositives}  false ${falsePositives}  missed ${falseNegatives}`)
console.log(`precision ${(100 * precision).toFixed(2)}  recall ${(100 * recall).toFixed(2)}  false injections on no-relevant prompts ${noneFalseInjections}`)
console.log((100 * f1).toFixed(2))
