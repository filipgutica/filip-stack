import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { buildPlugins } from './plugin-build.js'

let testRoot = ''

describe('buildPlugins', () => {
  afterEach(async () => {
    if (testRoot.length > 0) {
      await rm(testRoot, { recursive: true, force: true })
      testRoot = ''
    }
  })

  it('builds a self-contained Codex plugin root', async () => {
    const repoRoot = process.cwd()
    testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-plugin-build-test-'))
    const outputRoot = join(testRoot, 'dist', 'plugins')
    const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')) as { version: string }

    const result = await buildPlugins({ repoRoot, outputRoot })

    const [codexManifest, codexHooks, codexSkill] = await Promise.all([
      readFile(join(result.codexOutputRoot, '.codex-plugin', 'plugin.json'), 'utf8'),
      readFile(join(result.codexOutputRoot, 'hooks', 'hooks.json'), 'utf8'),
      readFile(join(result.codexOutputRoot, 'skills', 'coordinator', 'SKILL.md'), 'utf8'),
    ])

    const parsedCodexHooks = JSON.parse(codexHooks) as {
      hooks: {
        UserPromptSubmit: Array<{
          hooks: Array<{
            type: string
            command: string
          }>
        }>
      }
    }

    expect(codexManifest).toContain('"name": "filip-stack"')
    expect(codexManifest).toContain(`"version": "${packageJson.version}"`)
    expect(parsedCodexHooks.hooks.UserPromptSubmit).toHaveLength(2)
    expect(parsedCodexHooks.hooks.UserPromptSubmit[0]?.hooks[0]?.command).toBe(
      `node "${join(result.codexOutputRoot, 'scripts', 'coordinator-hook.mjs')}" codex UserPromptSubmit`,
    )
    expect(parsedCodexHooks.hooks.UserPromptSubmit[1]?.hooks[0]?.command).toBe(
      `node "${join(result.codexOutputRoot, 'scripts', 'project-notes-hook.mjs')}" codex UserPromptSubmit`,
    )
    expect(codexSkill).toContain('name: coordinator')
    expect(codexSkill).toContain('description:')
  })
})
