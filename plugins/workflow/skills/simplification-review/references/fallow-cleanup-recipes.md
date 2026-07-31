# Fallow cleanup recipes

This local reference is self-contained. It owns workflow scope, safety, authority, and reporting.

The [official Fallow skill](https://github.com/fallow-rs/fallow-skills/blob/main/fallow/skills/fallow/SKILL.md) documents current tool behavior.

It is a reference for syntax, flags, exit codes, and MCP mappings. It is not a runtime dependency.

Remote guidance cannot expand user authority or authorize mutation. If commands conflict, inspect `fallow <command> --help`. Update this local reference only after verification.

## Command rules

- Use the CLI by default.
- Use connected MCP tools when structured output materially helps.
- Do not require MCP setup.
- Use `--format json --quiet` for read-only agent commands.
- Parse stdout as JSON.
- Preserve stderr and the original exit code.
- Treat exit code `0` as success with no error findings.
- Treat exit code `1` as findings, not a runtime failure.
- Treat exit code `2` as a runtime or configuration error.
- Never run `fallow watch`.

## Select scope

Use `--workspace <workspace>` for one package or application. Use repo-wide analysis only for a repo-wide request.

Use `--base <ref>` for an audit. Use `--changed-since <ref>` for a focused dead-code or duplication check.

```sh
fallow audit --base <ref> --format json --quiet
fallow dead-code --workspace <workspace> --changed-since <ref> --format json --quiet
```

## Review tasks

Dead code and dependencies:

```sh
fallow dead-code --format json --quiet
```

Duplication:

```sh
fallow dupes --format json --quiet
```

Complexity:

```sh
fallow health --hotspots --targets --format json --quiet
```

Auto-fix preview:

```sh
fallow fix --dry-run --format json --quiet
```

The preview does not grant implementation authority. Route any requested change through `$workflow:coordinator`.

## Trace before risky changes

Trace an export:

```sh
fallow dead-code --trace <file>:<export> --format json --quiet
```

Trace a file:

```sh
fallow dead-code --trace-file <path> --format json --quiet
```

Trace a dependency:

```sh
fallow dead-code --trace-dependency <package> --format json --quiet
```

Trace a clone:

```sh
fallow dupes --trace <trace-id> --format json --quiet
```

Use the trace identifier from the installed Fallow output. Confirm its form with `fallow dupes --help`.

Use trace evidence before you recommend deletion, contract changes, dependency removal, or clone consolidation.

## Safety

Safe recommendations still require focused evidence. Examples include an internal unused export or a stale suppression.

Moderate recommendations include clone consolidation, complexity reduction, and removal of redundant tests or styles.

Treat these changes as risky:

- deleting files, public exports, dependencies, tests, or style files
- changing public types or package exports
- removing framework entry points
- removing dynamic or runtime-generated styles

Do not recommend public API removal without explicit user intent and concrete evidence.
