---
name: simplification-review
description: "Review recently changed or explicitly scoped code for behavior-preserving simplification, cleanup, reuse, efficiency, and quality opportunities. Use for broad requests about simplifying code, improving reuse, reducing overcomplication or over-abstraction, dead or unused code, redundant tests or styles, Fallow-backed cleanup, and bounded maintainability review without implementing changes by default."
---

# Simplification Review

Use this skill for behavior-preserving simplification analysis. Keep the review bounded, prefer readability over cleverness, and stop after analysis unless the user explicitly asks for edits.

Fallow is the primary deterministic analysis engine for supported JavaScript, TypeScript, Vue, Nest, CSS, SCSS, Tailwind, and CSS Module cleanup signals. Use Fallow before broad manual codebase exploration when the task involves dead code, unused exports, unused files, unused types, unused dependencies, unlisted dependencies, unresolved imports, duplicate exports, circular dependencies, boundary violations, duplication, complexity, health hotspots, or CSS/style cleanup.

Do not narrow this skill into Fallow-only dead-code analysis. Fallow provides deterministic signals, but this skill still owns the broader review lens for code reuse, simplification, abstraction quality, maintainability, extensibility, efficiency, test quality, redundant tests, redundant styles, and overcomplicated implementation.

Use the official Fallow skill as the upstream usage reference for Fallow-specific agent behavior: https://github.com/fallow-rs/fallow-skills/blob/main/fallow/skills/fallow/SKILL.md. If local guidance and upstream Fallow usage differ, prefer the upstream Fallow skill for command invocation details, but preserve this skill's broader Filip Stack simplification-review scope and safety policy.

## Scope Resolution

Resolve scope in this order:

1. If the user names files, paths, a diff, a module, or a surface, use that scope.
2. Otherwise inspect local changes first with `git diff` and `git status --short`.
3. Review tracked changes from `git diff` plus any untracked files surfaced by `git status --short`.
4. If there are no local tracked or untracked changes, inspect branch changes with `git diff origin/main`.
5. If neither local nor branch diff produces a usable review surface, ask the user to name the area to review.

Keep the review limited to the resolved surface unless the user explicitly widens it.

## Review Goals

- Preserve exact behavior, public contracts, meaningful side effects, and intended test coverage.
- Reduce cognitive load, duplication, and unnecessary complexity.
- Prefer explicit code over dense or clever code.
- Improve maintainability and extensibility without turning the work into a rewrite.
- Treat efficiency as a review dimension only when there is an obvious, low-risk improvement.

## Review Lens

Inspect the resolved scope for these categories and call out only the ones that actually apply:

- duplicated code, weak reuse, or repeated logic
- hard-to-follow control flow, ambiguity, or unnecessary nesting
- brittle structure or poor extensibility
- leaky, layered, or unnecessary abstractions
- overcomplicated, over-engineered, or over-abstracted code
- poor separation of concerns or weak organization
- dead, unused, or obsolete code paths
- inefficient code that has a clear simplification path without changing behavior
- low-value, redundant, dead, duplicated, or weakly meaningful tests
- redundant styles or unused style paths that can be removed safely

Also call out when a suspicious area is not worth changing because the current complexity appears justified or the cleanup would be mostly stylistic churn.

Avoid recommending simplifications that:

- compress too many concerns into one function or component
- replace readable code with dense one-liners
- introduce nested ternaries or similarly hard-to-debug expressions
- remove abstractions that are carrying real organizational value

## Workflow

1. Confirm the scope from an explicit user request or the diff-based fallback order above.
2. For supported JS/TS/Vue/Nest/style cleanup signals, run the most focused Fallow command before broad manual exploration. Use `--format json --quiet` for agent-readable output.
3. Prefer workspace-scoped Fallow commands for package/app-specific work in monorepos.
4. Start focused local reads only after Fallow identifies relevant files, or when the request is about qualitative simplification that Fallow cannot judge.
5. Use explorer subagents only when the touched surface is broad enough or split enough that bounded delegated review materially helps.
6. When delegating, keep subagents read-only and constrain them to reuse, extensibility, maintainability, efficiency, quality, and Fallow finding review within the resolved scope.
7. Synthesize deterministic Fallow findings with human review judgment; ignore low-confidence or stylistic churn.
8. Produce a bounded simplification plan with assumptions, tradeoffs, validation concerns, and the smallest safe simplification direction.
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
- PR validation after generated code, broad refactors, or agent-created code

If a request is phrased broadly, such as "can we simplify this", "this feels overcomplicated", "improve reuse here", "clean this up", or "find unused/redundant code", treat it as this skill unless the user clearly asks for a different workflow.

## Fallow Policy

- Use the Fallow CLI as the default interface. MCP is optional and only preferred when already available.
- Use quiet JSON output for agent workflows: `--format json --quiet`.
- For changed-file or PR workflows, prefer `fallow audit --base main --format json --quiet` or a focused `--changed-since main` command.
- For broad cleanup, start with `fallow --format json --quiet` or the narrow subcommand that matches the request.
- Run `fallow fix --dry-run --format json --quiet` before any auto-fix apply.
- Do not delete files, exports, dependencies, tests, or styles solely from summary counts. Inspect the concrete finding and trace risky cases first.

When using explorer subagents, have them explicitly inspect for:

- ambiguity or hard-to-follow logic
- duplicated code or repeated logic
- dead or unused code
- overly complex or unnecessary abstractions
- brittle structure or hard-to-extend organization
- weak separation of concerns
- inefficient code with a clear behavior-preserving simplification path
- dead, redundant, or low-value tests
- tests that do not assert meaningful behavior
- redundant styles or unused style paths with enough evidence to remove safely

Use the shared explorer prompt shape from [../coordinator/references/subagent-templates.md](../coordinator/references/subagent-templates.md) when delegated read-only analysis helps. Keep workflow-policy details in `coordinator`; this skill owns the simplification lens and output contract.

## Output

- `Summary`
- `Prioritized Findings`
- `Simplification Plan`
- `Tradeoffs`
- `Risks`
- `Validation`
- `Open Questions`
