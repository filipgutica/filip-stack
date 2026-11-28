---
name: devchat
description: "Keep the user's todos and work items with devchat. Use when the user asks to add a todo to devchat, when work starts, hands off, asks the user a question, or wraps up in a repo that uses devchat, or when the user asks to list or clear their devchat todos or work items."
metadata:
  internal: true
---

# devchat

devchat keeps the user's todos and work items, on the devchat board or on this machine. The command decides where each write goes.

## Agent command

```text
devchat work start "<goal>" [--issue <ref>]                                    # start of work
devchat work note [<rid>] "<text>" [--pr <url>] [--ask|--blocked] [--re <id>]  # handoff, question, or answer to a pending reply
devchat work done [<rid>] [--re <id>]                                          # PR merged, or wrap-up
devchat todo add "<text>"                                                      # the user asks you to keep something for later
```

Run `devchat` through the launcher in this skill's base directory. It finds a supported Node installation when PATH has no `node`:

```text
/bin/sh <devchat-skill-directory>/scripts/devchat.sh work start "<goal>"
```

- `work start` prints the new work item's `rid`, then this repo's replies waiting for you, open work items, and open todos. Act on each waiting reply only when you take that work on.
- A waiting reply shows the call that answers it: `devchat work note <rid> --re <id> "<text>"`. Use that call exactly, with what you did or your next question. Without `--re`, a note on that item changes nothing, and `work done` sends nothing.
- `work start` cuts each waiting reply short. Before you answer one, read it whole with `devchat work show <rid>`.
- `--ask` asks the user a question. `--blocked` also marks the item blocked, and the note says why. End every `--ask` and `--blocked` note with your recommendation, so the user can accept it.
- `--pr` links a pull request: its URL, or its number in the item's repo. `--issue` takes `#<n>`, `<owner>/<repo>#<n>`, or an issue URL. A board item takes references only to repos on the allowlist. A plain note clears an open question, and a note on a resolved item reopens it.
- At wrap-up, run the note before `work done`: a note after it reopens the item.
- Omit `<rid>` in a T3 Code thread: devchat finds this thread's open work item.
- A `<rid>` must be one `work start` printed, or one the user gave you. devchat refuses a rid this machine has not seen.
- Call each command once, when the work reaches that point. Do not list or poll on your own.
- Write each text so it makes sense a month later: what to do, and where. Name a credential, file, or setting, never a secret value or personal data.
- Each command prints where it saved the write, for example `saved to the board (owner/repo) through the outbox` or `saved on this machine only (mode off)`, and whether a board write was sent yet. Tell the user those lines. A write not sent yet goes with the next sync; do not run `devchat sync` for it.
- When the guard refuses the text, it names the reason. Rewrite the text without that content and run the command once more.

## Admin commands

Only when the user asks to list, show, finish, or drop todos or work items, to sync, set up, or check devchat, or to import todos from the todos skill or roll that import back, read [references/admin.md](references/admin.md).
