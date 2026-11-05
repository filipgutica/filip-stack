import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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

  execFileSync(process.execPath, [script, runsDir])
  const report = readFileSync(join(runsDir, record.id, 'report.md'), 'utf8')
  assert.match(report, /### Round 1: Round 1\n\n- Decision: \*\*rejected\*\* \(overall votes: 0 candidate/)

  const pageDir = join(root, 'page')
  execFileSync(process.execPath, [script, runsDir, '--page', pageDir])
  const pageRun = JSON.parse(readFileSync(join(pageDir, 'runs', record.id, 'run.json'), 'utf8'))
  assert.deepEqual(pageRun.rounds[0].votes, [])
})
