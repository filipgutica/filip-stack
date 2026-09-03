---
name: walkthrough
description: Use only when the user explicitly invokes this skill for an interactive or agent-presented walkthrough of the last change, working tree, branch, or pull request. Do not activate it for ordinary summaries or code review.
disable-model-invocation: true
---

# Walkthrough

Explain and inspect one exact change set with the user. Present one coherent slice at a time and wait for a decision before continuing.

This skill is read-only except for an authorized walkthrough log. A question or correction does not authorize code changes, commits, pushes, or publication.

## Select the source

Confirm one source:

- the last completed change
- the working tree relative to `HEAD`
- a branch from its verified merge base to head
- a pull request from its verified base and head commits

Report working-tree changes outside the selected range. Do not silently include them.

## Choose the presenter

Use the main thread for the normal interactive walkthrough. When the user requests an automated agent walkthrough, read [presenter guidance](references/presenter.md) and use a fresh read-only presenter.

Read [presentation patterns](references/presentation-patterns.md) before building the change map.

## Walkthrough loop

1. Inspect the selected diff, changed files, tests, documentation, and verification evidence.
2. Build an ordered map that accounts for every changed file.
3. Group files by behavior or contract rather than presenting a file dump.
4. Present one slice with its behavior, decision, decisive evidence, verification, and risk.
5. Ask one focused acceptance question.
6. Pause for the user's response.
7. Record a valid correction without implementing it.
8. Rebuild affected slices after a separately authorized correction changes the range.
9. Finish only when every changed file is covered and every correction is resolved or explicitly deferred.

Read [walkthrough log guidance](references/walkthrough-log.md) only when a log path is known or the user requests persistence. Update it at slice decisions and corrections, not for every message.

## Finish

Summarize:

- covered behavior and files
- reviewer decisions and corrections
- verification evidence and limits
- unresolved risks or questions

Do not treat silence, a summary, a passing test, or presenter confidence as user acceptance.
