---
related: [full-stop, sol-loop, babysit-pr, merge-council]
---

## What it does

The agent proves the change, has Sol review the code and the PR description,
opens the PR, and waits out CI and review bots. Sol is OpenAI's GPT Sol model,
run through [sol-loop](../sol-loop/). Because you are not watching, the agent
asks you only what it cannot decide alone.

It is the light review path: one Sol reviewer instead of the three reviewers
that [merge-council](../merge-council/) uses. It can also finish the open
items from an earlier merge council.

## When to use it

- You have a local change or an existing PR and want it finished.
- You can merge the PR and want it merged once every check passes.
- You want a verdict on whether a PR is ready for human review.

Install it together with [sol-loop](../sol-loop/) and
[babysit-pr](../babysit-pr/); full send stops if either is missing. Call it by
name with `/full-send` in Claude or `$full-send` in Codex, with your goal or a
PR link, for example `/full-send fix the flaky login test`. To keep the merge
for yourself, use [full-stop](../full-stop/).

## How it works

When it starts, full send picks two modes, fix or review only, and merge or
verdict. It checks both again before it finishes:

| Mode | When it applies | What it may do |
| --- | --- | --- |
| Fix | You wrote the PR, or it does not exist yet, and you can push to it | Commit and push fixes to the PR's branch |
| Review only | Someone else's PR, or one you cannot push to | Report findings, without pushing |
| Merge | Fix mode, you can push to the base repository, and no review still blocks the PR | Merge when every check passes |
| Verdict | Every case where merge mode does not apply | Finish with `PASS` or `FAIL`, without merging |

Every change needs proof the agent saw itself: a reproduction that fails and
then passes, the repository's CI checks, or, for UI and runtime behavior, the
running app. Passing mocked tests alone do not count.

The agent fixes routine findings itself. A fix that changes a public contract,
data or a migration, security, or a dependency, or that removes a test without
evidence another test covers it, goes to you as a question. It also asks when
it cannot prove a change, when the next step is outside what full send allows,
such as deleting data or touching production, or when your goal is ambiguous.
It asks with the host's question tool, so the question is not lost in a
message you are not reading.

It merges only when the proof covers the whole diff, Sol has approved, required
checks are green, bots have finished, no human review asks for changes, and the
branch is up to date. It never uses `--admin` or another way around those
checks.

## What you get

- A first line of `Merged: <merge commit>`, `PASS: ready for human review`, or
  `FAIL: <main reason>`.
- The PR link, the proof, the Sol rounds and what they changed, findings fixed
  and declined with reasons, and how each merge council item closed.
- The decisions it made for you, and anything you still need to do.

Calling full send allows commits and pushes to the PR's own branch in fix mode,
a `--force-with-lease` push to that branch after a rebase, and the merge in
merge mode.
