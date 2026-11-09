# Round 3 notes

Date: 2026-11-09.

## Inputs

- The [proposer brief](brief.md), as sent. It describes round 2's result under both the original gates and Amendment 3.
- Three read-only proposals, summarized: [Astra](proposals/astra.md), [Sol 6.1](proposals/sol.md), and [Opus 5.5](proposals/opus.md).

## Candidate

[candidate.diff](candidate.diff) against `main`: 9 lines added and 18 removed. Both validators pass.

All three proposals agreed on these, and the candidate keeps them from round 2:

- Principle 5 reports in the final message instead of a written ledger.
- The review pointer and the delegation bullet start a separate review only for a change that is hard to undo after merge.
- Step 8 reruns an environment failure once, then reports it as unverified.
- Test-audit writes no coverage record at handoff, and its step 6 applies only when a review is required.
- "Another test layer can protect a distinct risk" goes.

New this round:

- **Reuse and missed tests in the final message (Opus 5.5).** Principle 5 now also names, for each new function, the existing code checked and how they share one implementation or why they cannot, and, for each added test, the regression that existing tests miss. Round 2 had cut both from `main`'s ledger. Evidence: `main` consolidated `Result.all` through `sequence` in true-myth r1 and r3 before any review, and no round-2 candidate attempt did; redundant added tests on adaptix rose from 8 to 14.
- **Test cases (Astra and Sol 6.1, from the same adaptix r2 patch).** "Choose cases by distinct failure modes; combine parameters only when they interact."
- **Existing operations (Astra and Sol 6.1, from csstree r3).** Step 7: "Build on existing operations, not formatting or incidental internal shape."

Disputes settled from round-2 traces:

- **Hygiene pointer: kept.** `main` read the hygiene reference in 12 of 12 attempts and round 2's candidate in 0 of 12. Astra and Sol 6.1 would have reverted it.
- **Step 6: back to `main`'s text.** Pre-fix tree rebuilds were similar (`main` 2 attempts, round 2's candidate 1), so "Before the fix" shows no effect. Test-audit's "fail before the fix exists" also goes back to `main` (all three proposals).

Not taken:

- **Cancellation and late-event checks** (Sol 6.1's step 9, Astra's "work that can still run after early exits"). Round 2's notes traced 66 of round 1's 106 duplicated test lines to a clause like it, and Opus 5.5 rejected it as naming one task's domain.
- **Word budget cuts.** The first merge came to 3,553 Workflow words against the 3,500 limit. To fit, the candidate drops step 2's representation-agreement line (Astra and Sol 6.1), step 9's sibling-matching sentence (Opus 5.5 would drop it first; round 2's version showed no effect), the restored "Do not use review as a substitute for a blocked or failed test" (Astra), and the step 8 example.

## Run

- Arms: vanilla (reused from round 2's vanilla cache) and `workflow-r3`, on the 4 climb tasks with 3 repeats. `workflow-main` is compared from round 2's results. The dry run planned 24 coding attempts and 24 reviews.
