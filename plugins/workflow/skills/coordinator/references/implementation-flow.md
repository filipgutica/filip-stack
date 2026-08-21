# Implementation flow

Use this route for authorized repository changes. Read-only review-feedback inspection does not require implementation authority.

## Select the path

- Use the **fast path** for a tiny, mechanical, low-risk, non-behavioral change.
- Use the **bounded cycle** for every meaningful change.
- Use the **named-ticket route** only with named-ticket end-to-end authority.
- Use the **review-feedback route** to inspect feedback or make authorized corrections.

Review-only work stays read-only. Route standalone simplification analysis to `$workflow:simplification-review`.

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
11. Report the result, evidence, omissions, and residual risk.

Keep tightly related work in the main thread. Give a worker one separate, bounded implementation area.

### Review tiers

- Use a **standard review** for routine meaningful changes.
- Use an **adversarial review** for broad or high-risk changes.
- Use one tier. Do not stack tiers unless the risk changes.

A standard reviewer can be a native review capability or a read-only reviewer. It must inspect the actual diff and evidence.

Use an adversarial critic for ambiguity, security, public contracts, concurrency, or broad changes.

## Named-ticket end-to-end route

Use this route only with explicit named-ticket end-to-end authority. This authority permits branch setup, creation and maintenance of the required external branch task ledger, its local pointer, and its Git exclude entry, plus task commits, push, and a draft pull request.

1. Confirm or create the working branch. Use `$workflow:using-git-worktrees` only with explicit worktree authority or when this named-ticket route requires isolation.
2. Read the ticket context and relevant repository evidence. When the ticket is ambiguous, follow its durable source upstream before deciding scope.
3. Define the ticket goal, success criteria, non-goals, and verification.
4. Invoke `$workflow:branch-task-planner` in named-ticket end-to-end mode to create or resume the external ledger with its Sources block.
5. For each ledger task, define its bounded sub-plan.
6. Run one bounded cycle for the task: implementation, verification, independent review, corrections, and review-cycle acceptance.
7. Commit the accepted task.
8. Use `$workflow:branch-task-planner` to add the commit to the ledger and mark the task `[x]`.
9. Repeat the sub-plan, implementation, review, and commit cycle for the next task.
10. Run branch-level checks after all tasks are complete.
11. If a branch check fails, create a correction task and return to step 5.
12. Push the branch only after all branch-level checks pass.
13. Invoke `$workflow:writing-pr-descriptions` to prepare the body. Open the draft pull request with that final body.

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
