---
name: planning
description: Use to explore an engineering direction or create or revise a specification, implementation plan, TASKS.md, Jira ticket, GitHub issue, or ticket breakdown from repository evidence. Do not use for authorized code implementation or ordinary prose editing.
---

# Planning

Turn a request into one decision-ready artifact or a bounded direction. Do not run an automatic specification-to-plan-to-ticket pipeline.

## Select one mode

- **Explore:** Compare material options and resolve decisions in conversation. Load no artifact template.
- **Specification:** Define behavior, boundaries, contracts, gates, and observable outcomes. Read [specification guidance](references/spec.md).
- **Implementation plan:** Define file-specific, independently verifiable changes from an approved direction. Read [plan guidance](references/plan.md).
- **Tasks or tickets:** Break approved work into owned, dependency-aware, verifiable units. Read [task and ticket guidance](references/tasks-and-tickets.md).

Load only the reference for the selected mode. If the requested output is unclear and the difference changes the work, ask one focused question.

For a specification, plan, task list, or ticket, also apply [technical prose guidance](../technical-writing/references/technical-prose.md). Keep the selected artifact's structure and decisions intact. Exploration replies follow the conversation guidance.

## Ground the result

1. Confirm the outcome, users, constraints, non-goals, and authority boundary.
2. Inspect current code, tests, schemas, configuration, documentation, and tracker state that own the proposal.
3. Separate observed facts, decisions, assumptions, and unresolved questions.
4. Reuse current architecture and terminology when they fit.
5. Surface a tradeoff before it becomes an implementation instruction.
6. Give every deliverable an observable completion signal.
7. Remove unsupported components, speculative flexibility, and unrelated cleanup.

Planning does not authorize repository code changes, commits, publishing, or external ticket changes. Draft external work in conversation. Create or edit Jira or GitHub items only when the user requests that mutation.

## Paper trails

Return the artifact in conversation by default. Persist it only when the user requests a file or gives a destination.

Use the supplied path. When the user selects an Engineering Workflow work item, use its flat directory under `~/.engineering-workflow/<work-item>/`. Do not create manifests, lifecycle directories, repository mirrors, pointer files, or generated link indexes.

Keep artifact roles distinct:

- `SPEC.md` owns requirements and design decisions.
- `PLAN.md` owns implementation sequence and verification.
- `TASKS.md` owns current execution state for complex or resumable work.
- External Jira or GitHub items own their tracker state.

Do not create every artifact. Stop after the requested output and let the user select the next step.
