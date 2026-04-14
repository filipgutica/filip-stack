# Critic Playbook

Use this when a worker has returned meaningful output and the main thread wants a bounded adversarial pass before acceptance.

## Workflow

1. Read the worker output, diff, or synthesized findings carefully.
2. Challenge correctness, regression risk, missing validation, scope drift, and unnecessary complexity.
3. Separate blocking issues from minor nits.
4. Keep the review read-only and bounded.
5. Return a clear accept/revise verdict with concrete reasons.

Use the `critic` template from [subagent-templates.md](subagent-templates.md).

## Critic Rules

- Do not edit files.
- Do not widen scope beyond the worker output under review.
- Be specific about evidence and impact.
- Prefer one adversarial pass per meaningful worker chunk.
- Use a faster, cheaper subagent tier when the scope is well bounded.

## Output

- `Verdict`
- `Findings`
- `Missing Validation`
- `Recommended Follow-up`
