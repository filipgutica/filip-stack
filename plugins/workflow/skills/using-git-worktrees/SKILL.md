---
name: using-git-worktrees
description: "Use when a user or authorized coordinator requests an isolated Git workspace, a worktree for a branch, or verification of existing worktree isolation."
disable-model-invocation: true
---

# Using Git worktrees

Inspect worktree state without authority. Require explicit worktree authority before creating or changing a worktree. Named-ticket end-to-end authority satisfies this requirement because it includes branch setup.

## Workflow

1. Read the Git root, common directory, current branch, and superproject state.
2. If the current checkout is a linked worktree and not a submodule, reuse it.
3. Use a host-native worktree tool when it exists and owns workspace lifecycle.
4. Otherwise, inspect existing repository and user worktree conventions.
5. When no convention exists, use
   `~/code/worktrees/<project>/<worktree-name>/`. Use the repository root name
   for `<project>`. Choose a concise, unique `<worktree-name>` from the target
   branch, normally its final path component. Create the `<project>` parent only
   as part of an authorized worktree-creation operation.
6. Resolve and validate the exact target before `git worktree add`.
7. Confirm the branch and clean baseline after creation.

Do not create worktrees under `.engineering-workflow` or inside the repository.
Do not edit `.gitignore`. Do not install dependencies automatically.

Run only the setup and baseline commands required by the repository and current task. Use the repository-pinned package manager. Report a failing baseline before implementation.

Do not remove a worktree without separate cleanup authority and a clean-state check.

Read [upstream.md](references/upstream.md) for provenance and local adaptation decisions.
