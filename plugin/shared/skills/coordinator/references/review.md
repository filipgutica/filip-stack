# Review Playbook

Use this when the prompt is review-only or when the main thread is reviewing a plan, findings, or diff from a subagent.

The main thread owns review and acceptance. If extra evidence is needed before the review verdict, use the `explorer` template from [subagent-templates.md](subagent-templates.md) for bounded read-only follow-up.

## Review Priorities

- Ambiguity, missing assumptions, or weak evidence
- Scope control problems
- Mismatch between the request and the proposed or implemented result
- Missing validation or unsupported claims
- Regression risk, contract drift, or unnecessary complexity

## Review Rules

- Be critical and specific.
- Keep findings concrete and actionable.
- Prioritize bugs, risks, and missing validation over style.
- For plans, revise the plan instead of returning feedback only.
- For implementation, require revision when a P1 or P2 issue is found.

## Subagent Result Review (main thread)

When reviewing worker or explorer output in the main thread:

**Reject and send one correction cycle** if:
- the diff touches files outside the assigned scope
- behavior changed when preservation was required
- validation was claimed but not actually run
- the change contradicts the approved plan without explanation

**Accept with a note** if:
- style or naming diverges from local conventions
- a minor edge case is unhandled but not a regression risk
- the diff is correct but larger than the minimum needed

**Do not send more than one correction cycle per worker result.** If the second attempt still has a blocking issue, take over in the main thread or escalate to the user.

## Output

For plans:

- `Revised plan`
- Brief findings only when needed to explain material corrections

For implementation, investigation, or validation review:

- `verdict`
- findings ordered by severity
- plan adherence or material deviations
- missing verification
- follow-up needed
