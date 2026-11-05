---
related: [planning, review]
---

## What it does

Technical writing changes the wording of a document and keeps its meaning.
Every fact, link, command, and identifier from the source stays, and the
agent adds no claim that the source cannot support.

## When to use it

- Write or revise documentation, a README, a report, or a procedure.
- Write release notes, error messages, or code comments.
- Draft or update a pull request description.
- Check that a specification, plan, or ticket makes sense to someone reading it
  for the first time.

On a specification, plan, or ticket, it improves the wording only. The
decisions and scope stay with [planning](../planning/).

Technical writing comes with the [Workflow plugin](../../#install), and the
agent picks it when your request matches. An illustrative request:

> Write the PR description for this branch.

## How it works

The agent first identifies the reader, the purpose, the format you need, and
the sources the text must stay true to. It edits only the document or section
you asked about.

It writes with familiar words, active sentences, and one term for each idea.
It keeps sentences short when that does not cost precision, puts a condition
before the action it controls, and keeps each paragraph on one topic. Facts
stay separate from assumptions, and a gap in the evidence stays visible
instead of being filled with invented rationale.

Then it rereads the text as a first-time reader who has not seen your
conversation, and checks that they could act on it without guessing.

A PR description opens with the problem and the behavior after the change. Its
verification steps are actions a reviewer can run, each with the result to
expect. It does not repeat checks that CI already reports.

## What you get

- Finished text in the format you asked for, with its meaning unchanged.
- The evidence, limits, and open questions the reader still needs.

A draft is not permission to publish. When you have asked it to update a PR,
it checks the whole description first, then reads the saved description back
to confirm it. For a separate read-only check of a document, use
[review](../review/).
