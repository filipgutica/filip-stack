---
name: grill-me
description: Use only when the user explicitly invokes this skill to stress-test an idea, specification, plan, architecture, or implementation approach through focused questions. Do not activate it for ordinary planning, review, or requests for quick feedback.
disable-model-invocation: true
---

# Grill Me

Stress-test one proposal until its important decisions, assumptions, dependencies, failure modes, and verification are explicit.

## Start from evidence

Read the supplied proposal and its declared sources. Inspect code, tests, schemas, configuration, and documentation before asking for facts the repository can answer.

Build a small decision tree around the goal, users, constraints, ownership, boundaries, data flow, failure behavior, compatibility, rollout, reversibility, and proof. Follow only branches that can change the proposal.

## Interview loop

1. Ask exactly one consequential question.
2. Include the answer you recommend from current evidence.
3. Label an answer as an assumption when evidence is missing.
4. State why the decision matters.
5. Challenge vague scope, hidden assumptions, premature abstractions, and weak verification.
6. Resolve the current decision before moving to a dependent one.
7. Stop when the proposal is coherent, a required fact is unavailable, or the user asks to stop.

Use this shape:

```text
Question: <one focused question>
Recommended answer: <the answer and any assumption>
Why it matters: <the decision or risk>
```

Do not turn the interview into a generic checklist. Do not ask the user to rediscover repository facts.

## Paper trail

Read [grill log guidance](references/grill-log.md) only when a log path is known or the user requests persistence.

Store a log beside a referenced work artifact or under `~/.engineering-workflow/<work-item>/grills/`. Do not block the interview on storage. If no destination is clear, keep a concise checkpoint in the conversation.

Record material decisions and changed assumptions. Do not record every turn, a transcript, hidden reasoning, full source content, or repeated instructions.

This skill is read-only except for an authorized grill log. It does not authorize specifications, plans, tickets, code changes, commits, or publication.

## Finish

Return:

- resolved decisions and rationale
- changed assumptions
- remaining risks or unknowns
- recommended changes to the proposal
