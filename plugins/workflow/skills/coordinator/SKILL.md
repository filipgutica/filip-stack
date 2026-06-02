---
name: coordinator
description: "Use as the main engineering entrypoint for broad engineering work, implementation, debugging, CI failures, refactors, cleanup, investigation, review, and prompts like 'implement this plan' or 'execute this plan'."
---

# Coordinator

Route non-trivial engineering work to the right flow, delegate bounded subtasks to subagents, and keep the main thread responsible for coordination, review, acceptance, and synthesis.

Favor the lightest workflow that safely fits the task, but do not silently collapse a requested coordinator or subagent workflow into ordinary local execution. Scale delegation and review intensity to task risk, behavioral uncertainty, and verification strength rather than task size alone.

## Core Behaviors

- **Coordinate before changing code.** For non-trivial implementation, create only the execution structure needed to delegate, review, integrate, and verify safely. Do not own detailed implementation-plan formatting.
- **Honor explicit delegation requests.** If the user asks for coordinator workflow with subagents, delegation, parallel agents, explorer/worker/critic roles, or a similar role-based flow, treat that as explicit authorization to use subagents where the host tools allow it. Use the roles that fit the work instead of doing the whole task locally by habit.
- **Route pure planning requests.** If the user asks for a written implementation plan, detailed task plan, or plan-output format, use `superpowers:writing-plans` for the plan content. Coordinator may still handle routing, scope control, and handoff.
- **Ask when ambiguity would cause a brittle or incorrect result.** If requirements, scope, expected behavior, or data shape are unclear enough that silently picking an interpretation would risk a wrong implementation, stop and ask. Do not surface every minor uncertainty — only what would make the result brittle or incorrect without clarification.
- **Treat plan execution as coordinator work.** Prompts like "implement this plan", "execute this plan", "build this", "make these changes", "apply the plan", or "carry this out" should route here unless the task is obviously a one-line mechanical edit.

## Routing Rules

Classify using host mode and prompt intent before starting substantial work.

- **Plan Mode**: planning, review, or investigation only — no file mutations. Use explorer subagents for discovery only when delegated read-only work materially helps; use critic or explorer subagents for adversarial review only when the review risk justifies it.
- **Review-only**: stay review-only.
- **Pure written planning / design / plan-output requests**: route to `superpowers:writing-plans`; coordinator should not invent or own the final plan schema.
- **Simplification analysis**: route broad cleanup, simplification, reuse, efficiency, overcomplication, over-abstraction, dead-code, redundant-test, redundant-style, and Fallow-backed maintainability review requests to `simplification-review`. Keep coordinator responsible for workflow choice, delegation intensity, and synthesis, but leave Fallow usage, simplification heuristics, and output shape to that skill.
- **Investigation**: investigate first; continue to implementation only when evidence supports a concrete fix path.
- **Plan execution / implementation / fix (outside Plan Mode)**: route prompts to implement an approved plan, build a feature, fix a bug, debug a failure, update docs/config, refactor code, clean up code, resolve CI, or apply requested changes through this workflow. Use enough inline structure to assign work, manage risk, and verify outcomes; do not stop at plan formatting unless the user asked for planning only. For non-trivial implementation with a clear write scope, prefer delegating a worker instead of keeping all edits in the main thread, unless the host does not allow spawning or the work is tightly coupled to the next local decision.
- **Mechanical-change fast path**: for rename-only refactors, import/export rewires, file moves with no behavior change, narrow internal test additions, or small repetitive mechanical edits with obvious scope, prefer one short local exploration pass, then execute locally or use one worker only if delegation materially helps. Do not use an explorer by default. Do not use a critic by default unless behavior, public surface, verification strength, or refactor risk justifies it.
- **Ambiguous**: stop and ask before proceeding — do not guess scope or intent.

Natural-language examples that should route here:

- "Implement this plan", "execute this plan", "apply the plan", "build this", "make these changes"
- "Fix this bug", "debug this failure", "figure out why this broke", "fix CI", "fix the failing test"
- "Add this feature", "wire this up", "update this workflow", "refactor this module"
- "Review this", "investigate this", "plan this", "clean this up", "resolve the conflicts"
- "Use coordinator workflow with subagents", "use explorer/worker/critic", "delegate this", "parallelize the investigation"

## Orchestration Loop

For non-trivial implementation or investigation, coordinate the work in this order:

1. **Classify intent and risk.** Identify whether the request is review-only, planning-only, investigation, implementation, CI/debugging, refactor, cleanup, or plan execution. Note behavior/public API risk and validation strength.
2. **Bound discovery.** Read locally for small obvious scopes. Delegate explorer subagents when discovery spans multiple files, unclear ownership, failing CI logs, unfamiliar paths, or independent unknowns.
3. **Choose execution shape.** Keep simple mechanical work local. Use workers when implementation can be assigned to clear files, modules, packages, or responsibilities. If a requested delegation flow cannot be used because the host does not expose or allow subagents, say that explicitly and continue with the closest local equivalent.
4. **Assign disjoint scopes.** When using multiple workers, give each one a self-contained prompt, explicit ownership, and non-overlapping write scope.
5. **Review before accepting.** Run a critic pass when behavior changes, public contracts, risky refactors, weak validation, broad worker output, or an explicitly requested critic role justify adversarial review.
6. **Integrate and verify.** Reconcile worker output, run targeted checks first, broaden verification only when the blast radius justifies it.
7. **Synthesize outcome.** Summarize what changed, what was verified, residual risks, and any follow-up the user needs.

## Subagent Roles

### Explorer
- **Purpose**: bounded read-only discovery
- **Allowed**: inspect code, tests, logs, docs, configs, repo structure; summarize findings; identify risks and scope boundaries
- **Not allowed**: edit files, propose wide rewrites, or claim acceptance decisions
- **Use when**: planning, broad review, early investigation, or implementation work with real unknowns that are distinct enough to justify delegation
- **Default shape**: use one bounded explorer by default for non-trivial discovery when there are multiple files, unfamiliar code paths, ambiguous ownership, failing tests, CI logs, broad diffs, or unclear implementation boundaries. Use parallel explorers when the unknowns are genuinely independent and materially different. Skip explorers for tiny, obvious, or purely mechanical work.
- **Skip when**: a few focused local reads establish scope, fix path, and likely touchpoints well enough to proceed safely
- **Anti-duplication rule**: if explorer discovery was already delegated, synthesize those findings in the main thread instead of substantially re-reading the same surface unless verification or a new decision requires it

### Worker
- **Purpose**: bounded implementation in a clearly defined scope
- **Allowed**: edit files in the assigned scope, add or update tests, run targeted validation, report deviations or blockers
- **Not allowed**: widen scope, rewrite unrelated areas, or self-accept the result
- **Use when**: the main thread has a clear plan and wants changes made
- **Default shape**: use a worker for non-trivial implementation when the change can be assigned to a clear file, module, package, or responsibility slice. Use one worker per bounded write scope; multiple workers only when ownership boundaries are disjoint. Keep edits local only when the task is tiny, the next decision is tightly coupled to the edit, or the host cannot spawn workers.

### Integrator
- **Purpose**: reconcile multiple worker outputs or perform final bounded stitching
- **Allowed**: integrate disjoint worker changes, resolve light conflicts, align interfaces, run final focused validation
- **Not allowed**: start new exploratory work or expand into unrelated refactors
- **Default shape**: optional and rare; prefer main-thread integration unless reconciliation is large enough to justify delegation

### Critic
- **Purpose**: adversarial review of worker output before acceptance
- **Allowed**: inspect plans, diffs, findings, validation; identify correctness risks, regressions, missing tests, scope drift, unnecessary complexity; recommend reject or revise
- **Not allowed**: edit files, widen scope, or accept work
- **Use when**: behavior changes, public API or type-contract changes, risky refactors, weak or incomplete verification, or ambiguous or cross-cutting worker output justify adversarial review
- **Usually unnecessary when**: rename-only internal refactors, purely mechanical edits with green checks, or bounded non-behavioral changes with obvious acceptance criteria
- **Default shape**: selective but expected for meaningful implementation output with behavioral risk, public contracts, broad refactors, weak validation, non-trivial worker changes, or when the user asked for a role-based coordinator flow. Skip critic for tiny mechanical edits with strong checks.

The main thread always owns routing, scope control, review, acceptance, and final synthesis. If the user asked for a role-based flow, the final synthesis should name which roles were used and which were intentionally skipped.

If the main thread already has enough evidence after a few local reads, skip explorer delegation entirely. If delegated findings or worker output are already sufficient, do not duplicate the same discovery work locally without a specific reason.

## Claude Code Delegation

- Explorer → `subagent_type: "Explore"` (read-only, fast)
- Worker / Integrator → `subagent_type: "general-purpose"` (read-write)
- To parallelize, send **both Agent calls in a single message** — sequential calls do not overlap.
- Subagent prompts must be **self-contained**: the subagent has no access to conversation history.

## Plan Mode (Claude Code)

- Planning only — do not call `Edit`, `Write`, or `Bash` for mutations.
- Use explorer subagents for repository discovery only when there are real unknowns that materially benefit from delegated read-only work; otherwise establish scope locally and synthesize in the main thread.
- For pure written implementation plans, use `superpowers:writing-plans` for the plan artifact.
- When the user approves: call `ExitPlanMode`, then delegate implementation to a worker with a self-contained prompt covering the approved scope, critical file paths, and acceptance criteria.
- After the worker returns: use a critic pass only when the output is behaviorally risky, cross-cutting, weakly validated, or otherwise merits adversarial review before acceptance.

## Host Notes

Keep instructions host-agnostic. Match model tier to task shape:

**Claude Code** — main thread: `sonnet`; Explorer: `haiku`; Worker / Integrator / Critic: `sonnet`; escalate to `opus` only for unusually complex or high-stakes synthesis or review.

**Codex** — use the host's current subagent roles for explorer, worker, integrator, and critic work. Prefer the host's default model inheritance and role defaults unless the user asks for a specific model or a task-specific reason justifies an override.

When delegating in Codex, follow the currently exposed `spawn_agent` schema and policy instead of hard-coding stale model names. If a stronger model is needed for an unusually ambiguous, cross-cutting, or risk-heavy delegated task, state why.

Escalate bounded explorer, worker, or integrator work to the stronger tier only when the task is unusually ambiguous, cross-cutting, or risk-heavy.

## Contrast Example

- **Bounded mechanical rename**: do a short local read to confirm scope, execute locally or use one worker if it materially saves time, run targeted checks, and skip explorer and critic by default.
- **Risky behavioral refactor**: do focused local discovery first, use explorer subagents only if there are real unknowns, delegate implementation to a worker once the fix path is clear, and run a critic pass before acceptance.

## References

- Prompt templates: [references/subagent-templates.md](references/subagent-templates.md)
