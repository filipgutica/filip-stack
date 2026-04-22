import { homedir, userInfo } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import chalk from 'chalk'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

import { setupShellAlias } from './setup.js'
import { renderMarkdown } from './markdown.js'
import { syncCodexHooks, syncGlobals } from './sync.js'

export type RunCliOptions = {
  argv: string[]
  repoRoot?: string
  homeDir?: string
  log?: (message: string) => void
  error?: (message: string) => void
}

type ParsedArgs = {
  _: Array<string | number>
  globals?: boolean
  dryRun?: boolean
  rcFile?: string
  alias?: string
}

const repoRootFromDist = () => resolve(dirname(fileURLToPath(import.meta.url)), '..')

const parseArgs = async (argv: string[]): Promise<ParsedArgs> => {
  const parsed = await yargs(argv)
    .scriptName('filip-stack')
    .usage(
      [
        'Usage: filip-stack [--globals] [--dry-run]',
        '       filip-stack codex-hooks [--dry-run]',
        '       filip-stack setup [--rc-file ~/.zshrc] [--alias filip-stack] [--dry-run]',
      ].join('\n'),
    )
    .command('codex-hooks', 'Install or update the global Codex notes hooks')
    .command('setup', 'Add a shell alias so this CLI can be called from anywhere')
    .option('globals', {
      type: 'boolean',
      description: 'Sync global AGENTS.md and CLAUDE.md',
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

const hasSyncFlags = (parsed: ParsedArgs) => Boolean(parsed.globals)

export const runCli = async ({
  argv,
  repoRoot = repoRootFromDist(),
  homeDir = homedir(),
  log = console.log,
  error = console.error,
}: RunCliOptions): Promise<number> => {
  try {
    const parsed = await parseArgs(argv)
    const command = parsed._[0]

    if (command === 'setup') {
      if (hasSyncFlags(parsed)) {
        throw new Error('setup cannot be combined with sync scope flags')
      }

      await setupShellAlias({
        rcFile: resolve(expandHomePath(parsed.rcFile ?? defaultRcFile(homeDir), homeDir)),
        aliasName: parsed.alias ?? 'filip-stack',
        commandPath: `node ${resolve(repoRoot, 'dist/cli.js')}`,
        dryRun: Boolean(parsed.dryRun),
        log: (message) => log(chalk.cyan(message)),
      })

      return 0
    }

    if (command === 'codex-hooks') {
      if (hasSyncFlags(parsed)) {
        throw new Error('codex-hooks cannot be combined with sync scope flags')
      }
      if (parsed.rcFile !== undefined || parsed.alias !== undefined) {
        throw new Error('--rc-file and --alias can only be used with setup')
      }

      const actions = await syncCodexHooks({
        repoRoot,
        homeDir,
        dryRun: Boolean(parsed.dryRun),
      })

      if (parsed.dryRun) {
        log(
          renderMarkdown(
            [
              '# Dry Run',
              '',
              'No files were changed. Selected scope: Codex Hooks.',
              '',
              '## Codex Hooks',
              '- Source: `plugins/filip-stack/scripts/project-notes-hook.mjs`',
              '- Destination: `~/.codex/hooks.json`',
              `- Planned actions: ${actions.length}`,
            ].join('\n'),
          ),
        )
      } else {
        log(
          renderMarkdown(
            [
              '# Sync Complete',
              '',
              'Synced Codex Hooks.',
              '',
              '## Codex Hooks',
              '- Updated: `~/.codex/hooks.json`',
            ].join('\n'),
          ),
        )
      }

      return 0
    }

    if (command !== undefined) {
      throw new Error(`Unknown command: ${String(command)}`)
    }

    if (parsed.rcFile !== undefined || parsed.alias !== undefined) {
      throw new Error('--rc-file and --alias can only be used with setup')
    }

    const actions = await syncGlobals({
      repoRoot,
      homeDir,
      dryRun: Boolean(parsed.dryRun),
    })

    if (parsed.dryRun) {
      log(
        renderMarkdown(
          [
            '# Dry Run',
            '',
            'No files were changed. Selected scope: Globals.',
            '',
            '## Globals',
            '- Source: `globals/`',
            '- Destinations: `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`',
            `- Planned actions: ${actions.length}`,
          ].join('\n'),
        ),
      )
    } else {
      log(
        renderMarkdown(
          ['# Sync Complete', '', 'Synced Globals.', '', '## Globals', '- Updated: `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`'].join('\n'),
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
