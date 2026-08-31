---
name: review-cycle
description: "Use after meaningful edits to accept the final diff, review coverage, and verification evidence."
---

# Review cycle

Use this final acceptance gate after meaningful edits. Do not use it for planning, read-only work, status updates, or trivial responses.

## Acceptance checks

- Does the diff solve the requested goal?
- Does the diff match the active slice?
- Does the diff stay within scope?
- Does the diff preserve unrelated user changes?
- Do public contracts, schemas, exports, and metadata remain compatible?
- Do tests prove the requested behavior without weaker assertions or unrelated churn?
- Does the diff contain debug code, skipped tests, unsafe casts, or stale comments?
- Does the completed review still cover the current diff and risk?
- Did the required checks run against the current diff?
- Does each verification result prove its stated claim?
- Did a required simplification review complete?

## Review tiers

- **Fast path:** no independent review for a tiny, mechanical, low-risk, non-behavioral change.
- **Standard review:** one standard reviewer for a routine meaningful change.
- **Adversarial review:** one adversarial critic for a broad or high-risk change.

A standard reviewer can be a native review capability or a read-only reviewer. It must inspect the actual diff and evidence.

Use an adversarial critic for ambiguity, security, public contracts, concurrency, or broad changes. Do not stack tiers unless the risk changes.

Agent Walkthrough is a separate branch-level integration and comprehension gate. It does not satisfy the selected independent review tier or replace this review cycle.

## Procedure

1. Run `git status --short`.
2. Inspect the focused diff.
3. Compare the final diff with the active slice.
4. Remove scope drift, debug artifacts, and unrelated changes. Preserve unrelated user changes.
5. Confirm the selected review tier.
6. Reuse a completed review while it covers the current diff and risk.
7. Run the missing review when no valid review exists.
8. Apply valid findings.
9. Repeat review only after a material coverage or risk change.
10. Map each acceptance claim to current verification evidence.
11. Run missing checks.
12. Rerun checks affected by corrections.
13. Fix remaining issues or report the blocker.

## User acceptance checkpoint

After a meaningful slice, present the active slice, diff summary, verification evidence, omissions, and residual risk.

The user can accept, revise, inspect, or delegate acceptance. Leave the work uncommitted unless the current authority permits agent acceptance and commit.

Named-work-item end-to-end authority permits agent acceptance only after this review cycle completes. The review cycle does not grant commit authority.

## Conditional checks

For public interfaces, preserve descriptions, annotations, examples, limits, and compatibility details.

For tests, reject unrelated fixture churn, focused tests, skipped tests, weak assertions, and blind snapshot updates.

For asynchronous changes, identify the visible or stateful boundary that each guard protects. Verify non-default timing with focused evidence.

For shared exports, run the shared-package check and an available consumer check.

For configuration or workflow changes, use schema validation and a dry-run when supported.

For documentation, use configured validation or a focused semantic diff review.

Use completed simplification-review evidence when the coordinator required that audit. Do not invoke it for every meaningful change.

## Output

Report the accepted result, verification evidence, material omissions, and residual risk. Include the user acceptance checkpoint when the selected route requires it.
