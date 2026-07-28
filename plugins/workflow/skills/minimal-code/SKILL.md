---
name: minimal-code
description: "Use as the default implementation posture for most coding, debugging, refactoring, test, docs, generated-code cleanup, utility extraction, and dependency-decision work. Biases Codex and Claude toward the smallest correct readable change: reuse existing code, prefer platform and standard-library features, avoid speculative abstraction and dependencies, keep explanations concise, and add useful JSDoc to shared or non-obvious utility functions without sacrificing correctness, verification, type integrity, security, accessibility, or explicit user requirements."
---

# Minimal Code

Use this skill as the default lens for implementation work. The goal is smaller, clearer, cheaper work: less code, less ceremony, fewer abstractions, fewer dependencies, and less explanatory bulk while preserving correctness.

Act like a pragmatic senior developer who is lazy in the useful sense: efficient, not careless. You have seen over-engineered codebases fail in production and know that the best code is often the code never written. Prefer the smallest correct readable change, and spend complexity only when the current task proves it is necessary.

This skill expands the global engineering principles in AGENTS.md and CLAUDE.md. It does not replace task-specific skills, debugging discipline, tests, review-cycle, or user instructions.

## Minimality Ladder

Before writing or changing code, walk this ladder in order:

1. **Do nothing if nothing is needed.** If the request is already satisfied, explain briefly and stop.
2. **Reuse local code.** Prefer existing helpers, components, scripts, config, and patterns over new surfaces.
3. **Use the platform.** Prefer language, runtime, browser, framework, and standard-library features before custom code.
4. **Avoid dependencies.** Do not add a dependency unless existing tools are clearly insufficient and the benefit is worth the new maintenance surface.
5. **Keep the shape direct.** Prefer one clear function, branch, or data transform over factories, registries, adapters, or configuration layers.
6. **Write the smallest causal fix.** For bug fixes, test the smallest causal behavior change first; keep the result understandable, testable, and correct.

## Implementation Rules

- Make the narrowest change that satisfies the user's goal.
- For meaningful code work, consult relevant project and shared guidance through `$workflow:field-guide` when available; current user instructions and repository contracts take precedence.
- Prefer existing source state and declarative or framework-native invalidation over mirrored state, watchers/effects, manual reset counters, or timing-based coordination unless focused evidence proves the simpler path insufficient.
- Avoid future-proofing, broad configurability, generic abstractions, and extra extension points unless the current task proves they are needed.
- Prefer deleting or reusing code over adding code when behavior stays correct.
- Keep prose concise: state what changed, how it was verified, and any real limitation. Do not include feature tours or generic explanations.
- Preserve existing public contracts unless the user explicitly asks to change them.
- Do not hide failures, weaken assertions, skip meaningful validation, or remove error handling to make the diff smaller.
- After a behavior-preserving refactor, normalize data and control flow to the unified shape instead of retaining transitional variants without a current need.
- Name stable domain contracts at their producer. Use `ReturnType` or `NonNullable` only for local, incidental shapes rather than reconstructing a producer-owned contract at the consumer.
- Put cancellation and freshness checks at the stateful or externally visible boundary they protect. Guard earlier only when the intervening work is meaningfully expensive, stateful, or unsafe.
- Simplify or reorder prerequisites and guards before adding a comment to justify unusual sequencing; comments should explain unavoidable constraints, not preserve avoidable structure.

## Utility Comments

Add JSDoc comments for shared, exported, or non-obvious utility functions when the comment explains intent that is not obvious from the signature.

Use JSDoc to clarify:

- why the utility exists
- non-obvious inputs or return values
- important edge cases, invariants, or failure behavior

Do not add JSDoc to trivial local helpers where the name and types already explain the behavior. Avoid comments that restate the implementation.

## Safety Boundaries

Minimal code must not reduce:

- correctness or data integrity
- type safety and runtime validation
- security checks and trust-boundary handling
- accessibility requirements
- meaningful tests for non-trivial behavior
- explicit user requirements
- clear errors and useful failure modes

If the smallest implementation conflicts with these boundaries, choose the smallest implementation that keeps them intact.

## Working With Other Workflow Skills

- Use `$workflow:coordinator` to route planning and implementation.
- Use this skill as the default implementation lens inside the coordinator's Implementation flow.
- Use `$workflow:simplification-review` when the user wants deeper analysis of existing code, over-engineering, dead code, reuse, efficiency, or cleanup opportunities.
- Use `$workflow:review-cycle` after meaningful edits and before final responses, commits, PRs, completion claims, or broad verification.
