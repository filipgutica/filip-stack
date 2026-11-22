---
related: [checkpoint]
---

## What it does

Run catch-up in any thread with no input. The agent reads only chat with no
tool calls, replying in seconds without checking your repo. You get four
one-sentence lines covering goal, progress, current state, and next step.
Unlike [checkpoint](../checkpoint/), it skips branch checks and handoffs.

## When to use it

Run `/catch-up` in Claude or `$catch-up` in Codex when returning to a thread.
It runs only when called. If you invoke it for verified branch state, check
results, or a handoff, it points you to [checkpoint](../checkpoint/) and stops.

## How it works

The agent links PRs, files, and threads from chat, flags unverified claims, and
notes on `Now` when a thread can close.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/catch-up/SKILL.md)
has the format.

## What you get

- **Goal:** objective.
- **Done:** progress so far.
- **Now:** active, waiting, or ready to close.
- **Next:** next step and owner.
