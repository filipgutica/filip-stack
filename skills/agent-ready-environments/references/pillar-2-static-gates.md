# Pillar 2: Static gates

Source keys refer to the Sources list in [SKILL.md](../SKILL.md).

**Why.** A build exit code and a linter are checks the agent can run and read
[A1]. The single most useful line in an instruction file is the command that
runs the check [A1]. Codex guidance likewise asks for a "done when" condition and for the relevant lint, format, and type checks to run [O3]. A `Stop` hook makes that check a condition of finishing,
instead of a request [A1]. OpenAI reports custom linters whose error messages
carry the fix, and "taste" rules encoded as checks instead of prose [O1] (unconfirmed for current models).

**Good looks like.**

- Strict typing: TypeScript `strict` (and `noUncheckedIndexedAccess` where the team accepts it), mypy or Pyright strict, `go vet` with staticcheck, Clippy with warnings denied.
- Lint, dead code and unused dependencies (for example Fallow or Knip, Vulture, `deadcode`), complexity limits, and duplication checks.
- One `check` command runs locally and in CI with the same configuration. A changed-files mode keeps it fast.
- Warnings fail the build or do not exist.
- Each suppression carries a reason, and the total count is tracked.
- Error messages say how to fix the problem.

**Audit check.**

- One command runs every gate. Record its duration.
- Clean `main` is green.
- Count suppressions by kind: inline directives (`eslint-disable`, `@ts-expect-error`, `# type: ignore`, `//nolint`, `#[allow]`), rules turned off in configuration, and allowlist entries. Scope filters that exclude code the repository does not own are not suppressions.
- Compare with a commit from three months ago. For an area younger than that, compare with its first commit and say so.
- Check where the gate runs: a `Stop` hook, pre-push, a required CI check, or only optional CI.

**Anti-patterns.** Gates that run only in CI, so the agent learns about
failures after it pushes. Warnings nobody fails on. Lint rules for preferences
that generate noise.
