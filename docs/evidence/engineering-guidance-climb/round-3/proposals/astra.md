# Round 3 proposal: Astra (gpt-6-astra, reasoningEffort high)

Received 2026-11-09. Summary of the returned proposal; the full text is in the T3 child thread `egc-r3-proposer-astra`.

Base: round 2's candidate. Keeps its reporting and review-routing cuts; revises inspection and test guidance. Drops round 2's "before the fix exists" wording, the hygiene restriction, and the deletion of "Do not use review as a substitute for a blocked or failed test."

## Edits (against main)

1. **core.md principle 5:** round 2's text. Evidence: happy-dom main r1 rewrites its ledger at trace lines 76, 127, 167, 181, 193, 206 (`aed1843f5af336af`).
2. **Engineering step 2 (new):** append "Trace changed invariants through producers, consumers, and alternate representations; identify validation and cleanup that shortcuts or early exits could bypass." Evidence: adaptix candidate r1 changes runtime lookup but leaves primary-key schema requirements and bypasses optional-field extraction.
3. **Step 8:** round 2's text. Evidence: adaptix candidate r2 trace lines 70–79 (`086864e3e9d76719`).
4. **Step 9 (revised):** "Compare new public types and error behavior with sibling APIs. For early exits, check the returned result and work that can still run afterward." before "Simplify changed code…". Evidence: happy-dom main r1's review catches late producer activity after cancellation (trace line 91); candidate r2 leaves that defect.
5. **Keep the design small (new):** append "Derive behavior from supported semantic operations; verify assumptions about formatting or internal representation against the abstraction's contract." Evidence: csstree candidate r3 indexes immediate match children, breaking equivalent wrapped syntax.
6. **Test value (revised):** replace "Another test layer can protect a distinct risk." with "Parameterize a setting only when it can change the asserted behavior; cover independent settings separately." Evidence: adaptix candidate r2 multiplies conflict keys, extra policies, and debug modes.
7. **Review pointer:** round 2's replacement, but keep "Do not use review as a substitute for a blocked or failed test." Evidence: happy-dom main r1 repeated review corrections, 12.19M vs candidate r1 5.73M.
8. **delegation-and-review.md:** round 2's single bullet.
9. **test-audit coverage record:** delete (round 2).
10. **test-audit step 6:** round 2's conditional wording.

## Totals

10 added, 23 removed, −29 words (validator rule).

## Predicted effect

Central forecast 8 of 12 (range 6–9): about 2 of 3 per task. Tokens 2.58M, 1.21× vanilla. Findings 6–9; duplicated test lines ≤ 48; redundant tests 12–15.

## Risks

Less written evidence (1, 9); scope growth from tracing representations (2); retry cap (3); unnecessary overloads from sibling comparison (4); needless abstraction (5); missed interactions (6); lost independent review (7, 8). Drop 7 and 8 together first if focused inspection does not replace review findings.
