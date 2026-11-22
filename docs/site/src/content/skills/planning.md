---
related: [technical-writing, jira-work-links]
---

## What it does

Describe a problem, idea, or approved design and name the one output you want.
The agent reads code, tests, schemas, config, docs, and tracker items to ground
claims in evidence. It separates facts from decisions, assumptions, and open
questions, stopping after that one output. You get a direction, document, plan,
or ticket draft in conversation. Planning makes no code edits and updates
tracker issues only when you ask.

## When to use it

Install [Workflow](../../#install), then ask for the output you need:

| Output | Ask for it when you need to |
| --- | --- |
| Direction | Compare options and settle decisions in conversation |
| Specification | Define behavior, a product requirements document (PRD), or an architecture decision record (ADR) |
| Plan | Turn an approved direction into file-specific, checkable steps |
| Tickets | Draft Jira or GitHub issues for owned outcomes |

> Write an implementation plan for adding CSV export to the reports page.

Planning changes no code. Build the result with [engineering](../engineering/).
Tighten finished wording with [technical-writing](../technical-writing/).

## How it works

1. It picks one mode, confirms goals and exclusions, and asks one focused
   question if an unclear output request changes the work.
2. It reads the code, tests, docs, and tracker items involved and surfaces real
   tradeoffs.
3. It drafts only the requested output using your format or repository template
   first, with observable checks.
4. For multi-repo or public-contract work, a separate reviewer critiques the
   draft for up to three rounds.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/planning/SKILL.md)
defines the four modes and links
[spec](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/planning/references/spec.md),
[plan](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/planning/references/plan.md),
and
[ticket](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/planning/references/tickets.md)
templates.

## What you get

- The requested output, with evidence, open questions, and blocking decisions.
- Unverified ticket facts marked `TBD`.
- A simple bug ticket kept to a few plain sentences and its acceptance criteria.

Output stays in conversation unless you ask for a file. Planning writes no local
ticket files and edits trackers only on request.
