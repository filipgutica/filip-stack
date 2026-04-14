import { homedir, userInfo } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import chalk from 'chalk'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

import { setupShellAlias } from './setup.js'
import { renderMarkdown } from './markdown.js'
import { syncGlobals } from './sync.js'
import { installPlugins, updatePlugins, type InstallTarget } from './install.js'

export type RunCliOptions = {
  argv: string[]
  repoRoot?: string
  homeDir?: string
  log?: (message: string) => void
  error?: (message: string) => void
  installCodexPlugin?: Parameters<typeof installPlugins>[0]['installCodexPlugin']
}

type ParsedArgs = {
  _: Array<string | number>
  globals?: boolean
  dryRun?: boolean
  rcFile?: string
  alias?: string
  target?: string
}

const repoRootFromDist = () => resolve(dirname(fileURLToPath(import.meta.url)), '..')

const parseArgs = async (argv: string[]): Promise<ParsedArgs> => {
  const parsed = await yargs(argv)
    .scriptName('./bin/filip-stack')
    .usage(
      [
        'Usage: ./bin/filip-stack [--globals] [--dry-run]',
        '       ./bin/filip-stack setup [--rc-file ~/.zshrc] [--alias filip-stack] [--dry-run]',
        '       ./bin/filip-stack install <claude|codex|all>  # local dev/recovery install helpers',
        '       ./bin/filip-stack update <claude|codex|all>   # refresh local host state after plugin changes',
      ].join('\n'),
    )
    .command('setup', 'Add a shell alias so this CLI can be called from anywhere')
    .command('install <target>', 'Run local plugin install helpers for Claude, Codex, or both')
    .command('update <target>', 'Rebuild plugin artifacts and refresh local host state')
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
const parseInstallTarget = (value: unknown): InstallTarget => {
  if (value === 'claude' || value === 'codex' || value === 'all') return value
  throw new Error('target must be one of: claude, codex, all')
}
const installSummaryLines = (target: InstallTarget) => {
  if (target === 'claude') {
    return [
      '# Plugin Install Complete',
      '',
      'Installed Claude local development plugin configuration.',
      '',
      '- Rebuild with `pnpm build` after plugin source changes.',
      '- This is the local convenience path; hosted marketplace install remains the preferred long-term Claude flow.',
    ]
  }

  if (target === 'codex') {
    return [
      '# Plugin Install Complete',
      '',
      'Installed Codex local plugin bridge configuration.',
      '',
      '- Rebuild with `pnpm build` after plugin source changes.',
      '- Codex local marketplace/config now point at the installed home-local plugin copy.',
    ]
  }

  return [
    '# Plugin Install Complete',
    '',
    'Installed Claude local development and Codex bridge configuration.',
    '',
    '- Rebuild with `pnpm build` after plugin source changes.',
    '- Claude local install is the development/recovery path; hosted marketplace distribution is the preferred long-term path.',
    '- Codex local marketplace/config now point at the installed home-local plugin copy.',
  ]
}

const updateSummaryLines = (target: InstallTarget) => {
  if (target === 'claude') {
    return [
      '# Plugin Update Complete',
      '',
      'Updated Claude local development plugin configuration.',
      '',
      '- Restart Claude or reload plugins if it has an active cached plugin session.',
    ]
  }

  if (target === 'codex') {
    return [
      '# Plugin Update Complete',
      '',
      'Updated Codex local plugin bridge configuration.',
      '',
      '- Restart Codex if it has an active cached plugin session.',
    ]
  }

  return [
    '# Plugin Update Complete',
    '',
    'Updated Claude local development and Codex bridge configuration.',
    '',
    '- Restart the hosts or reload plugins if they have active cached plugin sessions.',
  ]
}

export const runCli = async ({
  argv,
  repoRoot = repoRootFromDist(),
  homeDir = homedir(),
  log = console.log,
  error = console.error,
  installCodexPlugin,
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
        commandPath: resolve(repoRoot, 'bin/filip-stack'),
        dryRun: Boolean(parsed.dryRun),
        log: (message) => log(chalk.cyan(message)),
      })

      return 0
    }

    if (command === 'install' || command === 'update') {
      if (hasSyncFlags(parsed)) {
        throw new Error(`${command} cannot be combined with sync scope flags`)
      }
      if (parsed.rcFile !== undefined || parsed.alias !== undefined) {
        throw new Error('--rc-file and --alias can only be used with setup')
      }

      const target = parseInstallTarget(parsed.target)

      if (command === 'install') {
        await installPlugins({ repoRoot, homeDir, target, installCodexPlugin })
        log(renderMarkdown(installSummaryLines(target).join('\n')))
      } else {
        await updatePlugins({ repoRoot, homeDir, target, installCodexPlugin })
        log(renderMarkdown(updateSummaryLines(target).join('\n')))
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
