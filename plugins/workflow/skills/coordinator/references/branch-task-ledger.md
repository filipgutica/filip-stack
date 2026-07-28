# Branch Task Ledger

Use this reference for named-ticket end-to-end execution or requested manual planning on an established branch. The ledger stays outside the repository to avoid tracked planning files.

Manual planning may create or update the external ledger. It cannot create or switch branches, edit repository files, commit, push, open a pull request, or publish. Do not create or refresh a repository-local pointer during manual planning.

## Locate or Create the Ledger

1. Read the live git root, current branch, and repository name. Use `git rev-parse --show-toplevel` and `git branch --show-current`. For detached HEAD, use a short commit hash with a detached marker.
2. Use `~/.project-tasks/<repo-slug>/<branch-slug>/TASKS.md`. Replace `/` and other non-portable branch characters in the slug. If the path belongs to another root or branch, add a short stable root hash.
3. Before scanning, check `<git-root>/TASKS.md`. If that path is occupied, check `<git-root>/.task-ledger`. Treat the pointer as a candidate path. Validate the ledger metadata against the live root and branch.
4. Only during named-ticket end-to-end execution, add the pointer path to `git rev-parse --git-path info/exclude`. Never edit `.gitignore` or stage the pointer. Rewrite the pointer file when the active ledger changes. Refresh it after a branch switch.
5. Search `~/.project-tasks/<repo-slug>/` for a ledger whose metadata matches the current root and branch before creating a new one.

## Ledger Shape

Add a title and metadata block. Include the creation date, repository, absolute git root, working directory, branch, task directory, and pointer path. During manual planning, set the pointer path to `none`. Then add Context, Goal, Non-goals, Success Criteria, and one top-level task per intended commit.

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

## Completion and Commit Discipline

- In manual planning, use the ledger to propose bounded tasks with the user. Keep every task `[ ]`. A task does not grant implementation or commit authority.
- In explicit named-ticket end-to-end execution, one top-level task equals one bounded coordinator cycle and one Conventional Commit.
- Keep each task to a reviewable, independently verifiable change. Do not combine tasks without explicit approval.
- Check the repository state before each implementation task. The ledger guides work but does not prove the live state.
- In end-to-end execution, after the commit exists, add its subject and short hash to `Commit:`, then mark the task `[x]`. Never mark it complete first.
- Preserve unfinished task state and record concrete blockers with `[!]`.
