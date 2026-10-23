# Chair: rounds

Continue from [prepare](chair.md), which defines the terms used here.

## Review

1. Fill the [member brief](member-brief.md) once per member: the same subject, worktree path, shared context, and that member's lens.
2. Launch all three members in parallel as fresh agents with their roster targets, asynchronously where the host supports it.
   - **T3:** `delegate_task` with the member's provider, model, and effort, and a distinct `clientRequestId` of `<runId>-r<round>-<phase>-<member>-a<attempt>`, where `<phase>` is `review` or `reconcile`.
   - **Claude or Codex:** the native subagent tool with the member's profile, or with its model and effort.
3. Track each attempt by round, phase, member, and task ID. A wait timeout is not a failure: check the task's status. An attempt fails when it ends with an error, when its reported `HEAD` differs from the subject's head SHA, when its JSON is missing or malformed, or when it passes 20 minutes and you have cancelled it and confirmed that it stopped.
4. Retry a failed attempt once, after the first attempt has stopped. A second failure records that member as `ABSTAIN`.
5. Accept exactly one terminal report per member per phase, and keep it unchanged. Ignore anything that arrives later.
6. If the host reports that a member ran with a different model or effort than its roster target, stop the run: cancel active work and finish with `status: incomplete` and `NEEDS_HUMAN`.

## Reconcile

Reconcile when any finding lacks explicit agreement from all three members on the claim, the exact remedy, the blocking class, or fix eligibility, or when the votes differ. Otherwise go to Fix.

1. Group duplicate findings. Keep every original ID and position; grouping is not agreement.
2. Pool the grouped findings without member names, and send each member the reconciliation section of the [member brief](member-brief.md).
3. Each member answers every pooled finding independently and gives a final vote. Members do not see each other's answers. Launch, track, and retry these attempts as in Review, with phase `reconcile`.

Then give every finding exactly one status:

- **Agreed:** all three agree on the claim, the remedy, and the blocking class.
- **Rejected:** all three disagree with the claim. Keep it in the record; it is closed.
- **Contested:** every other combination.

## Fix (fix mode only)

A finding is **fixable** when it is agreed and all three members classified it `eligible`. Agreed findings classified `excluded` or `uncertain` go to the report as "needs your decision".

When at least one fixable finding exists and fewer than two fixes have been pushed in this run:

1. Wait until every member attempt in the round has stopped.
2. Pick the fixer from the delegation policy in the user-level instruction files, for routine implementation. Without a policy, use the host's general-purpose agent.
3. Send the [fixer brief](fixer-brief.md) with the fixable findings, the worktree path, the subject, and the push target.
4. **Pushed:** the new head SHA starts a new subject. Rebuild the shared context from prepare step 6, then return to Review for a full round on the whole PR.
5. **Not pushed** (failed check, stopped fixer, or rejected push): stop fixing and record the evidence. The verdict is `NEEDS_HUMAN`.

## Time

The run limit is 120 minutes from the start time in your brief. At the limit, cancel active work, start no new fix, and finish with `status: incomplete` and `NEEDS_HUMAN`.

Then continue with [report](report.md).
