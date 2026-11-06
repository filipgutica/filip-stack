#!/usr/bin/env node
// Rebuilds hill-climb run reports from saved run records.
// Usage: node build-runs.mjs [runs-dir] [--page <dir>]
// For each <runs-dir>/<id>/run.json, writes <runs-dir>/<id>/report.md, then writes
// <runs-dir>/index.json. With --page, also writes index.json and each run.json, and copies
// assets/runs-page.html (as index.html), into <dir> for publishing.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const pageFlag = args.indexOf('--page')
const pageDir = pageFlag >= 0 ? args[pageFlag + 1] : null
if (pageFlag >= 0 && !pageDir) throw new Error('--page needs a directory')
const positional = pageFlag >= 0 ? args.filter((_, i) => i !== pageFlag && i !== pageFlag + 1) : args
const runsDir = positional[0] ?? join(homedir(), '.hill-climb', 'runs')
const skillDir = join(dirname(fileURLToPath(import.meta.url)), '..')

const label = { candidate: 'Candidate', incumbent: 'Incumbent', same: 'Same', final: 'Final', start: 'Start' }

// Counts overall votes. A round votes candidate/same/incumbent; the final check votes final/same/start.
const overall = (votes, keys = ['candidate', 'same', 'incumbent']) => {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]))
  for (const vote of votes) counts[vote.overall] += 1
  return counts
}
const finalCounts = (run) => (run.final ? overall(run.final.votes, ['final', 'same', 'start']) : null)

// Score-decided climbs: whether the final score beat the start by the smallest gain that counts.
const scoreCheck = (run) => {
  if (run.score?.final == null) return null
  const { direction, start, final, minGain } = run.score
  const gain = direction === 'lower' ? start - final : final - start
  return { direction, start, final, gained: gain >= minGain }
}

// What a reader should check before trusting the climb: the operator's notes, then any final check
// that did not favor the final version, or a climb that kept changes but never ran one.
const attention = (run) => {
  const items = [...(run.attention ?? [])]
  const fc = finalCounts(run)
  const sc = scoreCheck(run)
  const total = fc ? fc.final + fc.same + fc.start : 0
  if (fc && fc.start > total / 2) items.push('Most judges preferred the starting version; consider dropping the climb.')
  else if (fc && fc.final <= total / 2) items.push('The final check did not show a clear gain over the starting version.')
  if (sc && !sc.gained) items.push('The final score did not beat the start score.')
  if (!fc && !sc && run.rounds.some((r) => r.decision === 'accepted')) items.push('The climb kept changes but never ran the final check.')
  return items
}

const voteTable = (run, votes) => [
  `| Member | ${run.criteria.map((c) => `${c.id} ${c.name}`).join(' | ')} | Overall | Reason |`,
  `| --- | ${run.criteria.map(() => '---').join(' | ')} | --- | --- |`,
  ...votes.map((vote) => `| ${vote.member} | ${run.criteria.map((c) => label[vote.criteria[c.id]]).join(' | ')} | ${label[vote.overall]} | ${vote.reason} |`),
]

const report = (run) => {
  const lines = [
    `# Hill climb: ${run.title}`,
    '',
    `- Date: ${run.date}`,
    `- Target: ${run.target.repo}${run.target.pr ? ` PR #${run.target.pr}` : ''}, branch \`${run.target.branch}\`, head \`${run.target.head}\``,
    `- Goal: ${run.goal}`,
    `- Budget: ${run.budget.rounds} rounds; size limit ${run.budget.sizeLimit} lines (original change ${run.budget.originalChangedLines} lines)${run.budget.maxCalls ? `; at most ${run.budget.maxCalls} member calls` : ''}`,
    `- Decision rule: ${run.decisionRule ?? 'judges'}${run.score ? ` (\`${run.score.command}\`, ${run.score.direction} is better by at least ${run.score.minGain}; start ${run.score.start}, final ${run.score.final ?? 'not measured'})` : ''}`,
    ...(run.mayChange?.length ? [`- May change: ${run.mayChange.join('; ')}`] : []),
    `- Gates: ${run.gates.map((gate) => `\`${gate}\``).join(', ')}`,
    `- Lineup: ${run.lineup.map((m) => `${m.member} (${m.model}, ${m.effort}, ${m.provider})`).join('; ')}`,
    `- Stop: ${run.stop}`,
    `- Result: ${run.result.summary} ${run.result.climbChangedLines} changed lines; ${run.result.committed ? 'committed' : 'not committed'}.`,
    `- Member calls: ${run.memberCalls}`,
    '',
  ]
  const check = attention(run)
  if (check.length) lines.push('## Check before you rely on it', '', ...check.map((a) => `- ${a}`), '')
  lines.push('## Criteria', '', ...run.criteria.map((c) => `- **${c.id} ${c.name}:** ${c.description}`), '', '## Rounds', '')
  for (const round of run.rounds) {
    const counts = overall(round.votes)
    lines.push(`### Round ${round.n}: ${round.summary}`, '')
    const votes = round.votes.length ? ` (overall votes: ${counts.candidate} candidate, ${counts.same} same, ${counts.incumbent} incumbent)` : ''
    lines.push(`- Decision: **${round.decision}**${votes}`)
    if (round.score != null) lines.push(`- Score: ${round.score}`)
    lines.push(`- Climb size after this round: ${round.climbChangedLines} / ${run.budget.sizeLimit} lines. Gates: ${round.gates}.`)
    if (round.restore) lines.push(`- Restore: ${round.restore}`)
    lines.push('- Applied:', ...round.applied.map((item) => `  - ${item}`))
    if (round.proposals?.length) {
      lines.push('- Proposals:', ...round.proposals.map((p) => `  - ${p.member}: ${p.text} (${p.status}${p.reason ? `: ${p.reason}` : ''})`))
    }
    if (round.votes.length) lines.push('', ...voteTable(run, round.votes))
    if (round.next?.length) lines.push('', '- Next suggestions:', ...round.next.map((n) => `  - ${n.member}: ${n.text}`))
    lines.push('')
  }
  const fc = finalCounts(run)
  if (fc) {
    lines.push('## Start vs final', '', `Overall votes: ${fc.final} final, ${fc.same} same, ${fc.start} start.`, '', ...voteTable(run, run.final.votes), '')
    if (run.final.notes?.length) lines.push(...run.final.notes.map((n) => `- ${n}`), '')
  }
  lines.push('## Follow-ups', '', ...run.followUps.map((f) => `- ${f}`), '')
  lines.push('## Notes', '', ...run.notes.map((n) => `- ${n}`), '')
  if (run.result.diff) lines.push('## Climb diff', '', '```diff', run.result.diff.trimEnd(), '```', '')
  return lines.join('\n')
}

if (!existsSync(runsDir)) throw new Error(`No runs directory at ${runsDir}`)
const runs = readdirSync(runsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(runsDir, entry.name, 'run.json')))
  .map((entry) => JSON.parse(readFileSync(join(runsDir, entry.name, 'run.json'), 'utf8')))
// A round that failed a gate has no judge votes; older records leave the field out.
for (const run of runs) for (const round of run.rounds) round.votes ??= []

const index = runs.map((run) => {
  writeFileSync(join(runsDir, run.id, 'report.md'), report(run))
  return {
    id: run.id,
    date: run.date,
    title: run.title,
    target: run.target,
    rounds: run.rounds.length,
    accepted: run.rounds.filter((r) => r.decision === 'accepted').length,
    rejected: run.rounds.filter((r) => r.decision === 'rejected').length,
    void: run.rounds.filter((r) => r.decision === 'void').length,
    summary: run.result.summary,
    climbChangedLines: run.result.climbChangedLines,
    sizeLimit: run.budget.sizeLimit,
    final: finalCounts(run),
    score: scoreCheck(run),
    attention: attention(run),
    stop: run.stop,
  }
}).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

const indexJson = `${JSON.stringify({ schemaVersion: 1, runs: index }, null, 2)}\n`
writeFileSync(join(runsDir, 'index.json'), indexJson)

if (pageDir) {
  mkdirSync(join(pageDir, 'runs'), { recursive: true })
  copyFileSync(join(skillDir, 'assets', 'runs-page.html'), join(pageDir, 'index.html'))
  writeFileSync(join(pageDir, 'runs', 'index.json'), indexJson)
  for (const run of runs) {
    mkdirSync(join(pageDir, 'runs', run.id), { recursive: true })
    writeFileSync(join(pageDir, 'runs', run.id, 'run.json'), `${JSON.stringify(run, null, 2)}\n`)
  }
}

console.log(`Built ${index.length} run reports in ${runsDir}${pageDir ? `; page files in ${pageDir}` : ''}`)
