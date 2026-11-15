---
related: [council, review, full-send]
---

## What it does

The [council](../council/) members each review the whole PR on their own,
then vote on the pooled findings without knowing who raised them. A finding
counts as agreed only when every member agrees on the problem, the fix, and
whether it blocks the merge. The verdict covers only the commits reviewed.

## When to use it

It uses council's members, listed on the [council page](../council/). The
install command above also installs `council`.

Ask for a merge council by name. A general "review this PR" uses a lighter
skill such as [review](../review/). Run `/merge-council` in Claude or
`$merge-council` in Codex with a PR link, or none for the current branch's
PR:

> /merge-council https://github.com/acme/app/pull/42

## How it works

Your agent coordinates but decides nothing: fixed rules turn the votes into
fixes and a verdict.

On your own open PR that you can push to, a fixer commits the agreed
findings every member marks safe to fix, and the members review the whole PR
again, for at most two fix pushes. On other PRs, the council only reports.

A change to an instruction file such as `AGENTS.md` or `CLAUDE.md` always
gets `NEEDS_HUMAN`, though the review still runs.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/merge-council/SKILL.md)
defines the rounds, fix rules, and verdict rules.

## What you get

- `APPROVE`, `CHANGES_REQUESTED`, or `NEEDS_HUMAN` for the reviewed commits.
- A short report: whether the PR can merge, what must happen first, and
  non-blocking findings.
- A `record.json` that a later run continues from.

Before it acts on an approval, your agent checks that the PR's commits still
match and CI passes. It merges only where repository guidance
allows merging on council approval; otherwise it reports that the PR is
ready. [Full-send](../full-send/) can finish open council items.
