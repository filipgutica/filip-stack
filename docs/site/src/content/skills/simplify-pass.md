---
related: [review, test-audit]
---

## What it does

Three reviews look for duplicate logic, redundant state and branches,
unneeded layers, and behavior a refactor must keep. The agent applies a
proposal only when its benefit is clear and the checks pass.

## When to use it

Install the skill, then run `/simplify-pass` in Claude or `$simplify-pass` in
Codex with a file, function, or change range:

> /simplify-pass src/cart/totals.ts

Without a target, it uses the current task's changes, then uncommitted
changes. If it finds neither, it asks you. Unrelated work stays out of scope.

Your host must support helper agents. All three reviews must finish before
any edit. If one is still missing after a retry, the run ends incomplete.

## How it works

The agent reads the target, its callers, the project guidance, and the
nearest tests. It writes down the behavior to keep: APIs, outputs, side
effects, errors, ordering, concurrency, and edge cases. It runs a useful
existing check first as a baseline.

Three read-only reviewers then look at the same target:

| Review | Purpose |
| --- | --- |
| Reuse and ownership | Find existing helpers and abstractions with no current need |
| Direct simplification | Find redundant state, branches, nesting, and indirection |
| Behavior contract | Identify invariants and tests the refactor must preserve |

The agent checks each proposal against the code and skips uncertain ones.
Useful tests and error handling stay. A new abstraction or dependency needs a
reason beyond fewer lines. A large final diff gets an independent read-only
[review](../review/).

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/simplify-pass/SKILL.md)
has the exact review and verification rules.

## What you get

- What became simpler, and the checks that show behavior did not change.
- Proposals it did not apply, with reasons.

A failed check, or doubt about kept behavior, leaves the result incomplete.
