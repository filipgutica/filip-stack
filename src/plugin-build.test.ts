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

  it('builds self-contained Claude and Codex plugin roots', async () => {
    const repoRoot = process.cwd()
    testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-plugin-build-test-'))
    const outputRoot = join(testRoot, 'dist', 'plugins')
    const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')) as { version: string }

    const result = await buildPlugins({ repoRoot, outputRoot })

    const [
      claudeManifest,
      claudeHooks,
      codexManifest,
      codexHooks,
      claudeSkill,
      codexSkill,
      claudeMarketplace,
      claudeMarketplacePluginManifest,
      publishedMarketplace,
      publishedNoJekyll,
    ] = await Promise.all([
      readFile(join(result.claudeOutputRoot, '.claude-plugin', 'plugin.json'), 'utf8'),
      readFile(join(result.claudeOutputRoot, 'hooks', 'hooks.json'), 'utf8'),
      readFile(join(result.codexOutputRoot, '.codex-plugin', 'plugin.json'), 'utf8'),
      readFile(join(result.codexOutputRoot, 'hooks', 'hooks.json'), 'utf8'),
      readFile(join(result.claudeOutputRoot, 'skills', 'coordinator', 'SKILL.md'), 'utf8'),
      readFile(join(result.codexOutputRoot, 'skills', 'coordinator', 'SKILL.md'), 'utf8'),
      readFile(join(result.claudeMarketplaceRoot, '.claude-plugin', 'marketplace.json'), 'utf8'),
      readFile(join(result.claudeMarketplaceRoot, 'filip-stack', '.claude-plugin', 'plugin.json'), 'utf8'),
      readFile(join(result.claudePublishedMarketplaceRoot, 'marketplace.json'), 'utf8'),
      readFile(join(result.claudePublishedMarketplaceRoot, '.nojekyll'), 'utf8'),
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
    const parsedClaudeHooks = JSON.parse(claudeHooks) as {
      hooks: {
        UserPromptSubmit: Array<{
          hooks: Array<{
            type: string
            command: string
          }>
        }>
      }
    }

    expect(claudeManifest).toContain('"name": "filip-stack"')
    expect(claudeManifest).toContain(`"version": "${packageJson.version}"`)
    expect(parsedClaudeHooks.hooks.UserPromptSubmit).toHaveLength(2)
    expect(parsedClaudeHooks.hooks.UserPromptSubmit[0]?.hooks[0]?.command).toBe(
      'node "${CLAUDE_PLUGIN_ROOT}/scripts/coordinator-hook.mjs" claude UserPromptSubmit',
    )
    expect(parsedClaudeHooks.hooks.UserPromptSubmit[1]?.hooks[0]?.command).toBe(
      'node "${CLAUDE_PLUGIN_ROOT}/scripts/project-notes-hook.mjs" claude UserPromptSubmit',
    )
    expect(codexManifest).toContain('"name": "filip-stack"')
    expect(codexManifest).toContain(`"version": "${packageJson.version}"`)
    expect(parsedCodexHooks.hooks.UserPromptSubmit).toHaveLength(2)
    expect(parsedCodexHooks.hooks.UserPromptSubmit[0]?.hooks[0]?.command).toBe(
      `node "${join(result.codexOutputRoot, 'scripts', 'coordinator-hook.mjs')}" codex UserPromptSubmit`,
    )
    expect(parsedCodexHooks.hooks.UserPromptSubmit[1]?.hooks[0]?.command).toBe(
      `node "${join(result.codexOutputRoot, 'scripts', 'project-notes-hook.mjs')}" codex UserPromptSubmit`,
    )
    expect(claudeMarketplace).toContain('"name": "local-plugins"')
    expect(claudeMarketplace).toContain(`"version": "${packageJson.version}"`)
    expect(claudeMarketplace).toContain('"owner"')
    expect(claudeMarketplace).toContain('"source": "./filip-stack"')
    expect(claudeMarketplacePluginManifest).toContain('"name": "filip-stack"')
    expect(publishedMarketplace).toBe(claudeMarketplace)
    expect(publishedNoJekyll).toBe('')
    expect(claudeSkill).toContain('description:')
    expect(claudeSkill).not.toContain('name: coordinator')
    expect(codexSkill).toContain('name: coordinator')
  })
})
