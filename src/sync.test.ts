import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { syncSetup } from './sync.js'

let testRoot: string
let repoRoot: string
let homeDir: string
let manifestPath: string

const readRepoHookFragment = async (path: string) => readFile(join(process.cwd(), path), 'utf8')

const writeFixture = async (path: string, content: string) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

const createRepoFixture = async () => {
  await writeFixture(join(repoRoot, 'skills/reviewer/SKILL.md'), 'repo reviewer')
  await writeFixture(join(repoRoot, 'skills/reviewer/agents/openai.yaml'), 'agent config')
  await writeFixture(join(repoRoot, 'skills/implementer/SKILL.md'), 'repo implementer')
  await writeFixture(join(repoRoot, 'hooks/shared/project-notes-hook.mjs'), 'shared hook')
  await writeFixture(join(repoRoot, 'hooks/codex/hooks.json'), await readRepoHookFragment('hooks/codex/hooks.json'))
  await writeFixture(join(repoRoot, 'hooks/codex/scripts/.gitkeep'), '')
  await writeFixture(join(repoRoot, 'hooks/claude/hooks.json'), await readRepoHookFragment('hooks/claude/hooks.json'))
  await writeFixture(join(repoRoot, 'hooks/claude/scripts/.gitkeep'), '')
  await writeFixture(join(repoRoot, 'globals/AGENTS.md'), 'repo agents')
  await writeFixture(join(repoRoot, 'globals/CLAUDE.md'), 'repo claude')
}

describe('syncSetup', () => {
  beforeEach(async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-sync-test-'))
    repoRoot = join(testRoot, 'repo')
    homeDir = join(testRoot, 'home')
    manifestPath = join(homeDir, '.filip-stack/sync-manifest.json')
    await createRepoFixture()
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('syncs skills and hooks by default without globals', async () => {
    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['skills', 'hooks'],
      dryRun: false,
    })

    await expect(readFile(join(homeDir, '.agents/skills/reviewer/SKILL.md'), 'utf8')).resolves.toBe(
      'repo reviewer',
    )
    await expect(readFile(join(homeDir, '.codex/hooks/project-notes-hook.mjs'), 'utf8')).resolves.toBe(
      'shared hook',
    )
    await expect(readFile(join(homeDir, '.claude/hooks/project-notes-hook.mjs'), 'utf8')).resolves.toBe(
      'shared hook',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.toContain('SessionStart')
    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      'UserPromptSubmit',
    )
    await expect(readFile(join(homeDir, '.codex/config.toml'), 'utf8')).resolves.toContain(
      'codex_hooks = true',
    )
    expect(existsSync(join(homeDir, '.codex/AGENTS.md'))).toBe(false)
    expect(existsSync(join(homeDir, '.claude/CLAUDE.md'))).toBe(false)
  })

  it('syncs only globals when requested', async () => {
    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['globals'],
      dryRun: false,
    })

    await expect(readFile(join(homeDir, '.codex/AGENTS.md'), 'utf8')).resolves.toBe('repo agents')
    await expect(readFile(join(homeDir, '.claude/CLAUDE.md'), 'utf8')).resolves.toBe('repo claude')
    expect(existsSync(join(homeDir, '.agents/skills/reviewer/SKILL.md'))).toBe(false)
  })

  it('syncs all scopes when requested', async () => {
    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['skills', 'hooks', 'globals'],
      dryRun: false,
    })

    expect(existsSync(join(homeDir, '.agents/skills/reviewer/SKILL.md'))).toBe(true)
    expect(existsSync(join(homeDir, '.codex/hooks.json'))).toBe(true)
    expect(existsSync(join(homeDir, '.claude/settings.json'))).toBe(true)
    expect(existsSync(join(homeDir, '.codex/config.toml'))).toBe(true)
    expect(existsSync(join(homeDir, '.codex/AGENTS.md'))).toBe(true)
    expect(existsSync(join(homeDir, '.claude/CLAUDE.md'))).toBe(true)
  })

  it('does not copy gitkeep placeholders', async () => {
    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['hooks'],
      dryRun: false,
    })

    expect(existsSync(join(homeDir, '.codex/hooks/.gitkeep'))).toBe(false)
    expect(existsSync(join(homeDir, '.claude/hooks/.gitkeep'))).toBe(false)
  })

  it('merges hook configs and preserves unrelated local settings', async () => {
    await writeFixture(
      join(homeDir, '.claude/settings.json'),
      JSON.stringify(
        {
          model: 'opus',
          hooks: {
            SessionStart: [{ hooks: [{ type: 'command', command: 'existing-claude-hook' }] }],
          },
        },
        null,
        2,
      ),
    )
    await writeFixture(
      join(homeDir, '.codex/hooks.json'),
      JSON.stringify(
        {
          hooks: {
            Notification: [{ hooks: [{ type: 'command', command: 'existing-codex-hook' }] }],
          },
        },
        null,
        2,
      ),
    )
    await writeFixture(
      join(homeDir, '.codex/config.toml'),
      '[features]\nprevent_idle_sleep = true\n\n[projects."/tmp/project"]\ntrust_level = "trusted"\n',
    )

    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['hooks'],
      dryRun: false,
    })

    const [claudeSettings, codexHooks, codexConfig] = await Promise.all([
      readFile(join(homeDir, '.claude/settings.json'), 'utf8'),
      readFile(join(homeDir, '.codex/hooks.json'), 'utf8'),
      readFile(join(homeDir, '.codex/config.toml'), 'utf8'),
    ])

    expect(claudeSettings).toContain('"model": "opus"')
    expect(claudeSettings).toContain('SessionStart')
    expect(claudeSettings).toContain('UserPromptSubmit')
    expect(claudeSettings).toContain('existing-claude-hook')
    expect(codexHooks).toContain('Notification')
    expect(codexHooks).toContain('existing-codex-hook')
    expect(codexHooks).toContain('UserPromptSubmit')
    expect(codexConfig).toContain('codex_hooks = true')
    expect(codexConfig).toContain('prevent_idle_sleep = true')
    expect(codexConfig).toContain('trust_level = "trusted"')
  })

  it('adds Claude hooks to settings files that do not already define hooks', async () => {
    await writeFixture(join(homeDir, '.claude/settings.json'), JSON.stringify({ model: 'opus' }, null, 2))

    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['hooks'],
      dryRun: false,
    })

    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      '"model": "opus"',
    )
    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      'SessionStart',
    )
  })

  it('preserves existing same-event hooks alongside notes hook entries', async () => {
    await writeFixture(
      join(repoRoot, 'hooks/claude/hooks.json'),
      await readRepoHookFragment('hooks/claude/hooks.json'),
    )
    await writeFixture(
      join(repoRoot, 'hooks/codex/hooks.json'),
      await readRepoHookFragment('hooks/codex/hooks.json'),
    )
    await writeFixture(
      join(homeDir, '.claude/settings.json'),
      JSON.stringify(
        {
          model: 'opus',
          hooks: {
            UserPromptSubmit: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'existing-claude-prompt-hook',
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
    await writeFixture(
      join(homeDir, '.codex/hooks.json'),
      JSON.stringify(
        {
          hooks: {
            UserPromptSubmit: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'existing-codex-prompt-hook',
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

    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['hooks'],
      dryRun: false,
    })

    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      'existing-claude-prompt-hook',
    )
    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      'node ~/.claude/hooks/project-notes-hook.mjs claude UserPromptSubmit',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.toContain(
      'existing-codex-prompt-hook',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.toContain(
      'node ~/.codex/hooks/project-notes-hook.mjs codex UserPromptSubmit',
    )
  })

  it('does not duplicate notes hook config on repeated sync', async () => {
    await writeFixture(
      join(repoRoot, 'hooks/claude/hooks.json'),
      await readRepoHookFragment('hooks/claude/hooks.json'),
    )
    await writeFixture(
      join(repoRoot, 'hooks/codex/hooks.json'),
      await readRepoHookFragment('hooks/codex/hooks.json'),
    )
    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['hooks'],
      dryRun: false,
    })

    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['hooks'],
      dryRun: false,
    })

    const codexHooks = await readFile(join(homeDir, '.codex/hooks.json'), 'utf8')
    const claudeSettings = await readFile(join(homeDir, '.claude/settings.json'), 'utf8')

    expect(codexHooks.match(/project-notes-hook\.mjs codex SessionStart/g) ?? []).toHaveLength(1)
    expect(codexHooks.match(/project-notes-hook\.mjs codex UserPromptSubmit/g) ?? []).toHaveLength(1)
    expect(claudeSettings.match(/project-notes-hook\.mjs claude SessionStart/g) ?? []).toHaveLength(1)
    expect(claudeSettings.match(/project-notes-hook\.mjs claude UserPromptSubmit/g) ?? []).toHaveLength(1)
  })

  it('writes a managed manifest and removes stale managed artifacts on later syncs', async () => {
    const manifestPath = join(homeDir, '.filip-stack/sync-manifest.json')

    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['skills', 'hooks'],
      dryRun: false,
    })

    const initialManifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      skills: string[]
      hooks: {
        codex: { scripts: string[]; commands: string[] }
        claude: { scripts: string[]; commands: string[] }
      }
    }

    expect(initialManifest.skills).toEqual(['implementer', 'reviewer'])
    expect(initialManifest.hooks.codex.scripts).toContain(join(homeDir, '.codex/hooks/project-notes-hook.mjs'))
    expect(initialManifest.hooks.claude.scripts).toContain(
      join(homeDir, '.claude/hooks/project-notes-hook.mjs'),
    )
    expect(initialManifest.hooks.codex.commands).toContain(
      'node ~/.codex/hooks/project-notes-hook.mjs codex SessionStart',
    )
    expect(initialManifest.hooks.claude.commands).toContain(
      'node ~/.claude/hooks/project-notes-hook.mjs claude SessionStart',
    )

    await writeFixture(join(homeDir, '.agents/skills/local-only/SKILL.md'), 'local only')
    await writeFixture(join(homeDir, '.codex/hooks/local-hook.mjs'), 'local codex hook')
    await writeFixture(join(homeDir, '.claude/hooks/local-hook.mjs'), 'local claude hook')
    await writeFixture(
      join(homeDir, '.codex/hooks.json'),
      JSON.stringify(
        {
          hooks: {
            Notification: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'existing-codex-hook',
                  },
                ],
              },
            ],
            UserPromptSubmit: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'node ~/.codex/hooks/project-notes-hook.mjs codex UserPromptSubmit',
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
    await writeFixture(
      join(homeDir, '.claude/settings.json'),
      JSON.stringify(
        {
          model: 'opus',
          hooks: {
            SessionStart: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'existing-claude-hook',
                  },
                ],
              },
            ],
            UserPromptSubmit: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'node ~/.claude/hooks/project-notes-hook.mjs claude UserPromptSubmit',
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

    await rm(join(repoRoot, 'skills/implementer'), { recursive: true, force: true })
    await rm(join(repoRoot, 'hooks/shared/project-notes-hook.mjs'), { force: true })
    await writeFixture(join(repoRoot, 'hooks/codex/hooks.json'), JSON.stringify({ hooks: {} }, null, 2))
    await writeFixture(join(repoRoot, 'hooks/claude/hooks.json'), JSON.stringify({ hooks: {} }, null, 2))

    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['skills', 'hooks'],
      dryRun: false,
    })

    expect(existsSync(join(homeDir, '.agents/skills/implementer'))).toBe(false)
    expect(existsSync(join(homeDir, '.agents/skills/reviewer'))).toBe(true)
    expect(existsSync(join(homeDir, '.agents/skills/local-only'))).toBe(true)
    expect(existsSync(join(homeDir, '.codex/hooks/project-notes-hook.mjs'))).toBe(false)
    expect(existsSync(join(homeDir, '.claude/hooks/project-notes-hook.mjs'))).toBe(false)
    expect(existsSync(join(homeDir, '.codex/hooks/local-hook.mjs'))).toBe(true)
    expect(existsSync(join(homeDir, '.claude/hooks/local-hook.mjs'))).toBe(true)

    const codexHooks = await readFile(join(homeDir, '.codex/hooks.json'), 'utf8')
    const claudeSettings = await readFile(join(homeDir, '.claude/settings.json'), 'utf8')
    const updatedManifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      skills: string[]
      hooks: {
        codex: { scripts: string[]; commands: string[] }
        claude: { scripts: string[]; commands: string[] }
      }
    }

    expect(codexHooks).toContain('existing-codex-hook')
    expect(claudeSettings).toContain('existing-claude-hook')
    expect(codexHooks).not.toContain('project-notes-hook.mjs codex UserPromptSubmit')
    expect(claudeSettings).not.toContain('project-notes-hook.mjs claude UserPromptSubmit')
    expect(updatedManifest.skills).toEqual(['reviewer'])
    expect(updatedManifest.hooks.codex.scripts).toEqual([])
    expect(updatedManifest.hooks.claude.scripts).toEqual([])
    expect(updatedManifest.hooks.codex.commands).toEqual([])
    expect(updatedManifest.hooks.claude.commands).toEqual([])
  })

  it('only cleans up stale artifacts for the selected scope', async () => {
    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['skills', 'hooks'],
      dryRun: false,
    })

    await rm(join(repoRoot, 'skills/implementer'), { recursive: true, force: true })
    await rm(join(repoRoot, 'hooks/shared/project-notes-hook.mjs'), { force: true })

    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['hooks'],
      dryRun: false,
    })

    expect(existsSync(join(homeDir, '.agents/skills/implementer'))).toBe(true)
    expect(existsSync(join(homeDir, '.codex/hooks/project-notes-hook.mjs'))).toBe(false)
    expect(existsSync(join(homeDir, '.claude/hooks/project-notes-hook.mjs'))).toBe(false)
  })

  it('removes stale project-notes hook entries that no longer exist in repo fragments', async () => {
    await writeFixture(
      manifestPath,
      JSON.stringify(
        {
          version: 1,
          repo: 'filip-stack',
          skills: [],
          hooks: {
            claude: {
              scripts: [],
              commands: [
                'node ~/.claude/hooks/project-notes-hook.mjs claude PreToolUse',
                'node ~/.claude/hooks/project-notes-hook.mjs claude SessionStart',
                'node ~/.claude/hooks/project-notes-hook.mjs claude Stop',
                'node ~/.claude/hooks/project-notes-hook.mjs claude UserPromptSubmit',
              ],
            },
            codex: {
              scripts: [],
              commands: [
                'node ~/.codex/hooks/project-notes-hook.mjs codex PreToolUse',
                'node ~/.codex/hooks/project-notes-hook.mjs codex PostToolUse',
                'node ~/.codex/hooks/project-notes-hook.mjs codex SessionStart',
                'node ~/.codex/hooks/project-notes-hook.mjs codex UserPromptSubmit',
              ],
            },
          },
        },
        null,
        2,
      ),
    )

    await writeFixture(
      join(homeDir, '.claude/settings.json'),
      JSON.stringify(
        {
          model: 'opus',
          hooks: {
            PreToolUse: [
              {
                matcher: 'Write|Edit|MultiEdit|NotebookEdit|Bash',
                hooks: [
                  {
                    type: 'command',
                    command: 'node ~/.claude/hooks/project-notes-hook.mjs claude PreToolUse',
                  },
                ],
              },
            ],
            Stop: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'existing-claude-stop-hook',
                  },
                ],
              },
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'node ~/.claude/hooks/project-notes-hook.mjs claude Stop',
                  },
                ],
              },
            ],
            UserPromptSubmit: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'existing-claude-prompt-hook',
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
    await writeFixture(
      join(homeDir, '.codex/hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: 'node ~/.codex/hooks/project-notes-hook.mjs codex PreToolUse',
                  },
                ],
              },
            ],
            PostToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: 'node ~/.codex/hooks/project-notes-hook.mjs codex PostToolUse',
                  },
                ],
              },
            ],
            UserPromptSubmit: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'existing-codex-prompt-hook',
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

    await writeFixture(join(repoRoot, 'hooks/claude/hooks.json'), JSON.stringify({ hooks: {} }, null, 2))
    await writeFixture(join(repoRoot, 'hooks/codex/hooks.json'), JSON.stringify({ hooks: {} }, null, 2))

    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['hooks'],
      dryRun: false,
    })

    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.not.toContain(
      'project-notes-hook.mjs claude Stop',
    )
    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.not.toContain(
      'project-notes-hook.mjs claude PreToolUse',
    )
    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      'existing-claude-stop-hook',
    )
    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      'existing-claude-prompt-hook',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.not.toContain(
      'project-notes-hook.mjs codex PostToolUse',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.not.toContain(
      'project-notes-hook.mjs codex PreToolUse',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.toContain(
      'existing-codex-prompt-hook',
    )
  })

  it('removes stale notes commands from mixed hook entries without dropping unrelated commands', async () => {
    await writeFixture(
      manifestPath,
      JSON.stringify(
        {
          version: 1,
          repo: 'filip-stack',
          skills: [],
          hooks: {
            claude: {
              scripts: [],
              commands: ['node ~/.claude/hooks/project-notes-hook.mjs claude UserPromptSubmit'],
            },
            codex: {
              scripts: [],
              commands: [],
            },
          },
        },
        null,
        2,
      ),
    )
    await writeFixture(
      join(homeDir, '.claude/settings.json'),
      JSON.stringify(
        {
          model: 'opus',
          hooks: {
            UserPromptSubmit: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'existing-claude-prompt-hook',
                  },
                ],
              },
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'node ~/.claude/hooks/project-notes-hook.mjs claude UserPromptSubmit',
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

    await writeFixture(join(repoRoot, 'hooks/claude/hooks.json'), JSON.stringify({ hooks: {} }, null, 2))

    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['hooks'],
      dryRun: false,
    })

    const claudeSettings = await readFile(join(homeDir, '.claude/settings.json'), 'utf8')

    expect(claudeSettings).toContain('existing-claude-prompt-hook')
    expect(claudeSettings).not.toContain('project-notes-hook.mjs claude UserPromptSubmit')
  })

  it('fails on invalid hook config fragments', async () => {
    await writeFixture(join(repoRoot, 'hooks/codex/hooks.json'), '{"notHooks":true}')

    await expect(
      syncSetup({
        repoRoot,
        homeDir,
        scopes: ['hooks'],
        dryRun: false,
      }),
    ).rejects.toThrow('Hook config must contain a top-level hooks object')
  })

  it('overwrites colliding files and preserves unrelated local content', async () => {
    await writeFixture(join(homeDir, '.agents/skills/reviewer/SKILL.md'), 'local reviewer')
    await writeFixture(join(homeDir, '.agents/skills/laptop-only-skill/SKILL.md'), 'local only')

    await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['skills'],
      dryRun: false,
    })

    await expect(readFile(join(homeDir, '.agents/skills/reviewer/SKILL.md'), 'utf8')).resolves.toBe(
      'repo reviewer',
    )
    await expect(
      readFile(join(homeDir, '.agents/skills/laptop-only-skill/SKILL.md'), 'utf8'),
    ).resolves.toBe('local only')
  })

  it('dry-run reports planned actions without writing', async () => {
    await writeFixture(join(homeDir, '.codex/hooks/stale-hook.mjs'), 'stale hook')
    await writeFixture(
      manifestPath,
      JSON.stringify(
        {
          version: 1,
          repo: 'filip-stack',
          skills: [],
          hooks: {
            codex: {
              scripts: [join(homeDir, '.codex/hooks/stale-hook.mjs')],
              commands: [],
            },
            claude: {
              scripts: [],
              commands: [],
            },
          },
        },
        null,
        2,
      ),
    )
    await writeFixture(join(homeDir, '.codex/hooks/stale-hook.mjs'), 'stale hook')

    const actions = await syncSetup({
      repoRoot,
      homeDir,
      scopes: ['hooks'],
      dryRun: true,
    })

    expect(actions).toContainEqual({
      type: 'update',
      source: join(repoRoot, 'hooks/claude/hooks.json'),
      destination: join(homeDir, '.claude/settings.json'),
      detail: 'merge Claude hooks config',
    })
    expect(actions).toContainEqual({
      type: 'update',
      source: join(repoRoot, 'hooks/codex/hooks.json'),
      destination: join(homeDir, '.codex/hooks.json'),
      detail: 'merge Codex hooks config',
    })
    expect(actions).toContainEqual({
      type: 'update',
      destination: join(homeDir, '.codex/config.toml'),
      detail: 'enable codex_hooks feature',
    })
    expect(actions).toContainEqual({
      type: 'delete',
      path: join(homeDir, '.codex/hooks/stale-hook.mjs'),
      detail: 'delete stale managed hook script',
    })
    expect(existsSync(join(homeDir, '.claude/settings.json'))).toBe(false)
    expect(existsSync(join(homeDir, '.codex/hooks.json'))).toBe(false)
    expect(existsSync(join(homeDir, '.codex/config.toml'))).toBe(false)
    await expect(readFile(manifestPath, 'utf8')).resolves.toContain('stale-hook.mjs')
    await expect(readFile(join(homeDir, '.codex/hooks/stale-hook.mjs'), 'utf8')).resolves.toBe('stale hook')
  })
})
