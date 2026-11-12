---
related: [planning]
---

## What it does

The interview focuses on decisions that could change your proposal: ownership,
data flow, failure behavior, rollout, and proof. Each question includes a
recommended answer and explains why the decision matters.

## When to use it

Install the skill with the command above. Invoke it explicitly with
`/grill-me` in Claude or `$grill-me` in Codex. Point it at the proposal, for
example `/grill-me docs/sync-redesign.md`.

Use it to challenge an architecture or implementation approach, uncover vague
scope or hidden assumptions, and settle decisions before building. If you
need a specification, plan, or tickets as the result, use
[planning](../planning/).

## How it works

The agent reads the proposal and its sources first. It looks up repository
facts in code, tests, and documentation instead of asking you to find them.
Then it asks one consequential question at a time. For example:

```text
Question: Should exports run on a schedule or only on request?
Recommended answer: Only on request; daily data is not needed (assumption).
Why it matters: A schedule adds a job runner and alerts to the proposal.
```

An answer without evidence is labeled as an assumption. The agent settles a
decision before asking one that depends on it. Questions follow the proposal's
open decisions; they are not a fixed checklist. The interview stops when the
proposal is coherent, a required fact is unavailable, or you ask it to stop.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/grill-me/SKILL.md)
has the interview and log contract.

## What you get

- Resolved decisions and their reasons.
- Changed assumptions, remaining risks, and unknowns.
- Recommended changes to the proposal.

Decisions stay in conversation unless you request a record. A saved Markdown
log records material decisions and changed assumptions, not a transcript.
Apart from that log, grill me changes no files. It does not write code,
specifications, or tickets.
