---
related: [planning, review, test-audit]
---

## What it does

Give your agent a bug, feature, refactor, CI failure, or review feedback. It
reads owning code, checks feedback against it, and makes the smallest authorized
edit without extra options, dependencies, or cleanup. It runs a baseline test
when suitable coverage exists. For bugs, a new test fails for the expected
reason first, or it reproduces the bug before and after. You get the edit,
command results, and remaining risks.

## When to use it

Install [Workflow](../../#install), then ask in plain words:

> Fix the off-by-one error in the date picker's week numbers.

Use it for fixes, features, refactors, failing checks, or review feedback to
verify and apply when authorized. For plans or tickets without edits, use
[planning](../planning/). For a read-only check, use [review](../review/).

## How it works

1. It reads owning code and tests, runs a baseline test when suitable coverage
   exists, and stops if nothing needs editing.
2. For larger work, it states a plan and checks a simpler option.
3. It edits source code and changes a test only when evidence shows it is wrong
   or its contract changed.
4. It reruns affected checks and inspects the diff for accidental edits,
   duplication, and dead code.

Before a PR reaches you, an **independent reviewer** (a separate non-author
agent in its own context) checks the diff when required and available. If
unavailable, the agent inspects it and reports the gap. Routine PRs still follow
user and repo rules. Explicit audits, substantial coverage changes, or uncertain
test value or preservation invoke [test-audit](../test-audit/). Requested final
reviews (like [sol-loop](../sol-loop/) or [full-send](../full-send/)) run once
per PR.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/engineering/SKILL.md)
and
[delegation-and-review.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/engineering/references/delegation-and-review.md)
hold the rules.

## What you get

- Edits, command results, remaining risks, and unrun checks marked unverified.

Engineering commits, pushes, publishes, or deploys only with authorization.
