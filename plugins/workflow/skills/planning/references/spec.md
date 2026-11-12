# Specification guidance

Use this reference for an engineering specification (also called an ERD), a product requirements document (PRD), or an architecture decision record (ADR). Each one states what must be true and which decisions constrain the work. None of them is a file-by-file implementation plan.

Keep a small document small. Omit sections that add no information, unless the repository requires them.

## Decision quality

- Link each requirement to an observable user or system outcome.
- State public contracts, compatibility constraints, and failure behavior.
- Mark unsupported facts as `TBD` or as assumptions.
- List each unresolved decision under **Open decisions**, with the work it blocks, if any.
- For multi-repository work, list only repositories with evidenced ownership. Do not assign work from naming symmetry or architectural preference.

When several components change, add a table with the columns Change, Owner or repository, Contract, Depends on, and Verified by. Give each change a short descriptive name.

Do not name exact files or functions unless they are part of a public contract or needed to remove ambiguity. Put implementation locations and commands in the implementation plan.

## Specification

```md
# <Title>
## Context
<Current behavior and nearest durable source, or Source: Direct request.>
## Goal
<Observable outcome.>
## Non-goals
<Relevant scope boundaries.>
## Requirements
<Behavior, contracts, compatibility, and failure handling.>
## Design
<Decisions, ownership, interfaces, and data flow. Add the component table here when several components change.>
## Verification
<Evidence that will establish the required outcomes.>
## Rollout
<Only when deployment, compatibility, or data changes require it.>
## Open decisions
<Each unresolved decision and the work it blocks.>
```

## Product requirements document

A PRD states the problem and the product behavior. Leave the technical design to a specification.

```md
# <Title>
## Problem
<Who has the problem and what it costs them.>
## Goal
<Observable outcome and how to measure it.>
## Users and use cases
<Who uses the result and what they do with it.>
## Requirements
<What the product must do, in priority order.>
## Non-goals
<Relevant scope boundaries.>
## Open decisions
<Each unresolved decision and the work it blocks.>
```

## Architecture decision record

An ADR records one decision. To change an accepted decision, write a new ADR that supersedes it.

```md
# <Number>. <Decision title>
Status: Proposed | Accepted | Superseded by <link>
## Context
<The forces and constraints that require a decision.>
## Decision
<What we will do, in active voice.>
## Alternatives
<Each option considered and why it was not chosen.>
## Consequences
<What becomes easier, harder, or required.>
```

## Example specification

```md
# Cancel a queued export
## Context
Source: Direct request. Queued exports currently run even when users no longer need them.
## Goal
Let users cancel an export before processing begins.
## Non-goals
Interrupting an export that is already running.
## Requirements
- Cancellation succeeds only while the export is queued.
- If processing starts first, return a conflict and display the current status.
## Design
The export service owns the atomic transition from queued to cancelled. The UI submits the request and refreshes the displayed status.
## Verification
Cancel a queued export and confirm it never starts. Race cancellation with processing and confirm exactly one transition succeeds.
## Open decisions
Whether the status model supports a cancelled state. Blocks the export service change.
```
