# Round 3 proposal: Opus 5.5 (claude-opus-5-5, effort high)

Received 2026-11-09. Summary of the returned proposal; the full text is in the T3 child thread `egc-r3-proposer-opus`.

## Edits (against main)

- **E1 core.md principle 5 (changed from round 2).** Replacement: "5. **Prove your change follows these principles.** In the final diff inspection, fix departures from principles 1–4 within scope. In your final message, name the simpler version you rejected and the requested outcome it fails to deliver; for each new function, the existing code you checked for the same logic and how they now share one implementation or why they cannot; each change outside the request with its reason; and, for each added test, the regression it catches and the existing test that misses it. Challenge my proposed approach when evidence supports a simpler one."
  - Evidence: true-myth main r1 and r3 replaced the `Result.all` loop with `return sequence(results)`; no candidate or vanilla attempt did. Both consolidations happened before any review (r1 `f8817389…` item 45, review at 53; r3 `8fb2b1ae…` item 24). Redundant tests on adaptix: candidate 14 vs main 8; round 2 dropped the "existing test that misses it" clause.
- **E2 step 6:** keep round 2 ("Before the fix, confirm…"). Evidence: candidate true-myth r2 (`dc2155f6…`) logged its tests failing before the implementation.
- **E3 step 8:** keep round 2.
- **E4 step 9:** replace round 2's added sentence with "Match sibling code's constants, type patterns, and error handling." Evidence: candidate true-myth r1 used the literal `'Just'` where main used `Variant.Just`, and looser `sequence` overloads.
- **E5 test value:** delete "Another test layer can protect a distinct risk." (round 2).
- **E6 hygiene pointer:** keep round 2.
- **E7, E8 review routing and delegation bullet:** keep round 2. Evidence: main true-myth r2 ran a review then a type-fix rework cycle, 4.39M vs candidate 1.35M.
- **E9 test-audit:** keep round 2 (delete coverage record; conditional step 6).
- Dropped from round 2: test-audit's "fail before the fix exists" rewording.

## Totals

10 added, 25 removed, about −73 words.

## Predicted effect

- Pair wins about 7–8 of 12 (borderline). Two near-certain wins where main failed (adaptix r3, csstree r1). True-myth 1.5–2 of 3 with the reuse clause. Happy-dom r3 leans candidate, r2 leans main (new `FetchBodyStreamUtility` module). Adaptix r1/r2 toss-ups (main named helpers). Csstree r2/r3 slight candidate lean.
- Tokens: about 2.5M, 1.17× vanilla (E1 adds 2–4 reads).
- Review findings about 11; redundant tests toward 13.

## Risks

E1 may pull agents into rewiring existing APIs; E7/E8 lose automatic adversarial review for concurrency and public-contract changes (largest real-work risk); E3 may mislabel real failures as environmental; E4 may copy bad local patterns. Drop E4 first. Rejected: a cancellation-specific step-9 line, as it reads as naming happy-dom's domain.
