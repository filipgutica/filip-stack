# Tasks and tickets

Use a task file for local execution state. Use Jira or GitHub issues when the external tracker owns the work. Do not mirror external status into a local ticket file.

## Task boundaries

Create one task for one independently reviewable outcome. Add a dependency only when another task produces required input. Use subagents only for independent work with separate ownership.

For `TASKS.md`, use this compact shape:

```md
# <Work item>

## Goal
## Non-goals
## Success criteria

### Task 1: [ ] <Outcome>
- Owner/files: <surface>
- Depends on: <task or none>
- Verification: `<command>` proves <claim>
- Evidence: <result or pending>
- Risk or decision: <item or none>
```

Use `[ ]` for pending, `[x]` for verified complete, and `[!]` for a concrete blocker. Update state only when a task starts, completes, blocks, or changes scope. Git remains the worktree record.

## Tickets

A ticket must let an engineer perform the required work without guessing. Confirm current behavior and ownership before assigning implementation.

### Execution-ready gate

Before assigning implementation, verify the current behavior, owner, and location for each proposed change. If any is missing, return an **Evidence needed before this is execution-ready** brief with only confirmed decisions and the missing evidence. Make investigation the deliverable instead of disguising it as implementation work.

### Tracker hierarchy and relationships

Use the hierarchy and relationship types supported by the target tracker. Verify the project, issue type, parent, ticket key, URL, and relationship direction before including them. Put an uncertain relationship in the evidence brief instead of guessing.

- **External parent:** Group the independently owned outcomes from one decision-ready specification. List verified children in dependency order.
- **Story or issue:** Define one independently reviewable outcome under its verified parent when the tracker supports hierarchy.
- **Subtask:** Use only when part of a story needs separate ownership, sequencing, or verification. Keep ordinary implementation steps in the story.

Use this external-parent shape when needed:

```md
## Goal
## Children
## Acceptance criteria
## Non-goals
```

Use this minimal story shape:

```md
## Goal
## Work
## Acceptance criteria
## Non-goals
## Testing
```

For a bug, use:

```md
## Observed behavior
## Environment
## Root-cause evidence
## Proposed fix
## Testing
```

Omit a proposed fix when evidence does not support one. Make investigation the deliverable when the owner or cause is unknown.

### Source and code links

Link the first material reference to code with a verified repository URL, ref, and path. Add a line anchor only when it was verified. Never put a machine-local path in a ticket. Omit an unverified code link or identify it as missing evidence instead of inventing it.

### Critic pass

Before returning or publishing a draft, ask: **Could an engineer follow every instruction literally without confusion or extra unnecessary work?** Check evidence, necessity, clarity, ownership, hierarchy, relationships, duplication, scope, and verification. Remove unsupported instructions, repeated constraints, implementation guesses, and unrelated testing.

For a consequential or ambiguous ticket set, use a separate reviewer when available. Give it the draft and inspected evidence without coaching it toward acceptance. Verify its findings before revising the draft.

Specification-to-ticket decomposition is this mode with a ready specification as its source. Create only independently owned outcomes. Do not turn each implementation step into a separate ticket.
