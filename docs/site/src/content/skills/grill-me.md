---
related: [planning]
---

## What it does

The questions target decisions that could change your proposal: ownership,
data flow, failure behavior, rollout, and proof. Each comes with a
recommended answer and why the decision matters.

## When to use it

Install the skill, then run `/grill-me` in Claude or `$grill-me` in Codex and
point it at the proposal:

> /grill-me docs/sync-redesign.md

Use it to challenge an approach, expose vague scope or hidden assumptions,
and settle decisions before you build. For a specification, plan, or tickets,
use [planning](../planning/).

## How it works

The agent reads the proposal and looks up facts in the code, tests, and
documentation instead of asking you. Then it asks one question at a time:

```text
Question: Should exports run on a schedule or only on request?
Recommended answer: Only on request; daily data is not needed (assumption).
Why it matters: A schedule adds a job runner and alerts to the proposal.
```

An answer without evidence is labeled as an assumption. The agent settles a
decision before it asks one that depends on it. The interview ends when the
proposal holds together, a needed fact is unavailable, or you ask it to stop.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/grill-me/SKILL.md)
has the interview and log rules.

## What you get

- Settled decisions and their reasons.
- Changed assumptions, remaining risks, and unknowns.
- Recommended changes to the proposal.

Decisions stay in the conversation unless you ask for a Markdown log, which
records decisions and changed assumptions, not a transcript. Otherwise grill
me changes no files.
