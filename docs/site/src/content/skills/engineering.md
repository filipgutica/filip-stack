---
related: [planning, review, test-audit]
---

## What it does

Engineering is the Workflow skill your agent uses whenever you ask it to
change code. It aims for the smallest change that does what you asked, with
no speculative options, abstractions, dependencies, or nearby cleanup. Small
never means dropping error handling, validation, security, or tests that
matter.

## When to use it

Use it for code work you have asked the agent to do:

- a code change, bug fix, or refactor
- a failing test or a CI failure
- review feedback to check or apply

Engineering does not handle questions that need only an explanation. For a
direction, specification, plan, or tickets without edits, use
[planning](../planning/).

Engineering comes with the [Workflow plugin](../../#install). You do not call
it by name: ask for the change in plain words and the agent picks it. An
illustrative request:

> Fix the off-by-one error in the date picker's week numbers.

## How it works

Before it edits, the agent reads the code that owns the behavior and the
nearest existing test, and runs that test when one fits. For larger work it
states a plan and compares it with a simpler option. If no change is needed,
it stops there.

It fixes the code before it touches a correct test. It changes a test only
when evidence shows the test is wrong or the behavior it checks has changed
on purpose. It adds a test only for a regression that existing tests would
miss, and a new test for a bug must fail on the old code first.

When the change is done, it reruns the test and the affected checks, then
reads the whole diff for accidental changes, duplication, and dead code.
Large test changes go through [test-audit](../test-audit/). Risky changes,
such as a data migration or a security fix, get a review from an agent that
did not write the change, when the host can run one.

## What you get

- The change, with each command that proves it and the command's result.
- Any remaining risk, stated plainly. A check that could not run is reported
  as not run, never as passed.

Engineering does not commit, push, or publish unless you ask it to.
