---
name: writing-specs
description: "Use when a user needs an engineering specification or ERD for product or technical work before implementation, review, or ticket decomposition."
---

# Writing Specs and ERDs

Treat specification and engineering requirements document (ERD) as interchangeable terms. Separate settled decisions from unresolved ones. An ERD is `Ready` only when no unresolved gate blocks its component changes. Otherwise, it is `Draft`.

## Workflow

1. Read [erd-format.md](references/erd-format.md) before drafting or updating an ERD.
2. Confirm the problem, intended outcome, constraints, prior milestone, and known non-goals.
3. Inspect the current repository surface for contracts, owners, code pointers, tests, and existing decisions.
4. Record only supported facts. Use `TBD` for unknown metadata, options, repositories, links, diagrams, interfaces, tests, or requirements.
5. Classify every unresolved decision. Make it a Gate when it blocks listed component work. Otherwise, make it an Open Question.
6. Put an observable outcome and verification signal in each component deliverable or high-level task.
7. After a gate resolves, search the ERD for its number and name. Update the Gates summary, Context, Component changes, Order of Operations, and Open Questions before marking the edit complete.
8. Apply the final plain-language proofreading pass only after the structure and facts are correct.

## Quality bar

Copy the required headings from [erd-format.md](references/erd-format.md). Keep design points grouped by concern and component changes grouped by repository. Mark a repository's work as conditional when it depends on an unresolved gate.

Do not add a likely component, interface, behavior, option, or test. Put missing information in a Gate, an Open Question, or `TBD`. Keep each component entry limited to the outcome supported by the request or repository evidence.

For a new ERD, use the current date. Use supported facts for Author, Version, and ticket link. Otherwise, write `TBD`. Set Status to `Draft` while any gate is unresolved. Set it to `Ready` only after all blocking gates are resolved and propagated.

When `$workflow:spec-to-tickets` verifies an external parent issue, prepare a metadata link with its system, ID, and URL. Require explicit external-artifact authority for the local source before changing its `Ticket` metadata. Without that authority, return the proposed link in the conversation. Do not require the external parent to link back to the local file.

Link each code pointer to the exact ref that currently contains the code. Use `blob/main/...` after a referenced change merges. Update every stale feature-branch link and remove obsolete `unmerged` qualifiers.

An unresolved gate makes the ERD a reviewable draft, not a decision-complete implementation input. Do not route it to `$workflow:spec-to-tickets` until every gate is resolved. Metadata `TBD` values and non-blocking Open Questions do not by themselves prevent `Ready` status.

Do not turn the ERD into a file-level implementation plan. Use `$workflow:writing-plans` for that purpose.

## External artifacts

Return the specification or ERD in the conversation by default. Persist it only when the user explicitly requests an external artifact.

Write the specification under an active topic at `~/.engineering-workflow/<repo-id>/specs/<topic-id>/SPEC.md`. The request grants external-artifact authority only for that write.

Use [Engineering Workflow storage](../setup/references/storage.md). Do not create or change `config.json` or `topics.json` manually. Use the setup utility to validate topics.

If storage or the topic is not configured, use `$workflow:setup` with explicit setup authority. Without that authority, deliver the specification in the conversation.

Read [upstream.md](references/upstream.md) for source pins and local adaptation decisions.
