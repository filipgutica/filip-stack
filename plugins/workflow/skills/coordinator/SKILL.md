---
name: coordinator
description: "Route engineering work by authority, workflow, ownership, and review tier."
---

# Coordinator

Route engineering work by authority and workflow. The main thread owns scope, routing, synthesis, and acceptance.

Use `$workflow:minimal-code` for implementation. Minimality never overrides correctness, tests, types, security, accessibility, or explicit user requirements.

## Authority

- **Implementation authority:** permits repository edits.
- **External-artifact authority:** an explicit user request to create or update a named artifact under `~/.engineering-workflow` permits only that artifact write. It does not grant repository edits, setup, migration, ticket publishing, or other external writes.
- **Setup or migration authority:** an explicit user request to configure or migrate Engineering Workflow storage permits only the requested setup or migration operation.
- **Ticket-writing authority:** permits ticket creation or changes.
- **Publishing authority:** permits only the publishing action that the user explicitly requests.
- **Named-ticket end-to-end authority:** permits branch setup, creation and maintenance of the required external branch task ledger, its local pointer, and its Git exclude entry, plus task commits, push, and a draft pull request.

Planning and Investigation are read-only for repository files. Review feedback does not grant implementation or publishing authority.

## Router

```mermaid
flowchart TD
    Scope{"Work scope and authority"}
    Scope -->|Planning| Planning
    Scope -->|Investigation| Investigation
    Scope -->|Implementation| Implementation
```

- **Planning:** discuss work and create authorized planning artifacts. See [references/planning-flow.md](references/planning-flow.md).
- **Investigation:** gather evidence and present a fix path. See [references/investigation-flow.md](references/investigation-flow.md).
- **Implementation:** make explicitly authorized repository changes. See [references/implementation-flow.md](references/implementation-flow.md).

Use `$workflow:branch-task-planner` when the user explicitly requests an external ledger or explicitly authorizes named-ticket end-to-end execution, which requires one.

A manual-only skill can be an explicit nested invocation when the selected authorized route requires it. This does not waive the skill's authority checks.

## Role boundaries

- **Explorer:** read-only discovery for a specific unanswered question.
- **Worker:** owns a separate bounded change, tests it, and self-reviews it. It does not widen scope or accept its own work.
- **Standard reviewer:** performs the independent review for routine meaningful changes.
- **Adversarial critic:** performs the independent review for broad or high-risk changes.
- **Main thread:** selects the route and review tier, integrates results, and accepts the work.

Use a fresh worker context for a ledger task when it reduces context load or adds useful isolation. Keep one writer for overlapping files.

## References

- [Planning flow](references/planning-flow.md)
- [Investigation flow](references/investigation-flow.md)
- [Implementation flow](references/implementation-flow.md)
- [Prompt templates](references/subagent-templates.md)
