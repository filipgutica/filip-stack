---
name: spec-to-tickets
description: "Use when a decision-complete engineering specification must be decomposed into small, owned, independently verifiable local Markdown or Jira tickets."
---

# Spec to Tickets

Decompose a decision-complete specification into the smallest independently owned tickets that preserve the selected design.

## Preconditions

- Confirm that the specification is decision-complete. Return unresolved decisions instead of creating tickets from assumptions.
- Identify each owner, dependency, contract boundary, and verification signal from the specification and repository evidence.
- Do not create a ticket for cleanup, investigation, or future work unless the specification requires it.

## Decomposition

1. Create one ticket per independently reviewable outcome or owner boundary.
2. State dependencies only when sequencing is necessary.
3. Give each ticket a concrete goal, bounded work, acceptance criteria, non-goals, and focused testing.
4. Use `$workflow:writing-tickets` for the ticket wording and its execution-ready evidence gate.
5. Keep shared behavior, migration, rollout, and verification ownership explicit rather than duplicating it across tickets.

## Backends and authority

Read the repository configuration described in [Engineering Workflow storage](../setup/references/storage.md).

- For the `local` backend, return drafts in the conversation by default. Require ticket-writing authority and an explicit request to persist Markdown tickets under `~/.engineering-workflow/<repo-id>/tickets/<topic>/`.
- For the `jira` backend, draft the tickets first. Do not create, update, transition, comment on, or otherwise write Jira tickets without explicit publishing authority from the user. The configured backend and ticket-writing authority do not grant Jira publishing authority.

Do not create or change `config.json` manually. If storage is not configured, use `$workflow:setup` with explicit setup authority or return the ticket drafts in the conversation.
