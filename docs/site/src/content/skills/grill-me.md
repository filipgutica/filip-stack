---
related: [planning]
---

## What it does

Grill me stress-tests one idea, design, specification, or plan through focused
questions. It makes important decisions, assumptions, dependencies, failure
behavior, and verification explicit.

## When to use it

- Challenge an architecture or implementation approach before committing to it.
- Find vague scope, hidden assumptions, or weak verification in a proposal.
- Resolve decisions that materially change the work.

It runs only when you call it by name. Ordinary planning, review, and quick
feedback do not activate it. Use [planning](../planning/) when you want a
specification, implementation plan, or tickets as the deliverable.

## How it works

1. Reads the proposal and its declared sources. It checks code, tests, schemas,
   configuration, and documentation before asking for repository facts.
2. Maps the decisions that can change the proposal, including users, ownership,
   boundaries, data flow, compatibility, rollout, and reversibility.
3. Asks exactly one consequential question. Each question includes a recommended
   answer, any unsupported assumption, and why the decision matters.
4. Resolves the current decision before moving to one that depends on it.
   The interview follows relevant branches rather than a generic checklist.
5. Stops when the proposal is coherent, a required fact is unavailable, or
   you ask to stop.

Decisions stay in conversation by default. When you request persistence, a
plain Markdown log records material decisions and changed assumptions. It
keeps your decision separate from the recommendation and does not store a transcript.

## What you get

- Resolved decisions and their rationale.
- Changed assumptions, remaining risks, and unknowns.
- Recommended changes to the proposal.

The skill is read-only except for an authorized grill log. It does not
authorize code changes, specifications, tickets, commits, or publication.
