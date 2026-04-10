export type Scope = 'skills' | 'hooks' | 'globals'

export type ScopeFlags = {
  all?: boolean
  skills?: boolean
  hooks?: boolean
  globals?: boolean
  interactive?: boolean
}

export const DEFAULT_SCOPES: Scope[] = ['skills', 'hooks']
const ALL_SCOPES: Scope[] = ['skills', 'hooks', 'globals']

export const resolveScopes = ({
  all = false,
  skills = false,
  hooks = false,
  globals = false,
  interactive = false,
}: ScopeFlags): Scope[] => {
  const selectedIndividualScopes: Scope[] = []

  if (skills) selectedIndividualScopes.push('skills')
  if (hooks) selectedIndividualScopes.push('hooks')
  if (globals) selectedIndividualScopes.push('globals')

  if (all && selectedIndividualScopes.length > 0) {
    throw new Error('--all cannot be combined with --skills, --hooks, or --globals')
  }

  if (interactive && (all || selectedIndividualScopes.length > 0)) {
    throw new Error('--interactive cannot be combined with scope flags')
  }

  if (all) return ALL_SCOPES
  if (selectedIndividualScopes.length > 0) return selectedIndividualScopes
  return DEFAULT_SCOPES
}
