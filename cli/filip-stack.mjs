#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const usage = `Usage: filip-stack [--repo <dir>] <command> [options]

Commands:
  status            Show the applied commit and each host-config target's state
  apply             Apply host config and import shared Field Guide preferences
  update            Pull the main checkout, apply host config, and sync preferences
  sync              Refresh this machine's guidance, installed skills, and plugins
  field-guide-sync  Import and export shared Field Guide preferences

Options:
  --repo <dir>      Source checkout (default: ~/code/filip-stack)
  --home <dir>      Target home directory (passed to the command)
  --force           Back up and overwrite local edits (apply and update only)
  --dry-run         Preview sync without changing installations
  --json            Print the sync result as JSON
  --help            Show this help
  --version         Show the CLI version
`

const fail = (message) => {
  process.stderr.write(`filip-stack: ${message}\n`)
  process.exit(1)
}

const args = process.argv.slice(2)
let repository = join(homedir(), 'code', 'filip-stack')
if (args[0] === '--repo') {
  if (!args[1] || args[1].startsWith('--')) fail('--repo requires a directory')
  repository = resolve(args[1])
  args.splice(0, 2)
}

if (args.length === 0 || args[0] === '--help') {
  process.stdout.write(usage)
} else if (args[0] === '--version') {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  process.stdout.write(`${version}\n`)
} else {
  const script = join(repository, 'scripts', args[0] === 'sync' ? 'sync.mjs' : 'host-config.mjs')
  if (args[0] === 'sync' && !existsSync(script) && existsSync(join(repository, 'scripts', 'host-config.mjs'))) {
    fail(`source checkout at ${repository} does not support sync; update its main branch`)
  }
  if (!existsSync(script)) fail(`no source checkout at ${repository}; clone filipgutica/filip-stack there or pass --repo <dir>`)
  const result = spawnSync(process.execPath, [script, ...(args[0] === 'sync' ? args.slice(1) : args)], { stdio: 'inherit' })
  if (result.error) fail(result.error.message)
  process.exit(result.status ?? 1)
}
