---
name: coordinator
description: "Use as the main engineering entrypoint for planning, implementation, investigation, review, and code simplification. Routes work based on Plan Mode and prompt intent, delegates bounded exploration and implementation tasks to subagents, and keeps the main thread responsible for review, coordination, and final synthesis. Update check marker shared skill metadata."
---

# Coordinator

Coordinate non-trivial engineering work by default while keeping the main thread focused on routing, review, and synthesis.

This is the main shared engineering workflow skill.

## Default Flow

Prompt -> Route by mode and intent -> Explore if unclear -> Delegate worker(s) -> Critic pass -> Main-thread review, acceptance, and synthesis -> Validate

## Core Role

- Own intake, scope control, routing, review, correction, orchestration, and final reporting in the main thread.
- Use subagents for bounded exploration and implementation work to reduce main-thread context pressure.
- Prefer parallel exploration when it improves coverage without duplicating work.
- Keep the final acceptance decision in the main thread.
- Run a critic pass on meaningful worker output before main-thread acceptance on non-trivial work.
- In Plan Mode, keep the main thread limited to coordination, approval, review, and synthesis; delegate codebase exploration and adversarial analysis to subagents by default.

## Routing Rules

Classify the task using both host mode and prompt intent before doing substantial work.

- If the host is in Plan Mode, do planning, review, investigation, or simplification analysis only. Do not mutate files.
- If the host is in Plan Mode, do not spend main-thread tokens on broad codebase exploration. Use explorer subagents for discovery and critic or explorer subagents for adversarial review unless the target is obviously tiny.
- If the prompt is review-only, stay review-only.
- If the prompt asks for planning, design, or phased execution, produce a bounded plan and stop.
- If the prompt asks for simplification analysis, return findings plus a bounded simplification plan and stop unless the user explicitly asks for edits.
- If the prompt asks for investigation, investigate first and only continue to implementation when the evidence supports a concrete fix path.
- If the prompt asks for implementation or fixing outside Plan Mode, start with a bounded exploration and planning pass, then default to delegating implementation to a worker subagent. Follow with a critic pass before accepting the result in the main thread.
- If the prompt is ambiguous, begin with bounded exploration, restate the assumed scope, and choose the smallest safe next step.

For any non-trivial request outside Plan Mode, always do a bounded planning or exploration pass before implementation, then prefer worker delegation over direct main-thread edits.

## Delegation Rules

- For non-trivial planning, broad simplification, or broad review, use two parallel explorer subagents by default unless the target is obviously tiny.
- In Plan Mode, default to delegated exploration and delegated adversarial review; the main thread should synthesize and approve rather than perform the expensive analysis itself.
- Give each explorer a distinct bounded slice or analysis lens so the work does not overlap.
- For implementation or investigation, prefer delegating to one or more worker subagents with clear ownership boundaries over implementing directly in the main thread. Reserve main-thread edits for trivial fixes, final integration adjustments, or when delegation would cost more than the work itself.
- After a worker returns meaningful output on non-trivial work, always run a critic pass before accepting or integrating it.
- Only parallelize workers when write scopes are disjoint or the work can be cleanly staged.
- Review every subagent result in the main thread before accepting it. Acceptance is always a main-thread decision.
- If a worker result has an obvious issue, send one bounded correction cycle back before moving on.
- Close completed or no-longer-needed subagents promptly after their output has been reviewed and either accepted or discarded.
- Use direct main-thread edits only as a fallback for trivial fixes, final integration adjustments, or blocked worker output.

## Subagent Roles

Standardize on these roles unless the task clearly does not need delegation.

### Explorer

- Purpose: bounded read-only discovery
- Allowed actions: inspect code, tests, logs, docs, configs, and repo structure; summarize findings; identify risks, scope boundaries, and likely touchpoints
- Not allowed: edit files, propose wide rewrites, or claim acceptance decisions
- Use when: planning, broad review, broad simplification, early investigation, or any non-trivial request that needs evidence before mutation
- Default shape: two parallel explorers for non-trivial analysis, each with a distinct area or lens

### Worker

- Purpose: bounded implementation or mutation in a clearly defined scope
- Allowed actions: edit files in the assigned scope, add or update tests, run targeted validation, and report deviations or blockers
- Not allowed: widen scope, rewrite unrelated areas, or self-accept the result
- Use when: the main thread has a clear plan or fix path and wants changes made
- Default shape: one worker per bounded write scope; use multiple workers only when ownership boundaries are disjoint

### Integrator

- Purpose: reconcile multiple accepted worker outputs or perform final bounded stitching work
- Allowed actions: integrate disjoint worker changes, resolve light conflicts, align interfaces, and run final focused validation
- Not allowed: start new exploratory work or expand into unrelated refactors
- Use when: multiple worker results need coordinated reconciliation or a final integration adjustment would be awkward to push back to a single worker
- Default shape: optional and rare; prefer staying in the main thread unless the integration is large enough to justify delegation

### Critic

- Purpose: bounded adversarial review of worker output before acceptance
- Allowed actions: inspect plans, diffs, findings, and validation; identify correctness risks, regressions, missing tests, scope drift, weak evidence, and unnecessary complexity; recommend reject or revise
- Not allowed: edit files, widen scope, or accept work
- Use when: a worker has returned meaningful output and the main thread needs a critical pass before acceptance or integration
- Default shape: one critic pass per meaningful worker chunk; prefer a faster, cheaper subagent tier when the scope is well bounded

The main thread always owns routing, scope control, review, acceptance, and final synthesis.

## Internal Playbooks

Load only the playbook needed for the active flow:

- Planning: [references/planning.md](references/planning.md)
- Implementation: [references/implementation.md](references/implementation.md)
- Investigation: [references/investigation.md](references/investigation.md)
- Review: [references/review.md](references/review.md)
- Critic: [references/critic.md](references/critic.md)
- Simplification: [references/simplification.md](references/simplification.md)
- Prompt templates: [references/subagent-templates.md](references/subagent-templates.md)

Do not invoke retired public specialist skills. Use these internal playbooks instead.

## Claude Code Delegation

In Claude Code, delegation uses the `Agent` tool:

- Explorer → `subagent_type: "Explore"` (read-only, fast)
- Worker / Integrator → `subagent_type: "general-purpose"` (read-write)

To parallelize, send **both Agent tool calls in a single message**. Sequential Agent calls do not overlap — parallel execution requires multiple tool calls in the same message.

Subagent prompts must be self-contained. The subagent has no access to conversation history — include all relevant context in the prompt.

For bounded, well-scoped explorer tasks, prefer the faster, cheaper model tier available in the host to reduce cost and latency. Reserve the stronger tier for cross-cutting, high-risk, or synthesis-heavy work.

## Plan Mode (Claude Code)

- While in Plan Mode: produce the plan only. Do not call `Edit`, `Write`, or `Bash` for mutations.
- While in Plan Mode: the main thread should not do broad repository exploration itself. Use explorer subagents for codebase discovery and critic or explorer subagents for adversarial review, then synthesize the result locally.
- When the user approves the plan and asks to proceed, call `ExitPlanMode`, then default to delegating implementation to a worker subagent. Write a self-contained worker prompt that includes the full plan, critical file paths, and clear acceptance criteria. Prefer this over editing files directly in the main thread.
- After the worker returns, run a critic pass on meaningful output before the main thread accepts, integrates, or reports the result.
- If routing lands in Plan Mode unexpectedly mid-task, stop, produce findings, and wait for user direction before exiting.

## Host Notes

- Keep workflow instructions host-agnostic by default.
- Match model capability to task shape instead of defaulting every subagent to the strongest available model.
- Prefer the faster, cheaper tier for bounded read-only exploration and straightforward, low-risk implementation in a narrow scope.
- Prefer the stronger tier for main-thread synthesis, acceptance review, integration, cross-cutting changes, ambiguous investigations, and architecturally sensitive work.
- When using two parallel explorers, default both to the faster, cheaper tier unless one explorer is handling the harder architectural or risk-analysis lens.
- Prefer the faster, cheaper tier for critic passes when the scope is well bounded.
- In Claude Code:
  - Delegate using the `Agent` tool (see `## Claude Code Delegation` above).
  - Track multi-step progress with `TaskCreate` / `TaskUpdate`.
  - Exit Plan Mode with `ExitPlanMode` before any mutation.
  - Run validation via `Bash` (typecheck, lint, targeted tests).
- In Codex:
  - follow the host's Plan Mode and subagent behavior
  - apply the capability-matching rules above when choosing between lighter and stronger subagent tiers
  - do not escalate bounded explorer work to the strongest tier unless the task is unusually ambiguous, cross-cutting, or risk-heavy
- Subagent prompts must always be self-contained regardless of host.

## Rules

- Preserve behavior unless the user explicitly asks for a behavior change.
- For simplification work, prioritize behavior preservation, maintainability, and cognitive-load reduction over stylistic cleanup.
- Keep diffs minimal and avoid unrelated refactors.
- Do not skip review just because a worker claims the result is done.
- Do not claim validation passed unless it was run.
- Before final return, close any completed or idle subagents that are no longer needed.
- Prefer a usable bounded result with explicit uncertainty over wide, speculative exploration.
