import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { syncCodexHooks } from './sync.js'

let testRoot: string
let repoRoot: string
let homeDir: string

describe('syncCodexHooks', () => {
  beforeEach(async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-sync-test-'))
    repoRoot = join(testRoot, 'repo')
    homeDir = join(testRoot, 'home')

    await mkdir(join(repoRoot, 'plugins', 'project-notes', 'scripts'), { recursive: true })
    await writeFile(join(repoRoot, 'plugins', 'project-notes', 'scripts', 'project-notes-hook.mjs'), '#!/usr/bin/env node\n')
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('writes managed Codex hooks into hooks.json', async () => {
    await syncCodexHooks({
      repoRoot,
      homeDir,
      dryRun: false,
    })

    const hooks = await readFile(join(homeDir, '.codex/hooks.json'), 'utf8')
    expect(hooks).toContain('project-notes-hook.mjs')
    expect(hooks).toContain('codex UserPromptSubmit')
    expect(hooks).toContain('codex Stop')
  })

  it('preserves unrelated Codex hooks while updating managed entries', async () => {
    await mkdir(join(homeDir, '.codex'), { recursive: true })
    await writeFile(
      join(homeDir, '.codex/hooks.json'),
      JSON.stringify(
        {
          hooks: {
            UserPromptSubmit: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'echo custom-user-hook',
                  },
                  {
                    type: 'command',
                    command: 'node "/old/path/project-notes-hook.mjs" codex UserPromptSubmit',
                  },
                ],
              },
            ],
            Stop: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'echo custom-stop-hook',
                  },
                ],
              },
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'node "/old/path/project-notes-hook.mjs" codex Stop',
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
    )

    await syncCodexHooks({
      repoRoot,
      homeDir,
      dryRun: false,
    })

    const hooks = await readFile(join(homeDir, '.codex/hooks.json'), 'utf8')
    expect(hooks).toContain('echo custom-user-hook')
    expect(hooks).toContain('echo custom-stop-hook')
    expect(hooks).not.toContain('node "/old/path/project-notes-hook.mjs" codex UserPromptSubmit')
    expect(hooks).not.toContain('node "/old/path/project-notes-hook.mjs" codex Stop')
    expect(hooks).toContain('project-notes-hook.mjs')
    expect(hooks).toContain('codex UserPromptSubmit')
    expect(hooks).toContain('codex Stop')
  })

  it('does not write Codex hooks during dry-run', async () => {
    const actions = await syncCodexHooks({
      repoRoot,
      homeDir,
      dryRun: true,
    })

    expect(actions).toHaveLength(2)
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).rejects.toThrow()
  })
})
