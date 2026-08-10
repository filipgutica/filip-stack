---
name: spec-to-tickets
description: "Use when a decision-complete engineering specification must be decomposed into small, owned, independently verifiable local Markdown or Jira tickets."
disable-model-invocation: true
---

# Spec to Tickets

Decompose a decision-complete specification into the smallest independently owned tickets that preserve the selected design.

## Preconditions

- Reject a `Draft` specification or ERD, and any specification or ERD with unresolved Gates. Return the blocking Gates and create no tickets. For a `Ready` specification or ERD, confirm that each Gate resolution is propagated through the component changes and task order.
- Identify each owner, dependency, contract boundary, and verification signal from the specification and repository evidence.
- Do not create a ticket for cleanup, investigation, or future work unless the specification requires it.

## Decomposition

1. Search for an existing epic and related tracker tickets before drafting new tickets.
2. Use one epic for the decision-complete specification or ERD. Reuse the verified epic or draft a new epic when none exists. Link it to the source document.
3. Create one story per independently reviewable outcome or owner boundary. Make each story a child of the epic.
4. Link verified blocking, sequencing, superseding, duplicate, and related relationships.
5. Use a subtask only when part of a complex story needs separate ownership, sequencing, or verification.
6. Give each story or subtask a concrete goal, bounded work, acceptance criteria, non-goals, and focused testing.
7. Use `$workflow:writing-tickets` for the ticket wording and its execution-ready evidence gate.
8. Keep shared behavior, migration, rollout, and verification ownership explicit rather than duplicating it across tickets.

## Backends and authority

Read the repository configuration described in [Engineering Workflow storage](../setup/references/storage.md).

- For the `local` backend, return drafts in the conversation by default. Require ticket-writing authority and an explicit request to persist Markdown tickets under `~/.engineering-workflow/<repo-id>/tickets/<topic>/`.
- For the `jira` backend, draft the tickets first. Do not create, update, transition, comment on, assign parents, or add relationships without explicit publishing authority from the user. The configured backend and ticket-writing authority do not grant Jira publishing authority.

Do not create or change `config.json` manually. If storage is not configured, use `$workflow:setup` with explicit setup authority or return the ticket drafts in the conversation.
