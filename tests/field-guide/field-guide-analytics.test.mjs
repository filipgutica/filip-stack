import assert from 'node:assert/strict'
import {
  execFileSync,
  spawn,
  spawnSync,
} from 'node:child_process'
import {
  chmodSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import {
  appendAnalyticsEvent,
  configureAnalytics,
  isAnalyticsEnabled,
  recordImpact,
  recordReview,
  reportAnalytics,
} from '../../plugins/field-guide/skills/field-guide/scripts/field-guide-analytics.mjs'

const guidanceA = `guidance:v1:${'a'.repeat(64)}`
const guidanceB = `guidance:v1:${'b'.repeat(64)}`
const analyticsModuleUrl = new URL(
  '../../plugins/field-guide/skills/field-guide/scripts/field-guide-analytics.mjs',
  import.meta.url,
).href

const createGuideRoot = () => {
  const guideRoot = mkdtempSync(join(tmpdir(), 'field-guide-analytics-'))
  writeFileSync(join(guideRoot, 'init.md'), '# Field Guide\n')
  writeFileSync(join(guideRoot, 'memory.md'), '# Memory\n')
  writeFileSync(join(guideRoot, 'memory.json'), '{"schemaVersion":1}\n')
  return guideRoot
}

const enableAnalytics = (guideRoot) => configureAnalytics({ guideRoot, enabled: true })

test('analytics is opt-in and requires an initialized guide to configure', () => {
  const guideRoot = mkdtempSync(join(tmpdir(), 'field-guide-analytics-uninitialized-'))

  assert.equal(isAnalyticsEnabled({ guideRoot }), false)
  assert.throws(() => configureAnalytics({ guideRoot, enabled: true }), /initialized/)

  const initializedRoot = createGuideRoot()
  assert.deepEqual(enableAnalytics(initializedRoot), {
    enabled: true,
    path: join(initializedRoot, 'analytics', 'config.json'),
  })
  assert.equal(isAnalyticsEnabled({ guideRoot: initializedRoot }), true)
  assert.deepEqual(configureAnalytics({ guideRoot: initializedRoot, enabled: false }), {
    enabled: false,
    path: join(initializedRoot, 'analytics', 'config.json'),
  })
  assert.equal(isAnalyticsEnabled({ guideRoot: initializedRoot }), false)
})

test('events contain only bounded metadata and use private local storage permissions', () => {
  const guideRoot = createGuideRoot()
  enableAnalytics(guideRoot)
  const event = appendAnalyticsEvent({
    guideRoot,
    event: { type: 'retrieval', projectKey: 'sample-project', guidanceIds: [guidanceA] },
  })
  const analyticsRoot = join(guideRoot, 'analytics')
  const eventsPath = join(analyticsRoot, 'events.jsonl')
  const serialized = readFileSync(eventsPath, 'utf8')

  assert.equal(event.type, 'retrieval')
  assert.match(event.id, /^[0-9a-f-]{36}$/)
  assert.equal(new Date(event.at).toISOString(), event.at)
  assert.deepEqual(JSON.parse(serialized), event)
  assert.doesNotMatch(serialized, /prompt|query|transcript|learning|sample text/i)
  assert.equal(statSync(analyticsRoot).mode & 0o777, 0o700)
  assert.equal(statSync(eventsPath).mode & 0o777, 0o600)
  assert.equal(statSync(join(analyticsRoot, 'config.json')).mode & 0o777, 0o600)

  assert.equal(appendAnalyticsEvent({
    guideRoot,
    event: { type: 'hook_invoked', host: 'codex', prompt: 'private task text' },
  }), null)
  assert.equal(appendAnalyticsEvent({
    guideRoot,
    event: { type: 'retrieval', projectKey: 'private task text', guidanceIds: [] },
  }), null)
  assert.equal(readFileSync(eventsPath, 'utf8').trim().split('\n').length, 1)
})

test('disabled analytics do not append automatic events and manual records require opt-in', () => {
  const guideRoot = createGuideRoot()
  const event = { type: 'hook_invoked', host: 'codex' }

  assert.equal(appendAnalyticsEvent({ guideRoot, event }), null)
  assert.throws(() => recordImpact({ guideRoot, input: {} }), /disabled/)
  enableAnalytics(guideRoot)
  configureAnalytics({ guideRoot, enabled: false })
  assert.equal(appendAnalyticsEvent({ guideRoot, event }), null)
  assert.throws(() => recordReview({ guideRoot, input: {} }), /disabled/)
})

test('impact and review entries validate cross-references and reject duplicates', () => {
  const guideRoot = createGuideRoot()
  enableAnalytics(guideRoot)
  const retrieval = appendAnalyticsEvent({
    guideRoot,
    event: { type: 'retrieval', projectKey: 'sample-project', guidanceIds: [guidanceA] },
  })
  const impact = recordImpact({
    guideRoot,
    input: {
      schemaVersion: 1,
      retrievalEventId: retrieval.id,
      guidanceId: guidanceA,
      effect: 'decision_changed',
    },
  })
  assert.equal(impact.type, 'impact')
  assert.throws(() => recordImpact({
    guideRoot,
    input: {
      schemaVersion: 1,
      retrievalEventId: retrieval.id,
      guidanceId: guidanceA,
      effect: 'applied',
    },
  }), /duplicate/)
  assert.throws(() => recordImpact({
    guideRoot,
    input: {
      schemaVersion: 1,
      retrievalEventId: retrieval.id,
      guidanceId: guidanceB,
      effect: 'applied',
    },
  }), /was not returned/)

  const review = recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'impact', impactEventId: impact.id, verdict: 'confirmed' },
  })
  assert.equal(review.type, 'review')
  assert.throws(() => recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'impact', impactEventId: impact.id, verdict: 'rejected' },
  }), /duplicate/)
  assert.throws(() => recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'capture', caseId: randomUUID(), verdict: 'eligible_missed', notes: 'raw correction text' },
  }), /unsupported/)
})

test('concurrent processes can create only one impact for a retrieval and guidance pair', async () => {
  const guideRoot = createGuideRoot()
  enableAnalytics(guideRoot)
  const retrieval = appendAnalyticsEvent({
    guideRoot,
    event: { type: 'retrieval', projectKey: 'sample-project', guidanceIds: [guidanceA] },
  })
  const eventsPath = join(guideRoot, 'analytics', 'events.jsonl')
  const filler = Array.from({ length: 2000 }, () => JSON.stringify({
    schemaVersion: 1,
    id: randomUUID(),
    at: new Date().toISOString(),
    type: 'hook_invoked',
    host: 'codex',
  })).join('\n')
  appendFileSync(eventsPath, `${filler}\n`)

  const barrierRoot = mkdtempSync(join(tmpdir(), 'field-guide-analytics-barrier-'))
  const releasePath = join(barrierRoot, 'release')
  const childSource = [
    `import { recordImpact } from ${JSON.stringify(analyticsModuleUrl)}`,
    "import { existsSync, writeFileSync } from 'node:fs'",
    'const [guideRoot, retrievalEventId, guidanceId, readyPath, releasePath] = process.argv.slice(1)',
    "writeFileSync(readyPath, 'ready')",
    'while (!existsSync(releasePath)) await new Promise((resolve) => setTimeout(resolve, 1))',
    'try {',
    "  recordImpact({ guideRoot, input: { schemaVersion: 1, retrievalEventId, guidanceId, effect: 'applied' } })",
    "  process.stdout.write('created')",
    '} catch (error) {',
    "  if (/busy|duplicate/.test(error.message)) process.stdout.write('rejected')",
    "  else { process.stderr.write(error.message); process.exitCode = 1 }",
    '}',
  ].join('\n')
  const runWriter = (index) => new Promise((resolve) => {
    const readyPath = join(barrierRoot, `ready-${index}`)
    const child = spawn(process.execPath, [
      '--input-type=module',
      '-e',
      childSource,
      guideRoot,
      retrieval.id,
      guidanceA,
      readyPath,
      releasePath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, 5000)
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.once('close', (status) => {
      clearTimeout(timeout)
      resolve({ status, stdout, stderr, timedOut })
    })
  })
  const writers = Array.from({ length: 4 }, (_, index) => runWriter(index))
  const readyPaths = Array.from({ length: 4 }, (_, index) => join(barrierRoot, `ready-${index}`))
  const readyDeadline = Date.now() + 4000
  while (!readyPaths.every(existsSync) && Date.now() < readyDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  writeFileSync(releasePath, 'go')
  const results = await Promise.all(writers)

  assert.ok(readyPaths.every(existsSync), 'all writers reached the concurrency barrier')
  assert.ok(results.every(({ status, timedOut }) => status === 0 && !timedOut), JSON.stringify(results))
  assert.equal(results.filter(({ stdout }) => stdout === 'created').length, 1)
  assert.equal(results.filter(({ stdout }) => stdout === 'rejected').length, 3)
  assert.equal(reportAnalytics({ guideRoot }).impacts.total, 1)
})

test('reports counts, valid denominators, and a date-filtered summary without raw events', () => {
  const guideRoot = createGuideRoot()
  enableAnalytics(guideRoot)
  appendAnalyticsEvent({ guideRoot, event: { type: 'hook_invoked', host: 'codex' } })
  appendAnalyticsEvent({ guideRoot, event: { type: 'hook_invoked', host: 'claude' } })
  const retrievalHit = appendAnalyticsEvent({
    guideRoot,
    event: { type: 'retrieval', projectKey: 'sample-project', guidanceIds: [guidanceA] },
  })
  const secondRetrievalHit = appendAnalyticsEvent({
    guideRoot,
    event: { type: 'retrieval', projectKey: 'sample-project', guidanceIds: [guidanceA] },
  })
  appendAnalyticsEvent({
    guideRoot,
    event: { type: 'retrieval', projectKey: 'sample-project', guidanceIds: [] },
  })
  appendAnalyticsEvent({
    guideRoot,
    event: { type: 'submission', projectKey: 'sample-project', guidanceId: guidanceA, outcome: 'created' },
  })
  appendAnalyticsEvent({
    guideRoot,
    event: { type: 'transition', projectKey: 'sample-project', guidanceId: guidanceA, outcome: 'withdraw' },
  })
  const appliedImpact = recordImpact({
    guideRoot,
    input: { schemaVersion: 1, retrievalEventId: retrievalHit.id, guidanceId: guidanceA, effect: 'applied' },
  })
  const decisionImpact = recordImpact({
    guideRoot,
    input: { schemaVersion: 1, retrievalEventId: secondRetrievalHit.id, guidanceId: guidanceA, effect: 'decision_changed' },
  })

  const confirmedReview = recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'impact', impactEventId: decisionImpact.id, verdict: 'confirmed' },
  })
  const appliedReview = recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'impact', impactEventId: appliedImpact.id, verdict: 'rejected' },
  })
  const captureCaseId = randomUUID()
  recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'capture', caseId: captureCaseId, verdict: 'eligible_captured' },
  })
  recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'capture', caseId: randomUUID(), verdict: 'eligible_missed' },
  })
  recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'capture', caseId: randomUUID(), verdict: 'not_eligible' },
  })

  const report = reportAnalytics({ guideRoot })
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.enabled, true)
  assert.equal(report.hooks.total, 2)
  assert.ok(report.hooks.byHost.codex.lastSeen)
  assert.equal(report.retrievals.total, 3)
  assert.equal(report.retrievals.hits, 2)
  assert.equal(report.retrievals.misses, 1)
  assert.equal(report.retrievals.hitRate, 2 / 3)
  assert.deepEqual(report.submissions.outcomes, { created: 1 })
  assert.deepEqual(report.transitions.outcomes, { withdraw: 1 })
  assert.equal(report.impacts.total, 2)
  assert.equal(report.impacts.applied, 1)
  assert.equal(report.impacts.reviews.rejected, 1)
  assert.equal(report.impacts.reviews.confirmed, 1)
  assert.equal(report.impacts.confirmedCatches, 1)
  assert.equal(report.impacts.reviewConfirmationRate, 1)
  assert.equal(report.capture.eligibleCaptured, 1)
  assert.equal(report.capture.eligibleMissed, 1)
  assert.equal(report.capture.notEligible, 1)
  assert.equal(report.capture.captureRate, 0.5)
  assert.doesNotMatch(JSON.stringify(report), /guidance:v1|sample-project|retrievalEventId/)

  const emptyReport = reportAnalytics({ guideRoot, since: '2999-01-01' })
  assert.equal(emptyReport.retrievals.total, 0)
  assert.equal(emptyReport.retrievals.hitRate, null)
  assert.equal(emptyReport.capture.captureRate, null)
  assert.ok(appliedReview.id)
  assert.ok(confirmedReview.id)
})

test('confirmed catch reviews require a decision-changed impact and capture cases cannot repeat', () => {
  const guideRoot = createGuideRoot()
  enableAnalytics(guideRoot)
  const retrieval = appendAnalyticsEvent({
    guideRoot,
    event: { type: 'retrieval', projectKey: 'sample-project', guidanceIds: [guidanceA] },
  })
  const impact = recordImpact({
    guideRoot,
    input: { schemaVersion: 1, retrievalEventId: retrieval.id, guidanceId: guidanceA, effect: 'applied' },
  })
  assert.throws(() => recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'impact', impactEventId: impact.id, verdict: 'confirmed' },
  }), /decision_changed/)

  const caseId = randomUUID()
  recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'capture', caseId, verdict: 'eligible_captured' },
  })
  assert.throws(() => recordReview({
    guideRoot,
    input: { schemaVersion: 1, kind: 'capture', caseId, verdict: 'eligible_missed' },
  }), /duplicate/)
})

test('automatic event writes fail open when the event path is not writable', () => {
  const guideRoot = createGuideRoot()
  enableAnalytics(guideRoot)
  const eventsPath = join(guideRoot, 'analytics', 'events.jsonl')
  mkdirSync(eventsPath)

  assert.equal(appendAnalyticsEvent({
    guideRoot,
    event: { type: 'hook_invoked', host: 'codex' },
  }), null)
})

test('malformed stored lines are ignored by reference checks and reports', () => {
  const guideRoot = createGuideRoot()
  enableAnalytics(guideRoot)
  const eventsPath = join(guideRoot, 'analytics', 'events.jsonl')
  writeFileSync(eventsPath, '{broken json\n')
  chmodSync(eventsPath, 0o600)

  assert.equal(reportAnalytics({ guideRoot }).hooks.total, 0)
  assert.throws(() => recordImpact({
    guideRoot,
    input: {
      schemaVersion: 1,
      retrievalEventId: randomUUID(),
      guidanceId: guidanceA,
      effect: 'applied',
    },
  }), /retrieval event/)
  assert.ok(readFileSync(eventsPath, 'utf8').startsWith('{broken json\n'))
})

test('non-regular analytics files fail open without blocking on FIFOs', { skip: process.platform === 'win32' }, () => {
  const fifoRoot = mkdtempSync(join(tmpdir(), 'field-guide-analytics-fifo-config-'))
  const fifoAnalytics = join(fifoRoot, 'analytics')
  mkdirSync(fifoAnalytics)
  execFileSync('mkfifo', [join(fifoAnalytics, 'config.json')])

  const probeScript = `
    import { appendAnalyticsEvent, reportAnalytics } from ${JSON.stringify(analyticsModuleUrl)}
    const guideRoot = process.argv[1]
    try {
      const result = process.argv[2] === 'append'
        ? appendAnalyticsEvent({ guideRoot, event: { type: 'hook_invoked', host: 'codex' } })
        : reportAnalytics({ guideRoot })
      process.stdout.write(JSON.stringify(result))
    } catch (error) {
      process.stdout.write(JSON.stringify({ error: error.message }))
    }
  `
  const runProbe = ({ guideRoot, mode }) => spawnSync(
    process.execPath,
    ['--input-type=module', '-e', probeScript, guideRoot, mode],
    { encoding: 'utf8', timeout: 2000 },
  )

  const configFifoResult = runProbe({ guideRoot: fifoRoot, mode: 'append' })
  assert.equal(configFifoResult.error, undefined)
  assert.equal(configFifoResult.status, 0, configFifoResult.stderr)
  assert.equal(configFifoResult.stdout, 'null')

  const eventsRoot = mkdtempSync(join(tmpdir(), 'field-guide-analytics-fifo-events-'))
  const eventsAnalyticsRoot = join(eventsRoot, 'analytics')
  mkdirSync(eventsAnalyticsRoot)
  writeFileSync(join(eventsAnalyticsRoot, 'config.json'), '{"schemaVersion":1,"enabled":true}\n', { mode: 0o600 })
  execFileSync('mkfifo', [join(eventsAnalyticsRoot, 'events.jsonl')])

  const eventFifoAppend = runProbe({ guideRoot: eventsRoot, mode: 'append' })
  assert.equal(eventFifoAppend.error, undefined)
  assert.equal(eventFifoAppend.status, 0, eventFifoAppend.stderr)
  assert.equal(eventFifoAppend.stdout, 'null')

  const eventFifoReport = runProbe({ guideRoot: eventsRoot, mode: 'report' })
  assert.equal(eventFifoReport.error, undefined)
  assert.equal(eventFifoReport.status, 0, eventFifoReport.stderr)
  assert.match(JSON.parse(eventFifoReport.stdout).error, /regular file/)
})
