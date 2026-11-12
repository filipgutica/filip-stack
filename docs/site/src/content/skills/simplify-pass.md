---
related: [review, test-audit]
---

## What it does

Three independent reviews look for duplicate logic, redundant state and
branches, unnecessary layers, and behavior a refactor must preserve. The
agent applies proposals only when their benefit is clear and checks support
the result.

## When to use it

Install the skill with the command above. Invoke it explicitly with
`/simplify-pass` in Claude or `$simplify-pass` in Codex. Name a file, function,
or change range, for example `/simplify-pass src/cart/totals.ts`.

Use it for focused simplification or cleanup of code changed in the current
task. Without a target, it uses that task's changes, then uncommitted changes.
If no target can be identified, it asks you before proceeding. Unrelated work
stays outside the scope.

The host must support helper agents. All three reviews must finish before
editing; after one retry, a missing review ends the run as incomplete.

## How it works

The agent reads the target, callers, project guidance, and nearest tests. It
records the behavior to preserve: APIs, outputs, side effects, errors,
ordering, concurrency, and important edge cases. A useful existing check runs
first as a baseline.

The reviewers inspect the same target read-only from three angles:

| Review | Purpose |
| --- | --- |
| Reuse and ownership | Find existing helpers and abstractions with no current need |
| Direct simplification | Find redundant state, branches, nesting, and indirection |
| Behavior contract | Identify invariants and tests the refactor must preserve |

The agent checks proposals against live code and leaves uncertain changes
unapplied. Meaningful tests and error handling stay. A new abstraction or
dependency needs a reason beyond saving lines. After focused checks, a
substantial final diff gets an independent read-only [review](../review/).

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/simplify-pass/SKILL.md)
has the exact review and verification requirements.

## What you get

- What became simpler and the checks supporting unchanged behavior.
- Proposals left unapplied, with reasons.

A failed check or uncertainty about preserved behavior leaves the result
incomplete.
