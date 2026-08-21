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

Do not design unrequested extensions or begin implementation. Brainstorms are conversation-first and can remain ephemeral.

## External artifacts

Do not create a standalone `BRAINSTORM.md`. Preserve settled rationale in the next specification or plan. Use `$workflow:grill-me` when the user wants a topic-scoped decision log that survives context compaction.

## Exit criteria

The result identifies the selected direction, material tradeoffs, assumptions, and the next artifact to create. Route implementation-ready work to `$workflow:writing-specs` or `$workflow:writing-plans`.
