---
related: [review, test-audit]
---

## What it does

Simplify targets duplicated logic, extra state, needless branches, and layers
that add nothing. The agent changes only what three separate reviews support
and its checks confirm.

## When to use it

- Simplify a specific file, function, or range of changes.
- Clean up the code you changed in the current task before you hand it off.

Simplify runs only when you call it: `/workflow:simplify` in Claude or
`$workflow:simplify` in Codex. It comes with the
[Workflow plugin](../../#install). Name the target when you call it, for
example `/workflow:simplify src/cart/totals.ts`. Without a target it uses the
code changed in the current task, then your uncommitted changes, and it asks
you only when it still cannot find one.

## How it works

The agent reads the target, its callers, and the nearest tests. It lists what
must not change: public APIs, outputs, side effects, errors, ordering, and
edge cases. When an existing check gives a useful baseline, it runs that first.

Then three helper agents review the same code without editing it, each from
one angle:

| Review | What it looks for |
| --- | --- |
| Reuse and ownership | Existing helpers that can replace duplicate code, and abstractions nothing needs yet |
| Direct simplification | Redundant state, branches, nesting, and indirection |
| Behavior contract | The behavior and tests a refactor must keep |

The agent waits for all three. If one is still missing after a retry, or the
host cannot run helper agents, it reports the review as incomplete and edits
nothing.

The agent then applies only the proposals with a clear benefit and leaves
uncertain ones alone. It keeps meaningful tests and error handling, and it
does not add an abstraction or dependency only to save lines. Finally it runs
the checks that cover the change, and a substantial final diff gets a
read-only [review](../review/) from an agent that did not make it.

## What you get

- What became simpler, and the checks that show the behavior did not change.
- The proposals it left unapplied, and why.

If a check fails or the agent cannot show that behavior is unchanged, the
result is reported as incomplete.
