---
related: [technical-writing, jira-work-links]
---

## What it does

You choose one output, and the agent grounds it in the repository's code,
tests, and tracker state. A request for a specification ends with that
specification; it does not start a plan or create tickets automatically.

## When to use it

Install the [Workflow plugin](../../#install), then ask for the output you
need. The agent selects planning when your request matches.

| Output | Ask for it when you need to |
| --- | --- |
| Direction | Compare approaches and settle decisions in conversation |
| Specification, PRD, or ADR | Define behavior, product requirements, or one architecture decision |
| Implementation plan | Turn an approved direction into file-specific, checkable changes |
| Tickets | Draft Jira or GitHub issues for owned outcomes with dependencies |

For example:

> Write an implementation plan for adding CSV export to the reports page.

Planning makes no code changes. Ask for implementation to use
[engineering](../engineering/), or use [technical-writing](../technical-writing/)
to revise finished prose without changing its decisions.

## How it works

The agent establishes the outcome, users, constraints, exclusions, and what
it may change. If ambiguity about the output would change the work, it asks
one focused question.

It reads the sources that own the proposal: code, tests, schemas,
configuration, documentation, and tracker issues. It separates observed facts
from decisions, assumptions, and open questions. Material tradeoffs come to
you before they become implementation instructions. Each deliverable has an
observable completion signal.

Before returning the artifact, the agent checks whether an engineer could
follow it literally without guessing. A separate reviewer critiques the
result first when you ask for a review, the work spans several repositories,
or it changes a public contract.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/planning/SKILL.md)
defines the four modes and links their output formats. Your format and the
repository's format take precedence over those defaults.

## What you get

- The one direction, specification, plan, or set of tickets you requested.
- Supporting evidence, unresolved questions, and decisions that block the work.

The result stays in conversation unless you request a file. Planning does not
commit or publish. It creates or changes Jira or GitHub issues only when you
ask, and it does not write local ticket files. A ticket marks each fact it
could not verify as `TBD` instead of holding back the draft.
