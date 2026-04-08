---
name: investigator
description: Use when the user reports a bug, failing test, regression, unclear issue, or asks for end-to-end investigation plus fix. Investigate the problem, report findings, implement the smallest correct fix, and iterate through review until the result is ready.
---

# Investigator

Investigate a problem, prove the likely cause, and drive it to a reviewed fix.

## Workflow

1. Inspect the relevant code, tests, logs, or artifacts before changing anything.
2. Keep the review and acceptance decision in the main thread. Use the `reviewer` skill to review the findings and decide whether to proceed.
3. If the issue is actionable, send the same subagent the implementation task with the narrowest possible scope.
4. Review the returned changes in the main thread using the `reviewer` skill.
5. If the review finds a concrete issue, send one correction cycle back to the same subagent and have it address the review before final acceptance.
6. Return the final fix, validation status, and any remaining limitations.

## Subagent Workflow

- use one worker subagent to investigate the issue and return findings, likely root cause, and a proposed fix path
- for bounded subagent work, use the host's faster model, for example `gpt-5.4-mini` in Codex or `Sonnet 4.6` in Claude Code
- keep all review and acceptance decisions in the main thread
- use the `reviewer` skill in the main thread for both the findings pass and the diff pass
- if the investigation or fix is very complicated, split it into smaller steps and review each step before proceeding
- once the full fix is assembled, do one final review pass on the combined change and validation evidence
- if the review finds a concrete issue, send one correction cycle through the same subagent
- require the implementation pass to be reviewed before final acceptance
- keep the subagent task narrow and avoid unrelated refactors

## Operating Rules

- Keep the investigation focused on the reported issue, not a broad refactor.
- Preserve existing behavior unless the evidence shows a change is required.
- Prefer deterministic fixes and tests that would catch the original failure.
- Use the main thread as the reviewer and decision point.
- Keep subagent prompts concrete and bounded.
- Do not let the subagent widen scope or rewrite unrelated code.

## Review Gates

After the investigation pass, run the `reviewer` skill on the findings and proposed fix path. After the implementation pass, run the `reviewer` skill on the diff and validation evidence. Do not re-create the review rubric here; use the reviewer verdict as the gate.

## Output Expectations

Return a concise summary of:

- what was investigated
- what was changed
- how it was validated
- any known limitations or follow-up work
