---
related: [planning, review, test-audit]
---

## What it does

The agent changes only what your request needs. It adds no speculative
options, dependencies, abstractions, or nearby cleanup. It keeps validation,
error handling, security, and useful tests.

## When to use it

Install the [Workflow plugin](../../#install), then ask for the change in plain
words. You do not need a special command. For example:

> Fix the off-by-one error in the date picker's week numbers.

Use it for a feature, bug fix, refactor, failing test, CI failure, or review
feedback to check or apply. For a plan, specification, or tickets without code
changes, use [planning](../planning/).

## How it works

1. The agent reads the code that owns the behavior and the nearest tests. It
   runs a relevant test before it edits. If no change is needed, it stops.
2. For larger work, it states a plan and compares it with a simpler option.
3. It makes the change. Existing tests count as intended behavior: it changes
   a test only when evidence shows the test is wrong or its contract changed
   on purpose. A regression test must fail on the old code first.
4. It reruns the affected checks and reads the diff for accidental changes,
   duplication, and dead code.

Work that spans several PRs repeats plan, implement, verify, review, and fix
for each task. Before a PR reaches you, an agent that did not write it reviews
the whole PR. A small routine PR needs only focused checks. Risky work, such
as a migration or a security change, gets an independent review when the host
supports one. Large test changes get a [test-audit](../test-audit/). A final
review you ask for, such as [sol-loop](../sol-loop/) or
[full-send](../full-send/), runs once on each finished PR.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/engineering/SKILL.md)
has the exact implementation and verification rules.

## What you get

- The change, with the commands the agent ran and their results.
- Remaining risks, and any check that could not run, marked unverified.

Engineering does not commit, push, or publish unless you authorize it.
