---
related: [review]
---

## What it does

Walkthrough explains and inspects one exact change set with you. It presents
one coherent slice at a time, shows the decisive evidence, and waits for
your decision before continuing.

## When to use it

- Understand the last completed change or the working tree.
- Walk through a branch or pull request at verified commits.
- Learn how a change connects behavior, implementation, tests, and documentation.

It runs only when you call it by name. It does not activate for ordinary
summaries or code review. Use [review](../review/) for a read-only findings report.

## How it works

1. Confirms the exact source and keeps unrelated working-tree changes outside it.
2. Inspects the diff, changed files, tests, documentation, and verification evidence.
   It builds an ordered map that accounts for every changed file.
3. Groups files by behavior or contract. Each slice explains the behavior,
   decision, evidence, verification, and risk with a concrete example.
4. Offers a practical exercise for the main behavior when appropriate. Expected
   results stay separate from observed results, and you can skip the exercise.
5. Asks one focused acceptance question and waits. Corrections are recorded
   without being implemented. Separately authorized fixes cause affected slices
   to be rebuilt.
6. Finishes when every file is covered and corrections are resolved or explicitly deferred.

The normal presenter is the main thread. An automated agent walkthrough uses
a fresh read-only presenter when you request one.

## What you get

- An explanation of the covered behavior and files.
- Your decisions and corrections, verification limits, and unresolved risks.
- A walkthrough log when you request persistence.

Silence, passing tests, and completed exercises do not count as acceptance.
The walkthrough does not authorize code changes, commits, pushes, or publication.
