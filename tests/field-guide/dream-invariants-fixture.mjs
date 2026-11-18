// fallow-ignore-file unused-file, unused-export -- loaded by the opt-in Field Guide invariant suite
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cliAt } from './older-cli.mjs'
import { fieldGuideSkillRoot } from './plugin-paths.mjs'

const cli = fileURLToPath(new URL('scripts/field-guide.mjs', fieldGuideSkillRoot))
const dream = fileURLToPath(new URL('scripts/field-guide-dream.mjs', fieldGuideSkillRoot))
const preload = new URL('./dream-fault-preload.mjs', import.meta.url).href
const released = () => cliAt('c067c9143cf388a7dae102d4871e7d846c51ba19')
const hook = `
const [cli, guideRoot, prompt] = process.argv.slice(2)
const { confirmFromPrompt } = await import(cli)
console.log(JSON.stringify(confirmFromPrompt({ guideRoot, prompt, mainThread: true, host: 'claude' })))
`

export const write = (path, data) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

const files = (root) => Object.fromEntries(readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map(({ name, parentPath }) => [join(parentPath, name).slice(root.length + 1), readFileSync(join(parentPath, name))]))

export const durable = (snapshot) => Object.fromEntries(Object.entries(snapshot)
  .filter(([name]) => !/^memory\.lock(?:\.|$)/u.test(name)))

export const journalOf = (snapshot) => (snapshot['operations.jsonl']?.toString() ?? '')
  .split('\n').slice(0, -1).filter(Boolean).map((line) => {
    try { return JSON.parse(line) } catch { return null }
  }).filter(Boolean)

export const memoryOf = (snapshot) => {
  const markdown = snapshot['memory.md'].toString()
  return JSON.parse(markdown.slice(markdown.lastIndexOf('```json\n') + 8, markdown.lastIndexOf('\n```')))
}

export const proposalsOf = (snapshot) => {
  try { return JSON.parse(snapshot['proposals.json']?.toString() ?? '{}').proposals ?? [] } catch { return [] }
}

export const requireResult = (result) => {
  assert.equal(result.status, 0, result.error)
  return result.json
}

const install = ({ home, host, old }) => {
  const current = old ? '6.15.0' : '99.0.0'
  const claude = join(home, 'claude-copy', current)
  const codex = join(home, '.codex/plugins/cache/test/field-guide', current)
  const copy = host === 'claude' ? claude : codex
  write(join(copy, 'skills/field-guide/schemas/memory-v2.schema.json'), '{}\n')
  if (!old) write(join(copy, 'skills/field-guide/schemas/dream-apply-v1.schema.json'), '{}\n')
  if (host === 'claude') {
    write(join(home, '.claude/plugins/installed_plugins.json'), JSON.stringify({
      version: 2, plugins: { 'field-guide@test': [{ scope: 'user', installPath: copy, version: current }] },
    }))
  } else {
    write(join(home, '.codex/config.toml'), '[plugins."field-guide@test"]\nenabled = true\n')
  }
}

export const fixture = ({ t, origin = 'git@github.com:example/guide-fixture.git' }) => {
  const root = mkdtempSync(join(tmpdir(), 'field-guide-invariants-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const home = join(root, 'home')
  const repo = join(root, 'repo')
  const store = join(root, 'guide')
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' })
  mkdirSync(repo)
  git('init', '--quiet')
  git('-c', 'user.name=Guide Fixture', '-c', 'user.email=guide@example.test',
    '-c', 'core.hooksPath=/dev/null', 'commit', '--allow-empty', '-qm', 'test: seed fixture')
  git('remote', 'add', 'origin', origin)
  const liveFiles = {
    [join(home, '.claude/CLAUDE.md')]: '# Rules\n\nClean up after a merge.\n',
    [join(home, '.agents/AGENTS.md')]: '# Instructions\n\nKeep project guidance concise.\n',
    [join(home, '.agents/skills/fixture/SKILL.md')]: '---\nname: fixture\ndescription: Test fixture.\n---\n\nKeep both records when uncertain.\n',
    [join(repo, 'AGENTS.md')]: '# Project instructions\n',
    [join(repo, 'CLAUDE.md')]: '# Project rules\n',
    [join(repo, '.agents/skills/local/SKILL.md')]: '# Local skill\n',
  }
  for (const [path, content] of Object.entries(liveFiles)) write(path, content)
  const env = { ...process.env, HOME: home, CODEX_HOME: join(home, '.codex'), CLAUDE_CONFIG_DIR: join(home, '.claude'), T3CODE_THREAD_ID: undefined }
  let inputCount = 0
  const run = ({ command, args = [], use = 'cli', at = store, fault } = {}) => {
    const executable = use === 'dream' ? dream : use === 'released' ? released() : cli
    const argv = use === 'hook' || use === 'released-hook'
      ? ['--input-type=module', '--eval', hook, 'field-guide-test-hook', use === 'released-hook' ? released() : cli, at, ...args]
      : [executable, command, '--repo-root', repo, '--guide-root', at, ...args]
    const prefix = fault ? ['--import', preload] : []
    const invoked = spawnSync(process.execPath, [...prefix, ...argv], {
      cwd: repo, encoding: 'utf8', timeout: 10_000,
      env: { ...env, FG_FAULT_ROOT: fault && at, FG_CRASH_AFTER: fault?.crash, FG_DENY_JOURNAL: fault?.deny, FG_CLOCK: fault?.clock },
    })
    assert.ifError(invoked.error)
    return {
      status: invoked.status,
      error: invoked.stderr.replace(/^FG_WRITE .*\n/gmu, '').trim(),
      writes: [...invoked.stderr.matchAll(/^FG_WRITE \d+ (\w+ .+)$/gmu)].map((match) => match[1]),
      json: invoked.stdout.trim() && invoked.status === 0 ? JSON.parse(invoked.stdout) : null,
    }
  }
  const input = (value) => {
    const path = join(root, `input-${++inputCount}.json`)
    write(path, JSON.stringify(value))
    return ['--input', path]
  }
  const snapshot = () => files(store)
  // A copy of a snapshot in its own folder, for a reader that must not touch the store.
  const copyOf = (saved) => {
    const at = join(root, 'snapshot-store')
    rmSync(at, { recursive: true, force: true })
    for (const [file, contents] of Object.entries(saved)) write(join(at, file), contents)
    for (const folder of initializedDirs) mkdirSync(join(at, folder), { recursive: true })
    return at
  }
  const restore = (saved) => {
    rmSync(store, { recursive: true, force: true })
    for (const [file, contents] of Object.entries(saved)) write(join(store, file), contents)
    for (const folder of initializedDirs) mkdirSync(join(store, folder), { recursive: true })
  }
  const checkUndo = (operationId, { old, gate, clock } = {}) => {
    const at = join(root, 'undo-store')
    rmSync(at, { recursive: true, force: true })
    cpSync(store, at, { recursive: true })
    if (gate) install({ home, host: 'codex', old: true })
    try {
      const before = durable(files(at))
      const result = run({ command: 'undo-operation', args: ['--id', operationId], at, fault: clock ? { clock } : undefined })
      return { result, before, after: durable(files(at)), reader: old({ at }) }
    } finally {
      if (gate) rmSync(join(home, '.codex'), { recursive: true, force: true })
    }
  }
  requireResult(run({ command: 'init' }))
  const initializedDirs = readdirSync(store, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name, parentPath }) => join(parentPath, name).slice(store.length + 1))
  return {
    root, home, store, run, input, snapshot, copyOf, restore, checkUndo,
    outside: () => Object.fromEntries(Object.keys(liveFiles).map((path) => [path, readFileSync(path)])),
    install: (options) => install({ home, ...options }),
    clearReaders: () => {
      rmSync(join(home, '.codex'), { recursive: true, force: true })
      rmSync(join(home, '.claude/plugins'), { recursive: true, force: true })
    },
    changeLive: () => write(join(home, '.claude/CLAUDE.md'), '# Rules\n\nClean up after a merge. Keep this rule under review.\n'),
    capture: ({ name, scope = 'project', key = 'worktrees', learning = `After a merge, clean up worktrees for ${name}.`, relationship, linkedSubjects }) => requireResult(run({
      command: 'submit',
      args: input({
        schemaVersion: 1, decision: 'capture', confidence: 'high', explicitPreference: true,
        scope, subjectKey: key, learning, relationship, linkedSubjects,
        evidence: { summary: 'The user stated a fixture preference.', pointers: [{ kind: 'conversation', client: 'codex', threadId: 'fixture', turnId: name }] },
      }),
    })).result.targetId,
    plan: (fault) => run({ command: 'plan', use: 'dream', fault }),
    apply: ({ review, token, fault = {} }) => run({
      use: 'dream', command: 'apply', args: [...input(review), ...(token ? ['--preview-token', token] : [])], fault,
    }),
    confirm: (prompt, use = 'hook') => run({ use, args: [prompt] }),
    oldExport: () => run({ use: 'released', command: 'export', args: ['--output', join(root, 'released-export.json')] }),
  }
}
