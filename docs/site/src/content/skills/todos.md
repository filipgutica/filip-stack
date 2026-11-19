---
related: [checkpoint, catch-up]
---

## What it does

Todos keeps each item as an open issue in your private `todos` repository on
GitHub, so an item you defer on one machine shows up when you ask on another.
Agents use the `gh` CLI, which needs to be signed in on each machine.

## When to use it

Install the skill, then talk to the agent as you normally would:

- "Add rotating the deploy key to my todos" or "remind me later to…" adds an
  item.
- "What's on my todos?" lists the open items, oldest first, by issue number.
- "Done with 3" or "cleared the DB thing" closes an item.

When you say you will do something later without asking for a todo, the agent
offers once to add it. At a handoff, it offers to move the items you are
deferring from **Waiting on you**.

Todos are items you owe. For the verified state of a task, use
[checkpoint](../checkpoint/); for a recap of a thread, use
[catch-up](../catch-up/).

## How it works

The repository is `<your GitHub login>/todos`. On first use, the agent asks
before creating it as a private repository, and it stops if the repository is
public. Each issue records the repository or thread it came from and the
machine it was added on, so a list shows which items belong to another
machine. When a list includes items older than 30 days, the agent marks them
stale and asks whether to drop them. Items name a credential or file, never a
secret value.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/todos/SKILL.md)
has the exact commands.

## What you get

One list shared by every machine and agent. Finished items are closed as
completed, and dropped ones as not planned, so GitHub keeps their history.
