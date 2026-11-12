// Turns a promptfoo eval's results into base-versus-working-tree tables and applies
// the gate. promptfoo scores each output on its own; this gate compares the two
// prompt versions, which promptfoo assertions cannot do.

const errorReason = 2 // promptfoo ResultFailureReason.ERROR
// The prompt labels in each eval config.
const versions = { base: 'base', head: 'working tree' }

// Groups promptfoo result rows into attempts. An attempt is one repeat of one
// scenario for one prompt version and provider. A scenario can span several tests
// (routing checks the skill and the reference separately), and the attempt passes
// only when all of them pass. Throws on provider errors, which are not attempts.
const collectAttempts = (results) => {
  const errors = results.filter((row) => row.failureReason === errorReason)
  if (errors.length > 0) throw new Error(`${errors.length} result(s) errored instead of answering; first: ${errors[0].error}`)
  const attempts = new Map()
  for (const row of [...results].sort((left, right) => left.testIdx - right.testIdx)) {
    const { scenario, expects, needsNewGuidance } = row.testCase.metadata
    const key = JSON.stringify([row.provider.id, scenario, row.prompt.label, row.repeatIndex])
    const attempt = attempts.get(key) ?? { provider: row.provider, scenario, expects, needsNewGuidance, version: row.prompt.label, pass: true, answers: [] }
    attempt.pass &&= row.success
    attempt.answers.push(row.gradingResult.componentResults[0].reason)
    attempts.set(key, attempt)
  }
  return [...attempts.values()]
}

// Scores one scenario for one provider. A row regresses when the working tree passes
// fewer attempts than the base, or when it is marked `needsNewGuidance` and does not
// gain over the base unless it already passes every attempt. Without a base, a row
// regresses when the working tree misses any attempt.
const scoreRow = ({ provider, scenario, attempts, expected, noBase }) => {
  const of = (version) => attempts.filter((attempt) => attempt.version === version)
  for (const version of noBase ? [versions.head] : Object.values(versions)) {
    if (of(version).length !== expected) throw new Error(`${provider.id} ${scenario} has ${of(version).length} ${version} attempts, expected ${expected}`)
  }
  const passes = (version) => of(version).filter(({ pass }) => pass).length
  const head = passes(versions.head)
  const base = noBase ? null : passes(versions.base)
  const { expects, needsNewGuidance } = attempts[0]
  const regressed = noBase ? head < expected : head < base || (needsNewGuidance && head <= base && head < expected)
  return { scenario, expects: typeof expects === 'string' ? expects : expects[provider.label], base, head, regressed, answers: of(versions.head).map(({ answers }) => answers.join(' / ')) }
}

// Returns one table per provider, with a row per scenario, and the number of regressed rows.
export const gate = ({ results, attempts: expected, noBase = false }) => {
  const groups = new Map()
  for (const attempt of collectAttempts(results)) {
    const group = groups.get(attempt.provider.id) ?? groups.set(attempt.provider.id, { provider: attempt.provider, rows: new Map() }).get(attempt.provider.id)
    const row = group.rows.get(attempt.scenario) ?? group.rows.set(attempt.scenario, { scenario: attempt.scenario, attempts: [] }).get(attempt.scenario)
    row.attempts.push(attempt)
  }
  const tables = [...groups.values()].sort((left, right) => left.provider.id.localeCompare(right.provider.id)).map(({ provider, rows }) => ({
    provider,
    rows: [...rows.values()].map(({ scenario, attempts }) => scoreRow({ provider, scenario, attempts, expected, noBase })),
  }))
  return { tables, regressions: tables.flatMap(({ rows }) => rows).filter(({ regressed }) => regressed).length }
}

// Formats the gate's tables as Markdown, one per provider, with totals.
export const formatTables = ({ tables, attempts, title }) => tables.map(({ provider, rows }) => {
  // A run without a base shows a dash in the base column.
  const score = (passes, count) => (passes === null ? '-' : `${passes}/${count}`)
  const total = (key) => (rows[0]?.[key] === null ? null : rows.reduce((sum, row) => sum + row[key], 0))
  return [
    `## ${title(provider)}`,
    '| Scenario | Accepts | Base | Working tree | Working tree answers |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.scenario} | ${row.expects} | ${score(row.base, attempts)} | ${score(row.head, attempts)} | ${row.answers.join(', ')} |`),
    `Total: base ${score(total('base'), rows.length * attempts)}, working tree ${score(total('head'), rows.length * attempts)}`,
  ].join('\n')
}).join('\n\n')
