# Investigation Playbook

Use this when the user reports a bug, regression, failing test, or unclear issue.

## Workflow

1. Inspect the relevant code, tests, logs, or artifacts before changing anything.
2. Use a bounded exploration subagent to gather findings, likely cause, and fix options.
3. Review the findings in the main thread and decide whether the evidence supports a concrete fix path.
4. If it does, hand the fix to a worker subagent with narrow scope.
5. Review the returned change in the main thread.
6. Run validation and summarize the result.

Start with the `explorer` template from [subagent-templates.md](subagent-templates.md). Only switch to the `worker` template once the main thread accepts a concrete fix path.

## Investigation Rules

- Keep the scope tied to the reported issue.
- Preserve behavior unless the evidence shows a change is required.
- Prefer deterministic fixes and regression coverage when feasible.
- Stop at findings if the root cause is still not strong enough to justify mutation.
- For investigations that lead to multi-chunk fixes, track progress per-chunk using the host's task tracking mechanism.

## Output

- What was investigated
- Main findings and likely cause
- What was changed, if anything
- Validation
- Known limitations or follow-up
