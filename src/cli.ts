import { homedir, userInfo } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import chalk from 'chalk'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

import { DEFAULT_SCOPES, resolveScopes, type Scope } from './scopes.js'
import { setupShellAlias } from './setup.js'
import { formatDryRun, formatSyncSummary } from './output.js'
import { renderMarkdown } from './markdown.js'
import { runSync, type RunSyncResult } from './run.js'
import { runInkApp as defaultRunInkApp } from './tty/run-ink.js'

export type RunCliOptions = {
  argv: string[]
  repoRoot?: string
  homeDir?: string
  isTty?: boolean
  runInkApp?: (options: {
    repoRoot: string
    homeDir: string
    runSync: (options: { scopes: Scope[]; dryRun: boolean }) => Promise<RunSyncResult>
  }) => Promise<number>
  log?: (message: string) => void
  error?: (message: string) => void
}

type ParsedArgs = {
  _: Array<string | number>
  skills?: boolean
  hooks?: boolean
  globals?: boolean
  all?: boolean
  dryRun?: boolean
  rcFile?: string
  alias?: string
}

const repoRootFromDist = () => resolve(dirname(fileURLToPath(import.meta.url)), '..')

const parseArgs = async (argv: string[]): Promise<ParsedArgs> => {
  const parsed = await yargs(argv)
    .scriptName('./bin/filip-stack')
    .usage(
      [
        'Usage: ./bin/filip-stack [--skills] [--hooks] [--globals] [--all] [--dry-run]',
        '       ./bin/filip-stack setup [--rc-file ~/.zshrc] [--alias filip-stack] [--dry-run]',
      ].join('\n'),
    )
    .command('setup', 'Add a shell alias so this CLI can be called from anywhere')
    .option('skills', {
      type: 'boolean',
      description: 'Sync shared skills',
    })
    .option('hooks', {
      type: 'boolean',
      description: 'Sync Claude and Codex hooks',
    })
    .option('globals', {
      type: 'boolean',
      description: 'Sync global AGENTS.md and CLAUDE.md',
    })
    .option('all', {
      type: 'boolean',
      description: 'Sync skills, hooks, and globals',
    })
    .option('dry-run', {
      type: 'boolean',
      description: 'Print planned changes without writing',
    })
    .option('rc-file', {
      type: 'string',
      description: 'Shell rc file to update for setup',
    })
    .option('alias', {
      type: 'string',
      description: 'Alias name to create during setup',
    })
    .alias('h', 'help')
    .strict()
    .fail((message, error) => {
      throw error ?? new Error(message)
    })
    .parseAsync()

  return parsed
}
const defaultRcFile = (homeDir: string): string => {
  const shell = process.env.SHELL ?? userInfo().shell ?? ''

  if (shell.endsWith('/bash')) return resolve(homeDir, '.bashrc')
  return resolve(homeDir, '.zshrc')
}

const expandHomePath = (path: string, homeDir: string): string => {
  if (path === '~') return homeDir
  if (path.startsWith('~/')) return resolve(homeDir, path.slice(2))
  return path
}

const hasSyncFlags = (parsed: ParsedArgs) =>
  Boolean(parsed.all || parsed.skills || parsed.hooks || parsed.globals)

export const runCli = async ({
  argv,
  repoRoot = repoRootFromDist(),
  homeDir = homedir(),
  isTty = Boolean(process.stdout.isTTY),
  runInkApp = defaultRunInkApp,
  log = console.log,
  error = console.error,
}: RunCliOptions): Promise<number> => {
  try {
    if (argv.length === 0 && isTty) {
      return runInkApp({
        repoRoot,
        homeDir,
        runSync: ({ scopes, dryRun }) => runSync({ repoRoot, homeDir, scopes, dryRun }),
      })
    }

    const parsed = await parseArgs(argv)
    const command = parsed._[0]

    if (command === 'setup') {
      if (hasSyncFlags(parsed)) {
        throw new Error('setup cannot be combined with sync scope flags')
      }

      await setupShellAlias({
        rcFile: resolve(expandHomePath(parsed.rcFile ?? defaultRcFile(homeDir), homeDir)),
        aliasName: parsed.alias ?? 'filip-stack',
        commandPath: resolve(repoRoot, 'bin/filip-stack'),
        dryRun: Boolean(parsed.dryRun),
        log: (message) => log(chalk.cyan(message)),
      })

      return 0
    }

    if (command !== undefined) {
      throw new Error(`Unknown command: ${String(command)}`)
    }

    if (parsed.rcFile !== undefined || parsed.alias !== undefined) {
      throw new Error('--rc-file and --alias can only be used with setup')
    }

    const scopes = resolveScopes({
      all: parsed.all,
      skills: parsed.skills,
      hooks: parsed.hooks,
      globals: parsed.globals,
    })

    const result = await runSync({
      repoRoot,
      homeDir,
      scopes,
      dryRun: Boolean(parsed.dryRun),
    })

    if (parsed.dryRun) {
      log(renderMarkdown(formatDryRun({ actions: result.actions, scopes: result.scopes, repoRoot, homeDir })))
    } else {
      log(
        renderMarkdown(
          formatSyncSummary({
            actions: result.actions,
            scopes: result.scopes,
            repoRoot,
            homeDir,
          }),
        ),
      )
    }

    return 0
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
    error(chalk.red(message))
    return 2
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli({ argv: hideBin(process.argv) })
}
