---
name: project-notes-tracker
description: Manage project-local Markdown work tickets in a .notes todo/in-progress/complete tracker. Use when creating a .notes ticket, turning an approved plan into tracked work, logging implementation progress, completing a ticket, or reorganizing .notes task history across repositories.
---

# Project Notes Tracker

Use this workflow for repo-local `.notes/` directories that track work as Markdown tickets.

## Directory Contract

Use these directories under the repository root:

- `.notes/todo/` for work seeds that have not started.
- `.notes/in-progress/` for tickets with an approved plan or active implementation.
- `.notes/complete/` for finished tickets with a completion summary.

Keep the file's folder and frontmatter `status` synchronized.

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

## Work Log

## Completion Summary
```

## Lifecycle

When creating a ticket:

- Create it in `.notes/todo/`.
- Set `status: "todo"`, `created` to the current date, and `started`/`completed` to `null`.
- Put the user's initial problem statement, constraints, context, and unresolved planning questions under `## Planning Seed`.
- Leave `## Approved Plan` as `Not started.`, `## Work Log` as `No work logged yet.`, and `## Completion Summary` as `Not completed.` unless real content already exists.

When a plan is approved:

- Add a concise summary of the approved plan under `## Approved Plan`.
- Set `status: "in-progress"` and `started` to the current date.
- Move the file to `.notes/in-progress/`.
- Preserve the planning seed rather than replacing it.

When doing work:

- Append dated entries under `## Work Log`.
- Record material actions, decisions, validation, files or areas touched, and tradeoffs that would help future work.
- Keep entries factual and concise. Do not paste transcript dumps.

When completing work:

- Add a concise summary under `## Completion Summary` covering what changed, important tradeoffs, validation, and lessons learned.
- Set `status: "complete"` and `completed` to the current date.
- Move the file to `.notes/complete/`.

## Guardrails

- Do not store secrets, credentials, access tokens, private customer data, or sensitive incident details.
- Do not use `.notes` as a substitute for tests, issues, PR descriptions, or durable product documentation.
- Prefer a short useful history over exhaustive logs.
- If the repo has local `AGENTS.md` guidance for `.notes`, follow it unless it conflicts with this lifecycle contract.
