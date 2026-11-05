---
related: [planning]
---

## What it does

A plan can read well and still leave key decisions open. In grill me, the
agent asks you one question at a time about the decisions that could change
the plan, such as ownership, data flow, failure behavior, rollout, and how you
will prove it works. Each question comes with the answer the agent
recommends.

## When to use it

- Challenge an architecture or implementation approach before you build it.
- Find vague scope, hidden assumptions, or weak verification in a plan.
- Settle the decisions that would change the work.

Grill me runs only when you call it: `/workflow:grill-me` in Claude or
`$workflow:grill-me` in Codex. It comes with the
[Workflow plugin](../../#install). Point it at the proposal, for example
`/workflow:grill-me docs/sync-redesign.md`. If you want a specification, plan,
or tickets as the result, use [planning](../planning/).

## How it works

The agent reads the proposal and its sources first. It looks up facts in the
code, tests, and docs itself instead of asking you for them.

Each question follows the same shape:

```text
Question: <one focused question>
Recommended answer: <the answer and any assumption>
Why it matters: <the decision or risk>
```

An answer without evidence behind it is labeled as an assumption. The agent
settles each decision before it asks about one that depends on it, and it
follows only the questions that could change the proposal, not a fixed
checklist. The interview ends when the proposal holds together, when a fact it
needs is unavailable, or when you ask it to stop.

## What you get

- The decisions you settled, with their reasons.
- Assumptions that changed, and the risks and unknowns that remain.
- Recommended changes to the proposal.

The decisions stay in the conversation. If you ask for a record, the agent
saves a short Markdown log of the decisions and changed assumptions, not a
transcript. Apart from that log, grill me changes no files and does not write
code, specifications, or tickets.
