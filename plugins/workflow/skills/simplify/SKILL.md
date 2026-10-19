---
name: simplify
description: Simplify the selected code while preserving its behavior.
disable-model-invocation: true
---

# Simplify

Run only when the user invokes this skill. Improve clarity and remove needless complexity in the selected code without changing observable behavior.

## Scope and baseline

Use the target or range supplied with the invocation. Otherwise use code changed in the current task; if that is unclear, inspect staged and unstaged changes and relevant untracked files. Keep unrelated changes out of scope. If there is no identifiable target, ask for one before proceeding.

Read the affected code, its callers, project instructions, and the nearest existing tests. Identify the behavior that must remain: public APIs, outputs, side effects, errors, ordering, concurrency, and important edge cases. Run a focused existing check before editing when it gives a useful baseline.

## Independent review

Launch these three read-only subagents in parallel using explicit available host profiles. Give each the same bounded target and relevant project constraints. Ask for compact findings with file and line references, supporting evidence, and uncertainties; the first two agents should also propose concrete changes. They must not edit files or delegate further.

1. **Reuse and ownership:** Find existing local helpers or patterns that can replace duplicate code. Flag abstractions that have no current need and suggest the simplest owner for the logic.
2. **Direct simplification:** Find redundant state, branches, nesting, indirection, comments, and unnecessary work. Favor clear, direct code over shorter code.
3. **Behavior contract:** Map observable behavior and tests that constrain a refactor. Report specific invariants and risk areas involving validation, errors, type safety, side effects, ordering, timing, security, and public interfaces.

Wait for a usable assessment from all three agents before editing. Retry a failed or missing assessment once with the same scope. If an agent is still unavailable, report the incomplete review and stop before editing.

## Apply and verify

Compare each proposed change with the contract map and live code. Apply only changes whose simplification benefit is concrete and whose behavior can be preserved. Resolve overlapping or conflicting proposals yourself; leave uncertain proposals unapplied. Keep one writer in the main thread and make the smallest focused edits. Preserve meaningful tests and error handling. Do not add an abstraction or dependency just to reduce line count.

Run the focused checks that cover the affected behavior, inspect the final diff for scope and accidental changes, and use an independent read-only reviewer for a substantive final diff. If a check fails or behavior preservation remains uncertain, fix the issue or report the incomplete result. Summarize what became simpler, the verification performed, and any proposals deliberately left unapplied.
