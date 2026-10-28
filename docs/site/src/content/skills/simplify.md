---
related: [review, test-audit]
---

## What it does

Simplify improves clarity and removes needless complexity from selected code
while preserving observable behavior. It uses three independent assessments
before the main thread makes a focused change.

## When to use it

- Simplify a specific target or change range.
- Remove duplication, redundant state, branches, or unnecessary indirection.
- Improve the code changed in the current task without changing its contract.

It runs only when you call it by name. If the target cannot be identified,
it asks for one before proceeding.

## How it works

1. Reads the target, callers, project instructions, and nearby tests. It maps
   the APIs, outputs, side effects, errors, ordering, and edge cases to preserve.
2. Runs a focused existing check when that gives a useful baseline.
3. Gets three independent, read-only assessments: reuse and ownership, direct
   simplification, and the behavior contract. Each uses the same bounded target.
4. Waits for all three assessments. It retries a missing or failed assessment
   once and stops before editing if the review remains incomplete.
5. Checks proposals against live code and the behavior map. One writer applies
   only changes with a concrete benefit and leaves uncertain proposals unapplied.
6. Runs focused checks and inspects the final diff. A substantive final diff
   receives an independent read-only [review](../review/).

The skill preserves meaningful tests and error handling. It does not add an
abstraction or dependency just to reduce line count. Use
[test-audit](../test-audit/) when the value or preservation of coverage is uncertain.

## What you get

- A focused simplification with the affected behavior preserved and checked.
- The verification performed and any incomplete result.
- Proposed changes deliberately left unapplied, with their uncertainties.

If behavior preservation remains uncertain, the result stays incomplete.
