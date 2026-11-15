---
related: [planning, review]
---

## What it does

The agent writes for the intended reader. It keeps facts, decisions, links,
commands, and required structure exactly. It adds no unsupported claims and
says where evidence is missing.

## When to use it

Install the [Workflow plugin](../../#install), then name the document or
section and the format you need. For example:

> Write the PR description for this branch.

Use it for documentation, READMEs, reports, procedures, release notes, error
text, code comments, and PR descriptions. It also checks whether a
specification, plan, or ticket makes sense to a first-time reader. For those,
[planning](../planning/) owns the decisions; technical writing changes only
the wording.

## How it works

The agent identifies the audience, purpose, format, and sources first. It
edits only the part you named.

The writing rules favor familiar words, active sentences, consistent terms,
and one topic per paragraph. Conditions come before the actions they control.
Facts, assumptions, and open questions stay separate.

Last, the agent reads the text as a newcomer would: could someone act on it
without your conversation?

A PR description states the problem before the new behavior. Verification
steps give an action and its expected result. It does not repeat what CI
already reports, but it states any real gap in verification.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/technical-writing/SKILL.md)
links the writing rules and PR guidance.

## What you get

- Finished text in the requested format, true to its sources.
- The evidence, limits, and open questions the reader still needs.

Drafting does not authorize publishing. When you ask it to update a PR, the
agent checks the whole description and reads the saved text back. For a
separate read-only check of a document, use [review](../review/).
