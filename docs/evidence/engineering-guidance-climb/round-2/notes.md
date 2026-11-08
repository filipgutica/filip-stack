# Round 2 notes

Date: 2026-11-07.

## Inputs

- The [proposer brief](brief.md), as sent. Its first version said round 1 passed every mechanical gate; all three proposers caught it, and the brief now says round 1 also failed duplicated test lines (106 against 46) and high plus medium findings (10 against 9).
- Three read-only proposals: [Astra](proposals/astra.md), [Sol 6.1](proposals/sol.md), and [Opus 5.5](proposals/opus.md).
- All three found that the "two `~/.agents` lookups" per attempt are one command: `activation.py` counts both the `item.started` and `item.completed` events. No guidance edit follows from it.

## Candidate

[candidate.diff](candidate.diff) against `main`: 11 lines added and 26 removed. Both validators pass.

What all three proposals agreed on, and the candidate takes:

- A separate review starts only for a change that is hard to undo after merge: security or authentication, migrations, persisted data or formats, or removing or renaming a published API. The Engineering pointer and the delegation bullets say the same thing. "Do not use review as a substitute for a blocked or failed test" goes.
- Principle 5 drops the written ledger. The final message names the simpler version, each change outside the request, and the regression each added test catches.
- "Another test layer can protect a distinct risk" goes.
- Test-audit no longer writes a coverage record at handoff (Sol 6.1 and Opus 5.5).

Taken from one proposal, with its trace evidence:

- **Regression test before the fix (Opus 5.5).** Step 6 now says "Before the fix, confirm that a new bug regression test fails on the pre-fix code", and test-audit says the test "must fail before the fix exists". Round 1 rebuilt pre-fix trees after fixing: 0.76M tokens in one happy-dom attempt. The step keeps the phrase the contract validator locks.
- **Environment failures (Opus 5.5).** Step 8 reruns a failure caused by the environment once, then reports it as unverified. Step 8 no longer lists "an observed failure" as a reason to repeat checks, so the two rules cannot combine into the retry loop seen in round 1 (ten baseline retries in one happy-dom attempt).
- **Types and failures (round 1, kept by Astra and Opus 5.5).** Step 9 keeps "Keep types precise and raise new failures the way sibling checks do".
- **Hygiene pointer (Astra and Sol 6.1).** The reference loads "only when splitting work or preparing a PR". Round 1's softer wording still loaded it in 11 of 12 attempts, so the token projection credits it nothing.
- **Test-audit step 6 (round 1, kept by Opus 5.5).** It adds the test audit to a review only when a review is required. Round 1 changed this trigger and the Engineering pointer together and started no subagents; reverting one of the two could bring reviews back.

Choices that no proposal made, or that override one:

- **Dropped round 1's lifecycle clause** ("trace cancellation, teardown, and late events"). Opus 5.5 traced 66 of round 1's 106 duplicated test lines to it. Astra and Sol 6.1 kept it in another step.
- **Kept `main`'s step structure.** Astra and Sol 6.1 folded the nine steps into five; that costs about five more changed lines for the same mechanisms.
- **Not taken:** the reviewer timing and correction-verification edits (Opus 5.5). With the narrower trigger, no climb task starts a reviewer, so the climb cannot measure them.
- **Not taken:** Sol 6.1's trims to test-audit's junk-pattern and audit-reading paragraphs, and Astra's per-bug limit on pre-fix proof. The authoring gate is the likeliest source of round 1's fewer and less redundant tests.
- **Word budget.** The first merge came to 3,516 words against the 3,500 limit. The candidate drops the inline commit sentence from the hygiene pointer and shortens the step 8 environment rule.
- **Validator lock.** `validate-contracts.mjs` requires "new bug regression test fails on the pre-fix code for the expected reason", so step 6 keeps that phrase after "Before the fix".

## Projection

The proposers projected 1.28× (Astra), 1.29× (Sol 6.1), and 1.32× (Opus 5.5) vanilla tokens against the 1.3× gate. Opus 5.5's 1.32× is closest to this candidate. The token gate is a coin flip; the next lever is narrowing when test-audit is invoked (about 0.1M tokens per attempt, per Opus 5.5).

## Run

- Arms: vanilla, `workflow-main`, and `workflow-r2`, coded fresh on the 4 climb tasks with 3 repeats: 36 coding attempts and 36 reviews. The dry run matched that plan.
- `pluginbench check` passed on the second try. The first failed adaptix dead code because the shell lacked the PluginBench virtualenv on `PATH`, so vulture 2.16 was missing. All 12 vanilla attempts missed the cache, so the baselines are fresh.
