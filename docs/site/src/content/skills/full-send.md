---
related: [full-stop, sol-loop, babysit-pr, council]
---

## What it does

Give full send a local change, a goal, or a PR link, and it works unattended to
merge that PR. Unlike [full-stop](../full-stop/), which stops before merging,
full send merges once checks and permissions allow. Your agent proves the
change, runs review via [sol-loop](../sol-loop/) (or a [council](../council/)
score check), and handles CI and bots via [babysit-pr](../babysit-pr/). You get
a merged commit, or a `PASS` or `FAIL` verdict, with proof and the decisions
made while you were away.

## When to use it

Use full send to finish a change or PR and merge it unattended. To keep the
merge decision yourself, use [full-stop](../full-stop/).

It needs `sol-loop` and `babysit-pr` (plus `council` for a score check), all
included above, and a host that can run Sol (see [sol-loop](../sol-loop/)) or
every [council](../council/) model.

Run `/full-send` in Claude or `$full-send` in Codex with a goal or PR link:

> /full-send fix the flaky login test

Add a **threshold** (minimum 0 to 10 score, defaulting to 9.5) to replace
`sol-loop` with a [council](../council/) merge **gate** (a required score pass):

> /full-send fix the flaky login test council 9.5

In fix mode, this authorizes commits, pushes, and `--force-with-lease` after a
rebase on the PR's own branch. It also authorizes proof tests without asking
first, and merging only in merge mode after the merge gate passes.

## How it works

At the start and before finishing, your agent checks two modes:

| Mode | Applies when | Otherwise |
| --- | --- | --- |
| Fix | You authored the PR, or none exists, and you can push to its head repo | Review only: reports issues without pushing |
| Merge | Fix mode applies, you can push to the base repo, and review status permits merging | Verdict mode: returns `PASS` or `FAIL` without merging |

1. **Prove and review.** Your agent completes the goal (or starts from an
   existing PR) and gathers direct proof in the session (a reproduction, CI
   checks, or the running app with screenshots). Mocked tests alone do not
   prove UI. [Sol-loop](../sol-loop/) reviews code and PR text, or the
   [council](../council/) gate runs once checks turn green.
2. **Open and watch the PR.** In fix mode, it opens a non-draft PR or updates
   an existing one and fixes real CI and bot issues via
   [babysit-pr](../babysit-pr/). In review-only mode, it reports needed edits
   and findings without pushing.
3. **Ask on risky choices.** In fix mode, routine fixes happen in the loop.
   Your agent asks before touching public contracts, migrations, data,
   security, dependencies, uncovered test removals, missing proof, failed
   gates, or steps outside the grant, leaving the PR unmerged if unanswered.
4. **Merge only when green.** Merging requires merge mode, proof for the whole
   diff, Sol approval or a passed council gate, green required checks,
   finished bot reviews with each finding fixed or dismissed with a written
   reason, no human change request, and an up-to-date, mergeable branch, never
   using `--admin`.

Read
[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/full-send/SKILL.md)
for the exact contract, plus
[council gate](https://github.com/filipgutica/filip-stack/blob/main/skills/full-send/references/council-gate.md)
and
[council arbiter](https://github.com/filipgutica/filip-stack/blob/main/skills/full-send/references/council-arbiter.md).

## What you get

- `Merged: <merge commit>`, `PASS: ready for human review`, or
  `FAIL: <main reason>`.
- The PR link, proof, Sol rounds or council scores, and fixed or declined
  issues with reasons.
- Decisions made while you were away, and anything left for you to do.
