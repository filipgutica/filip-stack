# Fallow Cleanup Recipes

Use Fallow as the deterministic first pass for supported JS/TS/Vue/Nest and style cleanup. Keep the broader simplification-review lens active for reuse, overcomplication, abstraction quality, efficiency, test quality, and maintainability issues that Fallow cannot decide.

Use the official Fallow skill as the upstream usage reference for Fallow-specific agent behavior:

https://github.com/fallow-rs/fallow-skills/blob/main/fallow/skills/fallow/SKILL.md

Follow upstream Fallow guidance for exact command invocation details. In particular, prefer quiet JSON output for agent workflows and remember that exit code 1 means issues were found, while exit code 2 is a runtime/config error. Preserve the local Filip Stack policy for broad simplification review, trace-before-deletion safety, and workspace-scoped cleanup defaults.

## Scope Selection

- If the user names a package, app, workspace, or paths that clearly belong to one workspace, use `-w <workspace>`.
- In pnpm, npm, and yarn monorepos, Fallow detects workspaces automatically and still analyzes the full monorepo graph while scoping reported issues to the selected workspace.
- Use repo-wide analysis only when the user asks for repo-wide cleanup or the target cannot be inferred.
- If scope is still ambiguous after inspecting the prompt, `git status --short`, and `git diff --name-only`, ask the user for the target area instead of guessing.

Examples:

```sh
fallow dead-code -w apps/web --format json --quiet
fallow dead-code -w apps/web --changed-since main --format json --quiet
fallow health -w packages/ui --format json --quiet
fallow dupes -w apps/web --format json --quiet
```

## CLI Recipes

Use `--format json --quiet` for agent workflows. When the host command runner aborts on non-zero exit codes, append `|| true` to Fallow analysis commands and inspect the JSON output so issue-found exit code 1 does not stop the workflow. Do not hide or ignore runtime/config errors.

Quick PR or changed-code check:

```sh
fallow audit --base main --format json --quiet
fallow dead-code --changed-since main --format json --quiet
```

Workspace-scoped cleanup:

```sh
fallow --workspace <workspace> --format json --quiet
fallow dead-code -w <workspace> --format json --quiet
```

Full repo cleanup:

```sh
fallow --format json --quiet
fallow dead-code --format json --quiet
fallow dupes --format json --quiet
fallow health --format json --quiet
```

Dependency cleanup:

```sh
fallow dead-code --unused-deps --format json --quiet
fallow dead-code --trace-dependency <package> --format json --quiet
```

Duplication and reuse cleanup:

```sh
fallow dupes --format json --quiet
fallow dupes --trace <file>:<line> --format json --quiet
```

Complexity and health review:

```sh
fallow health --format json --quiet
fallow health -w <workspace> --format json --quiet
```

Complexity recipes:

```sh
fallow health --targets --effort low --format json --quiet
fallow health --hotspots --since 6m --format json --quiet
fallow health --complexity --top 20 --sort cognitive --format json --quiet
fallow health --file-scores --format json --quiet
```

Use these when the request is about reducing complexity, choosing refactoring targets, finding high-churn complexity hotspots, or prioritizing broad simplification work. Treat `--targets` as a ranked refactoring-opportunity signal, `--hotspots` as churn plus complexity prioritization, `--complexity --sort cognitive` as the focused function-level complexity view, and `--file-scores` as the file-level maintainability view.

CSS, SCSS, Tailwind, and CSS Module cleanup:

```sh
fallow dead-code --unused-files --format json --quiet
fallow dead-code --unused-exports --format json --quiet
```

Safe auto-fix preview:

```sh
fallow fix --dry-run --format json --quiet
```

Safe auto-fix apply:

```sh
fallow fix --yes --format json --quiet
```

Only apply auto-fix after reviewing the dry-run output and gathering trace evidence for risky changes.

## Trace Requirements

Trace before risky deletion, public-surface changes, dependency removal, or clone consolidation:

```sh
fallow dead-code --trace <file>:<export> --format json --quiet
fallow dead-code --trace-file <path> --format json --quiet
fallow dead-code --trace-dependency <package> --format json --quiet
fallow dupes --trace <file>:<line> --format json --quiet
```

Use trace output to distinguish internal cleanup from public API, package entrypoint, barrel export, framework convention, script, or cross-workspace usage.

## Safety Tiers

Safe mechanical fixes:

- remove an `export` keyword from a clearly internal unused symbol after dry-run review
- remove unused dependencies only after `--trace-dependency` shows no import, script, or cross-workspace usage
- remove stale suppressions or obvious unused internal imports when validation passes

Moderate refactors:

- consolidate clone groups after `fallow dupes --trace`
- reduce complexity or health hotspots after reading the affected implementation and tests
- remove redundant tests or styles when behavior/style coverage remains meaningful

Risky changes:

- delete files, public exports, package exports, dependencies, framework entry points, test suites, CSS files, or dynamic style paths
- change API-facing types or exported contracts
- remove CSS or CSS Module classes where class names are dynamic or runtime-generated

Risky changes require concrete trace evidence, focused code reads, and user-visible explanation. Do not delete public APIs without explicit evidence and user intent.

## MCP Policy

The CLI is the default and fallback. If Fallow MCP tools are available, prefer structured tools for the equivalent operation:

- `analyze` for dead-code analysis
- `check_changed` for changed-file dead-code analysis
- `find_dupes` for duplication
- `fix_preview` before any auto-fix
- `fix_apply` only after preview review
- `check_health` for complexity, health, hotspots, and refactoring targets
- `audit` for changed-file dead-code, complexity, and duplication review
- `project_info` for detected plugins, files, entry points, or boundaries
- `trace_export`, `trace_file`, `trace_dependency`, and `trace_clone` before risky cleanup

Do not require MCP setup. Do not add repo-level MCP configuration unless the user explicitly asks.

## Post-Change Validation

Prefer repo-specific commands when discoverable. In this repo, use:

```sh
pnpm validate-plugins
pnpm check
```

For other pnpm repos, use the closest available workspace-scoped commands first, then broader checks when the cleanup can affect shared behavior:

```sh
pnpm --filter <workspace> typecheck
pnpm --filter <workspace> lint
pnpm --filter <workspace> test
pnpm typecheck
pnpm lint
pnpm test
```
