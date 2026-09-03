---
name: technical-writing
description: Use to draft or revise finished technical documentation, reports, procedures, release notes, error text, code comments, or pull request descriptions when clear concise prose is the requested outcome. Do not use to decide engineering scope or create specifications, plans, tasks, or tickets.
---

# Technical writing

Make technical prose clear, concise, and faithful to the source.

## Preserve the contract

1. Identify the audience, purpose, required format, and source evidence.
2. Preserve facts, decisions, links, citations, identifiers, code, commands, and required headings.
3. Separate confirmed facts from assumptions and unresolved items.
4. Do not invent behavior, verification, ownership, or rationale.
5. Edit only the requested artifact or section.

For a pull request description, read [PR description guidance](references/pr-description.md).

## Write with BLUF and plain language

- Lead with the result, decision, or required action.
- Use one term for one concept.
- Prefer short common words and active voice.
- Use a verb for an action.
- Keep instructions in imperative form with one action per step.
- Keep one topic per paragraph.
- Remove filler, marketing language, repeated conclusions, and unnecessary jargon.
- Define a necessary technical term at first use when the audience might not know it.
- Use a table or diagram only when it makes a relationship easier to understand.

Use short sentences as a default. Split a sentence when it contains independent instructions or several conditions. Correctness and required syntax take priority over style rules.

## Finish

Check that:

- the first paragraph gives the bottom line
- every claim has a source or a clear uncertainty label
- required evidence and limitations remain present
- code, commands, and identifiers are unchanged
- the text contains no duplicated requirement
- the requested destination and authority are clear before any external write
