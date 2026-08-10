---
name: writing-specs
description: "Use when a user needs a decision-complete engineering specification for approved product or technical work before implementation or ticket decomposition."
---

# Writing Specs

Write a specification that fixes the decisions needed to implement and verify the requested work. A spec is decision-complete when an engineer does not need to choose behavior, ownership, compatibility, or verification criteria that affect the result.

## Workflow

1. Confirm the problem, intended outcome, constraints, and selected direction.
2. Inspect the current repository surface for existing contracts, owners, and tests.
3. Record the behavior, scope boundaries, interfaces, data or state changes, failure handling, rollout or migration needs, and verification.
4. Resolve every material implementation decision. If a decision needs user judgment, present the options and stop before calling the spec complete.
5. Separate confirmed facts from assumptions and open questions.

## Quality bar

Make the specification concrete enough to decompose into owned tickets. Use observable behavior and stable terms. Name the owner of each cross-boundary change. Do not include placeholders such as `TBD`, implied defaults, or optional alternatives for material decisions.

Use these headings when they apply:

```md
# <title>

## Context
## Goal
## Non-goals
## User-visible behavior
## Technical design
## Interfaces and data
## Failure modes
## Migration and rollout
## Acceptance criteria
## Verification
## Risks / assumptions / open questions
```

Omit an inapplicable interface, migration, or rollout section. Do not omit a section that contains a material decision.

Do not turn a specification into implementation steps. Use `$workflow:writing-plans` for a file-level execution plan and `$workflow:spec-to-tickets` only after the specification is decision-complete.

## External artifacts

Return the specification in the conversation by default. Write `~/.engineering-workflow/<repo-id>/specs/<topic>/SPEC.md` only when the user explicitly requests a persisted external artifact.

Use [Engineering Workflow storage](../setup/references/storage.md) for an authorized write. Do not create or change `config.json` manually. If storage is not configured, use `$workflow:setup` with explicit setup authority or deliver the specification in the conversation.

Read [upstream.md](references/upstream.md) for source pins and local adaptation decisions.
