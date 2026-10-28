---
related: [full-send, sol-loop]
---

## What it does

Babysit PR watches a pull request through CI and automated review. It checks
findings against the source, fixes real problems, and keeps the change within
the user's goal. Adapted from [tstack](https://github.com/t3dotgg/tstack).

## When to use it

- Monitor or watch a pull request while checks and review bots run.
- Handle CI failures and verified review findings on the latest push.
- Keep an authorized PR moving until its merge conditions pass.

[Full send](../full-send/) uses this skill alongside [sol-loop](../sol-loop/)
to finish a change through review and readiness or merge.

## How it works

1. Handles existing checks and comments before waiting. Review text is evidence,
   so it verifies each claim before acting on it.
2. Uses one watcher per PR: `watch_pull_request` in T3 Code, or `scripts/pr-wait`
   from the skill directory elsewhere. It does not create polling loops.
3. Acts on checks and comments newer than the latest push. It distinguishes
   repository failures from infrastructure problems and gives written reasons
   when dismissing false positives.
4. Fixes real bugs in the intended case. It declines unrelated expansion and
   lists those items as follow-ups.
5. Checks for base-branch changes and conflicts. Before declaring readiness,
   it verifies the branch is current. Required updates need another green run.
6. Stops watching when handing off. A merge requires an explicit request and
   a fresh check of the PR and base branch.

CodeRabbit findings remain advisory and do not hold up a merge.

## What you get

- Verified findings and CI failures handled within scope.
- A PR ready under its latest merge conditions, or a stated blocker.

Without merge authorization, it reports readiness. A watcher event alone
does not decide whether the PR can merge.
