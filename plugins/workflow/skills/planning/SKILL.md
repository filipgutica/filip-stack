---
name: planning
description: Explore an engineering direction or create or revise a specification, PRD, ADR, implementation plan, or engineering ticket from repository evidence. Do not use for authorized implementation, ordinary prose editing, or quick opinions about a plan.
metadata:
  internal: true
---

# Planning

Turn a request into one decision-ready artifact or a bounded direction. Do not run an automatic specification-to-plan-to-ticket pipeline.

## Select one mode

- **Explore:** Compare material options and resolve decisions in conversation. Load no artifact template.
- **Specification:** Define behavior, boundaries, contracts, and observable outcomes in a specification, PRD, or ADR. Read [specification guidance](references/spec.md).
- **Implementation plan:** Define file-specific, independently verifiable changes from an approved direction. Read [plan guidance](references/plan.md).
- **Tickets:** Draft tracker tickets for owned, dependency-aware, verifiable outcomes. Read [ticket guidance](references/tickets.md).

Load only the reference for the selected mode. If the requested output is unclear and that changes the work, ask one focused question.

For a specification, plan, or ticket, also apply [technical prose guidance](../technical-writing/references/technical-prose.md) without changing the artifact's structure or decisions.

## Ground the result

1. Confirm the outcome, users, constraints, non-goals, and authority boundary.
2. Inspect the code, tests, schemas, configuration, documentation, and tracker state that own the proposal.
3. Separate observed facts, decisions, assumptions, and unresolved questions.
4. Reuse current architecture and terminology when they fit.
5. Surface a tradeoff before it becomes an implementation instruction.
6. Give every deliverable an observable completion signal.
7. Remove unsupported components, speculative flexibility, and unrelated cleanup.

Planning does not authorize code changes, commits, publishing, or tracker edits. Create or edit Jira or GitHub items only on request.

## Deliver the requested artifact

Return the artifact in conversation by default. Persist it only when the user requests a file or destination.

User and repository formats outrank the reference's default.

Before returning an artifact, ask: **Could an engineer follow every instruction literally without confusion or unnecessary work?** When the user asks for a review or the work spans several repositories, have another reviewer critique it first, without coaching; verify its findings.

Keep specifications focused on requirements and decisions, and plans on implementation and verification. Do not create companion artifacts automatically. Stop after the requested output.
