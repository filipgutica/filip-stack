import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { syncGlobals } from './sync.js'

let testRoot: string
let repoRoot: string
let homeDir: string

describe('syncGlobals', () => {
  beforeEach(async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-sync-test-'))
    repoRoot = join(testRoot, 'repo')
    homeDir = join(testRoot, 'home')

    await mkdir(join(repoRoot, 'globals'), { recursive: true })
    await writeFile(join(repoRoot, 'globals/AGENTS.md'), 'repo agents')
    await writeFile(join(repoRoot, 'globals/CLAUDE.md'), 'repo claude')
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('syncs globals into codex and claude home locations', async () => {
    await syncGlobals({
      repoRoot,
      homeDir,
      dryRun: false,
    })

    await expect(readFile(join(homeDir, '.codex/AGENTS.md'), 'utf8')).resolves.toBe('repo agents')
    await expect(readFile(join(homeDir, '.claude/CLAUDE.md'), 'utf8')).resolves.toBe('repo claude')
  })

  it('does not write files during dry-run', async () => {
    const actions = await syncGlobals({
      repoRoot,
      homeDir,
      dryRun: true,
    })

    expect(actions).toHaveLength(4)
    await expect(readFile(join(homeDir, '.codex/AGENTS.md'), 'utf8')).rejects.toThrow()
  })
})
