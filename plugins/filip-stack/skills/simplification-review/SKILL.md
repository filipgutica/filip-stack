---
name: simplification-review
description: "Review recently changed or explicitly scoped code for behavior-preserving simplification opportunities. Use when the user wants a bounded maintainability review focused on reuse, extensibility, efficiency, and code quality without implementing changes by default."
---

# Simplification Review

Use this skill for behavior-preserving simplification analysis. Keep the review bounded, prefer readability over cleverness, and stop after analysis unless the user explicitly asks for edits.

Model the review after a disciplined code-simplifier workflow, but keep it analyze-first in this repo.

## Scope Resolution

Resolve scope in this order:

1. If the user names files, paths, a diff, a module, or a surface, use that scope.
2. Otherwise inspect local changes first with `git diff` and `git status --short`.
3. Review tracked changes from `git diff` plus any untracked files surfaced by `git status --short`.
4. If there are no local tracked or untracked changes, inspect branch changes with `git diff origin/main`.
5. If neither local nor branch diff produces a usable review surface, ask the user to name the area to review.

Keep the review limited to the resolved surface unless the user explicitly widens it.

## Review Goals

- Preserve exact behavior, public contracts, meaningful side effects, and intended test coverage.
- Reduce cognitive load, duplication, and unnecessary complexity.
- Prefer explicit code over dense or clever code.
- Improve maintainability and extensibility without turning the work into a rewrite.
- Treat efficiency as a review dimension only when there is an obvious, low-risk improvement.

## Review Lens

Inspect the resolved scope for these categories and call out only the ones that actually apply:

- duplicated code, weak reuse, or repeated logic
- hard-to-follow control flow, ambiguity, or unnecessary nesting
- brittle structure or poor extensibility
- leaky, layered, or unnecessary abstractions
- poor separation of concerns or weak organization
- dead, unused, or obsolete code paths
- inefficient code that has a clear simplification path without changing behavior
- low-value, redundant, or weakly meaningful tests

Also call out when a suspicious area is not worth changing because the current complexity appears justified or the cleanup would be mostly stylistic churn.

Avoid recommending simplifications that:

- compress too many concerns into one function or component
- replace readable code with dense one-liners
- introduce nested ternaries or similarly hard-to-debug expressions
- remove abstractions that are carrying real organizational value

## Workflow

1. Confirm the scope from an explicit user request or the diff-based fallback order above.
2. Start with focused local reads when a small number of files can establish the main complexity sources.
3. Use explorer subagents only when the touched surface is broad enough or split enough that bounded delegated review materially helps.
4. When delegating, keep subagents read-only and constrain them to reuse, extensibility, maintainability, efficiency, and quality review within the resolved scope.
5. Synthesize the findings in the main thread.
6. Produce a bounded simplification plan with assumptions, tradeoffs, validation concerns, and the smallest safe simplification direction.
7. Stop after analysis unless the user explicitly asks for implementation.

When using explorer subagents, have them explicitly inspect for:

- ambiguity or hard-to-follow logic
- duplicated code or repeated logic
- dead or unused code
- overly complex or unnecessary abstractions
- brittle structure or hard-to-extend organization
- weak separation of concerns
- inefficient code with a clear behavior-preserving simplification path
- dead, redundant, or low-value tests
- tests that do not assert meaningful behavior

Use the shared explorer prompt shape from [../coordinator/references/subagent-templates.md](../coordinator/references/subagent-templates.md) when delegated read-only analysis helps. Keep workflow-policy details in `coordinator`; this skill owns the simplification lens and output contract.

## Output

- `Summary`
- `Prioritized Findings`
- `Simplification Plan`
- `Tradeoffs`
- `Risks`
- `Validation`
- `Open Questions`
