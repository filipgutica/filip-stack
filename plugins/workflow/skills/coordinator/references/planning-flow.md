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
4. An explicit `$workflow:writing-specs` invocation persists its specification by default. A plan or local ticket draft persists only when the user requests that named artifact. An explicit `$workflow:grill-me` invocation persists one curated grill log. Each request grants authority only for its artifact write.
5. For a persisted local artifact, use `topics` to resolve its open topic. Use a user-identified open topic or the only open topic. If multiple open topics exist, ask for a topic choice. A standalone Jira or GitHub issue does not require a topic.
6. If the topic does not exist, require setup authority before `init-topic --confirm`. Artifact authority alone cannot initialize a topic.
7. Each persisted local artifact links to `TOPIC.md`. It also records the nearest durable source or `Direct request`. External tickets use tracker-native hierarchy and links. Do not require a link to an ephemeral brainstorm or session.
8. State material assumptions, risks, and open decisions.
9. End with the requested artifact or discussion. Do not continue into a different artifact type without a user request.

## User-involved branch-ledger planning

Use `$workflow:branch-task-planner` only when the user requests an external ledger for an established branch.

1. Invoke `$workflow:branch-task-planner` in direct-invocation mode.
2. Request new authority before implementation.

Manual ledger planning cannot create or switch branches. It cannot edit repository files, commit, or publish.
