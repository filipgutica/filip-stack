---
related: [planning, review]
---

## What it does

The agent keeps facts, decisions, links, commands, and required structure
exactly, adds no unsupported claims, and says where evidence is missing.

## When to use it

Install the [Workflow plugin](../../#install), then name the document or
section and the format you need:

> Write the PR description for this branch.

Use it for documentation, READMEs, reports, procedures, release notes, error
text, code comments, and PR descriptions. It also checks whether a
specification, plan, or ticket makes sense to a first-time reader.
[Planning](../planning/) still owns their decisions.

## How it works

The agent identifies the audience, purpose, format, and sources, and edits
only the part you named. The writing rules favor familiar words, active
sentences, consistent terms, and one topic per paragraph. Facts,
assumptions, and open questions stay separate. Last, the agent reads the text
as a newcomer would: could someone act on it without your conversation?

A PR description states the problem before the new behavior. Each
verification step gives an action and its expected result, and any real gap
in verification is stated.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/technical-writing/SKILL.md)
links the writing rules and PR guidance.

## What you get

- Finished text in the requested format, true to its sources.
- The evidence, limits, and open questions the reader still needs.

Drafting does not authorize publishing. For a read-only check of a document, use
[review](../review/).
