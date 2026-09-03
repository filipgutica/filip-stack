# Specification guidance

A specification defines what the system must do and which decisions constrain implementation. It is not a file-by-file implementation plan.

Use this shape when each section adds information:

```md
# <Title>

## Context
## Goal
## Non-goals
## Requirements
## Design and ownership
## Component changes
## Verification
## Rollout or migration
## Risks, assumptions, and open questions
```

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
