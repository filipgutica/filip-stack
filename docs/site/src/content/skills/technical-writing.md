---
related: [planning, review]
---

## What it does

Technical writing makes technical prose clear, concise, and faithful to its
sources. It preserves the facts, decisions, structure, and identifiers that
readers need to use the document.

## When to use it

- Write or revise documentation, READMEs, reports, and procedures.
- Prepare release notes, error text, or code comments.
- Draft or update a pull request description.
- Check whether a specification, plan, or ticket makes sense to its first reader.

[Planning](../planning/) owns engineering scope, requirements, decisions, and
task breakdowns. This skill improves their wording without changing those decisions.

## How it works

1. Identifies the audience, purpose, required format, and source evidence.
   It edits only the requested artifact or section.
2. Preserves facts, links, citations, commands, identifiers, and required headings.
   Confirmed facts stay separate from assumptions and unresolved items.
3. Uses familiar words, active sentences, consistent terms, and paragraphs
   that stay on one topic. Conditions come before the actions they control.
4. Reviews the result as someone who has not seen the conversation.
   It checks whether the reader can act without reconstructing missing context.
5. Removes filler, repetition, and unsupported claims. Missing evidence remains
   explicit rather than becoming invented rationale or verification.

Pull request descriptions follow repository guidance and lead with the problem
and resulting behavior. Reviewer actions include expected results. Verification
does not repeat routine checks already reported by CI.

## What you get

- Finished prose in the requested format, with technical meaning preserved.
- Necessary evidence, limitations, and unresolved questions retained.

A draft does not authorize publication. For an authorized PR update, the skill
checks the complete body before publication and fetches it afterward to verify
the saved result. Use [review](../review/) for a separate read-only artifact check.
