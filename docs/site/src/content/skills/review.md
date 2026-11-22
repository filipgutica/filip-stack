---
related: [test-audit, walkthrough]
---

## What it does

Name one change or document: a branch, PR, commit range, working tree, or file.
The agent reads every changed file, traces callers and tests, and checks
`AGENTS.md` or `CLAUDE.md`. It runs the narrowest checks and edits nothing. You
get **findings** (issues backed by a file and line or command output) ordered by
impact, or none.

## When to use it

Install [Workflow](../../#install), then name what to review:

> Review this branch against main before I open the PR.

Use it for a read-only check of a working tree, branch, PR, commit range, or
document. Fix findings with [engineering](../engineering/), draft plans with
[planning](../planning/), or tour a change with [walkthrough](../walkthrough/).

## How it works

1. It locks the target. For a branch, it checks from the **merge base** (the
   common ancestor Git uses for the comparison) to the branch's latest commit
   and flags outside changes.
2. It reads changed files, callers, tests, types, config, and docs. Explicit
   audits, substantial coverage changes, or uncertain test value or preservation
   invoke read-only [test-audit](../test-audit/).
3. It runs the narrowest checks once, repeating only for new evidence or changed
   conditions, and marks unrun checks as limits.
4. It skips style preferences and extra scope.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/review/SKILL.md)
has the exact rules.

## What you get

- **Findings** ordered by impact with proof, consequence, and next action, or a
  plain statement of none.
- Range, check results, limits, and whether the reviewer was independent.

Review is read-only and accepts nothing.
