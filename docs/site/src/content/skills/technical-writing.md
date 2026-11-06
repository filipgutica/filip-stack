---
related: [planning, review]
---

## What it does

The agent writes for the intended reader while preserving facts, decisions,
links, commands, identifiers, and required structure. It keeps unsupported
claims out and makes evidence gaps visible.

## When to use it

Install the [Workflow plugin](../../#install), then request the text or
revision. The agent selects technical-writing when the request matches.
Name the document or section and the format you need. For example:

> Write the PR description for this branch.

Use it for documentation, READMEs, reports, procedures, release notes, error
text, code comments, and PR descriptions. It also checks whether a
specification, plan, or ticket makes sense to a first-time reader.

For those engineering artifacts, [planning](../planning/) owns the scope and
decisions. Technical writing improves their wording without changing them.

## How it works

The agent identifies the audience, purpose, format, and source evidence before
writing. It edits only the artifact or section you requested.

Familiar words, active sentences, consistent terms, and one topic per
paragraph make instructions easier to follow. Conditions come before the
actions they control. Sentences stay short where precision allows. Facts,
assumptions, and unresolved questions remain distinct; missing evidence is not
filled with invented rationale.

The final pass takes the reader's position: could someone act on the text
without seeing your conversation or guessing what the author meant?

For PR descriptions, the problem comes before the resulting behavior. Any
verification instructions give an action and its expected result. Routine
checks that CI already reports are not repeated, but a material verification
gap is stated.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/technical-writing/SKILL.md)
links the prose rules and PR-description guidance.

## What you get

- Finished text in the requested format, faithful to its sources.
- The evidence, limitations, and open questions its reader still needs.

Drafting does not authorize publication. When you request a PR update, the
agent checks the full description and reads the saved text back afterward.
Use [review](../review/) for a separate read-only check of a document.
