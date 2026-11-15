---
related: [test-audit, walkthrough]
---

## What it does

The agent checks the change against your request and the repository's rules,
including `AGENTS.md` or `CLAUDE.md`, and edits nothing.

## When to use it

Install the [Workflow plugin](../../#install), then name what to review:

> Review this branch against main before I open the PR.

You can name a working tree, branch, PR, commit, commit range, or document. To
apply the findings, ask for fixes with [engineering](../engineering/). For a
guided explanation of a change, use [walkthrough](../walkthrough/).

## How it works

The agent first confirms the exact subject. For a branch, that is everything
from the merge base to its head. It reports changes outside that range
instead of reviewing them silently.

It reads every changed file and follows the affected behavior through
callers, tests, types, configuration, and documentation. Changed or removed
tests must still protect the behavior, and large test changes get a
read-only [test-audit](../test-audit/). A check that could not run is a
limitation, never a pass. Style preferences and requests for more scope are
not findings.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/review/SKILL.md)
has the exact scope and evidence rules.

## What you get

- Findings ordered by impact, each with a file and line or a command result,
  the consequence, and the next action.
- A plain statement when the evidence supports no findings.
- What was reviewed, the check results, and the limits, including whether the
  reviewer was independent of the author.

Review does not edit, commit, push, post comments, or accept the change.
