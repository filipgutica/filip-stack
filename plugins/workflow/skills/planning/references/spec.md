# Specification guidance

A specification defines what the system must do and which decisions constrain implementation. It is not a file-by-file implementation plan.

Keep a small specification small. Add component, interface, data-flow, migration, or rollout detail only when the requested behavior needs it.

## Decision quality

- Link requirements to an observable user or system outcome.
- Name the current owner for each changed behavior.
- State public contracts, compatibility constraints, and failure behavior.
- Mark unsupported facts as `TBD` or assumptions.
- Mark an unresolved decision as a gate only when it blocks named work.
- Keep non-blocking questions separate from gates.
- Set the status to `Draft` while a gate blocks implementation.
- Set the status to `Ready` only when implementation can proceed without inventing a material decision.

For multi-repository work, list only repositories with evidenced ownership. Do not assign work from naming symmetry or architectural preference.

Each component change must state:

- required outcome
- owner or repository
- affected contract
- dependency or order constraint
- verification signal

Do not add exact files or functions unless they are part of a public contract or needed to remove ambiguity. Put implementation locations and commands in the implementation plan.

## Default structure

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
## Design and ownership
<Decisions, responsibilities, interfaces, and data flow.>
## Component changes
<Only when multiple components need distinct changes.>
## Verification
<Evidence that will establish the required outcomes.>
## Rollout or migration
<Only when deployment, compatibility, or data changes require it.>
## Risks, assumptions, and open questions
<Material uncertainty and decisions still needed.>
```

- Keep a small specification small. Omit sections that add no information, subject to required project structure.

## Example

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
## Design and ownership
The export service owns the atomic transition from queued to cancelled. The UI submits the request and refreshes the displayed status.
## Verification
Cancel a queued export and confirm it never starts. Race cancellation with processing and confirm exactly one transition succeeds.
## Risks, assumptions, and open questions
Confirm whether the existing status model supports cancelled before implementation.
```
