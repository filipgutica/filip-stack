---
name: planning
description: Explore an engineering direction or create or revise a specification, implementation plan, or engineering ticket from repository evidence. Do not use for authorized implementation or ordinary prose editing.
---

# Planning

Turn a request into one decision-ready artifact or a bounded direction. Do not run an automatic specification-to-plan-to-ticket pipeline.

## Select one mode

- **Explore:** Compare material options and resolve decisions in conversation. Load no artifact template.
- **Specification:** Define behavior, boundaries, contracts, gates, and observable outcomes. Read [specification guidance](references/spec.md).
- **Implementation plan:** Define file-specific, independently verifiable changes from an approved direction. Read [plan guidance](references/plan.md).
- **Tickets:** Break approved work into owned, dependency-aware, verifiable outcomes. Read [ticket guidance](references/tickets.md).

Load only the reference for the selected mode. If the requested output is unclear and the difference changes the work, ask one focused question.

For a specification, plan, or ticket, also apply [technical prose guidance](../technical-writing/references/technical-prose.md). Keep the selected artifact's structure and decisions intact. Exploration replies follow the conversation guidance.

## Ground the result

1. Confirm the outcome, users, constraints, non-goals, and authority boundary.
2. Inspect current code, tests, schemas, configuration, documentation, and tracker state that own the proposal.
3. Separate observed facts, decisions, assumptions, and unresolved questions.
4. Reuse current architecture and terminology when they fit.
5. Surface a tradeoff before it becomes an implementation instruction.
6. Give every deliverable an observable completion signal.
7. Remove unsupported components, speculative flexibility, and unrelated cleanup.

Planning does not authorize repository code changes, commits, publishing, or external ticket changes. Draft external work in conversation. Create or edit Jira or GitHub items only when the user requests that mutation.

## Deliver the requested artifact

Return the artifact in conversation by default. Persist it only when the user requests a file or gives a destination.

Use the supplied destination and follow applicable repository or project guidance and personal format references supplied by the host. Without a prescribed format, organize only the information the reader needs.

Keep specifications focused on requirements and decisions, plans on implementation and verification, and external tickets on their tracker state. Do not mirror ticket status into local ledgers or create companion artifacts automatically. Stop after the requested output.
