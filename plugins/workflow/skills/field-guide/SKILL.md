---
name: field-guide
description: "Consult indexed guidance or record durable guidance from a committed review correction."
---

# Field guide

Use the layered local guide without loading the complete review history.

The guide is local and untracked at `~/.field-guide` by default. Current user instructions and repository contracts always outrank it.

## Consult

For meaningful code or review work:

1. Run `node scripts/field-guide.mjs paths --repo-root <git-root>` from this skill directory.
2. Read each returned root and project index that exists.
3. Follow only links relevant to the current change. Do not bulk-load review records.
4. Apply guidance in this order:
   - current user request
   - repository code, contracts, and instructions
   - current-project guidance
   - shared guidance
   - historical review evidence
5. Resolve stale or contradictory guidance against higher-priority sources.

Do not initialize a guide merely to consult it.

## Record a committed review correction

Create a review record only after review feedback causes a committed correction.

1. Resolve the full commit hash.
2. Confirm that the hash names a commit in the current repository.
3. Run `node scripts/field-guide.mjs init --repo-root <git-root>`.
4. Read [references/storage.md](references/storage.md).
5. Create one review record with the required shape.
6. Link the record from the project `init.md`.
7. Add the durable lesson to the project `patterns.md`.
8. Promote the lesson only when the storage rules permit it.
9. Update each affected `init.md`.
10. Run `node scripts/field-guide.mjs validate --repo-root <git-root>`.

Do not record no-finding reviews, rejected feedback, uncommitted corrections, secrets, proprietary code dumps, or raw conversation transcripts.

## Utility

The utility accepts an optional `--guide-root <path>` for tests or alternate local storage:

```text
field-guide.mjs init --repo-root <path> [--guide-root <path>]
field-guide.mjs paths --repo-root <path> [--guide-root <path>]
field-guide.mjs validate --repo-root <path> [--guide-root <path>]
```

- `init` creates missing structure and index links without replacing existing content.
- `paths` prints the resolved guide paths as JSON without writing.
- `validate` checks index links, repository identity, review indexing, and commit evidence.
