---
related: [review, simplify]
---

## What it does

Every test costs time to run, read, and update. Typical low-value tests repeat
another test's proof, or break when you rename a private function even though
the behavior did not change. Test audit also flags production code that
exists only so a test can reach it.

## When to use it

- You want to audit or clean up a set of tests.
- A change adds, removes, or rewrites a lot of tests.
- You are unsure whether a new test adds anything, or whether deleting one
  would lose the last proof of a behavior.

Test audit comes with the [Workflow plugin](../../#install). The agent picks
it when your request matches, and [engineering](../engineering/) and
[review](../review/) call it for large test changes. An illustrative request:

> Audit the tests in `src/billing/` for duplicates and tests that only mirror
> the implementation.

## How it works

Test audit works in one of three modes:

| Mode | What it covers |
| --- | --- |
| Authoring | Each new or changed test, as it is written |
| Audit | A focused sweep of existing tests in the files or change you name |
| Campaign | Every test one subsystem owns; runs only when you ask for it |

For each test, it asks four questions. What behavior does it protect? What
real regression would make it fail? Why does no other test already catch that
failure? Does it need an export, flag, or hook in production code that only
the test uses? A new test without good answers is not added yet, and a test
that needs such a hook moves to the real boundary instead. It also checks
each test against a list of common low-value patterns, such as a test with no
assertions or a test whose expected value comes from the code under test.

Before it judges a test, it reads the whole test, the production code it
covers, the callers, and any overlapping tests. A suspicious test stays when it
is the only test that guards a real behavior. When it removes a test, it names
the remaining test that would still fail if that behavior broke, or the change
that retired the behavior.

## What you get

- The tests audited, the findings, the suspicious tests it kept and why, and
  the limits of what it checked.
- For edits, one line per added or removed test that says what still protects
  that behavior.
- For edits, production and test lines changed, counted separately, and the
  follow-ups it found.

A read-only audit reports findings and changes nothing. Test audit commits,
pushes, or opens a PR only when you ask.
