---
related: [technical-writing, jira-work-links]
---

## What it does

Planning turns an engineering request into a bounded direction, specification,
implementation plan, or set of tickets. It grounds the result in the
repository and produces only the output you ask for.

## When to use it

- Compare approaches before choosing a direction.
- Define behavior, ownership, and constraints in a specification.
- Turn an approved direction into changes an engineer can verify.
- Break approved work into tickets with clear outcomes and dependencies.

It does not implement changes or handle ordinary prose editing. Use
[technical-writing](../technical-writing/) to revise finished prose.

## How it works

1. Selects one mode: exploration, specification, implementation plan, or tickets.
   It asks a focused question if the choice materially changes the work.
2. Confirms the outcome, users, constraints, non-goals, and authorized actions.
3. Inspects the code, tests, schemas, configuration, documentation, and tracker
   state that own the proposal.
4. Separates observed facts, decisions, assumptions, and unresolved questions.
   It surfaces tradeoffs before they become implementation instructions.
5. Names owners and observable completion signals. Plans identify affected
   files or surfaces; tickets describe independently reviewable outcomes.
6. Removes unsupported work and checks whether another engineer can follow
   the result without inventing a material decision. Consequential or
   ambiguous artifacts receive a separate critique.

Ticket dependencies require real inputs from other work. Relationship checks
can use [jira-work-links](../jira-work-links/) alongside this work.

## What you get

- One requested artifact or a bounded direction, with evidence and uncertainty.
- Verification signals and any decisions that still block implementation.

The result stays in conversation unless you request a file or destination.
Planning does not authorize code changes, commits, publication, or tracker edits.
