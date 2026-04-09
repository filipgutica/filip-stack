---
name: project-notes-tracker
description: Manage project-local Markdown work tickets in a .notes todo/in-progress/complete tracker. Use when creating a .notes ticket, turning an approved plan into tracked work, logging implementation progress, completing work, or coordinating with hook-backed session tracking.
---

# Project Notes Tracker

Use this workflow for repo-local `.notes/` directories that track work as Markdown tickets. The repo hook setup can enforce ticket binding, approved-plan gating, and remind the model to keep the linked ticket updated during active sessions.

## Directory Contract

Use these directories under the repository root:

- `.notes/todo/` for work seeds that have not started.
- `.notes/in-progress/` for tickets with an approved plan or active implementation.
- `.notes/complete/` for finished tickets with a completion summary.
- `.notes/.runtime/` for machine-managed session bindings, bypass state, and transient hook state. Keep this directory untracked.

Keep the file's folder and frontmatter `status` synchronized.

## Hook Contract

When the shared notes hooks are installed:

- `SessionStart` ensures the `.notes/` directory structure exists and restores any session binding.
- `UserPromptSubmit` can create, bind, trigger planning guidance, trigger approval guidance, or bypass the gate through reserved prompts.
- `UserPromptSubmit` should also remind the model to keep the linked ticket's `## Work Log` updated during normal tracked work once the ticket has an approved plan.
- `PreToolUse` blocks mutating work when the session has no bound ticket or the ticket has no approved plan yet.

The current session should track exactly one `todo` or `in-progress` ticket at a time.

Reserved prompt commands:

- `notes create: <title>` creates a new ticket in `.notes/todo/` and binds the session to it.
- `notes use: <ticket>` binds the session to an existing `todo` or `in-progress` ticket. Match by relative path, filename stem, or title.
- `notes plan: <seed>` tells the model to add the planning seed to the bound ticket and start a planner-driven workflow. It does not approve the plan yet.
- `notes approve` tells the model to write the approved plan into `## Approved Plan`, stamp `started`, move the ticket to `.notes/in-progress/`, and lift the mutating-work gate once that ticket update is done.
- `notes bypass` starts a session-only bypass flow. The next prompt becomes the bypass reason unless the user enters `cancel`.

Planning flow rules:

- `notes plan:` should tell the model to append the seed under `## Planning Seed` and keep the ticket in `.notes/todo/`.
- In Claude, the hook should tell the model to enter planning flow and use `$planner` with the seed.
- In Codex, the hook should prompt the user to switch into Plan Mode and use `$planner` with the seed because mode switching is host-controlled.
- `notes approve` should tell the model to write the approved plan into the ticket and move it to `.notes/in-progress/`.
- Do not rely on the hook script to parse planner output or write ticket contents on the model's behalf.

Session bypass rules:

- bypass skips only the mutating-work gate for the current session
- bypass does not disable `.notes` setup, ticket discovery, or later return to tracked mode
- bypass state lives only in `.notes/.runtime/` and is never committed

## Ticket Format

Use one Markdown file per task or ticket. Prefer dated, kebab-case filenames, for example `2026-04-06-add-memory-linking.md`.

Each ticket must start with YAML frontmatter:

```yaml
---
title: "<ticket title>"
status: "todo"
created: "YYYY-MM-DD"
started: null
completed: null
tags: ["short", "kebab", "tags"]
---
```

Use these sections in order:

```md
# <ticket title>

## Planning Seed

## Approved Plan

## Completion Criteria

## Work Log

## Completion Summary
```

## Lifecycle

When creating a ticket:

- Create it in `.notes/todo/`.
- Set `status: "todo"`, `created` to the current date, and `started`/`completed` to `null`.
- Put the user's initial problem statement, constraints, context, and unresolved planning questions under `## Planning Seed`.
- Leave `## Approved Plan` as `Not started.`, `## Completion Criteria` as `Not defined yet.`, `## Work Log` as `No work logged yet.`, and `## Completion Summary` as `Not completed.` unless real content already exists.
- If hooks are installed, bind the current session to the new ticket immediately.

When a plan is approved:

- Add a concise summary of the approved plan under `## Approved Plan`.
- Set `status: "in-progress"` and `started` to the current date.
- Move the file to `.notes/in-progress/`.
- Preserve the planning seed rather than replacing it.
- Define explicit `## Completion Criteria` once the approved plan is known so the agent can tell when the ticket should move to `.notes/complete/`.
- Hooks should treat placeholder content such as `Not started.` as "no approved plan yet" and continue blocking mutating work until real plan content exists.
- `notes plan:` alone should not lift the gate.

When doing work:

- Append dated entries under `## Work Log`.
- Record material actions, decisions, validation, files or areas touched, and tradeoffs that would help future work.
- Keep entries factual and concise. Do not paste transcript dumps.
- Hook-driven logging should stay lightweight: use prompt-time hooks to signal that a Work Log update is needed, then let the model write the actual note in plain language during the turn.

When completing work:

- Only complete the ticket once the body of work and the stated `## Completion Criteria` are satisfied.
- Add a concise summary under `## Completion Summary` covering what changed, important tradeoffs, validation, and lessons learned.
- Set `status: "complete"` and `completed` to the current date.
- Move the file to `.notes/complete/`.
- When the work is committed or pushed and the ticket's completion criteria are satisfied, the agent should complete the ticket in the same turn rather than leaving it in `.notes/in-progress/`.

## Guardrails

- Do not store secrets, credentials, access tokens, private customer data, or sensitive incident details.
- Do not use `.notes` as a substitute for tests, issues, PR descriptions, or durable product documentation.
- Prefer a short useful history over exhaustive logs.
- If the repo has local `AGENTS.md` guidance for `.notes`, follow it unless it conflicts with this lifecycle contract.
- Ignore completed tickets when suggesting candidates for a new session binding.
