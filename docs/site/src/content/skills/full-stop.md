---
related: [full-send, sol-loop, babysit-pr, council]
---

## What it does

Give full stop a local change, a goal, or a PR link, and it runs
[full-send](../full-send/)'s review and CI loop without ever merging. Unlike
full send, full stop stops before merging and, in fix mode, turns off
auto-merge and leaves any merge queue. Your agent proves the change, runs
[sol-loop](../sol-loop/) or [council](../council/) review, and handles CI and
bots via [babysit-pr](../babysit-pr/). You get a verdict saying whether the PR
is ready to merge, waiting on human approval, or blocked (`FAIL`), while the PR
stays open.

## When to use it

Use full stop to prepare a PR while you are away and merge it yourself. To let
the agent merge, use [full-send](../full-send/).

It needs `full-send`, `sol-loop`, `babysit-pr`, and `council` (for a score
check), all installed above, plus a host that runs Sol or the
[council](../council/) lineup.

Run `/full-stop` in Claude or `$full-stop` in Codex with a goal or PR link:

> /full-stop `<PR URL>`

Add a **threshold** (minimum 0 to 10 score, defaulting to 9.5) for a
[council](../council/) **gate** pass:

> /full-stop `<PR URL>` council 9.5

This grants full send's commit, push, rebase, and testing permissions, never
merging, auto-merge, merge queues, or pushes to the default branch.

## How it works

Full stop follows [full-send](../full-send/)'s rules, with three overrides:

1. **Always return a verdict.** It stays in verdict mode even when you can
   merge, never merging, enabling auto-merge, or queuing a merge.
2. **Block automatic merges.** In fix mode, it turns off auto-merge and removes
   the PR from any merge queue before starting and before each push. In
   review-only mode, it reports those settings unchanged. Whenever it cannot
   stop the PR from merging without you, it asks before continuing.
3. **Check readiness at handoff.** Before stopping, it checks full send's gate
   on the final diff and confirms the live PR is open, not a draft, and not
   set to merge automatically (including via auto-merge or a merge queue).

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/full-stop/SKILL.md)
lists every override over full send.

## What you get

- `PASS: ready to merge`, `PASS: ready for human review` (only human approval
  remains), or `FAIL: <main reason>`.
- Full send's evidence, review rounds or scores, and decisions, plus the final
  head commit and confirmation the PR is still open (or merged by someone
  else).
