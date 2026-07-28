---
name: field-guide
description: "Use when code or review work should consult past preferences, or when a committed code-review correction should become durable guidance."
---

# Field Guide

Use the layered local guide to find relevant engineering preferences without loading the complete review history. Record committed review corrections as project or shared guidance.

The guide is local and untracked at `~/.field-guide` by default. Current user instructions and repository contracts always outrank it.

## Consult

For meaningful code or review work:

1. Run `node scripts/field-guide.mjs paths --repo-root <git-root>` from this skill directory.
2. Read each returned root or project index that exists.
3. Follow only links relevant to the current change. Do not bulk-load review records.
4. Apply guidance in this order:
   - current user request
   - repository code, contracts, and instructions
   - current-project guidance
   - shared guidance
   - historical review evidence
5. Treat stale or contradictory guidance as evidence to resolve, not as authority over current behavior.

Do not initialize a guide merely to consult it.

## Capture a Committed Review Learning

Capture a lesson only after code-review feedback causes a correction and that correction has a commit. Without that commit, create no field-guide entry.

1. Resolve the full commit hash and confirm it names a commit in the current repository.
2. Run `node scripts/field-guide.mjs init --repo-root <git-root>`.
3. Read [references/storage.md](references/storage.md) and create one concise review record using its exact shape.
4. Link the record from the project `init.md` with a one-line description.
5. Distill the reusable lesson into the project `patterns.md`.
6. Promote it to `shared/` using the evidence shape in the storage reference only when:
   - the user explicitly states that it is a general preference, or
   - committed records from at least two project guides support the same lesson.
7. Update every affected `init.md`, then run `node scripts/field-guide.mjs validate --repo-root <git-root>`.

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
