---
name: implementer
description: Use when there is a clear plan or the task is ready for code changes. Implements the smallest correct change, breaking larger work into smaller chunks when needed, then performs bounded self-review before returning. Do not use for pure planning, brainstorming, or vague architecture exploration.
---

# Implementer

Implement a change cleanly and accurately.

This skill is for execution, not planning.

## Use when

- there is an approved or clear plan
- the user wants code changes made
- the task is ready for implementation and validation

## Do not use when

- the task is still ambiguous and needs planning first
- the user is asking for brainstorming only
- the task is architecture exploration without a concrete change target

## Responsibilities

- follow the plan closely
- inspect surrounding code before editing
- make the minimal necessary change
- preserve local patterns and conventions
- update or add tests when appropriate
- report deviations clearly

## Subagent Workflow

- use one subagent to implement the change
- use your judgment on model selection — prefer a capable but efficient model for bounded, clearly-scoped tasks; scale up if the task is complex; clarify with the user if the task is ambiguous before delegating
- if the task is large or complicated, split the plan into multiple sequential subagent tasks, each with a narrow and clearly bounded scope
- send each task to the subagent one at a time; do not batch multiple steps into a single subagent call
- keep all review and acceptance decisions in the main thread
- run the `reviewer` skill in the main thread after each subagent task completes — this is mandatory, not optional
- do not proceed to the next task until the current one has passed review
- if the review finds an obvious issue, send one correction cycle through the same subagent before moving on
- after all tasks are complete, do one final review pass on the combined change against the original request
- keep the review independent and do not let it rewrite unrelated code

### Host-specific subagent notes

- **Claude Code**: Use the `Agent` tool. Pass `model: "sonnet"` for subagent work. Subagent prompts must be self-contained — subagents have no access to the parent conversation context, so include all file paths, prior findings, and instructions explicitly.
- **Codex**: Subagent delegation is handled by the host runtime.

## Internal review is mandatory

After each meaningful implementation chunk, perform one critical self-review using the `reviewer` skill before continuing. The main thread owns the review and acceptance decision.

If the review finds an obvious issue, fix it immediately as part of that same pass.

Do not keep iterating.

## Hard stop rules

- Maximum: bounded implementation/review cycles per chunk; do not keep iterating on the same chunk
- If issues remain that cannot be resolved confidently, stop and report them under Known Limitations
- Do not enter repeated self-review loops
- If validation fails, report the failure clearly instead of repeatedly retrying without a new approach

## Rules

- do not expand scope unnecessarily
- do not rewrite unrelated code
- do not assume missing details silently
- do not claim tests passed unless they were run
- do not hide failed validation
- use the `reviewer` skill for the final review pass instead of duplicating the rubric here
- always return the implementer summary template after implementation, even if the last step was validation or a follow-up question

## Output format

Return structured Markdown only.

## Summary
What was implemented

## Files Changed
- path/to/file.ts

## Plan Deviations
- None / explanation

## Validation Run
- Tests: passed/failed/not run
- Lint: passed/failed/not run
- Build: passed/failed/not run

## Known Limitations
- Any unresolved issues, uncertainty, or follow-up needed
