---
related: [review, full-send]
---

## What it does

Merge council runs an independent chair and three reviewers on a pull request.
It returns a verdict tied to the reviewed commits and, on your own open PRs,
can fix and push agreed findings.

## When to use it

- Request a merge council or council review explicitly.
- Follow up an earlier council using its saved record and your decisions.
- Configure the chair and reviewers with `merge-council setup`.

A general PR review request uses another [review](../review/) route. The
council requires a PR, a configured roster, and a host that can run its agents.

## How it works

1. Validates the roster against available models and resolves the PR and checkout.
   A fresh chair runs the council without the launcher's conversation context.
2. Freezes the head and base commits and prepares a separate review worktree.
   Your own open PR uses fix mode when you can push; other cases are read-only.
3. Gives all three members the same subject. Each reviews the whole PR, with
   deeper attention to contracts, risk, or simplicity and evidence.
4. Reconciles findings independently. Agreement requires the same claim, remedy,
   and blocking classification; disagreements stay explicit.
5. In fix mode, assigns only unanimously eligible remedies to one fixer.
   Pushed fixes trigger a new full review. The run permits two fix pushes.
6. Produces a verdict and record. Before acting on approval, the launcher
   checks that head and base still match and CI passes.

## What you get

- `APPROVE`, `CHANGES_REQUESTED`, or `NEEDS_HUMAN` for the frozen subject.
- A short report of blocking items and selected non-blocking findings.
- A detailed `record.json` for follow-up work.

Missing coverage or changed instruction files can require human review.
[Full send](../full-send/) can finish open council items. Council approval
alone does not grant merge permission.
