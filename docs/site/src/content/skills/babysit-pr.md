---
related: [full-send, sol-loop]
---

## What it does

After you open a pull request, CI runs and review bots, automated reviewers
such as Greptile, Macroscope, or CodeRabbit, leave comments. Bots are helpful
but not always right, so babysit PR checks each comment against the code
before it changes anything.

## When to use it

- You want someone to watch a PR while its checks and review bots run.
- A PR has CI failures or bot findings to sort out.
- You want an authorized PR kept moving until it can merge.

Install it with the command above, then ask in plain words, for example
"babysit PR 42". [full-send](../full-send/) and [full-stop](../full-stop/) use
it to see a PR through CI.

## How it works

The agent handles the checks and comments that already exist, then waits for
new ones. When nothing needs action, it stays quiet instead of posting "still
waiting".

It acts only on checks and comments newer than the latest push. It tells a
real failure in your code from a flaky CI machine, fixes real findings, and
replies with a written reason when it dismisses a false positive. CodeRabbit
findings are treated like any other finding, but the agent never waits for
CodeRabbit and never holds a merge for it.

Review loops tend to grow a PR one cheap fix at a time. Babysit PR fixes real
bugs in the case the PR is for, and declines the rest, such as extra tests,
guards for edge cases that do not matter, or small speedups, with a written
reason. Those become follow-ups.

It also watches the base branch. Before it calls a PR ready, it checks that
the branch is up to date with no conflicts, and if base commits that landed
after the last green run touch the PR's files, it rebases and waits for green
again.

## What you get

- CI failures and real findings fixed, and false positives answered.
- A PR that is ready to merge, or a clear statement of what blocks it.
- Follow-ups for the fixes it declined.

Babysit PR merges only when you asked it to, and it fetches and checks the PR
again right before the merge. Otherwise it reports that the PR is ready. If
another PR makes this one obsolete, it stops and asks you before closing it.
