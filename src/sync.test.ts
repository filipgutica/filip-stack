import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { syncSetup } from './sync.js'

let testRoot: string
let repoRoot: string
let homeDir: string

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
  await writeFixture(join(repoRoot, 'hooks/codex/scripts/pre-tool-use.sh'), 'codex hook')
  await writeFixture(
    join(repoRoot, 'hooks/codex/hooks.json'),
    JSON.stringify(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'command',
                  command: '~/.codex/hooks/pre-tool-use.sh',
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
  await writeFixture(join(repoRoot, 'hooks/codex/scripts/.gitkeep'), '')
  await writeFixture(join(repoRoot, 'hooks/claude/scripts/post-tool-use.sh'), 'claude hook')
  await writeFixture(
    join(repoRoot, 'hooks/claude/hooks.json'),
    JSON.stringify(
      {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write|Edit',
              hooks: [
                {
                  type: 'command',
                  command: '~/.claude/hooks/post-tool-use.sh',
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
  await writeFixture(join(repoRoot, 'hooks/claude/scripts/.gitkeep'), '')
  await writeFixture(join(repoRoot, 'globals/AGENTS.md'), 'repo agents')
  await writeFixture(join(repoRoot, 'globals/CLAUDE.md'), 'repo claude')
}

describe('syncSetup', () => {
  beforeEach(async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'filip-stack-sync-test-'))
    repoRoot = join(testRoot, 'repo')
    homeDir = join(testRoot, 'home')
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
    await expect(readFile(join(homeDir, '.codex/hooks/pre-tool-use.sh'), 'utf8')).resolves.toBe(
      'codex hook',
    )
    await expect(readFile(join(homeDir, '.codex/hooks/project-notes-hook.mjs'), 'utf8')).resolves.toBe(
      'shared hook',
    )
    await expect(readFile(join(homeDir, '.claude/hooks/post-tool-use.sh'), 'utf8')).resolves.toBe(
      'claude hook',
    )
    await expect(readFile(join(homeDir, '.claude/hooks/project-notes-hook.mjs'), 'utf8')).resolves.toBe(
      'shared hook',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.toContain('PreToolUse')
    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      'PostToolUse',
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
    expect(existsSync(join(homeDir, '.codex/hooks/pre-tool-use.sh'))).toBe(true)
    expect(existsSync(join(homeDir, '.claude/hooks/post-tool-use.sh'))).toBe(true)
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

    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      '"model": "opus"',
    )
    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      'SessionStart',
    )
    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      'PostToolUse',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.toContain(
      'Notification',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.toContain(
      'PreToolUse',
    )
    await expect(readFile(join(homeDir, '.codex/config.toml'), 'utf8')).resolves.toContain(
      'codex_hooks = true',
    )
    await expect(readFile(join(homeDir, '.codex/config.toml'), 'utf8')).resolves.toContain(
      'prevent_idle_sleep = true',
    )
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
      'PostToolUse',
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
            Stop: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'existing-claude-stop-hook',
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
            Stop: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'existing-codex-stop-hook',
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
      'existing-claude-stop-hook',
    )
    await expect(readFile(join(homeDir, '.claude/settings.json'), 'utf8')).resolves.toContain(
      'node ~/.claude/hooks/project-notes-hook.mjs claude Stop',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.toContain(
      'existing-codex-stop-hook',
    )
    await expect(readFile(join(homeDir, '.codex/hooks.json'), 'utf8')).resolves.toContain(
      'node ~/.codex/hooks/project-notes-hook.mjs codex Stop',
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

    expect(codexHooks.match(/project-notes-hook\.mjs codex Stop/g) ?? []).toHaveLength(1)
    expect(codexHooks.match(/project-notes-hook\.mjs codex SessionStart/g) ?? []).toHaveLength(1)
    expect(claudeSettings.match(/project-notes-hook\.mjs claude Stop/g) ?? []).toHaveLength(1)
    expect(claudeSettings.match(/project-notes-hook\.mjs claude SessionStart/g) ?? []).toHaveLength(1)
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
    expect(existsSync(join(homeDir, '.claude/settings.json'))).toBe(false)
    expect(existsSync(join(homeDir, '.codex/hooks.json'))).toBe(false)
    expect(existsSync(join(homeDir, '.codex/config.toml'))).toBe(false)
  })
})
