---
related: [full-send, sol-loop]
---

## What it does

Bot comments are checked against the source before they lead to code changes.
The agent separates real repository failures from flaky infrastructure and
keeps fixes within the PR's intended behavior.

## When to use it

Install the skill with the command above, then name the PR and ask the agent
to watch it. For example: "babysit PR 42". The agent selects the skill for
requests to monitor, watch, or babysit a PR.

Use it after opening a PR, while CI and automated reviewers run, or when
failures and bot findings need attention. [Full-send](../full-send/) and
[full-stop](../full-stop/) use it for this part of their work.

The skill uses T3 Code's PR watcher there, or its bundled `pr-wait` script
elsewhere. One watcher owns each PR; the agent does not create a polling loop.
[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/babysit-pr/SKILL.md)
has the host-specific waiting and recovery instructions.

## How it works

The agent handles existing checks and comments before waiting for new events.
It acts only on checks and comments newer than the latest push. When nothing
needs action, it stays quiet.

Real findings get fixes. False positives get a written dismissal. Extra tests,
unneeded edge-case guards, and small speedups outside the goal become
follow-ups with reasons. CodeRabbit findings get the same scrutiny, but the
agent never waits for CodeRabbit or holds a merge for it.

Before reporting readiness, the agent checks the base branch, conflicts, and
whether the PR is behind. If base commits after the last green run touch the
PR's files, it rebases, pushes, and waits for green again.

## What you get

- Real CI failures and findings resolved, with false positives answered.
- A ready PR or a concrete blocker.
- Declined changes recorded as follow-ups.

Merging requires your explicit request. Immediately before a merge, the agent
fetches and rechecks the PR. If another PR makes this one obsolete, it stops
and asks before closing it unless closure was already authorized.
