---
related: [review, simplify-pass]
---

## What it does

Each test must protect a real behavior that no other test already covers. The
audit flags tests that only add maintenance cost, and production code that
exists only for tests. It keeps a doubtful test when it is the only
protection for a real contract.

## When to use it

Install the [Workflow plugin](../../#install), then name the tests or change to
audit. [Engineering](../engineering/) and [review](../review/) also call it
when test changes are large or a test's value is unclear. Edits need your
request:

> Audit the tests in `src/billing/` for duplicates and implementation-coupled
> assertions. Read-only, please.

## How it works

| Mode | Scope |
| --- | --- |
| Authoring | Each new or changed test as it is written |
| Audit | Existing tests in the files or change you name |
| Campaign | Every test in one subsystem; only when you ask |

For each test, the agent asks: what behavior does it protect, which realistic
bug breaks it, and why do other tests miss that bug? A new test without good
answers is not added. A test that needs an export, flag, or hook no
production code uses moves to the real boundary. Before it removes a test,
the agent names the remaining test that catches the same failure, and
afterwards it checks for unused files, exports, and dependencies.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/test-audit/SKILL.md)
links the full criteria.

## What you get

- The audited range, the findings, doubtful tests kept with reasons, and
  limits.
- For edits, a record for each added or removed test, and production and
  test lines changed.

Commits, pushes, and PRs need your request.
