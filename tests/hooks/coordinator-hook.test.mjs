import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { runHook } from '../../plugins/filip-stack/scripts/coordinator-hook.mjs'

let testRoot = null

const createGitRepoRoot = async () => {
  testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-coordinator-hook-'))
  await mkdir(join(testRoot, '.git'))
  return testRoot
}

afterEach(async () => {
  if (testRoot !== null) {
    await rm(testRoot, { recursive: true, force: true })
    testRoot = null
  }
})

describe('coordinator hook', () => {
  it.each([
    ['claude'],
    ['codex'],
  ])('emits a workflow reminder for ordinary prompts in %s', async (host) => {
    const repoRoot = await createGitRepoRoot()

    const result = await runHook({
      host,
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'Refactor the install flow' },
      cwd: repoRoot,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain('bounded planning or exploration pass')
    expect(result.stdout.join('\n')).toContain('delegate bounded exploration or implementation to subagents by default')
    expect(result.stdout.join('\n')).toContain('use subagents for codebase exploration and adversarial review in Plan Mode')
    expect(result.stdout.join('\n')).toContain('coordination, approval, review, and synthesis')
    expect(result.stdout.join('\n')).toContain('For non-trivial engineering work')
  })

  it('stays quiet for reserved notes commands', async () => {
    const repoRoot = await createGitRepoRoot()

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'notes create: Track hook work' },
      cwd: repoRoot,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toEqual([])
  })

  it('does not duplicate an explicitly invoked coordinator skill', async () => {
    const repoRoot = await createGitRepoRoot()

    const result = await runHook({
      host: 'codex',
      event: 'UserPromptSubmit',
      payload: { cwd: repoRoot, prompt: 'Use $filip-stack:coordinator to plan this refactor' },
      cwd: repoRoot,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toEqual([])
  })
})
