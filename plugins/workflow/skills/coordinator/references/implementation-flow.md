# Implementation flow

Use this route for authorized repository changes. Read-only review-feedback inspection does not require implementation authority.

## Select the path

- Use the **fast path** for a tiny, mechanical, low-risk, non-behavioral change.
- Use the **bounded cycle** for every meaningful change.
- Use the **named-work-item route** only with named-work-item end-to-end authority.
- Use the **review-feedback route** to inspect feedback or make authorized corrections.

Review-only work stays read-only. Route standalone simplification analysis to `$workflow:simplification-review`.

## Establish the active slice

Before meaningful edits, inspect the Git state and preserve unrelated user changes. State a compact outcome, boundary, and verification signal.

Continue without another approval when the work is decision-complete. Keep the active slice in the main-thread context. Git owns the worktree record.

The fast path does not need a visible active slice. It still follows the narrow scope and targeted check rules.

### Handle new prompts

| New prompt | Default action | Visible interruption |
|---|---|---|
| Explanation or status request | Respond, then continue the active slice. | No |
| Correction or work required by the active slice | Apply it within the same boundary. | No |
| Independent state-changing work | Recommend deferral and continue the active slice. | Yes |
| Commit or verification boundary change | Recommend a separate slice. | Yes |
| Material product or architecture decision | Ask the user to decide. | Yes |
| Explicit priority replacement | Stop the slice and show the current Git state. | Yes |

Do not record deferred work until the user selects and authorizes a destination. Do not create a ticket, task, or ledger entry automatically.

## Fast path

1. Confirm the narrow scope.
2. Make the edit.
3. Run one targeted check.
4. Complete the review cycle.
5. Report the result.

The fast path does not require an independent review.

## Bounded cycle

1. Confirm implementation authority.
2. Define the goal, evidence, scope, risks, assumptions, and verification.
3. Select ownership and one independent review tier.
4. Invoke `$workflow:implementation`, which applies `$workflow:minimal-code` and the proportional test-driven path.
5. Run focused checks that provide review evidence.
6. Run `$workflow:simplification-review` when duplication, reuse, ownership, or complexity risk is material.
7. Run the selected independent review.
8. Apply valid findings.
9. Rerun checks affected by the corrections.
10. Run `$workflow:review-cycle`.
11. Present the user acceptance checkpoint unless the selected route grants agent acceptance.
12. Report the result, evidence, omissions, and residual risk.

Keep tightly related work in the main thread. Give a worker one separate, bounded implementation area.

### Review tiers

- Use a **standard review** for routine meaningful changes.
- Use an **adversarial review** for broad or high-risk changes.
- Use one tier. Do not stack tiers unless the risk changes.

A standard reviewer can be a native review capability or a read-only reviewer. It must inspect the actual diff and evidence.

Use an adversarial critic for ambiguity, security, public contracts, concurrency, or broad changes.

## Named-work-item end-to-end route

Use this route only with explicit named-work-item end-to-end authority. The primary work item can be a ticket, specification, or plan.

Choose direct execution or plan composition based on complexity. Do not create individual tickets when the primary work item already defines a bounded outcome.

This authority permits branch setup, required ledger and pointer maintenance, bounded commits, push, and a draft pull request.

1. Confirm or create the working branch. Use `$workflow:using-git-worktrees` only when this route requires isolation.
2. Read the primary work item and relevant repository evidence. When the primary work item is ambiguous, follow its durable source before deciding scope.
3. Define the goal, success criteria, non-goals, and verification.
4. Compose a plan when complexity requires execution decomposition. Do not require tickets for a self-contained specification or plan.
5. Invoke `$workflow:branch-task-planner` in named-work-item end-to-end mode to create or resume the external ledger.
6. For each ledger task, define its bounded sub-plan.
7. Run one bounded cycle for the task: implementation, verification, independent review, corrections, and review-cycle acceptance.
8. Use agent acceptance after the review cycle. Material product or architecture decisions still return to the user.
9. Commit the accepted task.
10. Add the commit to the ledger and mark the task `[x]`.
11. Repeat the bounded cycle for the next task.
12. Run branch-level checks after all tasks are complete.
13. If a branch check fails, create a correction task and return to step 6.
14. Push the branch only after all branch-level checks pass.
15. Invoke `$workflow:writing-pr-descriptions` to prepare the body. Open the draft pull request with that final body.

Perform only the publishing actions that the current request authorizes.

## Review-feedback route

Review feedback can be inspected without implementation authority. Corrections require implementation authority.

1. Invoke `$workflow:receiving-code-review`.
2. Verify each comment against the code, contract, and prior user decisions.
3. Stop after inspection when the request grants no implementation authority.
4. Use the fast path for an authorized, isolated, low-risk correction.
5. Use a bounded cycle for an authorized, material, or uncertain correction.
6. Record commit-backed field-guide evidence only after the correction has a commit. Field-guide can separately capture an explicit durable preference through its observation path.

Review feedback does not grant branch, commit, push, or pull-request authority.

## Roles

- **Explorer:** answers one bounded question without editing or accepting work.
- **Worker:** owns one bounded implementation area, tests it, and self-reviews it without accepting its own work.
- **Standard reviewer:** reviews a routine meaningful change.
- **Adversarial critic:** challenges a broad or high-risk change.
- **Main thread:** selects the route and tier, integrates results, and accepts the work.

Follow the host policy for model and tool selection. Do not require vendor-specific models or tool signatures.
