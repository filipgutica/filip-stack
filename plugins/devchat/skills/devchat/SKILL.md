---
name: devchat
description: "Keep the user's todos with devchat. Use when the user asks to add a todo to devchat, or to list or clear their devchat todos."
metadata:
  internal: true
---

# devchat

devchat keeps the user's todos. In this version every todo stays on this machine: board writes arrive with `devchat setup`.

## Agent command

```text
devchat todo add "<text>"    # the user asks you to keep something for later
```

Run `devchat` through the launcher in this skill's base directory. It finds a supported Node installation when PATH has no `node`:

```text
/bin/sh <devchat-skill-directory>/scripts/devchat.sh todo add "<text>"
```

- Call it once, when the user asks for the todo. Do not check, list, or poll todos on your own.
- Write the todo so it makes sense a month later: what to do, and where. Name a credential, file, or setting, never a secret value or personal data.
- The command prints where it saved the item, for example `saved on this machine only (mode off)`. Tell the user that line.
- When the guard refuses the text, it names the reason. Rewrite the text without that content and run the command once more.

## Admin commands

Only when the user asks to list, finish, or drop todos, or to check the devchat setup, read [references/admin.md](references/admin.md).
