---
name: grill-me
description: Use when the user wants to stress-test a plan, design, architecture, implementation approach, or decision tree; when they ask to be grilled, challenged, interrogated, or pushed for clearer tradeoffs and assumptions.
---

# Grill Me

## Overview

Interview the user rigorously about a plan or design until the important decisions, assumptions, dependencies, and tradeoffs are explicit. Keep the pressure constructive: the goal is shared understanding, not performance.

An explicit `$workflow:grill-me` invocation creates a curated topic log by default. Read [grill-log.md](references/grill-log.md) before the first question.

## Interview Loop

- Start from the user's plan, proposal, or design. If there is no concrete artifact yet, ask for the smallest useful statement of the goal, constraints, and intended approach.
- Build a decision tree mentally: goal, users, constraints, boundaries, data flow, API or UI shape, failure modes, migration or rollout, observability, verification, and reversibility.
- Ask exactly one question at a time unless the user explicitly asks for a checklist.
- For each question, include a concise recommended answer based on the current evidence. Mark it as an assumption when it depends on missing information.
- Resolve the current branch before moving to a dependent branch. Use the user's answer to update the next question.
- After each resolved answer, update the grill log before asking the next question.
- Challenge vague answers, hidden assumptions, premature abstractions, and missing verification with concrete follow-up questions.
- Stop when the plan has a coherent path through the major decisions, or when the user asks to stop.

## Codebase-Aware Questions

If a question can be answered by inspecting local code, tests, documentation, configs, open files, or command output, inspect those sources first instead of asking the user. Then ask only for the remaining judgment or preference.

Prefer:

- "I found `X` in `path/to/file`; given that, should we preserve this contract or change it?"
- "Recommended answer: preserve it, because the existing callers rely on `Y`."

Avoid:

- Asking the user for facts that are discoverable locally.
- Asking multiple independent questions in one turn.
- Turning the interview into a generic checklist detached from the user's actual plan.

## External artifact authority

The explicit invocation grants authority only for one grill log under the confirmed topic. It does not grant repository setup, specification, plan, ticket, or implementation authority.

Use the setup utility to resolve an existing topic. If no durable source selects one, ask the user to select an open topic or confirm a proposed new topic. Create no log before topic confirmation.

If setup or topic creation is required, use `$workflow:setup` only with explicit setup authority. Without that authority, continue in the conversation and state that no grill log was persisted.

## Question Shape

Use this shape by default:

```text
Question: <one focused question>
Recommended answer: <the answer you would choose, with assumptions if any>
Why it matters: <the decision this unlocks or the risk it exposes>
```
