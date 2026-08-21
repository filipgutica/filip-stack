---
name: writing-plans
description: "Use when a user requests an engineering implementation plan, execution plan, or decision-ready plan from an approved direction and repository evidence."
---

# Writing Plans

Write a plan that another engineer can execute without rediscovering scope, ownership, or verification.

## Workflow

1. Confirm the requested outcome, selected direction, authority boundary, and non-goals.
2. Gather bounded read-only evidence from the relevant code, tests, configuration, and documentation.
3. Reuse existing patterns before proposing new modules, APIs, or dependencies.
4. Stop for a material missing decision. State the decision and its effect instead of inventing a plan.
5. Make each subtask file-specific, independently verifiable, and limited to required work.

## Required plan shape

Use these exact headings, in this order:

```md
# Title

## Context

## Goal

## Non-goals

## Success criteria

## Bounded subtasks

## Files touched

## Verification commands

## Risks / assumptions / open questions
```

Start `Context` with `Source: <nearest durable source>` or `Source: Direct request`. A persisted plan adds `Topic: [TOPIC.md](TOPIC.md)` on the next line. Use a relative link for a local source and a verified HTTPS link for Jira or GitHub. Do not use a brainstorm session ID or a machine-local path.

For every bounded subtask, name the files, expected outcome, and verification signal. List files by role under **Files touched**. Put commands that prove the changed behavior under **Verification commands**. Do not describe implementation as authorized when the request is plan-only.

## External artifacts

Return the plan in the conversation by default. Persist it only when the user explicitly requests an external artifact.

Write the plan beside its specification under an open topic at `~/.engineering-workflow/topics/open/<topic-id>/PLAN.md`. The request grants external-artifact authority only for that write.

Use [Engineering Workflow storage](../setup/references/storage.md). Do not create or change `config.json` or `TOPIC.md` manually. Use the setup utility to validate topics.

If storage or the topic is not configured, use `$workflow:setup` with explicit setup authority. Without that authority, deliver the plan in the conversation.
