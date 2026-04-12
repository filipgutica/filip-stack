# Implementation Playbook

Use this when the prompt calls for changes and the task is outside Plan Mode.

## Workflow

1. Start with a bounded exploration and planning pass unless the task is truly tiny.
2. Assign the smallest useful implementation chunk to a worker subagent.
3. Keep write scope explicit and narrow.
4. Review the returned diff in the main thread before accepting it.
5. If needed, send one correction cycle back to the same worker.
6. Repeat by chunk for larger work.
7. Run validation before final return.
8. Use direct main-thread edits only for tiny fallback fixes or final integration adjustments.

Use the `worker` role and prompt shape from [subagent-templates.md](subagent-templates.md). If multiple accepted worker outputs need reconciliation, use the `integrator` role instead of inventing a new worker shape.

## Implementation Rules

- Make the smallest correct change.
- Preserve local patterns and conventions.
- Avoid unrelated rewrites.
- Do not batch unrelated tasks into one worker prompt.
- Report plan deviations clearly.
- For work spanning more than two bounded chunks, track progress per-chunk using the host's task tracking mechanism. Mark each chunk complete immediately — do not batch updates.

## Output

- `Summary`
- `Files Changed`
- `Plan Deviations`
- `Validation Run`
- `Known Limitations`
