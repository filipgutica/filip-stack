import { spawnSync } from 'node:child_process'

// Fallow 3.18.0 reports new clones but ignores --fail-on-issues for dupes.
const result = spawnSync('fallow', [
  'dupes', '--baseline', 'fallow-baselines/dupes.json', '--format', 'json', '--quiet',
], { encoding: 'utf8' })

if (result.error) throw result.error
process.stderr.write(result.stderr)
if (result.status !== 0) {
  process.stdout.write(result.stdout)
  process.exit(result.status ?? 1)
}

const report = JSON.parse(result.stdout)
const newGroups = report.clone_groups.length
console.log(`Fallow duplication: ${newGroups} new clone groups`)
if (newGroups > 0) {
  process.stdout.write(result.stdout)
  process.exit(1)
}
