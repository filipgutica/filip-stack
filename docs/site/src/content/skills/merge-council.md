---
related: [council, review, full-send]
---

## What it does

Your agent convenes the [council](../council/) members on a pull request.
Each member reviews the whole PR on its own, then all members vote on the
pooled findings without seeing who raised them. A finding counts as agreed
only when every member agrees on the problem, the remedy, and whether it
blocks merging. The verdict applies only to the commits reviewed.

## When to use it

Install the skill together with `council`, then explicitly ask for a merge
council. A general "review this PR" uses a lighter route such as
[review](../review/).

Invoke `/merge-council` in Claude or `$merge-council` in Codex with a PR URL,
for example `/merge-council https://github.com/acme/app/pull/42`. With no
argument, it uses the current branch's PR. The members are the council's
lineup, so changing the council changes the merge council too.

## How it works

Your agent coordinates but decides nothing itself: fixed rules turn the
members' votes into fixes and a verdict.

On your own open PR, when you can push to it, fix mode applies agreed
findings that every member marks safe to fix. A fixer commits and pushes
them, and the members review the whole PR again. The run allows at most two
fix pushes. On other PRs, the council reports without fixes.

Changes to instruction files such as `AGENTS.md` or `CLAUDE.md` always force
`NEEDS_HUMAN`; the review still runs.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/merge-council/SKILL.md)
defines the review rounds, fix rules, and verdict rules.

## What you get

- `APPROVE`, `CHANGES_REQUESTED`, or `NEEDS_HUMAN` for the reviewed commits.
- A short report stating whether the PR can merge, what must happen first,
  and non-blocking findings.
- A `record.json`; another run continues from the record after you address
  its open items.

Before acting on approval, your agent verifies that the PR's head and base
commits still match and CI passes. It merges only where repository guidance
allows merging on council approval; otherwise it reports readiness.
[Full-send](../full-send/) can finish open council items.
