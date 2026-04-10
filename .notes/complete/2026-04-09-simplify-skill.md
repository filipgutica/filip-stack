---
title: "simplify skill"
status: "complete"
created: "2026-04-09"
started: "2026-04-09"
completed: "2026-04-09"
tags: ["skill", "planning"]
---

# simplify skill

## Planning Seed

Created from session prompt.

Original request: notes plan new simplify skill

Requested outcome: create a new tracked notes item and draft a plan for a "simplify skill" task.

Clarified scope: this is a brand new "code simplifier" skill.

Reference model: https://mcpmarket.com/tools/skills/codebase-simplifier

Initial direction: borrow the strong parts of that skill's definition, especially its behavior-preserving simplification goal and maintainability focus, while adapting the workflow to this repository's skill conventions and guardrails.

## Approved Plan

Create a new repo skill named `code-simplifier` under `skills/code-simplifier/` that works the same way in Codex and Claude. The skill should analyze code for simplification opportunities without changing behavior, then return prioritized findings plus a `$planner`-style simplification plan. By default, it should use two parallel exploration subagents unless the target is obviously tiny. The skill must not implement changes itself; it should explicitly suggest `$implementer` when the user wants execution.

Implement the skill contract in `skills/code-simplifier/SKILL.md` with explicit targeted-versus-broad scope guidance, parallel exploration by default, `$planner` integration for bounded and verifiable follow-up tasks, and a fixed output contract of Summary, Findings, Simplification Plan, Tradeoffs, Risks, Validation, and Open Questions. Add `skills/code-simplifier/agents/openai.yaml` with host-neutral metadata and a default prompt that mentions `$code-simplifier`, requests findings plus a `$planner`-style plan, and clarifies how to ask for targeted or broad analysis.

## Completion Criteria

- `skills/code-simplifier/SKILL.md` defines a host-agnostic, analysis-first code simplification workflow that does not perform implementation.
- The skill explicitly distinguishes targeted analysis from broad analysis and tells users how to specify each.
- The skill explicitly references `$planner` for shaping simplification plans and `$implementer` for follow-up execution.
- The skill defaults to two parallel exploration subagents except for obviously tiny targets.
- `skills/code-simplifier/agents/openai.yaml` exists and matches the final skill contract.
- Relevant validation passes or any non-applicable steps are clearly explained.

## Work Log

- 2026-04-09 Approved the implementation plan, moved the ticket to in-progress, and began creating the new `code-simplifier` skill with host-agnostic metadata and bounded scope rules.
- 2026-04-09 Added `skills/code-simplifier/SKILL.md` and `skills/code-simplifier/agents/openai.yaml`, then tightened the prompt contract so targeted versus broad analysis is explicit in both the skill body and metadata.
- 2026-04-09 Validated the repo with `pnpm typecheck`, `pnpm test`, and `pnpm build`. `lint` and `stylelint` are not configured in this repository, so those checks were not applicable.

## Completion Summary

Added a new `code-simplifier` skill that is host-agnostic between Codex and Claude, analysis-only, and shaped around behavior-preserving simplification. The skill now teaches users how to request targeted versus broad analysis, defaults to two parallel exploration subagents except for obviously tiny targets, uses `$planner` as the model for bounded and verifiable simplification plans, and explicitly hands execution off to `$implementer`. Validation passed with `pnpm typecheck`, `pnpm test`, and `pnpm build`.
