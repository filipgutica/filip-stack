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
- `UserPromptSubmit` should stay quiet on ordinary tracked prompts in Codex after restoring or attaching session state; use explicit `notes *` commands and the `Stop` hook for visible guidance instead of adding per-turn prompt noise.
- `Stop` should block completion when a bound ticket is still `todo` but already has a real approved plan, and require the model to transition it to `.notes/in-progress/` plus update `## Approved Plan` and `## Work Log` before ending the turn.
- `UserPromptSubmit` should stay quiet when there is no bound ticket and the prompt is not an explicit `notes *` command.

Each session tracks at most one `todo` or `in-progress` ticket at a time. A ticket may be attached to multiple sessions (across hosts or within the same host), allowing Claude and Codex sessions to collaborate on the same work.

Session continuity rules:

- A true host resume should keep the same ticket/session link when the host preserves the same session ID.
- A fresh session starts unbound — `notes create:` does not auto-bind.
- To attach a session to an existing ticket, use `notes track: <ticket>`. Multiple sessions may attach to the same ticket.
- Switching to a different ticket via `notes track:` detaches the session from its previous ticket first.

Reserved prompt commands:

- `notes create: <title>` creates a new ticket in `.notes/todo/`. It does **not** bind the creating session — use `notes track:` to attach a session.
- `notes track: <ticket>` attaches the current session to an existing `todo` or `in-progress` ticket. Match by relative path, filename stem, or title. Multiple sessions may track the same ticket. Switches the session away from any previously tracked ticket.
- `notes track:` with no selector should list open tickets instead of guessing.
- `notes plan: <seed>` tells the model to add the planning seed to the bound ticket and start a coordinator-driven planning workflow. It does not approve the plan yet.
- `notes approve` tells the model to write the approved plan into `## Approved Plan`, stamp `started`, and move the ticket to `.notes/in-progress/`.
- `notes complete` tells the model to close out the bound ticket by writing `## Completion Summary`, stamping `completed`, and moving it to `.notes/complete/`.

Example multi-session workflow:

```
# Claude session: seed planning tickets, no session attached yet
notes create: redesign auth middleware
notes create: migrate legacy session tokens

# Claude session later: start planning — session is lazily attached when work begins
notes track: 2026-04-18-redesign-auth-middleware
notes plan: tighten the auth flow

# Codex session (separate terminal): attach to the same ticket
notes track: 2026-04-18-redesign-auth-middleware
# Both sessions now track the same ticket; each appends [claude]/[codex] Work Log entries.
```

Planning flow rules:

- `notes plan:` should tell the model to append the seed under `## Planning Seed` and keep the ticket in `.notes/todo/`.
- In Claude, the hook should tell the model to enter planning flow and use `$coordinator` with the seed.
- In Codex, the hook should prompt the user to switch into Plan Mode and use `$filip-stack:coordinator` with the seed because mode switching is host-controlled.
- `notes approve` should tell the model to write the approved plan into the ticket and move it to `.notes/in-progress/`.
- During normal prompts, `UserPromptSubmit` may restore or attach session state silently, but it should not emit visible reminder text for ordinary Codex prompts.
- Do not rely on the hook script to parse coordinator output or write ticket contents on the model's behalf.

## Ticket Format

Use one Markdown file per task or ticket. Prefer dated, kebab-case filenames, for example `2026-04-06-add-memory-linking.md`.

Each ticket must start with YAML frontmatter:

```yaml
---
title: "<ticket title>"
ticket-id: "<stable ticket id>"
sessions: [{"id":"<session-id>","host":"claude|codex","attached-at":"<ISO timestamp>"}]
status: "todo"
created: "YYYY-MM-DD"
started: null
completed: null
tags: ["short", "kebab", "tags"]
---
```

`sessions` is a JSON array. New tickets start with `sessions: []`. A session is written into the list when it first does real work on the ticket — running `notes track:`, `notes plan:`, `notes approve`, `notes complete`, or sending any normal work prompt — not at ticket creation. The `Stop` hook is read-only and does not trigger attachment. Multiple sessions can be in the list simultaneously. A session is removed when it switches to a different ticket via `notes track:`. Legacy tickets with a single `session-id: "..."` field are automatically migrated to the list format on first write; the legacy field is cleared at that point.

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
- Set `ticket-id` to a stable identifier that survives file moves, `sessions` to `[]`, `status: "todo"`, `created` to the current date, and `started`/`completed` to `null`.
- Put the user's initial problem statement, constraints, context, and unresolved planning questions under `## Planning Seed`.
- Leave `## Approved Plan` as `Not started.`, `## Completion Criteria` as `Not defined yet.`, `## Work Log` as `No work logged yet.`, and `## Completion Summary` as `Not completed.` unless real content already exists.
- Sessions are not bound on creation. Use `notes track: <ticket>` to attach a session.

When a plan is approved:

- Add a concise summary of the approved plan under `## Approved Plan`.
- Set `status: "in-progress"` and `started` to the current date.
- Move the file to `.notes/in-progress/`.
- Preserve the planning seed rather than replacing it.
- Preserve `ticket-id` and `sessions` list unchanged across moves.
- Define explicit `## Completion Criteria` once the approved plan is known so the agent can tell when the ticket should move to `.notes/complete/`.
- Hooks should treat placeholder content such as `Not started.` as "no approved plan yet" and continue blocking mutating work until real plan content exists.
- `notes plan:` alone should not lift the gate.
- Once a bound `todo` ticket has a real approved plan, the `Stop` hook should block ending the turn until the ticket moves to `.notes/in-progress/`, `status: "in-progress"` is set, `started` is stamped if needed, `## Approved Plan` is populated, and `## Work Log` is updated for the implementation turn.

When doing work:

- Append dated entries under `## Work Log`, prefixed with the host tag: `[claude]` or `[codex]`.
- Record material actions, decisions, validation, files or areas touched, and tradeoffs that would help future work.
- Keep entries factual and concise. Do not paste transcript dumps.
- Hook-driven logging should stay lightweight: prefer explicit `notes *` commands and stop-time enforcement over visible per-turn prompt reminders, then let the model write the actual note in plain language during the turn.
- Hook-driven state restoration should stay lightweight too: restore an already-linked session when possible, but keep ticket edits and planning logic in the model rather than the hook script.

When completing work:

- Only complete the ticket after the user explicitly says to close out the session or uses `notes complete`, and only if the body of work and the stated `## Completion Criteria` are satisfied.
- Add a concise summary under `## Completion Summary` covering what changed, important tradeoffs, validation, and lessons learned.
- Set `status: "complete"` and `completed` to the current date.
- Move the file to `.notes/complete/`.
- Preserve `ticket-id` and `sessions` list unchanged across moves.
- Do not complete a ticket just because one implementation round finished or the current criteria appear satisfied; leave it in `.notes/in-progress/` until the user explicitly closes it out.

## Guardrails

- Do not store secrets, credentials, access tokens, private customer data, or sensitive incident details.
- Do not use `.notes` as a substitute for tests, issues, PR descriptions, or durable product documentation.
- Prefer a short useful history over exhaustive logs.
- If the repo has local `AGENTS.md` guidance for `.notes`, follow it unless it conflicts with this lifecycle contract.
- Ignore completed tickets when suggesting candidates for a new session binding.
- Treat ticket frontmatter as the source of truth for durable binding: `ticket-id` is the stable identity, `sessions` is the list of attached sessions, and runtime files should only cache the last known path.
