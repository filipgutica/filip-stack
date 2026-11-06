---
related: [test-audit, walkthrough]
---

## What it does

The agent checks a bounded change against your request and the repository's
rules, including applicable `AGENTS.md` or `CLAUDE.md` guidance. Files stay as
they are; findings are evidence for a later decision or fix.

## When to use it

Install the [Workflow plugin](../../#install), then name what to review. The
agent selects review when the request matches. For example:

> Review this branch against main before I open the PR.

You can name a working tree, branch, PR, commit, commit range, or existing
document. Use it for a final check before accepting work. To apply findings,
ask for fixes through [engineering](../engineering/). For an interactive
explanation of the change, use [walkthrough](../walkthrough/).

## How it works

The agent verifies the exact subject first. For a branch, that means its
verified merge base through its head. It reports unrelated or dirty changes
outside the selected range instead of including them silently.

It reads every changed file and traces affected behavior through the owning
code, callers, tests, types, configuration, and documentation. Changed or
removed tests must still leave the behavior protected, unless the contract
they checked is now obsolete. Substantial coverage
changes get a read-only [test-audit](../test-audit/).

Checks stay focused on the selected contract. Available complexity, dead-code,
and duplication tools contribute evidence. A blocked or unavailable check is
a limitation, never a pass. Style preferences and requests to expand scope do
not count as findings.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/review/SKILL.md)
has the exact scope and evidence requirements.

## What you get

- Findings ordered by impact, each with a file and line or command evidence,
  the consequence, and a precise next action.
- A statement that no findings are supported, when that is what the evidence shows.
- The reviewed subject, exact check results, and limits, including whether
  the reviewer was independent of the author.

Review does not edit files, commit, push, publish, post comments, or accept
the change for you.
