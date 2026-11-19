---
name: todos
description: Keep the user's deferred items as a todo list in their private GitHub repository, so any agent on any machine can read and update it. Use when the user asks to add, list, or clear a todo ("remind me later to", "what's on my todos", "done with 3"), says they will do something later, asks what is left on their list, or when a handoff's Waiting on you list holds items they are deferring.
---

# Todos

A todo is an open item the user owes, kept across threads, repositories, and machines. It is not a record of a task's state: `checkpoint` captures verified state for a handoff, and `catch-up` recaps a thread.

## The list

Each todo is an open issue in the user's private `todos` repository: `<login>/todos`, where `<login>` is `gh api user --jq .login`. Pass `-R <login>/todos` to every `gh issue` command.

Before each add, list, or clear, run `gh repo view <login>/todos --json visibility` and continue only when it returns `PRIVATE`:

- When `gh` reports the repository as not found, it is missing or this login cannot see it. For a list or clear, say that this `gh` login sees no todos repository. For an add, ask the user before creating it with `gh repo create <login>/todos --private`, then check its visibility again.
- When the visibility is anything else, or the lookup fails, stop and tell the user. Never write a todo to a repository that is not private.

An issue's title is the item, written so it makes sense a month later: what to do, and where. Its body is one line: `From: <repo or thread> · Host: <hostname -s>`. Name a credential, file, or setting instead of writing a secret value, token, or personal data.

## Add

Run `gh issue create -R <login>/todos --title <item> --body <body line>`, quoting the title and body for the shell so apostrophes survive. Then confirm the issue number and title.

When the user defers something without asking for a todo ("I'll do that later"), offer once to add it, and add it only when they agree. At a handoff, offer once to move the **Waiting on you** items the user is deferring into todos.

## List

Run `gh issue list -R <login>/todos --state open --limit 200 --json number,title,body,createdAt --jq 'sort_by(.createdAt)'`. Leave out `--search`: its index lags, so an item added moments ago can be missing. Show each item with its issue number, date, and source, oldest first. Show the host when it differs from this machine's. Mark each item older than 30 days as stale and ask whether to drop it.

## Clear

1. Match the user's issue number or wording to one open issue. Issue numbers stay the same in every thread.
2. When the wording matches more than one item, or the number is not an open issue, show the candidates and ask which one.
3. Close a done item with `gh issue close <number> -R <login>/todos --reason completed`, and a dropped one with `--reason 'not planned'`.
4. Report the closed item.
