import { describe, expect, it } from 'vitest'

import { formatDryRun, formatSyncSummary } from './output.js'

describe('formatDryRun', () => {
  it('renders a grouped markdown summary', () => {
    const output = formatDryRun({
      repoRoot: '/repo',
      homeDir: '/home/user',
      scopes: ['skills', 'hooks'],
      actions: [
        { type: 'mkdir', path: '/home/user/.agents/skills' },
        { type: 'mkdir', path: '/home/user/.agents/skills/reviewer' },
        {
          type: 'copy',
          source: '/repo/skills/reviewer/SKILL.md',
          destination: '/home/user/.agents/skills/reviewer/SKILL.md',
        },
        {
          type: 'delete',
          path: '/home/user/.agents/skills/old-skill',
          detail: 'delete stale managed skill',
        },
        { type: 'mkdir', path: '/home/user/.codex/hooks' },
        {
          type: 'update',
          source: '/repo/hooks/codex/hooks.json',
          destination: '/home/user/.codex/hooks.json',
          detail: 'merge Codex hooks config',
        },
        {
          type: 'update',
          destination: '/home/user/.codex/config.toml',
          detail: 'enable codex_hooks feature',
        },
        { type: 'mkdir', path: '/home/user/.claude/hooks' },
        {
          type: 'update',
          source: '/repo/hooks/claude/hooks.json',
          destination: '/home/user/.claude/settings.json',
          detail: 'merge Claude hooks config',
        },
      ],
    })

    expect(output).toContain('# Dry Run')
    expect(output).toContain('Selected scopes: Skills, Hooks.')
    expect(output).toContain('### Skills')
    expect(output).toContain('### Codex Hooks')
    expect(output).toContain('### Claude Hooks')
    expect(output).toContain('- Planned: 1 file, 2 directories, 1 deletion')
    expect(output).toContain('- `.agents/skills/reviewer/SKILL.md`')
    expect(output).toContain('- `.agents/skills/old-skill`')
    expect(output).toContain('- `.codex/hooks.json`')
    expect(output).toContain('- `.codex/config.toml`')
    expect(output).toContain('- `.claude/settings.json`')
    expect(output).not.toContain('### Globals')
  })
})

describe('formatSyncSummary', () => {
  it('renders scope and destination details without implementation action counts', () => {
    const output = formatSyncSummary({
      repoRoot: '/repo',
      homeDir: '/home/user',
      scopes: ['skills'],
      actions: [
        { type: 'mkdir', path: '/home/user/.agents/skills' },
        { type: 'mkdir', path: '/home/user/.agents/skills/reviewer' },
        {
          type: 'copy',
          source: '/repo/skills/reviewer/SKILL.md',
          destination: '/home/user/.agents/skills/reviewer/SKILL.md',
        },
        {
          type: 'delete',
          path: '/home/user/.agents/skills/old-skill',
          detail: 'delete stale managed skill',
        },
        {
          type: 'copy',
          source: '/repo/skills/implementer/SKILL.md',
          destination: '/home/user/.agents/skills/implementer/SKILL.md',
        },
        {
          type: 'update',
          destination: '/home/user/.codex/hooks.json',
          detail: 'merge Codex hooks config',
        },
      ],
    })

    expect(output).toContain('Synced Skills.')
    expect(output).toContain('## Skills')
    expect(output).toContain('- Updated: 2 files')
    expect(output).toContain('- Deleted: 1 item')
    expect(output).toContain('- Destination: `~/.agents/skills`')
    expect(output).not.toContain('~/.codex/hooks.json')
    expect(output).not.toContain('filesystem action')
  })
})
