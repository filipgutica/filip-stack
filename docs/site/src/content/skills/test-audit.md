---
related: [review, simplify]
---

## What it does

A test can duplicate another test's proof or fail after a private function
is renamed while behavior stays the same. The audit checks these maintenance
costs and production code exposed only for tests. A suspicious test stays
when it is the only protection for a real contract.

## When to use it

Install the [Workflow plugin](../../#install), then name the tests or change
to audit. The agent selects test-audit when your request matches.
[Engineering](../engineering/) and [review](../review/) also use it for
substantial coverage changes or uncertain test value.

For a report without edits, say so:

> Audit the tests in `src/billing/` for duplicates and implementation-coupled
> assertions. Read-only, please.

Use it when adding or removing many tests, or when you cannot tell whether a
test adds distinct coverage. A cleanup request must authorize edits separately
from a read-only audit.

## How it works

| Mode | Scope |
| --- | --- |
| Authoring | Each new or changed test as it is written |
| Audit | Existing tests in the files or change you name |
| Campaign | Every test owned by one subsystem; only on explicit request |

The agent reads the whole test, its production owner, callers, and overlapping
coverage before judging it. It asks what behavior the test protects, which
credible regression breaks it, and why existing coverage misses that failure.
It also checks for production exports, flags, or hooks needed only by tests.

A new test without those answers is not added. Tests that require unnecessary
access to internals move to the real boundary. Patterns such as missing
assertions or expected values calculated by the code under test need scrutiny.
Before removing coverage, the agent identifies the remaining test that would
catch the failure, or the change that retired the contract.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/test-audit/SKILL.md)
links the full value criteria and validation procedure.

## What you get

- The audited range, findings, suspicious tests retained with reasons, and limits.
- For edits, a coverage record for each added or removed test.
- For edits, production and test lines changed, reported separately, plus follow-ups.

A read-only audit changes nothing. Commits, pushes, and PRs need your request.
