---
related: [technical-writing, jira-work-links]
---

## What it does

You get the one output you ask for. A request for a specification ends with
the specification, not a plan or tickets. The agent grounds it in the
repository's code, tests, and tracker.

## When to use it

Install the [Workflow plugin](../../#install), then ask for the output you
need:

| Output | Ask for it when you need to |
| --- | --- |
| Direction | Compare approaches and settle decisions in conversation |
| Specification, PRD, or ADR | Define behavior, product requirements, or one architecture decision |
| Implementation plan | Turn an approved direction into file-specific, checkable changes |
| Tickets | Draft Jira or GitHub issues for owned outcomes with dependencies |

> Write an implementation plan for adding CSV export to the reports page.

Planning changes no code. To build the result, ask for
[engineering](../engineering/). To improve a finished document's wording,
use [technical-writing](../technical-writing/).

## How it works

The agent settles the outcome, users, constraints, and exclusions, and asks
you one question if an ambiguity would change the work. It reads the code,
tests, schemas, configuration, documentation, and issues the proposal
touches. It keeps facts apart from decisions, assumptions, and open
questions, and brings real tradeoffs to you. Each deliverable has a
completion signal you can observe.

When the work spans several repositories or changes a public contract, a
separate reviewer critiques it, for up to three rounds.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/planning/SKILL.md)
defines the four modes and their default formats. Your format, or your
repository's, takes precedence.

## What you get

- The direction, specification, plan, or tickets you asked for.
- The evidence behind it, open questions, and decisions that block the work.

The result stays in the conversation unless you ask for a file. Planning
creates or changes Jira or GitHub issues only when you ask, writes no local
ticket files, and marks each unverified ticket fact as `TBD`.
