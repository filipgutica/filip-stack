# Upstream provenance

- Source: `https://github.com/obra/superpowers/tree/v6.2.0/skills/using-git-worktrees`
- Pin: `6.2.0`
- License: MIT. See `../../../THIRD_PARTY_NOTICES.md`.

## Retained ideas

- Detect existing linked worktrees before creation.
- Distinguish a worktree from a submodule.
- Prefer a host-native workspace tool.
- Verify the branch and baseline after creation.

## Local changes

- Require authority before Git state changes.
- Use an external user root when no convention exists.
- Never edit `.gitignore` or create a repository-local fallback.
- Never install dependencies automatically.
- Do not define automatic cleanup.

## Update policy

Review upstream changes manually. Do not merge upstream text automatically.
