---
related: [pr-review-churn, test-audit]
---

## What it does

Agent-ready environments audits or sets up repositories and engineering
guidance so coding agents can produce correct work and verify it themselves.

## When to use it

- Start a project with a reproducible environment and checkable gates.
- Audit an existing repository, instruction files, skills, or review gates.
- Review the guidance after a model release or source change.

## How it works

1. Selects the applicable modes: new project, existing repository, or
   engineering guidance.
2. Collects evidence across eight pillars, from code shape and test gates
   to reproducible environments, bounded autonomy, and evaluated guidance.
3. Scores applicable pillars from 0 to 3 and orders fixes by blast radius,
   durability, and cost.

The references provide detailed pillar checks and a maintenance procedure
for source drift and guidance decay.

## What you get

- An evidence section and a scored pillar table with gaps and proposed fixes.
- A distinction between advisory guidance and enforced checks.
- Explicit gaps in the skill and checks that remain unverified.
