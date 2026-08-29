---
name: grill-with-docs
description: "Use only when the user explicitly asks to be grilled while keeping repository documentation current and recording qualifying architecture decisions."
disable-model-invocation: true
---

# Grill With Docs

Stress-test a plan or design one decision at a time. Update existing repository documentation with resolved information. Record qualifying architectural decisions as ADRs.

Before the first question, read [`grill-me`](../grill-me/SKILL.md), its [grill log contract](../grill-me/references/grill-log.md), and [repository documentation](references/domain-docs.md).

## Authority

An explicit invocation grants repository-document authority for selected existing documentation and qualifying ADR files. It also grants external-artifact authority for one grill log under a confirmed topic.

This authority does not permit code, configuration, specification, plan, ticket, setup, topic creation, commit, push, or publication changes.

Before the first repository write, inspect Git state and the selected documentation. Apply the containment checks in [repository documentation](references/domain-docs.md) before each write. Preserve unrelated changes. If user edits overlap the intended update and the correct merge is unclear, ask one focused question.

## Interview loop

Follow the `grill-me` interview loop, including its question shape and codebase inspection rules.

Ask exactly one question at a time unless the user requests a checklist. Include a recommended answer and explain why the decision matters.

After each resolved answer, complete these actions before the next question:

1. Update the grill log when storage is available and authorized.
2. Update the selected repository documentation when the answer changes its documented subject.
3. Create or update an ADR only when the decision passes every ADR gate.

Do not write tentative language or unresolved decisions. Keep decisions that do not belong in existing documentation in the grill log and conversation.

## Repository documentation

Use each document's current audience and purpose. Prefer the smallest existing README or documentation file that owns the resolved information.

Use concrete scenarios to test boundaries and relationships. Compare factual claims with code, tests, configuration, and existing documentation before asking the user.

Do not create `CONTEXT.md` or another general documentation file by default. Treat an existing `CONTEXT.md` as a repository convention and preserve its purpose and format.

Create or update an ADR only when the decision is hard to reverse, surprising without context, and based on a real tradeoff.

## Completion

Stop when the major decision branches are coherent, the user asks to stop, or missing authority blocks the next required write.

Before completion, confirm that each resolved documentation update and qualifying ADR decision appears in the correct repository document. State any update that could not be persisted.

## References

- [Repository documentation](references/domain-docs.md)
- [Upstream provenance](references/upstream.md)
