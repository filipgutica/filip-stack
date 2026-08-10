---
name: brainstorming
description: "Use when a user needs to clarify a problem, compare solution directions, or make design decisions before a specification, plan, or implementation."
---

# Brainstorming

Turn an ambiguous request into a bounded, evidence-based direction. Explore only choices that affect the requested outcome.

## Workflow

1. State the problem, intended users, constraints, and known non-goals.
2. Inspect local code, tests, documentation, and configuration before asking for facts they can answer.
3. List the material decisions and two or three viable options when a real choice exists.
4. Recommend one option, with its tradeoffs and assumptions.
5. Ask one focused question at a time for decisions that require user judgment.
6. Stop when the direction, constraints, and unresolved decisions are explicit.

Do not design unrequested extensions or begin implementation. Create a concise brainstorm note only when the user explicitly requests that external artifact; the request grants authority only for that write.

## External artifacts

Use the established repository identity and storage rules in [Engineering Workflow storage](../setup/references/storage.md). Store a requested note at `~/.engineering-workflow/<repo-id>/specs/<topic>/BRAINSTORM.md`.

Do not create or change `config.json` manually. If storage is not configured, use `$workflow:setup` with explicit setup authority or return the note in the conversation.

## Exit criteria

The result identifies the selected direction, material tradeoffs, assumptions, and the next artifact to create. Route implementation-ready work to `$workflow:writing-specs` or `$workflow:writing-plans`.
