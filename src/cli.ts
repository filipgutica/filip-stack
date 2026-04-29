import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { syncCodexHooks } from './sync.js'

export type RunCliOptions = {
  argv: string[]
  repoRoot?: string
  homeDir?: string
  log?: (message: string) => void
  error?: (message: string) => void
}

const repoRootFromDist = () => resolve(dirname(fileURLToPath(import.meta.url)), '..')

const help = [
  'Usage: filip-stack codex-hooks [--dry-run]',
  '',
  'Commands:',
  '  codex-hooks    Install or update the global Codex notes hooks',
  '',
  'Options:',
  '  --dry-run      Print planned changes without writing',
  '  -h, --help     Show help',
].join('\n')

export const runCli = async ({
  argv,
  repoRoot = repoRootFromDist(),
  homeDir = homedir(),
  log = console.log,
  error = console.error,
}: RunCliOptions): Promise<number> => {
  try {
    const [command, ...args] = argv

    if (command === '-h' || command === '--help') {
      log(help)
      return 0
    }

    if (command !== 'codex-hooks') {
      throw new Error(command === undefined ? help : `Unknown command: ${command}`)
    }

    const dryRun = args.includes('--dry-run')
    const unknownOption = args.find((arg) => arg !== '--dry-run')
    if (unknownOption !== undefined) {
      throw new Error(`Unknown option for codex-hooks: ${unknownOption}`)
    }

    const actions = await syncCodexHooks({
      repoRoot,
      homeDir,
      dryRun,
    })

    if (dryRun) {
      log(
        [
          'Dry Run',
          'No files were changed. Selected scope: Codex Hooks.',
          'Codex Hooks',
          'Source: plugins/filip-stack/scripts/project-notes-hook.mjs',
          'Destination: ~/.codex/hooks.json',
          `Planned actions: ${actions.length}`,
        ].join('\n'),
      )
    } else {
      log('Synced Codex Hooks.\nUpdated: ~/.codex/hooks.json')
    }

    return 0
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
    error(message)
    return 2
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli({ argv: process.argv.slice(2) })
}
