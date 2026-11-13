---
related: [checkpoint]
---

## What it does

Catch-up answers from the conversation alone, so it returns in seconds and
runs no commands. It reminds you what the thread is for and where it stands.
It does not re-verify the repository.

## When to use it

Install the skill with the command above. Catch-up runs only when you invoke
it: `/catch-up` in Claude or `$catch-up` in Codex.
Use it when you return to a thread and have lost track of it.

For verified branch state and check results before a handoff, use
`checkpoint` instead.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/catch-up/SKILL.md)
has the exact format.

## What you get

Four lines:

- Goal: what the thread is for.
- Done: what it has reached so far.
- Now: what is in progress or waiting, or that the thread can close.
- Next: the next step and who owns it.
