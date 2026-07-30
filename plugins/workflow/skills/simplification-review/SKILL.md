---
name: simplification-review
description: "Audit scoped code for minimality, reuse, ownership, complexity, cleanup, and safe Fallow findings."
---

# Simplification review

Use this read-only skill to find behavior-preserving simplification opportunities. Return a report before any implementation.

The skill supports two modes:

1. Use it directly when the user requests simplification opportunities.
2. Use it during implementation when duplication, reuse, ownership, or complexity risk is material.

This skill does not replace a standard or adversarial review. Its findings can inform those reviews and the final review cycle.

## Resolve scope

1. Use files, paths, modules, diffs, or surfaces named by the user.
2. Otherwise, inspect `git diff` and `git status --short`.
3. Include tracked changes and untracked files in the selected area.
4. If the worktree is clean, inspect `git diff origin/main`.
5. Ask for a target when no diff identifies one.

Do not widen the selected area without explicit user direction.

## Audit lenses

- **Minimality:** Is this the smallest correct solution? Remove speculative layers, configuration, and ceremony.
- **Reuse:** Can project code, platform features, or a shared path replace new code or duplicate logic?
- **Ownership:** Does each responsibility have one clear owner, boundary, and source of truth? Remove competing paths, duplicated state, and unclear boundary crossings.
- **Complexity:** Can control flow, state, guards, abstractions, or repeated work become simpler?
- **Cleanup:** Can evidence support removal of dead code, exports, dependencies, tests, or styles?

Preserve behavior, contracts, side effects, and useful test coverage. Report when current complexity is justified.

Avoid suggestions that create dense expressions, mixed responsibilities, nested ternaries, or weaker ownership.

## Workflow

1. Confirm the scope.
2. Run the most focused Fallow check for supported JavaScript, TypeScript, Vue, Nest, or styles.
3. Read files identified by Fallow.
4. Inspect all five audit lenses manually.
5. Use bounded read-only explorer passes only when the scope and host support justify them.
6. Combine deterministic findings with manual evidence.
7. Reject unsupported, low-confidence, or stylistic suggestions.
8. Rank material findings by severity.
9. Stop after the report.

Route any authorized follow-up changes through `$workflow:coordinator`.

Use [Fallow cleanup recipes](references/fallow-cleanup-recipes.md) for commands and safety rules.

## Finding requirements

Each finding must include:

- audit lens
- severity
- file and line evidence
- impact
- smallest safe direction
- confidence limit when evidence is incomplete

## Output

```md
Simplification review: <scope>

High severity

[Minimality|Reuse|Ownership|Complexity|Cleanup] <finding title>: <file>:<line>
<evidence, impact, and smallest safe direction>

Medium severity

[Minimality|Reuse|Ownership|Complexity|Cleanup] <finding title>: <file>:<line>
<evidence, impact, and smallest safe direction>

Low severity

<compact findings>

Top priorities: <ordered priorities>

Validation notes: <Fallow results and confidence limits>
```

- **High:** likely correctness, side-effect, public-contract, or lifecycle risk.
- **Medium:** meaningful maintainability, reuse, fragility, or complexity issue.
- **Low:** useful local cleanup with low urgency.

If there are no material findings, say so and list the checks that ran.
