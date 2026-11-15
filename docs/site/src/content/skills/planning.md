---
related: [technical-writing, jira-work-links]
---

## What it does

You ask for one output, and you get that output. A request for a
specification ends with the specification. It does not start a plan or create
tickets on its own. Every claim comes from the code, tests, or tracker.

## When to use it

Install the [Workflow plugin](../../#install), then ask for the output you
need:

| Output | Ask for it when you need to |
| --- | --- |
| Direction | Compare approaches and settle decisions in conversation |
| Specification, PRD, or ADR | Define behavior, product requirements, or one architecture decision |
| Implementation plan | Turn an approved direction into file-specific, checkable changes |
| Tickets | Draft Jira or GitHub issues for owned outcomes with dependencies |

For example:

> Write an implementation plan for adding CSV export to the reports page.

Planning changes no code. To build the result, ask for
[engineering](../engineering/). To improve the wording of a finished
document without changing its decisions, use
[technical-writing](../technical-writing/).

## How it works

The agent first settles the outcome, users, constraints, and exclusions. If
an ambiguity would change the work, it asks you one question.

It then reads the code, tests, schemas, configuration, documentation, and
issues that the proposal touches. It keeps facts apart from decisions,
assumptions, and open questions. It brings real tradeoffs to you before they
become instructions. Each deliverable has a completion signal you can observe.

Before it returns, the agent checks that an engineer could follow the result
without guessing. When the work spans several repositories or changes a public
contract, a separate reviewer critiques it, for up to three rounds.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/planning/SKILL.md)
defines the four modes and their default formats. Your format, or your
repository's, takes precedence.

## What you get

- The direction, specification, plan, or tickets you asked for.
- The evidence behind it, open questions, and decisions that block the work.

The result stays in the conversation unless you ask for a file. Planning
creates or changes Jira or GitHub issues only when you ask, and writes no
local ticket files. A ticket marks each fact it could not verify as `TBD`.
