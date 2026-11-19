---
related: [checkpoint, catch-up]
---

## What it does

Todos keeps one plain Markdown file per machine, at
`~/.config/filip-stack/todos.md`, so an item you defer in one thread shows up
when you ask in another. The file stays outside any repository and is not
synced between machines.

## When to use it

Install the skill, then talk to the agent as you normally would:

- "Add rotating the deploy key to my todos" or "remind me later to…" adds an
  item.
- "What's on my todos?" lists the open items, oldest first and numbered.
- "Done with 3" or "cleared the DB thing" removes an item.

When you say you will do something later without asking for a todo, the agent
offers once to add it. At a handoff, it offers to move the items you are
deferring from **Waiting on you**.

Todos are items you owe. For the verified state of a task, use
[checkpoint](../checkpoint/); for a recap of a thread, use
[catch-up](../catch-up/).

## How it works

Each item is one dated line with the repository or thread it came from. The
agent appends new items and deletes finished ones one exact line at a time,
right after reading the file, so an item another agent adds meanwhile is
rarely lost. When a list includes items older than 30 days, the agent marks
them stale and asks whether to drop them.
Items name a credential or file, never a secret value.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/todos/SKILL.md)
has the exact format.

## What you get

A short list that holds only open items. Finished items are deleted, not
checked off.
