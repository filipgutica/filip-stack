---
related: [technical-writing, jira-work-links]
---

## What it does

Planning helps you decide what to build before anyone edits code. It reads
the code, tests, and tracker issues that the work touches, so the result
describes the repository as it is, and it produces only the one output you
asked for.

## When to use it

Ask for one of these four outputs:

| Output | Use it to |
| --- | --- |
| A direction | Compare approaches and settle decisions in the conversation |
| A specification | Define behavior, boundaries, and the outcomes you can observe |
| An implementation plan | List file-by-file changes, each one checkable, from an approved direction |
| Tickets | Split approved work into owned outcomes with their dependencies |

Planning does not implement anything or polish ordinary prose. To build the
change, ask for it and [engineering](../engineering/) takes over. To revise
finished prose, use [technical-writing](../technical-writing/).

Planning comes with the [Workflow plugin](../../#install), and the agent picks
it when your request matches. An illustrative request:

> Write an implementation plan for adding CSV export to the reports page.

## How it works

The agent first confirms the outcome, the users, the constraints, what is out
of scope, and what it may change. If the output you want is unclear and the
answer would change the work, it asks you one question.

Then it reads the code, tests, schemas, configuration, docs, and tracker state
behind the proposal. The result keeps observed facts, decisions, assumptions,
and open questions apart, and it raises a tradeoff with you before turning it
into an instruction. Every deliverable gets a signal you can observe to know
it is done.

Before it returns the result, the agent asks whether an engineer could follow
every instruction literally without guessing. A consequential or ambiguous
result gets a critique from a separate reviewer first.

## What you get

- One direction, specification, plan, or set of tickets, with its evidence and
  its open questions.
- The decisions that still block the work.

The result stays in the conversation unless you ask for a file. Planning does
not edit code, commit, or publish, and it creates or changes Jira or GitHub
issues only when you ask. It also stops after the output you asked for: a
specification does not turn into a plan and tickets on its own.
