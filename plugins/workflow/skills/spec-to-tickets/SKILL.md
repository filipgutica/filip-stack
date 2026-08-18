---
name: spec-to-tickets
description: "Use when a decision-complete engineering specification must be decomposed into small, owned, independently verifiable local Markdown tickets, Jira tickets, or GitHub issues."
disable-model-invocation: true
---

# Spec to Tickets

Decompose a decision-complete specification into the smallest independently owned tickets that preserve the selected design.

## Preconditions

- Reject a `Draft` specification or ERD, and any specification or ERD with unresolved Gates. Return the blocking Gates and create no tickets. For a `Ready` specification or ERD, confirm that each Gate resolution is propagated through the component changes and task order.
- Identify each owner, dependency, contract boundary, and verification signal from the specification and repository evidence.
- Do not create a ticket for cleanup, investigation, or future work unless the specification requires it.

## Decomposition

1. Search for an existing epic or parent issue and related tracker tickets before drafting new tickets.
2. Use one external parent issue for the decision-complete specification or ERD. Reuse a verified epic or parent issue. Draft one if none exists. After verification, prepare a metadata link with the system, ID, and URL. Require explicit external-artifact authority for the local source before changing its `Ticket` metadata. Without that authority, return the proposed link in the conversation. Do not require the external parent to link back to the local file.
3. Create one story or issue per independently reviewable outcome or owner boundary. Make each one a child of the verified external parent when the tracker supports hierarchy.
4. Link verified blocking, sequencing, superseding, duplicate, and related relationships.
5. Use a subtask only when part of a complex story needs separate ownership, sequencing, or verification.
6. Give each story or subtask a concrete goal, bounded work, acceptance criteria, non-goals, and focused testing.
7. Use `$workflow:writing-tickets` for the ticket wording and its execution-ready evidence gate.
8. Keep shared behavior, migration, rollout, and verification ownership explicit rather than duplicating it across tickets.

## Backends and authority

Read the repository configuration described in [Engineering Workflow storage](../setup/references/storage.md).

- For the `local` backend, return drafts in the conversation by default. Require ticket-writing authority and an explicit request before persistence. Store new tickets under `~/.engineering-workflow/<repo-id>/tickets/<topic-id>/todo/` for an active topic. Use `TICKET-001-short-title.md` as the filename pattern. The containing lifecycle directory is the ticket's authoritative status. Do not duplicate status in frontmatter.
- For the `jira` backend, draft the tickets first. Do not create, update, transition, comment on, assign parents, or add relationships without explicit publishing authority from the user. The configured backend and ticket-writing authority do not grant Jira publishing authority. Jira is canonical. Do not persist a mirrored local Markdown ticket or local lifecycle status.
- For the `github` backend, draft the issues first. Do not create, update, close, comment on, assign, label, or link issues without explicit publishing authority from the user. The configured backend and ticket-writing authority do not grant GitHub publishing authority. GitHub is canonical. Do not persist a mirrored local Markdown ticket or local lifecycle status.

When local work maps to a verified external ticket or issue, use the `externalLinks` contract in [Engineering Workflow storage](../setup/references/storage.md). Keep the local filename and local lifecycle status. The external link does not grant publishing authority.

For a `jira` or `github` backend, use the configured external ticket system as the destination. With publishing authority, return the verified issue ID and URL after publication. Without publishing authority, return the draft in the conversation. Do not create a local ticket file.

Do not create or change `config.json` or `topics.json` manually. Use the setup utility to discover or validate topics.

For the `local` backend, persisted ticket files require initialized storage and an active topic. If either is missing, use `$workflow:setup` with explicit setup authority. Without that authority, return the ticket drafts in the conversation.

A standalone Jira or GitHub issue does not require a topic. Jira and GitHub operations still require valid repository workflow configuration and explicit publishing authority for writes.

The current setup utility does not create, link, or transition tickets. Treat those operations as deferred work. Do not move legacy tickets automatically.
