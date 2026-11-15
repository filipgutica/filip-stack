---
related: [checkpoint]
---

## What it does

Catch-up answers from the conversation alone. It runs no commands, so it
returns in seconds, and it does not recheck the repository.

## When to use it

Install the skill, then run `/catch-up` in Claude or `$catch-up` in Codex when
you return to a thread and have lost track of it. It runs only when you call
it. For verified branch state and check results, use
[checkpoint](../checkpoint/).

## How it works

The agent links PRs, files, and threads the conversation names, and marks
claims the conversation never verified.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/catch-up/SKILL.md)
has the exact format.

## What you get

Four lines:

- Goal: what the thread is for.
- Done: what it has reached so far.
- Now: what is in progress or waiting, or that the thread can close.
- Next: the next step and who owns it.
