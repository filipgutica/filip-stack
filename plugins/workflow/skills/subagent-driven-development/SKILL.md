---
name: subagent-driven-development
description: "Use when a user explicitly requests same-session execution of an approved multi-task plan through bounded subagent implementation and review cycles."
disable-model-invocation: true
---

# Subagent-driven development

Route the request to `$workflow:coordinator`. The coordinator owns authority, task state, delegation, review tier, acceptance, commits, and publishing.

## Entry contract

1. Confirm explicit implementation authority and the approved plan.
2. Use `$workflow:using-git-worktrees` only when isolation is requested or required.
3. Use the existing branch task ledger when the coordinator route requires it.
4. Create one task for each bounded, independently verifiable outcome or intended commit.
5. Run the coordinator's bounded cycle for one task at a time.
6. Continue until all tasks finish or a concrete blocker requires user input.

For each delegated task:

- give the worker only its goal, evidence, scope, interfaces, risks, and verification
- keep one writer for an overlapping area
- require the worker to test and self-review its implementation
- use one independent review tier selected by the coordinator
- apply valid findings and rerun affected checks
- commit only with explicit commit authority
- record an authorized commit in the external ledger

The main thread reviews delegated results and accepts the task. A worker does not accept its own work.

Do not create a `.superpowers` workspace or a second progress ledger. Do not define a separate fix-loop cap, final review, or cleanup lifecycle. Use the coordinator and review-cycle contracts.

Read [upstream.md](references/upstream.md) for provenance and local adaptation decisions.
