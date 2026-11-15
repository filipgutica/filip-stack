---
related: [council, review, full-send]
---

## What it does

The [council](../council/) members each review the whole PR on their own.
Then all members vote on the pooled findings without knowing who raised them.
A finding counts as agreed only when every member agrees on the problem, the
fix, and whether it blocks the merge. The verdict covers only the commits
reviewed.

## When to use it

Like council, it needs an agent that can run both OpenAI and Claude models.
By default, the members are Astra (OpenAI's `gpt-6-astra`), Sol (OpenAI's
`gpt-6.1-sol`), Opus (Claude Opus 5.5), and Fable (Claude Fable 5.2). The
[council page](../council/) explains the lineup. The install command above
also installs `council`.

Ask for a merge council by name. A general "review this PR" uses a lighter
skill such as [review](../review/). Run `/merge-council` in Claude or
`$merge-council` in Codex with a PR link:

> /merge-council https://github.com/acme/app/pull/42

With no link, it uses the current branch's PR. Changing the council's lineup
changes the merge council too.

## How it works

Your agent coordinates but decides nothing. Fixed rules turn the members'
votes into fixes and a verdict.

On your own open PR that you can push to, fix mode applies the agreed
findings that every member marks safe to fix. A fixer commits and pushes
them, and the members review the whole PR again. A run makes at most two fix
pushes. On other PRs, the council reports without fixing.

A change to an instruction file such as `AGENTS.md` or `CLAUDE.md` always
gets `NEEDS_HUMAN`, though the review still runs.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/merge-council/SKILL.md)
defines the rounds, fix rules, and verdict rules.

## What you get

- `APPROVE`, `CHANGES_REQUESTED`, or `NEEDS_HUMAN` for the reviewed commits.
- A short report: whether the PR can merge, what must happen first, and
  non-blocking findings.
- A `record.json`. A later run continues from it after you address the open
  items.

Before it acts on an approval, your agent checks that the PR's head and base
commits still match and CI passes. It merges only where repository guidance
allows merging on council approval; otherwise it reports that the PR is
ready. [Full-send](../full-send/) can finish open council items.
