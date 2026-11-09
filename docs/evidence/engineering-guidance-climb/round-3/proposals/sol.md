# Round 3 proposal: Sol 6.1 (gpt-6.1-sol, reasoningEffort high)

Received 2026-11-09. Summary of the returned proposal; the full text is in the T3 child thread `egc-r3-proposer-sol`.

Keeps round 2's main cuts. Drops round 2's two regression-test timing changes (main already requires pre-fix failure evidence) and its hygiene routing change (standalone commits still need hygiene guidance).

## Edits (against main)

1. **core.md principle 5:** round 2's text. Evidence: vanilla true-myth r3 already composes `zipWith` through `zip` and `map`, so a mandatory reuse ledger is unnecessary.
2. **Engineering step 2 (new):** "Define behavior to preserve and boundary checks before editing, including missing-input defaults and agreement between runtime behavior and public representations." Evidence: adaptix candidate r1/r2 schemas still require primary keys; r1 loses optional-field defaults.
3. **Step 7 (new):** "Make the smallest causal change through existing semantic operations; preserve meaning across equivalent valid input forms instead of relying on formatting or incidental internal shape." Evidence: csstree candidate r3 indexes direct match children; true-myth candidate r1 keeps duplicate collection logic that main r1 removes.
4. **Step 8:** round 2's text.
5. **Step 9 (modifies round 2):** keep "Keep types precise and raise new failures the way sibling checks do." and add "For lifecycle changes, trace cancellation through producer shutdown and late events; preserve validation and resource ownership on fast paths." Evidence: happy-dom candidate r1 bypasses stream locking; r2/r3 can throw uncaught errors after cancellation.
6. **Test value (modifies round 2):** replace "Another test layer can protect a distinct risk." with "Choose cases by distinct failure modes; multiply parameters only when their interaction changes behavior." Evidence: adaptix candidate r2 `test_conflicts_report_keys_after_first_present`; redundant tests 14 vs 8.
7. **Review pointer:** round 2's replacement, deleting "Do not use review as a substitute…". Evidence: true-myth r1 main 5.65M vs candidate 2.10M with no findings.
8. **delegation-and-review.md:** round 2's single bullet.
9. **test-audit coverage record:** delete.
10. **test-audit step 6:** round 2's conditional wording.

## Totals

10 added, 25 removed, −46 words.

## Predicted effect

8 of 12 planning estimate (range 6–10). Tokens 2.56M, 1.20× vanilla (+0.20M per task). Findings toward 8; duplicated test lines ≤ 48; redundant tests toward 13.

## Risks

Shorter records (1, 9); scope growth (2); unsuitable reuse (3); retry cap (4); lifecycle inspection growth (5); missed interactions (6); reduced independent review (7, 8, 10). Drop edit 6 first.
