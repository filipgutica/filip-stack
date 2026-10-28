---
related: [planning, review, test-audit]
---

## What it does

Engineering makes the smallest change that does what you asked, then proves
it with the tests and checks that observe that behavior.

## When to use it

- A code change, bug fix, or refactor you have authorized.
- A failing test or CI failure.
- A correction a reviewer asked for.

It does not handle explanation-only questions or planning without edits.
For an engineering direction, specification, plan, or tickets, use
[planning](../planning/).

## How it works

1. Reads the Git state, the requested behavior, nearby code, the code that
   owns the behavior, and the nearest existing test.
2. Decides what must not change. For nontrivial work, it states a plan and
   compares it with a simpler option. If no change is needed, it stops.
3. Runs the nearest existing test before editing when suitable coverage exists,
   and records the result.
4. Fixes the production code before it changes a correct test. It changes a
   test only when evidence shows the test is wrong or its contract changed.
5. Adds a test only for a credible regression that existing tests miss. A new
   bug test must fail on the old code first.
6. Makes the smallest change that fixes the cause, without speculative
   options, dependencies, or unrelated cleanup.
7. Reruns the same test and the affected checks, then reads the final diff
   for accidental changes, duplication, and dead code.

For substantial test changes, it calls [test-audit](../test-audit/). For
consequential, hard-to-reverse, or security-sensitive changes, it follows
its review rules, which can require an independent reviewer.

## What you get

- The change, with the commands that prove it and their results.
- Any remaining risk, stated plainly.

It does not commit, push, or publish unless you ask it to.
