---
related: [merge-council]
---

## What it does

Council gathers independent advice from Astra, Sol 6.1, and Opus 5.5 at high
effort. The current agent combines their reasoning into a recommendation.

## When to use it

Ask for a council on a question, decision, plan, design, document, or code.
Use [merge council](../merge-council/) when you need its PR-specific review
procedure and merge verdict.

## How it works

1. Frames the same question, context, constraints, and criteria for all members.
2. Checks model availability and launches three independent, read-only delegates
   in parallel. A missing target requires your decision before launch.
3. Collects their opinions and checks consequential claims against evidence.
4. Recommends a next step while preserving material disagreement and uncertainty.

One round is the default. It needs no separate chair or saved roster.

## What you get

The recommendation, each member's position, useful agreement, material dissent,
and the next action. Missing responses are reported as an incomplete council.
Council advice alone does not authorize edits, publication, or merging.
