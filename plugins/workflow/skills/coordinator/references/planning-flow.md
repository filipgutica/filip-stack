# Planning flow

Use this route for Plan Mode, plan-only discussion, or written planning artifacts. This route grants no implementation authority.

```mermaid
flowchart LR
    Request["Plan Mode or plan-only request"]
    Request --> Ordinary["Discussion or artifact"]
    Request --> Ledger["User-Involved Branch-Ledger Planning"]
    Ordinary --> Present["Present discussion or artifact"]
    Ledger --> Present
```

## Ordinary planning

1. Gather bounded read-only evidence before asking for discoverable facts.
2. Select only the route needed for the user's requested output:
   - Use `$workflow:brainstorming` to clarify an ambiguous request or compare design options.
   - Use `$workflow:grill-me` when the user asks to stress-test a direction.
   - Use `$workflow:writing-specs` when the user requests a decision-complete product or technical specification.
   - Use `$workflow:writing-plans` when the user requests a file-specific implementation plan.
   - Use `$workflow:spec-to-tickets` only when the user explicitly requests ticket decomposition from a decision-complete specification.
   - Use `$workflow:writing-tickets` when the user requests ticket drafting, creation, changes, or an execution-ready review.
3. Require ticket-writing authority before ticket creation or changes.
4. Persist a plan, specification, brainstorm note, or local ticket draft only when the user explicitly requests that named external artifact. That request grants external-artifact authority only for the requested write.
5. For a persisted topic-scoped artifact under Engineering Workflow storage, use the read-only `topics` command to discover or validate its active topic. A standalone Jira or GitHub issue does not require a topic.
6. If the topic does not exist, require setup authority before `init-topic`. Artifact authority alone cannot initialize a topic.
7. State material assumptions, risks, and open decisions.
8. End with the requested artifact or discussion. Do not continue into a different artifact type without a user request.

## User-involved branch-ledger planning

Use `$workflow:branch-task-planner` only when the user requests an external ledger for an established branch.

1. Invoke `$workflow:branch-task-planner` in direct-invocation mode.
2. Request new authority before implementation.

Manual ledger planning cannot create or switch branches. It cannot edit repository files, commit, or publish.
