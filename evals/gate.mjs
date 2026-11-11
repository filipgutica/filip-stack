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

// Returns one group per provider, each with a row per scenario, and the number of
// regressed rows. A row regresses when the working tree passes fewer attempts than
// the base, or when it is marked `needsNewGuidance` and does not gain over the base
// unless it already passes every attempt.
export const gate = ({ results, attempts: expected }) => {
  const groups = new Map()
  for (const attempt of collectAttempts(results)) {
    const group = groups.get(attempt.provider.id) ?? groups.set(attempt.provider.id, { provider: attempt.provider, rows: new Map() }).get(attempt.provider.id)
    const row = group.rows.get(attempt.scenario) ?? group.rows.set(attempt.scenario, { scenario: attempt.scenario, attempts: [] }).get(attempt.scenario)
    row.attempts.push(attempt)
  }
  let regressions = 0
  const tables = [...groups.values()].map(({ provider, rows }) => ({
    provider,
    rows: [...rows.values()].map(({ scenario, attempts }) => {
      const of = (version) => attempts.filter((attempt) => attempt.version === version)
      for (const version of Object.values(versions)) {
        if (of(version).length !== expected) throw new Error(`${provider.id} ${scenario} has ${of(version).length} ${version} attempts, expected ${expected}`)
      }
      const [base, head] = [of(versions.base), of(versions.head)].map((list) => list.filter(({ pass }) => pass).length)
      const { expects, needsNewGuidance } = attempts[0]
      const regressed = head < base || (needsNewGuidance && head <= base && head < expected)
      if (regressed) regressions++
      return { scenario, expects: typeof expects === 'string' ? expects : expects[provider.label], base, head, regressed, answers: of(versions.head).map(({ answers }) => answers.join(' / ')) }
    }),
  }))
  return { tables, regressions }
}

// Formats the gate's tables as Markdown, one per provider, with totals.
export const formatTables = ({ tables, attempts, title }) => tables.map(({ provider, rows }) => {
  const total = (key) => rows.reduce((sum, row) => sum + row[key], 0)
  return [
    `## ${title(provider)}`,
    '| Scenario | Accepts | Base | Working tree | Working tree answers |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.scenario} | ${row.expects} | ${row.base}/${attempts} | ${row.head}/${attempts} | ${row.answers.join(', ')} |`),
    `Total: base ${total('base')}/${rows.length * attempts}, working tree ${total('head')}/${rows.length * attempts}`,
  ].join('\n')
}).join('\n\n')
