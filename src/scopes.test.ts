import { describe, expect, it } from 'vitest'

import { resolveScopes } from './scopes.js'

describe('resolveScopes', () => {
  it('defaults to skills and hooks', () => {
    expect(resolveScopes({})).toEqual(['skills', 'hooks'])
  })

  it('uses selected individual scopes only', () => {
    expect(resolveScopes({ globals: true })).toEqual(['globals'])
    expect(resolveScopes({ skills: true, hooks: true })).toEqual(['skills', 'hooks'])
  })

  it('selects every scope for all', () => {
    expect(resolveScopes({ all: true })).toEqual(['skills', 'hooks', 'globals'])
  })

  it('rejects all combined with individual scopes', () => {
    expect(() => resolveScopes({ all: true, skills: true })).toThrow(
      '--all cannot be combined with --skills, --hooks, or --globals',
    )
  })

  it('rejects interactive combined with scope flags', () => {
    expect(() => resolveScopes({ interactive: true, hooks: true })).toThrow(
      '--interactive cannot be combined with scope flags',
    )
    expect(() => resolveScopes({ interactive: true, all: true })).toThrow(
      '--interactive cannot be combined with scope flags',
    )
  })
})
