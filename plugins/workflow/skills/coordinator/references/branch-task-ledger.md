# Branch task ledger

Use this reference for named-ticket end-to-end work or requested ledger planning. The external ledger stays outside the repository.

Manual planning can create or update only the external ledger. Do not create a repository pointer during manual planning.

## Locate or create the ledger

1. Read the live git root with `git rev-parse --show-toplevel`.
2. Read the current branch with `git branch --show-current`.
3. Read the repository name.
4. Use a short commit hash with a detached marker for detached HEAD.
5. Select `~/.project-tasks/<repo-slug>/<branch-slug>/TASKS.md`.
6. Replace non-portable branch characters in the slug.
7. Add a short root hash when the path can identify multiple roots.
8. Check `<git-root>/TASKS.md` for an existing pointer.
9. Check `<git-root>/.task-ledger` when the first pointer path is occupied.
10. Validate candidate ledger metadata against the live root and branch.
11. Search the repository task directory before you create a ledger.
12. Add the pointer to the Git exclude file only during named-ticket end-to-end work.
13. Never edit `.gitignore` or stage the pointer.
14. Refresh the pointer after the active ledger or branch changes.

## Ledger shape

Add a title and metadata block. Include the date, repository, git root, working directory, branch, task directory, and pointer path.

Set the pointer path to `none` during manual planning. Add Context, Goal, Non-goals, Success Criteria, and one task per intended commit.

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

## Completion and commit discipline

- In manual planning, use the ledger to propose bounded tasks with the user. Keep every task `[ ]`. A task does not grant implementation or commit authority.
- In explicit named-ticket end-to-end execution, one top-level task equals one bounded coordinator cycle and one Conventional Commit.
- Keep each task to a reviewable, independently verifiable change. Do not combine tasks without explicit approval.
- Check the repository state before each implementation task. The ledger guides work but does not prove the live state.
- In end-to-end execution, after the commit exists, add its subject and short hash to `Commit:`, then mark the task `[x]`. Never mark it complete first.
- Preserve unfinished task state and record concrete blockers with `[!]`.
