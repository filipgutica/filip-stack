---
related: [review, walkthrough]
---

## What it does

Checkpoint captures the current state of work for a pause or handoff. It
compares conversation claims with current evidence and distinguishes intended,
attempted, implemented, and verified outcomes.

## When to use it

- Pause work with a concrete starting point for continuation.
- Hand off completed outcomes, remaining work, and material decisions.
- Record what checks actually prove before leaving a task.

It runs only when you call it by name. The checkpoint stays in conversation
unless you request a saved file. Evidence from a [review](../review/) or
[walkthrough](../walkthrough/) can inform the snapshot when its covered state is known.

## How it works

1. Identifies the outcome and authoritative sources. For repositories, it checks
   identity, branch, `HEAD`, dirty state, and relevant files.
2. Reconciles reported progress with observed state. Plans and agent claims
   do not establish completion.
3. Records material decisions, completed outcomes, remaining work, blockers,
   verification, and the next action. Unrelated dirty changes stay untouched.
4. Identifies each check's command, result, and covered revision or working-tree
   state. It uses available evidence without rerunning expensive checks solely
   to write the checkpoint.
5. Flags evidence invalidated by later changes. If the tested state is unknown,
   it labels the result historical and current verification unknown.
6. Saves a new snapshot only when requested. Earlier snapshots remain intact,
   and the saved path is returned.

## What you get

- A concise checkpoint with source, completed and remaining work, and verification.
- Material blockers and decisions, plus a concrete next action.
- Explicit labels for unconfirmed or unrun required checks.

A saved checkpoint creates no registry or companion artifacts. On resume,
the agent rechecks current sources and repository state before acting.
The skill does not authorize code changes, tracker updates, commits, or publication.
