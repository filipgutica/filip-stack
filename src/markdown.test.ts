import { describe, expect, it } from 'vitest'

import { renderMarkdown } from './markdown.js'

describe('renderMarkdown', () => {
  it('renders markdown to terminal text instead of HTML', () => {
    const output = renderMarkdown('# Dry Run\n\n- `~/.codex/hooks.json`')

    expect(output).toContain('# Dry Run')
    expect(output).toContain('~/.codex/hooks.json')
    expect(output).not.toContain('<h1>')
    expect(output).not.toContain('<ul>')
  })
})
