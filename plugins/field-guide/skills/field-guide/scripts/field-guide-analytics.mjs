import { randomUUID } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const guidanceIdPattern = /^guidance:v1:[0-9a-f]{64}$/
const projectKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const submissionOutcomes = new Set(['created', 'reinforced', 'promoted', 'duplicate-evidence'])
const transitionOutcomes = new Set(['activate', 'supersede', 'undo', 'withdraw'])
const impactEffects = new Set(['applied', 'decision_changed'])
const impactVerdicts = new Set(['confirmed', 'rejected'])
const captureVerdicts = new Set(['eligible_captured', 'eligible_missed', 'not_eligible'])

const fail = (message) => {
  throw new Error(message)
}

const assertObject = ({ value, label }) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`)
}

const assertFields = ({ value, required, optional = [], label }) => {
  const allowed = new Set([...required, ...optional])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${label} has unsupported field: ${key}`)
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail(`${label} is missing ${key}`)
  }
}

const rootFor = (guideRoot) => resolve(guideRoot ?? join(homedir(), '.field-guide'))
const analyticsPathsFor = (guideRoot) => {
  const root = rootFor(guideRoot)
  const analyticsRoot = join(root, 'analytics')
  return {
    root,
    analyticsRoot,
    configPath: join(analyticsRoot, 'config.json'),
    eventsPath: join(analyticsRoot, 'events.jsonl'),
    lockPath: join(analyticsRoot, 'events.lock'),
  }
}

const isInitialized = (guideRoot) => {
  const root = rootFor(guideRoot)
  return ['init.md', 'memory.md', 'memory.json'].every((name) => {
    try {
      return lstatSync(join(root, name)).isFile()
    } catch {
      return false
    }
  })
}

const ensureAnalyticsDirectory = (analyticsRoot) => {
  mkdirSync(analyticsRoot, { recursive: true, mode: 0o700 })
  const stats = lstatSync(analyticsRoot)
  if (!stats.isDirectory() || stats.isSymbolicLink()) fail('analytics directory must be a local directory')
  chmodSync(analyticsRoot, 0o700)
}

const readRegularFile = ({ path, label }) => {
  const flags = constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0)
  const descriptor = openSync(path, flags)
  try {
    if (!fstatSync(descriptor).isFile()) fail(`${label} must be a regular file`)
    return readFileSync(descriptor, 'utf8')
  } finally {
    closeSync(descriptor)
  }
}

const readConfig = (configPath) => {
  try {
    const config = JSON.parse(readRegularFile({ path: configPath, label: 'analytics config' }))
    assertObject({ value: config, label: 'analytics config' })
    assertFields({ value: config, required: ['schemaVersion', 'enabled'], label: 'analytics config' })
    if (config.schemaVersion !== 1 || typeof config.enabled !== 'boolean') return null
    return config
  } catch {
    return null
  }
}

const validateEvent = (event) => {
  assertObject({ value: event, label: 'analytics event' })
  if (event.schemaVersion !== 1) fail('analytics event schemaVersion must be 1')

  if (event.type === 'hook_invoked') {
    assertFields({ value: event, required: ['schemaVersion', 'type', 'host'], optional: ['id', 'at'], label: 'hook event' })
    if (!['codex', 'claude'].includes(event.host)) fail('hook event host must be codex or claude')
  } else if (event.type === 'retrieval') {
    assertFields({
      value: event,
      required: ['schemaVersion', 'type', 'projectKey', 'guidanceIds'],
      optional: ['id', 'at'],
      label: 'retrieval event',
    })
    validateProjectKey(event.projectKey)
    if (!Array.isArray(event.guidanceIds) || event.guidanceIds.length > 5 || new Set(event.guidanceIds).size !== event.guidanceIds.length) {
      fail('retrieval event guidanceIds must be a unique array with at most five items')
    }
    event.guidanceIds.forEach(validateGuidanceId)
  } else if (event.type === 'submission' || event.type === 'transition') {
    assertFields({
      value: event,
      required: ['schemaVersion', 'type', 'projectKey', 'guidanceId', 'outcome'],
      optional: ['id', 'at'],
      label: `${event.type} event`,
    })
    validateProjectKey(event.projectKey)
    validateGuidanceId(event.guidanceId)
    const outcomes = event.type === 'submission' ? submissionOutcomes : transitionOutcomes
    if (!outcomes.has(event.outcome)) fail(`${event.type} event outcome is invalid`)
  } else if (event.type === 'impact') {
    assertFields({
      value: event,
      required: ['schemaVersion', 'type', 'retrievalEventId', 'guidanceId', 'effect'],
      optional: ['id', 'at'],
      label: 'impact event',
    })
    validateUuid(event.retrievalEventId, 'impact event retrievalEventId')
    validateGuidanceId(event.guidanceId)
    if (!impactEffects.has(event.effect)) fail('impact event effect is invalid')
  } else if (event.type === 'review') {
    validateReviewEvent(event)
  } else {
    fail('analytics event type is invalid')
  }

  if (event.id !== undefined) validateUuid(event.id, 'analytics event id')
  if (event.at !== undefined) validateTimestamp(event.at)
  return event
}

const validateReviewEvent = (event) => {
  if (event.kind === 'impact') {
    assertFields({
      value: event,
      required: ['schemaVersion', 'type', 'kind', 'impactEventId', 'verdict'],
      optional: ['id', 'at'],
      label: 'impact review event',
    })
    validateUuid(event.impactEventId, 'impact review event impactEventId')
    if (!impactVerdicts.has(event.verdict)) fail('impact review event verdict is invalid')
  } else if (event.kind === 'capture') {
    assertFields({
      value: event,
      required: ['schemaVersion', 'type', 'kind', 'caseId', 'verdict'],
      optional: ['id', 'at'],
      label: 'capture review event',
    })
    validateUuid(event.caseId, 'capture review event caseId')
    if (!captureVerdicts.has(event.verdict)) fail('capture review event verdict is invalid')
  } else {
    fail('review event kind is invalid')
  }
}

const validateAutomaticInput = (event) => {
  assertObject({ value: event, label: 'analytics event' })
  if (event.type === 'hook_invoked') {
    assertFields({ value: event, required: ['type', 'host'], label: 'hook event input' })
  } else if (event.type === 'retrieval') {
    assertFields({ value: event, required: ['type', 'projectKey', 'guidanceIds'], label: 'retrieval event input' })
  } else if (event.type === 'submission' || event.type === 'transition') {
    assertFields({
      value: event,
      required: ['type', 'projectKey', 'guidanceId', 'outcome'],
      label: `${event.type} event input`,
    })
  } else {
    fail('automatic analytics event type is invalid')
  }
}

const validateProjectKey = (projectKey) => {
  if (typeof projectKey !== 'string' || projectKey.length > 128 || !projectKeyPattern.test(projectKey)) {
    fail('analytics projectKey must be a portable key')
  }
}

const validateGuidanceId = (guidanceId) => {
  if (typeof guidanceId !== 'string' || !guidanceIdPattern.test(guidanceId)) fail('analytics guidanceId is invalid')
}

const validateUuid = (value, label) => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) fail(`${label} must be a UUID`)
}

const validateTimestamp = (value) => {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail('analytics event at must be an ISO timestamp')
  }
}

const completeEvent = (fields) => validateEvent({
  schemaVersion: 1,
  id: randomUUID(),
  at: new Date().toISOString(),
  ...fields,
})

const completeAutomaticEvent = (input) => {
  validateAutomaticInput(input)
  return completeEvent(input)
}

const makeAnalyticsDirectoryWritable = (paths) => {
  ensureAnalyticsDirectory(paths.analyticsRoot)
  const config = readConfig(paths.configPath)
  if (!config?.enabled) return false
  return true
}

const readEvents = (eventsPath) => {
  let contents
  try {
    contents = readRegularFile({ path: eventsPath, label: 'analytics events path' })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  return contents.split('\n').flatMap((line) => {
    if (!line) return []
    try {
      const event = validateEvent(JSON.parse(line))
      if (!uuidPattern.test(event.id) || !event.at) return []
      return [event]
    } catch {
      return []
    }
  })
}

const persistEvent = (paths, event) => {
  ensureAnalyticsDirectory(paths.analyticsRoot)
  const flags = constants.O_WRONLY
    | constants.O_APPEND
    | constants.O_CREAT
    | constants.O_NONBLOCK
    | (constants.O_NOFOLLOW ?? 0)
  const descriptor = openSync(paths.eventsPath, flags, 0o600)
  try {
    if (!fstatSync(descriptor).isFile()) fail('analytics events path must be a regular file')
    fchmodSync(descriptor, 0o600)
    writeSync(descriptor, `${JSON.stringify(event)}\n`)
  } finally {
    closeSync(descriptor)
  }
}

const withAnalyticsLock = (paths, action) => {
  let descriptor
  try {
    descriptor = openSync(paths.lockPath, 'wx', 0o600)
  } catch (error) {
    if (error.code === 'EEXIST') fail('Field Guide analytics is busy; retry the operation')
    throw error
  }
  try {
    fchmodSync(descriptor, 0o600)
    return action()
  } finally {
    closeSync(descriptor)
    unlinkSync(paths.lockPath)
  }
}

const requireEnabled = (paths) => {
  if (!isAnalyticsEnabled({ guideRoot: paths.root })) fail('Field Guide analytics is disabled')
}

const validateImpactInput = (input) => {
  assertObject({ value: input, label: 'impact input' })
  assertFields({
    value: input,
    required: ['schemaVersion', 'retrievalEventId', 'guidanceId', 'effect'],
    label: 'impact input',
  })
  if (input.schemaVersion !== 1) fail('impact input schemaVersion must be 1')
  validateUuid(input.retrievalEventId, 'impact input retrievalEventId')
  validateGuidanceId(input.guidanceId)
  if (!impactEffects.has(input.effect)) fail('impact input effect is invalid')
  return input
}

const validateReviewInput = (input) => {
  assertObject({ value: input, label: 'review input' })
  if (input.kind === 'impact') {
    assertFields({
      value: input,
      required: ['schemaVersion', 'kind', 'impactEventId', 'verdict'],
      label: 'impact review input',
    })
    validateUuid(input.impactEventId, 'impact review input impactEventId')
    if (!impactVerdicts.has(input.verdict)) fail('impact review input verdict is invalid')
  } else if (input.kind === 'capture') {
    assertFields({
      value: input,
      required: ['schemaVersion', 'kind', 'caseId', 'verdict'],
      label: 'capture review input',
    })
    validateUuid(input.caseId, 'capture review input caseId')
    if (!captureVerdicts.has(input.verdict)) fail('capture review input verdict is invalid')
  } else {
    fail('review input kind must be impact or capture')
  }
  if (input.schemaVersion !== 1) fail('review input schemaVersion must be 1')
  return input
}

const parseSince = (since) => {
  if (since === undefined) return { value: null, timestamp: null }
  if (typeof since !== 'string') fail('since must be a YYYY-MM-DD date or ISO timestamp')
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(since)
  const timestamp = Date.parse(since)
  if (Number.isNaN(timestamp)) fail('since must be a YYYY-MM-DD date or ISO timestamp')
  if (dateOnly && new Date(`${since}T00:00:00.000Z`).toISOString().slice(0, 10) !== since) {
    fail('since must be a valid calendar date')
  }
  if (!dateOnly) validateTimestamp(since)
  return { value: since, timestamp }
}

const emptyOutcomeCounts = (events, type) => Object.fromEntries(
  [...new Set(events.filter((event) => event.type === type).map(({ outcome }) => outcome))]
    .sort()
    .map((outcome) => [outcome, events.filter((event) => event.type === type && event.outcome === outcome).length]),
)

/** Returns whether the local analytics opt-in file is valid and enabled. */
export const isAnalyticsEnabled = ({ guideRoot } = {}) => {
  const { configPath } = analyticsPathsFor(guideRoot)
  return readConfig(configPath)?.enabled === true
}

/** Enables or disables analytics for an initialized local Field Guide. */
export const configureAnalytics = ({ guideRoot, enabled } = {}) => {
  assertObject({ value: { guideRoot, enabled }, label: 'analytics configuration' })
  if (typeof enabled !== 'boolean') fail('analytics enabled must be a boolean')
  const paths = analyticsPathsFor(guideRoot)
  if (!isInitialized(paths.root)) fail('Field Guide analytics requires an initialized guide')
  ensureAnalyticsDirectory(paths.analyticsRoot)

  const temporaryPath = join(paths.analyticsRoot, `config.${randomUUID()}.tmp`)
  try {
    writeFileSync(temporaryPath, `${JSON.stringify({ schemaVersion: 1, enabled })}\n`, { mode: 0o600, flag: 'wx' })
    chmodSync(temporaryPath, 0o600)
    renameSync(temporaryPath, paths.configPath)
  } catch (error) {
    try {
      unlinkSync(temporaryPath)
    } catch {}
    throw error
  }
  return { enabled, path: paths.configPath }
}

/** Appends an automatic event; disabled analytics and storage failures return null. */
export const appendAnalyticsEvent = (options = {}) => {
  try {
    assertObject({ value: options, label: 'analytics options' })
    const { guideRoot, event } = options
    assertObject({ value: event, label: 'analytics event' })
    const complete = completeAutomaticEvent(event)
    const paths = analyticsPathsFor(guideRoot)
    if (!isAnalyticsEnabled({ guideRoot: paths.root })) return null
    if (!makeAnalyticsDirectoryWritable(paths)) return null
    persistEvent(paths, complete)
    return complete
  } catch {
    return null
  }
}

/** Records an agent-reported effect for a guidance record returned by retrieval. */
export const recordImpact = ({ guideRoot, input } = {}) => {
  const paths = analyticsPathsFor(guideRoot)
  requireEnabled(paths)
  const validated = validateImpactInput(input)
  return withAnalyticsLock(paths, () => {
    const events = readEvents(paths.eventsPath)
    const retrieval = events.find(({ id, type }) => id === validated.retrievalEventId && type === 'retrieval')
    if (!retrieval) fail('impact input retrieval event does not exist')
    if (!retrieval.guidanceIds.includes(validated.guidanceId)) {
      fail('impact input guidanceId was not returned by the referenced retrieval')
    }
    if (events.some((event) => (
      event.type === 'impact'
        && event.retrievalEventId === validated.retrievalEventId
        && event.guidanceId === validated.guidanceId
    ))) fail('duplicate impact for this retrieval and guidance')

    const event = completeEvent({ type: 'impact', ...validated })
    persistEvent(paths, event)
    return event
  })
}

/** Records a review of one impact claim or one sampled capture case. */
export const recordReview = ({ guideRoot, input } = {}) => {
  const paths = analyticsPathsFor(guideRoot)
  requireEnabled(paths)
  const validated = validateReviewInput(input)
  return withAnalyticsLock(paths, () => {
    const events = readEvents(paths.eventsPath)
    if (validated.kind === 'impact') {
      const impact = events.find(({ id, type }) => id === validated.impactEventId && type === 'impact')
      if (!impact) fail('impact review input impact event does not exist')
      if (validated.verdict === 'confirmed' && impact.effect !== 'decision_changed') {
        fail('only decision_changed impacts can be confirmed as catches')
      }
      if (events.some((event) => (
        event.type === 'review' && event.kind === 'impact' && event.impactEventId === validated.impactEventId
      ))) fail('duplicate review for this impact')
    } else if (events.some((event) => (
      event.type === 'review' && event.kind === 'capture' && event.caseId === validated.caseId
    ))) fail('duplicate review for this capture case')

    const event = completeEvent({ type: 'review', ...validated })
    persistEvent(paths, event)
    return event
  })
}

/** Returns aggregate counts and rates without returning event identifiers or payloads. */
export const reportAnalytics = ({ guideRoot, since } = {}) => {
  const paths = analyticsPathsFor(guideRoot)
  const dateFilter = parseSince(since)
  const allEvents = readEvents(paths.eventsPath)
  const events = dateFilter.timestamp === null
    ? allEvents
    : allEvents.filter(({ at }) => Date.parse(at) >= dateFilter.timestamp)
  const hooks = events.filter(({ type }) => type === 'hook_invoked')
  const retrievals = events.filter(({ type }) => type === 'retrieval')
  const submissions = events.filter(({ type }) => type === 'submission')
  const transitions = events.filter(({ type }) => type === 'transition')
  const impacts = events.filter(({ type }) => type === 'impact')
  const reviews = events.filter(({ type, kind }) => type === 'review' && kind === 'impact')
  const captureReviews = events.filter(({ type, kind }) => type === 'review' && kind === 'capture')
  const impactById = new Map(allEvents.filter(({ type }) => type === 'impact').map((event) => [event.id, event]))
  const validImpactReviews = reviews.filter(({ impactEventId, verdict }) => {
    const impact = impactById.get(impactEventId)
    return impact && (verdict !== 'confirmed' || impact.effect === 'decision_changed')
  })
  const confirmed = validImpactReviews.filter(({ verdict }) => verdict === 'confirmed').length
  const rejected = validImpactReviews.filter(({ verdict }) => verdict === 'rejected').length
  const decisionChangedReviewed = validImpactReviews.filter(({ impactEventId }) => (
    impactById.get(impactEventId).effect === 'decision_changed'
  )).length
  const hits = retrievals.filter(({ guidanceIds }) => guidanceIds.length > 0).length
  const eligibleCaptured = captureReviews.filter(({ verdict }) => verdict === 'eligible_captured').length
  const eligibleMissed = captureReviews.filter(({ verdict }) => verdict === 'eligible_missed').length
  const notEligible = captureReviews.filter(({ verdict }) => verdict === 'not_eligible').length
  const eligibleReviewed = eligibleCaptured + eligibleMissed

  return {
    schemaVersion: 1,
    enabled: isAnalyticsEnabled({ guideRoot: paths.root }),
    since: dateFilter.value,
    hooks: {
      total: hooks.length,
      byHost: Object.fromEntries(['codex', 'claude'].map((host) => {
        const hostEvents = hooks.filter((event) => event.host === host)
        return [host, {
          count: hostEvents.length,
          lastSeen: hostEvents.map(({ at }) => at).sort().at(-1) ?? null,
        }]
      })),
    },
    retrievals: {
      total: retrievals.length,
      hits,
      misses: retrievals.length - hits,
      hitRate: retrievals.length === 0 ? null : hits / retrievals.length,
    },
    submissions: { total: submissions.length, outcomes: emptyOutcomeCounts(events, 'submission') },
    transitions: { total: transitions.length, outcomes: emptyOutcomeCounts(events, 'transition') },
    impacts: {
      total: impacts.length,
      applied: impacts.filter(({ effect }) => effect === 'applied').length,
      decisionChanged: impacts.filter(({ effect }) => effect === 'decision_changed').length,
      reviews: { confirmed, rejected, decisionChangedReviewed },
      confirmedCatches: confirmed,
      reviewConfirmationRate: decisionChangedReviewed === 0 ? null : confirmed / decisionChangedReviewed,
    },
    capture: {
      eligibleCaptured,
      eligibleMissed,
      notEligible,
      eligibleReviewed,
      captureRate: eligibleReviewed === 0 ? null : eligibleCaptured / eligibleReviewed,
    },
  }
}
