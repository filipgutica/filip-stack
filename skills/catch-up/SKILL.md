---
name: catch-up
description: Recap this thread in four lines so the user can pick it up again. Use only when explicitly invoked.
disable-model-invocation: true
---

# Catch-up

Answer from the conversation alone. A catch-up is a reminder of where the thread stands, so it costs the user seconds and you no tool calls.

When the user asks for verified branch state, check results, or a handoff to someone else, recommend `checkpoint` instead of a recap, and stop.

Otherwise, reply with these four lines:

```text
Goal: <the thread's overall goal, from the user's current ask>
Done: <outcomes reached so far>
Now: <what is in progress, or what the thread is waiting on>
Next: <the next step, and who owns it>
```

Keep each line to one sentence. Name a PR, file, or thread as a link when the conversation has one. Mark a claim the conversation states but has not verified as unverified.

When the thread has no work in flight and nothing waits on the user, say so on the `Now` line, so the user knows they can close the thread.
