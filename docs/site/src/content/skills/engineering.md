---
related: [planning, review, test-audit]
---

## What it does

The change stays focused on the behavior you requested. The agent avoids
speculative options, dependencies, abstractions, and nearby cleanup while
preserving validation, error handling, security, and meaningful tests.

## When to use it

Install the [Workflow plugin](../../#install), then ask for the code change
in plain words. The agent selects engineering when the request matches;
you do not need a special command. For example:

> Fix the off-by-one error in the date picker's week numbers.

Use it for a feature, bug fix, refactor, failing test, CI failure, or review
feedback you want checked or applied. An explanation alone does not need it.
For a direction, specification, plan, or tickets without code edits, use
[planning](../planning/).

## How it works

The agent reads the code that owns the behavior and the nearest tests. It
runs a suitable existing test before editing. For larger work, it states a
plan and compares it with a simpler option. If no change is needed, it stops.

Correct tests constrain the fix. The agent changes a test only when evidence
shows it is wrong or its contract changed on purpose. New coverage must catch
a regression existing tests miss; a bug regression test must fail on the old
code first.

After editing, the agent reruns the affected checks and inspects the diff for
accidental changes, duplication, and dead code. Substantial coverage changes
get a [test-audit](../test-audit/). Risky work, such as migrations or security
changes, needs review by an agent that did not write it, when the host supports
that review.

Workers and reviewers keep further delegation within the brief's authority.
Truncated output sends the agent to the named artifact first. Credential and
token diagnostics reveal only whether a value is present.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/engineering/SKILL.md)
has the exact implementation and verification contract.

## What you get

- The requested change, with the commands run and their results.
- Remaining risks and checks that could not run, reported as unverified.

Engineering does not commit, push, or publish without your authorization.
