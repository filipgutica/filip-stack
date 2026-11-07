import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const agentNames = ['codex', 'claude-code']
const fields = (value, field, allowed) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`)
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(`${field} supports only ${allowed.join(', ')}`)
}
const names = (value, field, allowed) => {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((name) => typeof name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name))) {
    throw new Error(`${field} must be an array of names`)
  }
  if (new Set(value).size !== value.length) throw new Error(`${field} contains duplicate names`)
  if (allowed && value.some((name) => !allowed.includes(name))) throw new Error(`${field} supports only ${allowed.join(', ')}`)
  return value
}

const selection = (value, field) => {
  fields(value, field, ['skills', 'plugins'])
  return { skills: names(value.skills, `${field}.skills`), plugins: names(value.plugins, `${field}.plugins`) }
}

const environments = (value) => {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('environments must be an array')
  const ids = new Set()
  return value.map((environment) => {
    fields(environment, 'environment', ['environmentId', 'label', 'agents', 'exclude'])
    if (!environment || typeof environment.environmentId !== 'string' || !environment.environmentId || typeof environment.label !== 'string' || !environment.label) {
      throw new Error('each environment needs an environmentId and label')
    }
    if (ids.has(environment.environmentId)) throw new Error(`duplicate environmentId ${environment.environmentId}`)
    ids.add(environment.environmentId)
    return {
      ...environment,
      agents: environment.agents === undefined ? undefined : names(environment.agents, `${environment.label}.agents`, agentNames),
      exclude: selection(environment.exclude === undefined ? {} : environment.exclude, `${environment.label}.exclude`),
    }
  })
}

const selectEnvironment = ({ roster, environmentId, host, hasBaseline, path }) => {
  const matches = roster.filter((entry) => environmentId ? entry.environmentId === environmentId : entry.label === host)
  if (matches.length > 1) throw new Error('multiple environments match this host; pass --environment-id')
  if (environmentId && matches.length !== 1) throw new Error(`environment ${environmentId} is not enrolled in ${path}`)
  if (hasBaseline && roster.length && !matches.length) throw new Error(`host ${host} is not enrolled; pass --environment-id`)
  return matches[0]
}

const validateBaseline = (baseline, repository) => {
  for (const name of baseline.skills) {
    if (!existsSync(join(repository, 'skills', name, 'SKILL.md'))) throw new Error(`baseline skill ${name} is not available in this checkout`)
  }
  for (const name of baseline.plugins) {
    if (!existsSync(join(repository, 'plugins', name, '.claude-plugin/plugin.json'))) throw new Error(`baseline plugin ${name} is not available in this checkout`)
  }
}

export const loadFleetConfig = ({ path, environmentId, host, repository }) => {
  const content = existsSync(path) ? readFileSync(path, 'utf8') : null
  const input = content === null ? { version: 1 } : JSON.parse(content)
  fields(input, 'fleet config', ['version', 'baseline', 'environments'])
  if (input.version !== 1) throw new Error('fleet config version must be 1')
  const baseline = selection(input.baseline === undefined ? {} : input.baseline, 'baseline')
  const roster = environments(input.environments)
  validateBaseline(baseline, repository)
  const environment = selectEnvironment({ roster, environmentId, host, hasBaseline: input.baseline !== undefined, path })
  return {
    path: content === null ? null : path,
    digest: content === null ? null : createHash('sha256').update(content).digest('hex'),
    environmentId: environment?.environmentId ?? null,
    agents: environment?.agents ?? agentNames,
    baseline,
    excluded: environment?.exclude ?? { skills: [], plugins: [] },
  }
}
