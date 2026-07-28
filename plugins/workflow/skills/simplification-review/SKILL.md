---
name: simplification-review
description: "Use when reviewing changed or explicitly scoped code for behavior-preserving simplification, reuse, efficiency, dead code, redundant tests or styles, or maintainability problems."
---

# Simplification Review

Use this skill to find behavior-preserving simplifications. Keep the review bounded and prefer readability over cleverness. Stop unless the user asks for edits.

Use Fallow as the primary deterministic tool for supported JavaScript, TypeScript, Vue, Nest, and style cleanup. Run it before broad manual exploration.

Do not limit the review to Fallow findings. Also inspect reuse, abstraction quality, maintainability, efficiency, tests, styles, and unnecessary complexity.

Use the [official Fallow skill](https://github.com/fallow-rs/fallow-skills/blob/main/fallow/skills/fallow/SKILL.md) for current command guidance. If command guidance conflicts, use the upstream Fallow guidance. Keep this skill's broader review scope and safety rules.

## Scope Resolution

Resolve scope in this order:

1. If the user names files, paths, a diff, a module, or a surface, use that scope.
2. Otherwise inspect local changes first with `git diff` and `git status --short`.
3. Review tracked changes from `git diff` plus any untracked files surfaced by `git status --short`.
4. If there are no local tracked or untracked changes, inspect branch changes with `git diff origin/main`.
5. If neither diff identifies an area to review, ask the user to name one.

Keep the review within that area unless the user explicitly widens it.

## Review Goals

- Preserve exact behavior, public contracts, meaningful side effects, and intended test coverage.
- Reduce cognitive load, duplication, and unnecessary complexity.
- Prefer explicit code over dense or clever code.
- Improve maintainability and extensibility without turning the work into a rewrite.
- Treat efficiency as a review dimension only when there is an obvious, low-risk improvement.

## Review Lens

Inspect the selected area for these categories. Report only categories that apply:

- duplicated code, weak reuse, or repeated logic
- special-case branches, duplicate mappings, redundant guards, or mode-specific paths that a shared path can already handle
- hard-to-follow control flow, ambiguity, or unnecessary nesting
- brittle structure or poor extensibility
- duplicate sources of truth, derived context sets, helper sets, or local state mirrors. Prefer an existing store, composable, injectable, utility, or package API.
- leaky, layered, or unnecessary abstractions
- overcomplicated, over-engineered, or over-abstracted code
- type-only or lint-only ceremony, casts, wrappers, or scaffolding that does not make caller behavior clearer
- poor separation of concerns or weak organization
- dead, unused, or obsolete code paths
- inefficient code that has a clear simplification path without changing behavior
- low-value, redundant, dead, or duplicated tests that do not verify useful behavior
- redundant styles or unused style paths that can be removed safely

Also report when the current complexity is justified or a change would create mostly stylistic churn.

Avoid recommending simplifications that:

- compress too many concerns into one function or component
- replace readable code with dense one-liners
- introduce nested ternaries or similarly hard-to-debug expressions
- remove abstractions that provide useful separation or ownership

## Workflow

1. Confirm the scope from an explicit user request or the diff-based fallback order above.
2. For supported JavaScript, TypeScript, Vue, Nest, or style cleanup, run the most focused Fallow command first. Use `--format json --quiet`.
3. Prefer workspace-scoped Fallow commands for package/app-specific work in monorepos.
4. Read focused files after Fallow identifies them. For qualitative simplification that Fallow cannot judge, start with focused local reads.
5. For non-tiny scopes, run parallel read-only explorer passes for `Quality`, `Reuse`, and `Efficiency`. For tiny scopes, use one local pass with the same categories.
6. Keep each delegated pass read-only and limited to one category. Require severity, file and line evidence, impact, a minimal fix direction, and areas not worth changing.
7. Combine Fallow findings with the specialist reviews. Ignore unsupported, low-confidence, or mostly stylistic suggestions.
8. Produce a consolidated simplification review report with severity-ranked findings and top priorities. Include an implementation plan only when it helps the user act on the report.
9. Stop after analysis unless the user explicitly asks for implementation.

Use the command recipes and safety rules in [references/fallow-cleanup-recipes.md](references/fallow-cleanup-recipes.md).

## Trigger Strategy

Use this skill for broad natural-language requests about:

- simplifying code, cleaning up code, reducing complexity, improving maintainability, readability, or code quality
- improving reuse, consolidating duplicated logic, or reducing repeated patterns
- efficiency improvements where the goal is simpler or less wasteful code
- overcomplicated code, over-engineering, over-abstraction, leaky abstractions, or unnecessary layers
- dead code, unused code, unused exports, unused files, unused types, unused dependencies, unlisted dependencies, unresolved imports, duplicate exports, circular dependencies, or architecture boundary issues
- dead tests, redundant tests, duplicated tests, weak tests, or low-value test coverage
- redundant styles, unused styles, unused CSS Module classes, SCSS cleanup, Tailwind-related cleanup, or style file cleanup
- pull-request validation after generated code, broad refactors, or agent-created code

Use this skill for broad requests such as "simplify this," "improve reuse," "clean this up," or "find unused code." Use another workflow only when requested.

## Fallow Policy

- Use the Fallow CLI as the default interface. MCP is optional and only preferred when already available.
- Use quiet JSON output for agent workflows: `--format json --quiet`.
- For changed-file or pull-request workflows, prefer `fallow audit --base main --format json --quiet` or a focused `--changed-since main` command.
- For broad cleanup, start with `fallow --format json --quiet` or the narrow subcommand that matches the request.
- For complexity-focused simplification, use the complexity recipes in `references/fallow-cleanup-recipes.md`, especially `health --targets`, `health --hotspots`, `health --complexity`, and `health --file-scores` before relying on manual ranking.
- Run `fallow fix --dry-run --format json --quiet` before any auto-fix apply.
- Do not delete files, exports, dependencies, tests, or styles solely from summary counts. Inspect the concrete finding and trace risky cases first.

When using explorer subagents, have them explicitly inspect for:

- `Quality`: Check ambiguous logic, brittle state, manual mirrors, unnecessary wrappers, weak boundaries, and tests that do not verify useful behavior.
- `Reuse`: Check repeated logic and local replacements for existing project APIs or conventions. Check duplicate sources of truth, mappings, and mode-specific branches.
- `Efficiency`: Check repeated work, avoidable recomputation, hot-path allocation, broad invalidation, redundant watchers, and unnecessary deep observation.
- `Cleanup`: Check dead code, obsolete paths, redundant styles, and unused styles. Require enough evidence for safe removal.

Use the shared explorer prompt from [../coordinator/references/subagent-templates.md](../coordinator/references/subagent-templates.md) when delegated analysis helps. Keep workflow policy in `coordinator`. Keep the simplification criteria here.

## Output

Default to a report-first output. Do not edit code or imply implementation has started.

Use this structure:

```md
Simplification Review: <scope>

High Severity

[Quality|Reuse|Efficiency|Cleanup] <finding title> — <file>:<line>
<evidence, why it matters, and the smallest safe direction>

Medium Severity

[Quality|Reuse|Efficiency|Cleanup] <finding title> — <file>:<line>
<evidence, why it matters, and the smallest safe direction>

Low Severity

<compact grouped bullets or a small table with category, finding, and location>

Top priorities: <short ordered list of the most important fixes>

Validation notes: <Fallow command/results, missing checks, or important confidence limits when relevant>
```

Severity guidance:

- `High`: likely correctness bug, duplicate side effect, public-contract risk, hidden reactivity/lifecycle failure, or cleanup that prevents a real regression.
- `Medium`: meaningful maintainability, reuse, fragility, or efficiency issue with a clear behavior-preserving path.
- `Low`: small simplification, local readability cleanup, minor duplication, or optimization that is useful but not urgent.

If no material findings exist, say so directly and list what was checked.
