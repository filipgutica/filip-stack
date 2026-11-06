import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const script = new URL('../../skills/hill-climb/scripts/build-runs.mjs', import.meta.url).pathname

const vote = { member: 'Astra', overall: 'candidate', criteria: { C1: 'candidate' }, reason: 'Clearer.' }
const round = (n, decision, votes) => ({
  n, summary: `Round ${n}`, decision, climbChangedLines: 4, gates: decision === 'rejected' ? 'fail' : 'pass',
  applied: [], proposals: [], ...(votes && { votes }),
})
const record = {
  schemaVersion: 1, id: 'run-a', date: '2026-11-05', title: 'PR #1: example', kind: 'code',
  target: { repo: 'owner/name', pr: 1, prUrl: 'https://github.com/owner/name/pull/1', branch: 'b', base: 'aaa', head: 'bbb' },
  goal: 'Goal.', criteria: [{ id: 'C1', name: 'Clarity', description: 'Clear.' }],
  lineup: [{ member: 'Astra', model: 'm', effort: 'high', provider: 'P' }],
  budget: { rounds: 2, sizeLimit: 20, originalChangedLines: 10 }, gates: ['pnpm check'], notCovered: [],
  // A gate-failed round written without a votes field, as older records were.
  rounds: [round(1, 'rejected'), round(2, 'accepted', [vote])],
  stop: 'Budget spent.', result: { summary: 'Clearer copy.', climbChangedLines: 4, committed: true },
  followUps: [], notes: [], memberCalls: 3,
}

test('builds the runs-dir argument, including gate-failed rounds without votes', () => {
  const root = mkdtempSync(join(tmpdir(), 'hill-climb-runs-'))
  const runsDir = join(root, 'runs')
  mkdirSync(join(runsDir, record.id), { recursive: true })
  writeFileSync(join(runsDir, record.id, 'run.json'), JSON.stringify(record))

  // A temporary HOME keeps a regression of the runs-dir argument away from real saved runs.
  const env = { ...process.env, HOME: join(root, 'home') }
  execFileSync(process.execPath, [script, runsDir], { env })
  // A record from before decision rules keeps its report unchanged.
  assert.doesNotMatch(readFileSync(join(runsDir, record.id, 'report.md'), 'utf8'), /Decision rule/)
  const [built] = JSON.parse(readFileSync(join(runsDir, 'index.json'), 'utf8')).runs
  assert.equal(built.rejected, 1)
  // The runs page reads the rule from the index; records from before decision rules use judges.
  assert.equal(built.decisionRule, 'judges')

  const pageDir = join(root, 'page')
  execFileSync(process.execPath, [script, runsDir, '--page', pageDir], { env })
  const pageRun = JSON.parse(readFileSync(join(pageDir, 'runs', record.id, 'run.json'), 'utf8'))
  assert.deepEqual(pageRun.rounds[0].votes, [])
})

test('reports a score-decided climb by its scores, not as missing votes or a missing final check', () => {
  const root = mkdtempSync(join(tmpdir(), 'hill-climb-runs-'))
  const runsDir = join(root, 'runs')
  const scored = {
    ...record, id: 'run-score', decisionRule: 'score',
    // A tie, which loses even with a minimum gain of 0.
    score: { command: 'pnpm a11y:count', direction: 'lower', minGain: 0, start: 7, final: 7 },
    rounds: [{ ...round(1, 'accepted', []), score: 5 }],
  }
  mkdirSync(join(runsDir, scored.id), { recursive: true })
  writeFileSync(join(runsDir, scored.id, 'run.json'), JSON.stringify(scored))

  execFileSync(process.execPath, [script, runsDir], { env: { ...process.env, HOME: join(root, 'home') } })
  const report = readFileSync(join(runsDir, scored.id, 'report.md'), 'utf8')
  assert.match(report, /Decision rule: score/)
  assert.match(report, /Score: 5/)
  const [built] = JSON.parse(readFileSync(join(runsDir, 'index.json'), 'utf8')).runs
  assert.deepEqual(built.attention, ['The final score did not beat the start score.'])
  assert.deepEqual(built.score, { direction: 'lower', start: 7, final: 7, gained: false })
})

test('flags a both-rule climb that measured the final score but skipped the final judges', () => {
  const root = mkdtempSync(join(tmpdir(), 'hill-climb-runs-'))
  const runsDir = join(root, 'runs')
  const both = {
    ...record, id: 'run-both', decisionRule: 'both',
    score: { command: 'pnpm a11y:count', direction: 'higher', minGain: 1, start: 80, final: 90 },
    rounds: [{ ...round(1, 'accepted', [vote]), score: 90 }],
  }
  mkdirSync(join(runsDir, both.id), { recursive: true })
  writeFileSync(join(runsDir, both.id, 'run.json'), JSON.stringify(both))

  execFileSync(process.execPath, [script, runsDir], { env: { ...process.env, HOME: join(root, 'home') } })
  const [built] = JSON.parse(readFileSync(join(runsDir, 'index.json'), 'utf8')).runs
  assert.deepEqual(built.attention, ['The climb kept changes but never ran the final check.'])
})
