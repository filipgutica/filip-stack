---
related: [full-send, sol-loop, babysit-pr]
---

## What it does

The agent proves the change, has Sol, OpenAI's GPT Sol model, review the code
and the PR description, and waits out CI and review bots, just as
[full-send](../full-send/) does. It finishes with a verdict even when full send
would have merged.

## When to use it

- Finish a change while you are away, but keep the merge decision.
- Get an existing PR to a readiness verdict with no risk of a merge.

Install it together with [full-send](../full-send/), [sol-loop](../sol-loop/),
and [babysit-pr](../babysit-pr/); full stop stops if any of them is missing.
Call it by name with `/full-stop` in Claude or `$full-stop` in Codex, with your
goal or a PR link, for example `/full-stop https://github.com/acme/app/pull/42`.

## How it works

Full stop follows full send's modes, proof, fixes, and rules for asking you,
with one difference: it always finishes with a verdict instead of a merge.

In fix mode, it turns off auto-merge and takes the PR out of any merge queue
before it starts, and it checks again before each push. On a PR that it may
not change, it reports those settings instead. If it cannot stop the PR from
merging without you, it asks before it continues.

It uses full send's merge checks as its readiness check, and its proof and Sol
review must cover the final diff. Before it hands the PR back, it checks the
live PR: open, not a draft, and not set to merge on its own.

## What you get

- A first line of `PASS: ready to merge`, `PASS: ready for human review` when
  only a required human approval remains, or `FAIL: <main reason>`.
- Everything full send reports, plus the final commit and confirmation that the
  PR is still open and unmerged.

Calling full stop allows commits and pushes to the PR's own branch in fix mode.
It never merges, turns on auto-merge, adds the PR to a merge queue, or pushes
to the default branch.
