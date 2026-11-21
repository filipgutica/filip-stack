---
related: [checkpoint, catch-up]
---

## What it does

Tell your agent in plain words to add, list, or close tasks you plan to do
later. It saves each item as an open issue in your private `<login>/todos`
GitHub repository via the signed-in `gh` CLI. Each issue records its source and
machine, never secret values. You get one cross-machine list with stable issue
numbers and closed history on GitHub.

## When to use it

Use this skill for open items you owe across threads and machines. Sign in to
`gh` with the same GitHub login on each machine so they share one list.

- "Add rotating the deploy key to my todos" or "remind me later to..." adds an
  item.
- "What's on my todos?" lists open items oldest first with their issue numbers.
- "Done with 3" or "cleared the DB thing" closes an item.

When you defer something casually, the agent offers once to add it. At a
handoff, it offers once to move deferred **Waiting on you** items into todos.

For task state, use [checkpoint](../checkpoint/). For a thread recap, use
[catch-up](../catch-up/).

## How it works

1. **Verify privacy.** Before every action, the agent checks `<login>/todos` and
   stops unless it confirms `PRIVATE`. On an add when the repo is missing, it
   asks before creating it as private and rechecks visibility.
2. **Add safely.** Each issue gets a clear title, source, and machine name,
   naming credentials or files instead of secret values.
3. **List and close.** Lists sort oldest first, show the source machine when it
   differs from the current machine, and flag items over 30 days as stale.
   Ambiguous close requests ask which item.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/todos/SKILL.md)
has the exact commands.

## What you get

- Issue-number confirmation when you add an item.
- One shared oldest-first list across machines and agents.
- GitHub history (`completed` for done items, `not planned` for dropped ones).
