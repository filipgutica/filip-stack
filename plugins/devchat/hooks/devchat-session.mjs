#!/usr/bin/env node

// SessionStart hook. It records the session's starting repository under the session key from
// stdin `session_id`, and refreshes the plugin path file the `devchat` shim reads. It prints
// nothing, opens no socket, and fails open: any error leaves the session to start normally, and
// the router then keeps that session's writes on this machine.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { recordSession, refreshPluginPath } from '../skills/devchat/scripts/devchat.mjs'

const pluginRoot = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/u, '')

const pluginVersion = () => {
  for (const manifest of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    try {
      return JSON.parse(readFileSync(`${pluginRoot}/${manifest}`, 'utf8')).version
    } catch {
      // Try the next harness's manifest; each install carries at least one.
    }
  }
  return 'unknown'
}

// Codex sets PLUGIN_ROOT for plugin hooks and Claude Code sets CLAUDE_PLUGIN_ROOT, as Field
// Guide's hook relies on. Without either the harness is unknown, so nothing is recorded.
const harness = () => (process.env.PLUGIN_ROOT ? 'codex' : process.env.CLAUDE_PLUGIN_ROOT ? 'claude' : null)

const run = (input) => {
  const current = harness()
  if (current && typeof input.session_id === 'string' && input.session_id && typeof input.cwd === 'string' && input.cwd) {
    // A subagent's hook carries an `agent_id` (Field Guide's isMainThread uses the same signal).
    const subagent = typeof input.agent_id === 'string' && input.agent_id.length > 0
    recordSession({ key: { harness: current, id: input.session_id }, cwd: input.cwd, source: input.source, subagent })
  }
  refreshPluginPath({ root: pluginRoot, version: pluginVersion() })
}

const skip = (error) => {
  // stderr only: SessionStart stdout would reach the model's context.
  process.stderr.write(`devchat session hook skipped: ${error.message}\n`)
  process.exit(0)
}

// Stay inside the harness's 5 s budget even if stdin never closes.
setTimeout(() => skip(new Error('stdin did not close within 3 s')), 3000).unref()

let stdin = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  stdin += chunk
})
process.stdin.on('end', () => {
  try {
    run(JSON.parse(stdin))
  } catch (error) {
    skip(error)
  }
})
process.stdin.on('error', skip)
