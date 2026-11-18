---
name: todos
description: Keep the user's deferred items in one Markdown todo list that any agent can read and update. Use when the user asks to add, list, or clear a todo ("remind me later to", "what's on my todos", "done with 3"), says they will do something later, asks what is left on their list, or when a handoff's Waiting on you list holds items they are deferring.
---

# Todos

A todo is an open item the user owes, kept in one file across threads and repositories. It is not a record of a task's state: `checkpoint` captures verified state for a handoff, and `catch-up` recaps a thread.

## The file

The list lives at `$XDG_CONFIG_HOME/filip-stack/todos.md`, or `~/.config/filip-stack/todos.md` when that variable is unset or empty. There is one file per machine, outside any repository. A missing file means an empty list; create the file and its directory on the first add.

Each item is one line:

```text
- [ ] YYYY-MM-DD <item> (from: <repo or thread>)
```

The date is the day the item was added. `from` names the repository, or the thread when no repository applies. Write the item so it makes sense a month later: what to do, and where. Name a credential, file, or setting instead of writing a secret value, token, or personal data.

## Add

Append the line with a shell append, such as `printf '%s\n' '<line>' >> <file>`, so items that other agents write at the same time survive. Then confirm the added line.

When the user defers something without asking for a todo ("I'll do that later"), offer once to add it, and add it only when they agree. At a handoff, offer once to move the **Waiting on you** items the user is deferring into todos.

## List

Read the file and show the open items oldest first, numbered from 1, with their dates and sources. Mark each item older than 30 days as stale and ask whether to drop it.

## Clear

A done item is deleted, not checked off, so the file stays short.

1. Match the user's number or wording to one item. A number refers to the last list shown in this thread; when this thread has shown none, list first.
2. When the wording matches more than one item, show the candidates and ask which one.
3. Read the file again and delete that exact line with an exact-text edit, such as the Edit tool. When the line has changed or is gone, list again and confirm.
4. Report the removed line.

Edit one line at a time. Rewriting the whole file can drop items that another agent added meanwhile.
