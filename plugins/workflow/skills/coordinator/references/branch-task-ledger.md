# Branch Task Ledger

Use this reference only for the explicit end-to-end ticket route. The real ledger lives outside the repository so one branch can be resumed without adding tracked planning churn.

## Locate or Create the Ledger

1. Read the live git root (`git rev-parse --show-toplevel`), current branch (`git branch --show-current`), and repository basename. For detached HEAD, use a short commit hash plus a detached marker.
2. Use `~/.project-tasks/<repo-slug>/<branch-slug>/TASKS.md`, where the branch slug replaces `/` and other non-portable characters. If an existing path belongs to a different root or branch, append a short stable hash of the root to the directory.
3. Before scanning, check a repo-local pointer: `<git-root>/TASKS.md`, or `<git-root>/.task-ledger` when `TASKS.md` is tracked or otherwise occupied. The pointer contains the absolute ledger path; it is a candidate, never proof. Validate its ledger metadata against the live root and branch before use.
4. Add the pointer to `git rev-parse --git-path info/exclude`; never edit repository `.gitignore` for it and never stage the pointer. Rewrite it whenever the active ledger changes. After a branch switch, refresh a stale pointer before use or reporting.
5. Search `~/.project-tasks/<repo-slug>/` for a ledger whose metadata matches the current root and branch before creating a new one.

## Ledger Shape

Use a title and metadata block containing created date, repository, absolute git root, working directory, branch, task directory, and pointer path. Then include Context, Goal, Non-goals, Success Criteria, and one top-level task per intended commit.

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

Use `[ ]` for incomplete, `[x]` only for complete and committed, and `[!]` only for a concrete blocker. Include branch-level verification and deferred work when relevant.

## Commit Discipline

- One top-level task equals one bounded coordinator cycle and one Conventional Commit.
- Keep each task to a reviewable, independently verifiable change. Do not combine tasks without explicit approval.
- Re-check the repository state before each task; a ledger guides work but does not prove live state.
- After the commit exists, add its subject and short hash to `Commit:`, then mark the task `[x]`. Never mark it complete first.
- Preserve unfinished task state and record concrete blockers with `[!]`.
