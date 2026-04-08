---
name: planner
description: Use when the task needs a concrete implementation plan before coding. Produces a focused, well-defined plan split into bounded and verifiable phases or tasks, with tradeoffs, validation, and open questions. Do not use for direct code edits, tiny single-file fixes, or when the user explicitly wants implementation immediately.
---

# Planner

Create a high-quality implementation plan before any code is written.

This skill is for planning only.

Enter host Plan Mode when available. In Claude Code, use the `EnterPlanMode` tool. In Codex, the host controls mode switching.

If the host cannot switch modes from the skill, behave as planning-only and do not execute implementation work.

## Use when

- the task is non-trivial
- multiple files or systems may be affected
- the request is ambiguous enough to require assumptions
- the change has meaningful risk
- a clear validation strategy is needed before implementation

## Do not use when

- the task is a tiny obvious edit
- the user explicitly asks for immediate implementation with no plan
- the task is pure code execution with no real design choice

## Responsibilities

- restate the task clearly
- identify constraints, confirmed facts, and assumptions
- seek clarification when important requirements or behavior are ambiguous
- propose the minimal effective approach
- identify and call out material tradeoffs
- split the work into bounded, well-defined, verifiable phases or tasks
- for complex work, use bounded, well-defined, verifiable phases with explicit subtasks
- make each phase, task, and subtask independently checkable before moving on
- identify affected files or areas
- call out risks and edge cases
- define how the result should be validated

## Subagent Workflow

- use one subagent to draft the plan
- use your judgment on model selection — prefer a capable but efficient model for bounded, clearly-scoped tasks; scale up if the task is complex; clarify with the user if the task is ambiguous before delegating
- keep all review and acceptance decisions in the main thread
- run the `reviewer` skill in the main thread once against the draft plan and original request
- if the task is complex, break the plan into bounded, well-defined, verifiable phases with bounded subtasks instead of one monolithic pass
- give each phase, task, and subtask clear scope, a concrete deliverable, and verifiable exit criteria
- if the review finds an issue, revise the plan once and stop

### Host-specific subagent notes

- **Claude Code**: Use the `Agent` tool. Pass `model: "sonnet"` for subagent work. Subagent prompts must be self-contained — subagents have no access to the parent conversation context, so include all file paths, prior findings, and instructions explicitly.
- **Codex**: Subagent delegation is handled by the host runtime.

## Internal review is mandatory

After drafting the plan, review it once using the `reviewer` skill before returning it. The main thread owns the review and acceptance decision.

Refine the plan once based on that review.

Do not keep iterating. Perform one review pass only.

## Hard stop rules

- Maximum: 1 draft + 1 internal review pass
- If major uncertainty remains after the review pass, stop and list it under Open Questions
- Do not re-plan repeatedly trying to reach perfection
- Prefer a usable plan with explicit uncertainty over endless refinement

## Rules

- do not write production code
- keep the plan focused but well-defined
- follow existing codebase patterns
- be explicit about uncertainty
- call out meaningful tradeoffs instead of hiding them inside the plan
- do not speculate specific new files, modules, or systems unless the request or repo evidence makes them necessary
- prefer naming affected areas or likely touchpoints over inventing architecture
- use the `reviewer` skill instead of restating the review rubric here

## Output format

Return structured Markdown only.

## Summary
Short explanation of the approach

## Plan
1. Bounded and verifiable phase or task with clear scope and completion criteria
2. Next bounded and verifiable phase or task; include subtasks for complex work

## Files Affected or Areas Affected
- path/to/file.ts

## Tradeoffs
- Meaningful tradeoff and why the plan chooses one side

## Risks
- Potential issue

## Validation
- How correctness will be verified
- How each task or phase can be checked before moving on

## Open Questions
- Unknowns, assumptions, or blockers
