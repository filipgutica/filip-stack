---
name: branch-task-planner
description: "Use when a user requests an external branch task ledger or named-ticket end-to-end execution needs branch-scoped task tracking."
disable-model-invocation: true
---

# Branch task planner

Maintain an external ledger with one top-level task per intended commit.

## Select the authority mode

- **Direct invocation:** Modify only the external ledger for an established branch. This mode is planning-only.
- **Named-ticket end-to-end:** Require confirmed named-ticket end-to-end authority from `$workflow:coordinator`.

Do not infer named-ticket end-to-end authority from a ticket reference or an existing ledger.

## Locate the ledger

1. Read the live Git root and current branch.
2. Stop if direct invocation has no established branch.
3. Use `$workflow:setup` path resolution for `~/.engineering-workflow/<repo-id>/branches/<branch-id>/TASKS.md`.
4. Consume the returned repository and branch IDs. Do not reconstruct their slugs or stable hashes.
5. Search the resolved task directory before creating a ledger.
6. Check the matching legacy path under `~/.project-tasks` before creating a new ledger.
7. If only the legacy ledger exists, run the setup migration with `--repo-root` and `--branch` before continuing.
8. Require explicit setup or migration authority for that operation. Stop and request it when absent.
9. Validate ledger metadata against the live root and branch.

For detached HEAD during named-ticket execution, use the short commit hash with a detached marker until the coordinator creates the authorized branch.

## Direct invocation

The user's explicit request to create or modify a branch task ledger grants external-artifact authority only for that ledger write.

1. Gather the request and bounded read-only evidence.
2. Propose task boundaries in the conversation.
3. Apply the user's changes to the proposed tasks.
4. Create or update only the external ledger.
5. Keep each proposed task marked `[ ]`.
6. Set the pointer path to `none`.

Do not create or switch branches. Do not edit repository files. Do not create a repository pointer. Do not commit, push, or publish.

## Named-ticket end-to-end use

Use ticket context and repository evidence to define the ledger.

1. Create or resume the external ledger.
2. Use one top-level task for each intended Conventional Commit.
3. Let the coordinator run one bounded cycle for each task.
4. After the commit exists, record its subject and short hash in `Commit:`.
5. Mark the task `[x]` only after the ledger records the commit.
6. Preserve incomplete tasks if execution stops.
7. Add a correction task when branch-level verification fails.

Do not combine tasks without approval. Check the repository before each task. The ledger does not prove the live state.

During this mode, check `<git-root>/TASKS.md` and then `<git-root>/.task-ledger` for the pointer path. Add the pointer to the Git exclude file. Refresh it after the active ledger or branch changes. Never edit `.gitignore`. Never stage the pointer.

## Ledger shape

Add a title and metadata block. Include the date, repository, Git root, working directory, branch, task directory, and pointer.

Add Context, Goal, Non-goals, Success Criteria, branch checks, and deferred work when relevant. Use this task shape:

```md
## Task 1: [ ] <title>

**Commit:**

**Files touched:**
- Source: `<path>`
- Tests: `<path>`
- Docs/config: `<path>`

**Expected outcome:** <concrete behavior or artifact>

**Verification:**
- `<command>` proves <claim>

**Risks / assumptions / open questions:**
- <material uncertainty>

**Steps:**
- [ ] <bounded work>
- [ ] <review or verification>
```

Use `[ ]` for incomplete work. Use `[x]` for committed work. Use `[!]` only for a concrete blocker.

Keep each task reviewable and independently verifiable. A task does not grant implementation or commit authority.
