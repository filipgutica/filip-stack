---
name: project-notes-tracker
description: "Manage project-local Markdown work tickets in a .notes todo/in-progress/complete tracker. Use when creating a .notes ticket, turning an approved plan into tracked work, logging implementation progress, completing work, or coordinating with hook-backed session tracking."
---

# Project Notes Tracker

Use this workflow for repo-local `.notes/` directories that track work as Markdown tickets. The repo hook setup can restore ticket binding and remind the model to keep the linked ticket updated during active sessions without adding noisy per-tool hook output.

## Directory Contract

Use these directories under the repository root:

- `.notes/todo/` for work seeds that have not started.
- `.notes/in-progress/` for tickets with an approved plan or active implementation.
- `.notes/complete/` for finished tickets with a completion summary.
- `.notes/.runtime/` for machine-managed session bindings and transient hook state. Keep this directory untracked.

Keep the file's folder and frontmatter `status` synchronized.

## Hook Contract

When the shared notes hooks are installed:

- `UserPromptSubmit` can create, bind, restore, trigger planning guidance, or trigger approval guidance through reserved prompts.
- `UserPromptSubmit` should also remind the model to keep the linked ticket's `## Work Log` updated during normal tracked work once the ticket has an approved plan.
- `UserPromptSubmit` should stay quiet when there is no bound ticket and the prompt is not an explicit `notes *` command.

The current session should track exactly one `todo` or `in-progress` ticket at a time.

Session continuity rules:

- A true host resume should keep the same ticket/session link when the host preserves the same session ID.
- A fresh session should default to new work and therefore a new ticket.
- If the user wants to continue an old ticket from a fresh session, they should explicitly opt in with `notes use: <ticket>`.

Reserved prompt commands:

- `notes create: <title>` creates a new ticket in `.notes/todo/` and binds the session to it.
- `notes use: <ticket>` binds the session to an existing `todo` or `in-progress` ticket. Match by relative path, filename stem, or title.
- `notes use:` with no selector should list open tickets instead of guessing.
- `notes plan: <seed>` tells the model to add the planning seed to the bound ticket and start a coordinator-driven planning workflow. It does not approve the plan yet.
- `notes approve` tells the model to write the approved plan into `## Approved Plan`, stamp `started`, and move the ticket to `.notes/in-progress/`.
- `notes complete` tells the model to close out the bound ticket by writing `## Completion Summary`, stamping `completed`, and moving it to `.notes/complete/`.

Planning flow rules:

- `notes plan:` should tell the model to append the seed under `## Planning Seed` and keep the ticket in `.notes/todo/`.
- In Claude, the hook should tell the model to enter planning flow and use `$coordinator` with the seed.
- In Codex, the hook should prompt the user to switch into Plan Mode and use `$filip-stack:coordinator` with the seed because mode switching is host-controlled.
- `notes approve` should tell the model to write the approved plan into the ticket and move it to `.notes/in-progress/`.
- During normal prompts, the hook may remind the model to move a still-`todo` ticket into `.notes/in-progress/` before implementation work starts if the plan has already been accepted.
- Do not rely on the hook script to parse coordinator output or write ticket contents on the model's behalf.

## Ticket Format

Use one Markdown file per task or ticket. Prefer dated, kebab-case filenames, for example `2026-04-06-add-memory-linking.md`.

Each ticket must start with YAML frontmatter:

```yaml
---
title: "<ticket title>"
ticket-id: "<stable ticket id>"
session-id: "<current bound session id>"
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
- Set `ticket-id` to a stable identifier that survives file moves, `session-id` to the currently bound session, `status: "todo"`, `created` to the current date, and `started`/`completed` to `null`.
- Put the user's initial problem statement, constraints, context, and unresolved planning questions under `## Planning Seed`.
- Leave `## Approved Plan` as `Not started.`, `## Completion Criteria` as `Not defined yet.`, `## Work Log` as `No work logged yet.`, and `## Completion Summary` as `Not completed.` unless real content already exists.
- If hooks are installed, bind the current session to the new ticket immediately.

When a plan is approved:

- Add a concise summary of the approved plan under `## Approved Plan`.
- Set `status: "in-progress"` and `started` to the current date.
- Move the file to `.notes/in-progress/`.
- Preserve the planning seed rather than replacing it.
- Preserve `ticket-id` across moves and update `session-id` if the ticket is now bound to a different session.
- Define explicit `## Completion Criteria` once the approved plan is known so the agent can tell when the ticket should move to `.notes/complete/`.
- Hooks should treat placeholder content such as `Not started.` as "no approved plan yet" and continue blocking mutating work until real plan content exists.
- `notes plan:` alone should not lift the gate.

When doing work:

- Append dated entries under `## Work Log`.
- Record material actions, decisions, validation, files or areas touched, and tradeoffs that would help future work.
- Keep entries factual and concise. Do not paste transcript dumps.
- Hook-driven logging should stay lightweight: use prompt-time hooks to signal that a Work Log update is needed, then let the model write the actual note in plain language during the turn.
- Hook-driven state restoration should stay lightweight too: restore an already-linked session when possible, but keep ticket edits and planning logic in the model rather than the hook script.

When completing work:

- Only complete the ticket after the user explicitly says to close out the session or uses `notes complete`, and only if the body of work and the stated `## Completion Criteria` are satisfied.
- Add a concise summary under `## Completion Summary` covering what changed, important tradeoffs, validation, and lessons learned.
- Set `status: "complete"` and `completed` to the current date.
- Move the file to `.notes/complete/`.
- Preserve `ticket-id` across moves and update `session-id` if the closing session changed.
- Do not complete a ticket just because one implementation round finished or the current criteria appear satisfied; leave it in `.notes/in-progress/` until the user explicitly closes it out.

## Guardrails

- Do not store secrets, credentials, access tokens, private customer data, or sensitive incident details.
- Do not use `.notes` as a substitute for tests, issues, PR descriptions, or durable product documentation.
- Prefer a short useful history over exhaustive logs.
- If the repo has local `AGENTS.md` guidance for `.notes`, follow it unless it conflicts with this lifecycle contract.
- Ignore completed tickets when suggesting candidates for a new session binding.
- Treat ticket frontmatter as the source of truth for durable binding: `ticket-id` is the stable identity, `session-id` is the currently bound session, and runtime files should only cache the last known path.
