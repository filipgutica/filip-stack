---
name: review
description: User-invoked only. Use when the user explicitly asks Codex to ask Claude CLI for a review of the current code changes, branch diff, or pending implementation.
---

# Claude Review

Use Claude CLI as an external reviewer for current changes. Codex remains
responsible for triage, verification, and deciding whether findings are real.

## Workflow

1. Determine the review scope: uncommitted changes by default, or the branch
   diff/base ref if the user specifies one.
2. Run Claude CLI from the repository root with a non-interactive review prompt:

```bash
claude -p --permission-mode plan --no-session-persistence "<prompt>"
```

3. Ask Claude to review for correctness, regressions, missed tests, public API
   or behavior changes, and risky edge cases. Tell it not to edit files.
4. Check each finding against the actual repo before presenting or acting on it.
5. Report confirmed findings first, with file references when available. Clearly
   label uncertain or rejected findings.

## Prompt Shape

Use a prompt like:

```text
You are reviewing Codex's current changes.

Scope:
<uncommitted changes, branch diff, PR, or user-specified files>

Please inspect the repository and current diff as needed. Return only actionable
findings ordered by severity. Focus on bugs, regressions, missed tests, and
contract drift. Do not edit files.
```

## Failure Handling

If `claude` is not installed, not authenticated, times out, or fails, report the
failure and continue with Codex's own review instead of blocking.
