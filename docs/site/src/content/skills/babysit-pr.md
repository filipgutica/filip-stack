---
related: [full-send, sol-loop]
---

## What it does

The agent checks each bot comment against the code before it changes
anything. It tells real failures from flaky infrastructure, and keeps fixes
within what the PR is meant to do.

## When to use it

Install the skill, then name the PR:

> babysit PR 42

Use it after you open a PR, while CI and bots run.
[Full-send](../full-send/) and [full-stop](../full-stop/) use it for this
step.

In T3 Code, it uses the PR watcher, and elsewhere its bundled `pr-wait`
script. One watcher owns each PR, so the agent does not poll in a loop.
[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/babysit-pr/SKILL.md)
has the waiting and recovery steps for each host.

## How it works

The agent handles existing checks and comments, then waits for ones newer
than the latest push. When nothing needs action, it stays quiet.

Extra tests, unneeded guards, and small speedups outside the goal become
follow-ups. CodeRabbit findings are checked like any other, but the agent
never waits for CodeRabbit or holds a merge for it.

Before it reports the PR ready, the agent checks the base branch. If new
base commits touch the PR's files, it rebases, pushes, and waits for green
again.

## What you get

- Real CI failures and findings fixed, and false positives answered.
- A ready PR, or a concrete blocker.

Merging needs your explicit request. If another PR makes this one obsolete,
the agent asks before closing it, unless you already authorized that.
