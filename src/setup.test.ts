import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setupShellAlias } from './setup.js'

let testRoot: string
let rcFile: string

describe('setupShellAlias', () => {
  beforeEach(async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-setup-test-'))
    rcFile = join(testRoot, '.zshrc')
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('creates an rc file with an alias entry', async () => {
    await setupShellAlias({
      rcFile,
      aliasName: 'filip-stack',
      commandPath: 'node /repo/dist/cli.js',
      dryRun: false,
      log: () => {},
    })

    await expect(readFile(rcFile, 'utf8')).resolves.toContain('alias filip-stack="node /repo/dist/cli.js"')
  })

  it('is idempotent for the same alias marker', async () => {
    await setupShellAlias({
      rcFile,
      aliasName: 'filip-stack',
      commandPath: 'node /repo/dist/cli.js',
      dryRun: false,
      log: () => {},
    })
    await setupShellAlias({
      rcFile,
      aliasName: 'filip-stack',
      commandPath: 'node /repo/dist/cli.js',
      dryRun: false,
      log: () => {},
    })

    const content = await readFile(rcFile, 'utf8')
    expect(content.match(/alias filip-stack=/g)).toHaveLength(1)
  })

  it('does not write during dry-run', async () => {
    const messages: string[] = []

    await setupShellAlias({
      rcFile,
      aliasName: 'filip-stack',
      commandPath: 'node /repo/dist/cli.js',
      dryRun: true,
      log: (message) => messages.push(message),
    })

    expect(existsSync(rcFile)).toBe(false)
    expect(messages).toContain('would append alias to ' + rcFile + ': filip-stack -> node /repo/dist/cli.js')
  })

  it('preserves existing rc file content', async () => {
    await writeFile(rcFile, 'export TEST=true\n')

    await setupShellAlias({
      rcFile,
      aliasName: 'filip-stack',
      commandPath: 'node /repo/dist/cli.js',
      dryRun: false,
      log: () => {},
    })

    await expect(readFile(rcFile, 'utf8')).resolves.toContain('export TEST=true\n')
  })

  it('rejects invalid alias names', async () => {
    await expect(
      setupShellAlias({
        rcFile,
        aliasName: 'bad alias',
        commandPath: 'node /repo/dist/cli.js',
        dryRun: false,
        log: () => {},
      }),
    ).rejects.toThrow('Invalid alias name: bad alias')
  })
})
