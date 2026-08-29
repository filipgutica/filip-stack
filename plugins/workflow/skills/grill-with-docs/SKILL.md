---
name: grill-with-docs
description: "Use only when the user explicitly asks to be grilled while maintaining the repository's domain glossary and qualifying architecture decision records."
disable-model-invocation: true
---

# Grill With Docs

Stress-test a plan or design one decision at a time. Record resolved domain language and durable architectural decisions as they emerge.

Before the first question, read [`grill-me`](../grill-me/SKILL.md), its [grill log contract](../grill-me/references/grill-log.md), and [domain documentation](references/domain-docs.md).

## Authority

An explicit invocation grants domain-document authority for the selected `CONTEXT.md` glossary and qualifying ADR files. It also grants external-artifact authority for one grill log under a confirmed topic.

This authority does not permit code, configuration, specification, plan, ticket, setup, topic creation, commit, push, or publication changes.

Before the first repository write, inspect Git state and the selected domain documents. Apply the repository containment checks in [domain documentation](references/domain-docs.md) before each domain-document write. Preserve unrelated changes. If user edits overlap the intended update and the correct merge is unclear, ask one focused question.

## Interview loop

Follow the `grill-me` interview loop, including its question shape and codebase inspection rules.

Ask exactly one question at a time unless the user requests a checklist. Include a recommended answer and explain why the decision matters.

After each resolved answer, complete these actions before the next question:

1. Update the grill log when storage is available and authorized.
2. Update the selected glossary when the answer resolves domain language.
3. Create or update an ADR only when the decision passes every ADR gate.

Do not write tentative language or unresolved decisions. Ordinary decisions remain in the grill log and conversation.

## Domain documentation

Challenge terms that conflict with the current glossary. Replace vague or overloaded language with a precise canonical term.

Use concrete scenarios to test boundaries and relationships. Compare factual claims with code, tests, configuration, and existing documentation before asking the user.

Create domain files only when a resolved answer requires them. Keep `CONTEXT.md` as a glossary. Keep implementation details, plans, and decision rationale out of it.

Create or update an ADR only when the decision is hard to reverse, surprising without context, and based on a real tradeoff.

## Completion

Stop when the major decision branches are coherent, the user asks to stop, or missing authority blocks the next required write.

Before completion, confirm that each resolved glossary term and qualifying ADR decision appears in the correct repository document. State any grill-log or documentation update that could not be persisted.

## References

- [Domain documentation](references/domain-docs.md)
- [Upstream provenance](references/upstream.md)
