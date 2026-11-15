---
related: [full-send, sol-loop]
---

## What it does

The agent checks each bot comment against the code before it changes
anything. It tells real failures from flaky infrastructure, and it keeps
fixes within what the PR is meant to do.

## When to use it

Install the skill, then name the PR and ask the agent to watch it:

> babysit PR 42

Use it after you open a PR, while CI and automated reviewers run.
[Full-send](../full-send/) and [full-stop](../full-stop/) use it for this part
of their work.

In T3 Code, it uses the PR watcher. Elsewhere, it uses its bundled `pr-wait`
script. One watcher owns each PR, so the agent does not poll in a loop.
[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/babysit-pr/SKILL.md)
has the waiting and recovery steps for each host.

## How it works

The agent first handles existing checks and comments, then waits for new
ones. It acts only on checks and comments newer than the latest push. When
nothing needs action, it stays quiet.

Real findings get fixes. False positives get a written reply. Extra tests,
unneeded edge-case guards, and small speedups outside the goal become
follow-ups with reasons. CodeRabbit findings get the same scrutiny, but the
agent never waits for CodeRabbit or holds a merge for it.

Before it reports the PR ready, the agent checks the base branch for
conflicts and new commits. If new base commits touch the PR's files, it
rebases, pushes, and waits for green again.

## What you get

- Real CI failures and findings fixed, and false positives answered.
- A ready PR, or a concrete blocker.
- Declined changes recorded as follow-ups.

Merging needs your explicit request. Just before a merge, the agent fetches
and rechecks the PR. If another PR makes this one obsolete, it asks before
closing it, unless you already authorized that.
