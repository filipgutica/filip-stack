#!/usr/bin/env node
// Local check for host-config autonomy guidance. Renders the global guidance at a
// base ref and in the working tree, gives each host's main-thread model an open
// decision in the middle of a task, and scores who it says should settle it.

import { runHostGuidanceEval } from './eval-shared.mjs'

const actions = ['decide', 'advisor', 'council', 'ask user']

await runHostGuidanceEval({
  name: 'autonomy',
  scenarioFile: 'tests/host-config/autonomy-scenarios.json',
  system: (guidance) => `${guidance}\n\nYou are the main thread in T3 Code, partway through a long task the user authorized. You have an advisor tool, can delegate to the models the guidance names, and can use the council skill.`,
  user: (scenario) => [
    scenario.task,
    'Choose how this open decision gets settled. Do not settle it. Reply with only JSON: {"action": "<one of: decide (make the call yourself and continue), advisor (ask an advisor model and adopt its answer), council (convene a multi-model council), ask user (stop and ask the user)>"}.',
  ].join('\n\n'),
  classify: (reply) => {
    if (reply.invalid !== undefined) return `invalid reply "${reply.invalid}"`
    return actions.includes(reply.action) ? reply.action : `unknown action ${JSON.stringify(reply.action)}`
  },
  accepted: (scenario) => scenario.accept,
})
