---
related: [checkpoint]
---

## What it does

Catch-up answers from the conversation alone. It runs no commands, so it
returns in seconds. It does not recheck the repository.

## When to use it

Install the skill, then run `/catch-up` in Claude or `$catch-up` in Codex when
you return to a thread and have lost track of it. It runs only when you call
it.

For verified branch state and check results before a handoff, use
[checkpoint](../checkpoint/) instead.

## How it works

The agent reads the conversation and writes the recap without running tools.
It links PRs, files, and threads when the conversation has them, and marks
claims the conversation never verified. If you ask for verified state or a
handoff, it points you to `checkpoint`.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/catch-up/SKILL.md)
has the exact format.

## What you get

Four lines:

- Goal: what the thread is for.
- Done: what it has reached so far.
- Now: what is in progress or waiting, or that the thread can close.
- Next: the next step and who owns it.
