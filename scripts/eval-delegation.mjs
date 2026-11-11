#!/usr/bin/env node
// Local check for host-config delegation guidance. Renders the global guidance at a
// base ref and in the working tree, asks each host's main-thread model where a task
// should run, and scores the answer by provider and tier.

import { readFileSync } from 'node:fs'
import { runHostGuidanceEval } from './eval-shared.mjs'

// Maps a reply's model name to provider.tier through the first word of each roster label.
const roster = JSON.parse(readFileSync(new URL('../host-config/models.json', import.meta.url), 'utf8'))
const families = Object.entries(roster).flatMap(([provider, tiers]) => Object.entries(tiers).map(([tier, { label }]) => [label.split(' ')[0].toLowerCase(), `${provider}.${tier}`]))
const classify = (reply) => {
  if (reply.invalid !== undefined) return `invalid reply "${reply.invalid}"`
  if (reply.where === 'this thread') return 'self'
  const name = String(reply.model ?? '').toLowerCase()
  return families.find(([family]) => new RegExp(`\\b${family}\\b`).test(name))?.[1] ?? `unknown model ${JSON.stringify(reply.model)}`
}

const okUsage = {
  codex: { status: 'ok', source: 'codexbar', windows: [{ name: 'Weekly', usedPercent: 20, status: 'ok', willLastToReset: true }] },
  claude: { status: 'ok', source: 'claude-swap', windows: [{ name: 'sevenDay', usedPercent: 20, status: 'ok', willLastToReset: true }] },
}

await runHostGuidanceEval({
  name: 'delegation',
  scenarioFile: 'tests/host-config/delegation-scenarios.json',
  system: (guidance) => `${guidance}\n\nYou are the main thread in T3 Code. You can call delegate_task with any provider and model the guidance names, or use the native subagent profiles it names.`,
  user: (scenario) => [
    scenario.task,
    `Current provider usage, from the usage reader:\n${JSON.stringify({ providers: scenario.usage ?? okUsage })}`,
    'Decide where this work runs. Do not do the work. Reply with only JSON: {"where": "this thread"} or {"where": "delegate", "model": "<the model ID the delegated work runs on; for a native profile, the model ID that profile runs on>"}.',
  ].join('\n\n'),
  classify,
  accepted: (scenario, host) => scenario.accept[host],
})
