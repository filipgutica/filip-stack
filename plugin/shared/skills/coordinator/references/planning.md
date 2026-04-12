# Planning Playbook

Use this when the task needs a concrete plan before code is written or when the host is in Plan Mode.

## Workflow

1. Restate the goal, constraints, and current evidence.
2. Use bounded exploration to confirm likely touchpoints before committing to an approach.
3. For non-trivial work, use two parallel exploration passes with distinct lenses or areas.
4. Synthesize the findings in the main thread.
5. Produce a minimal effective plan with bounded, verifiable phases or tasks.
6. Review the plan critically in the main thread once before returning it.

Use the `explorer` role and prompt shape from [subagent-templates.md](subagent-templates.md).

## Planning Rules

- Do not write production code.
- Prefer explicit assumptions over guessed details.
- Keep phases or tasks independently verifiable.
- Call out meaningful tradeoffs, risks, and validation.
- If major uncertainty remains, stop with open questions instead of inventing details.

## Output

- `Summary`
- `Plan`
- `Files Affected or Areas Affected`
- `Tradeoffs`
- `Risks`
- `Validation`
- `Open Questions`
