---
name: plan
description: User-invoked only. Use when the user explicitly asks Codex to ask Claude CLI for a richer implementation plan, second opinion on approach, or planning pass before implementation.
---

# Claude Plan

Use Claude CLI as an external planning adviser. Claude's plan is input for
Codex to enrich and inform its own plan; Codex remains responsible for the
final plan, scope control, and deciding what to implement.

## Workflow

1. Summarize the user's goal, relevant constraints, and current repo context.
2. Run Claude CLI from the repository root with a non-interactive planning prompt:

```bash
claude -p --permission-mode plan --no-session-persistence "<prompt>"
```

3. Ask Claude for a concise implementation plan grounded in the current repo.
   Include any known constraints, files, test expectations, and open questions.
4. Read Claude's output critically. Do not treat it as authoritative.
5. Use the useful parts to enrich Codex's own plan, corrected for repo reality
   and Codex judgment. Call out any parts you rejected or could not verify.

## Prompt Shape

Use a prompt like:

```text
You are advising Codex on an implementation plan.

Goal:
<user goal>

Known context:
<repo, files, constraints, current findings>

Please inspect the repository as needed and produce a practical implementation
plan. Focus on sequencing, risks, validation, and minimal changes. Do not edit
files.
```

## Failure Handling

If `claude` is not installed, not authenticated, times out, or fails, report the
failure and continue with Codex's own planning instead of blocking.
