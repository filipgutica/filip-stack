#!/usr/bin/env node
// Builds one guidance version for a PluginBench treatment from a filip-stack source tree:
//   <out>/AGENTS.md  the Codex host-config render, with the ~/.agents files it points to inlined
//   <out>/workflow/  a full copy of plugins/workflow
// The source tree's own scripts/host-config.mjs renders the guidance, so every version uses its own renderer.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const usage = 'Usage: build-version.mjs --source <filip-stack tree> --out <directory>'
const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}
const source = option('--source')
const out = option('--out')
if (!source || !out) {
  process.stderr.write(`${usage}\n`)
  process.exit(1)
}

const blockStart = '<!-- filip-stack:host-config:begin'
const blockEnd = '<!-- filip-stack:host-config:end -->'
// Files the rendered guidance points to by path. They do not exist inside a PluginBench container.
const inlined = ['CODING_STANDARDS.md', 'roles.md']

const scratch = mkdtempSync(join(tmpdir(), 'egc-version-'))
try {
  const home = join(scratch, 'home')
  const applied = spawnSync(process.execPath, [join(resolve(source), 'scripts', 'host-config.mjs'), 'apply', '--home', home], {
    encoding: 'utf8',
    // An empty config directory keeps the machine's Field Guide preferences out of the version.
    env: { ...process.env, XDG_CONFIG_HOME: join(scratch, 'config') },
  })
  if (applied.status !== 0) throw new Error(`host-config apply failed: ${applied.stderr.trim()}`)

  const rendered = readFileSync(join(home, '.codex', 'AGENTS.md'), 'utf8')
  const start = rendered.indexOf('\n', rendered.indexOf(blockStart)) + 1
  const guidance = rendered.slice(start, rendered.indexOf(blockEnd)).trimEnd()
  const appendix = inlined.map((name) => (
    `## Contents of ~/.agents/${name}\n\n${readFileSync(join(home, '.agents', name), 'utf8').trimEnd()}`
  ))
  const text = [guidance, ...appendix].join('\n\n').replaceAll(home, '~')

  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'AGENTS.md'), `${text}\n`)
  cpSync(join(resolve(source), 'plugins', 'workflow'), join(out, 'workflow'), { recursive: true })
  process.stdout.write(`built ${out} (${Buffer.byteLength(text)} guidance bytes)\n`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
