---
related: [planning]
---

## What it does

Give grill-me an idea, specification, architecture note, or plan. The agent
checks your code, tests, and docs first, then asks one question at a time on
choices that could change the proposal. Each question gives a recommended
answer and why it matters. You get settled decisions, changed assumptions,
risks, and recommended edits.

## When to use it

Run `/grill-me` in Claude or `$grill-me` in Codex on a proposal:

> /grill-me docs/sync-redesign.md

It runs only when invoked. Use it to expose vague scope or hidden assumptions
before building. Skip it for ordinary planning, review, or quick feedback. Use
[planning](../planning/) for specs, plans, or tickets.

## How it works

1. **Check the repo.** Inspects code, tests, and docs instead of asking you for
   existing facts.
2. **Ask one question at a time.** Each question is worded so "yes" accepts the
   recommended answer, labeling unverified answers as assumptions:

   ```text
   Question: Should exports run only on request, not on a schedule?
   Recommended answer: Yes; daily data is not needed (assumption).
   Why it matters: A schedule adds a job runner and alerts to the proposal.
   ```

3. **Settle in order.** Resolves each choice before dependent ones and stops
   when the proposal holds together, a required fact is unavailable, or you
   stop it.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/grill-me/SKILL.md)
has the interview and log rules.

## What you get

- Resolved decisions and rationale.
- Changed assumptions, remaining risks, and unknowns.
- Recommended changes to the proposal.

Decisions stay in chat unless you ask for a Markdown log (no transcripts).
Otherwise grill-me changes no files.
