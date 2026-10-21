# Tickets

Use Jira or GitHub issues when the external tracker owns the work. Do not mirror external status into a local ticket file.

Create one ticket for one independently reviewable outcome. Add a dependency only when another ticket produces required input. Use subagents only for independent work with separate ownership.

A ticket must let an engineer perform the required work without guessing. Confirm current behavior and ownership before assigning implementation.

### Execution-ready gate

Before assigning implementation, verify the current behavior, owner, and location for each proposed change. If any is missing, return an **Evidence needed before this is execution-ready** brief with only confirmed decisions and the missing evidence. Make investigation the deliverable instead of disguising it as implementation work.

### Tracker hierarchy and relationships

Use the hierarchy and relationship types supported by the target tracker. Verify the project, issue type, parent, ticket key, URL, and relationship direction before including them. Put an uncertain relationship in the evidence brief instead of guessing.

- **External parent:** Group the independently owned outcomes from one decision-ready specification. List verified children in dependency order.
- **Story or issue:** Define one independently reviewable outcome under its verified parent when the tracker supports hierarchy.
- **Subtask:** Use only when part of a story needs separate ownership, sequencing, or verification. Keep ordinary implementation steps in the story.

Select the ticket shape below that matches the work, keeping optional sections only when useful. Omit a proposed fix when evidence does not support one. Make investigation the deliverable when the owner or cause is unknown.

### Source and code links

Link the first material reference to code with a verified repository URL, ref, and path. Add a line anchor only when it was verified. Never put a machine-local path in a ticket. Omit an unverified code link or identify it as missing evidence instead of inventing it.

### Critic pass

Apply [Planning](../SKILL.md)'s critic pass before returning or publishing a draft. For tickets, check evidence, necessity, clarity, ownership, hierarchy, relationships, duplication, scope, and verification. Remove unsupported instructions, repeated constraints, implementation guesses, and unrelated testing.

Specification-to-ticket decomposition is this mode with a ready specification as its source. Create only independently owned outcomes. Do not turn each implementation step into a separate ticket.

## Default formats

### Story or issue

```md
## Goal
<One independently reviewable outcome.>
## Work
<Required work and evidenced ownership.>
## Acceptance criteria
<Observable conditions for completion.>
## Non-goals
<Relevant boundaries.>
## Testing
<Actions and expected results that prove the outcome.>
```

### Bug

```md
## Observed behavior
<Actual and expected behavior, with reproduction steps.>
## Environment
<Relevant version, configuration, and inputs.>
## Root-cause evidence
<Confirmed evidence; label suspected causes as provisional.>
## Proposed fix
<Include only when supported by evidence.>
## Testing
<Reproduction and expected result after the fix.>
```

### Epic or parent

```md
## Goal
<Shared outcome.>
## Children
<Verified child links in real dependency order.>
## Acceptance criteria
<Conditions for the overall outcome.>
## Non-goals
<Relevant boundaries.>
```

### Evidence-needed brief

Use this when behavior, ownership, or a material decision is unresolved. Make investigation the deliverable instead of presenting guesses as implementation instructions.

```md
## Confirmed facts
<Verified behavior and decisions, with sources.>
## Missing evidence
<Specific unknowns and how to resolve them.>
## Readiness
<What must be established before implementation can proceed.>
```

- Acceptance criteria describe behavior; testing describes how to observe it. Preserve uncertainty and avoid duplicating the same requirements across sections.
- Testing names the risks and the owner boundary, not the layers to extend.

### Example story

```md
## Goal
Let users copy an export job's identifier from its details page.
## Work
Add a copy action beside the existing identifier.
## Acceptance criteria
- The action copies the displayed identifier and confirms success.
- A clipboard failure shows an error and leaves the identifier selectable.
## Non-goals
Changing export creation or identifier formatting.
## Testing
Open an export, copy its identifier, and paste it into a text field. Confirm it matches. Deny clipboard access and confirm the failure message appears.
```
