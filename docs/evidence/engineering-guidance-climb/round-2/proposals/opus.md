# Round 2 proposal: Opus 5.5 (claude-opus-5-5, high)

Final message, 2026-11-07. Replacement texts verbatim; current texts abbreviated.

## Premise corrections

- Round 1 did not pass the mechanical gates: duplicated test lines 106 against 46 (66 of them from happy-dom r3 `7664ae7c`), and high plus medium findings 10 against 9.
- `activation.py` counts everything twice: `commands()` yields both `item.started` and `item.completed`. "~/.agents looked up twice" is one command per attempt; `engineering_skill: 2` is one read.

## Fallback lookups

No guidance edit. Each attempt runs `cat ~/.agents/CODING_STANDARDS.md` once and it exits 1; in 6 of 12 it shares a command with the SKILL read. About 20k tokens, 1% of vanilla. The harness inlines the file into AGENTS.md (line 124) but keeps the "read it" line (line 97). Fix in the harness, not the guidance.

## Where round 1's extra turns go (means per attempt)

| Kind | Round 1 | Vanilla |
| --- | --- | --- |
| Test runs | 0.97M (11.0 calls) | 0.56M (7.7) |
| Exploring code | 0.69M | 0.46M |
| Guidance reads | 0.23M | none |
| Building a pre-fix copy | up to 0.76M in one attempt | none |

Causes: round 1 step 8 "every check the repository requires" (root-level `npm test` across the monorepo, network-test retries); round 1 step 9 lifecycle clause (adjacent races, extra cases, duplicated lines); main step 6 "fails on the pre-fix code" (pre-fix tree rebuilds: 0.76M happy-dom r3, 0.44M r1, ~0.2M true-myth r2 and r3); the coverage record (post-commit searches). The test-audit authoring gate earns its cost: round 1 added 9–18 cases where vanilla added 20–41.

## Edits (against `main`)

- **E1** engineering step 6 → "6. Add focused coverage for a credible regression that existing tests would miss. Run a new bug regression test before the fix exists, and confirm it fails for the expected reason. For reversible, low-impact changes, prefer existing checks over tests that mirror the implementation."
- **E2** engineering step 5 → "5. Change an existing test or fixture only when repository evidence proves that its contract changed or the test is wrong." (round 1)
- **E3** engineering steps 8–9 →
  "8. Rerun the same test. Inspect the diff and affected callers for accidental changes, duplication, dead code, redundant state or branches, needless indirection, and test value. Keep types precise, and raise new failures the way sibling checks do. Simplify changed code if useful, preserving behavior."
  "9. After the last edit, run the new tests and the checks the repository declares for the changed package; after a fix, rerun what failed. If a failure comes from the environment, such as network access or an external service, rerun that test once, then report it as unverified. Stop when the contract passes and required checks and review gates pass."
- **E4** engineering test-layer paragraph → "Prefer extending existing cases over duplicating proof. Dependency injection for clocks, network, or storage can support deterministic tests at real boundaries." (round 1)
- **E5** engineering review pointer (and delete "Do not use review as a substitute for a blocked or failed test.") → "Read [delegation and review](references/delegation-and-review.md) before delegating, when checking review feedback, and before a change that is hard to undo after merge: security or authentication, migrations, persisted data or formats, or removing or renaming a published API. Follow it and any user or repository review requirements. Other changes use step 8 checks."
- **E6** delegation line 3 → "…Continue independent work while workers run. Start a reviewer only after the final checks finish, and wait for its report without sending it messages." (round 1)
- **E7** delegation three bullets → "- A change that is hard to undo after merge, such as security or authentication, a migration, persisted data or formats, or removing or renaming a published API, uses a separate adversarial reviewer when available." / "- Other changes, including additive APIs and concurrency or lifecycle fixes, use Engineering's step 8 checks and main-thread diff inspection."
- **E8** delegation line 58 → "Verify corrections with focused checks or regression tests; ask for another review round only for a fix to a high-severity finding or a fix that changes the reviewed contract." (round 1)
- **E9** test-audit step 6 → "6. When [delegation and review](../engineering/references/delegation-and-review.md) requires an independent review, include the focused test audit in its brief." (round 1)
- **E10** test-audit: delete "Before handoff, write the coverage record against the final diff."
- **E11** core principle 5 → "5. **Prove your change follows these principles.** In the final diff inspection, fix any departure from principles 1–4 within scope. In your final message, name the simpler version you rejected and the requested outcome it fails to deliver, each change outside the request with its reason, and the regression each added test catches. Challenge my proposed approach when evidence supports a simpler one."

Dropped from round 1: the hygiene inline (still loaded 11/12), the SKILL:64 cut, the fresh-context reviewer line.

## Totals

13 added, 26 removed, −59 words.

## Predicted effect

Mean of projected medians (3.4 + 1.37 + 1.56 + 2.48)/4 = 2.20M; 2.20/1.67 = 1.32×, range 1.28–1.40. Borderline, more likely fails than passes. Duplicated lines expected toward 46; redundant tests at or below 11; findings still at risk.

## Risks

E3 could label a real regression environmental; E5/E7 lose the reviewer for lifecycle bugs; E1 may skip the failure check where test-first is impractical; E10 may miss a duplicate test; E11 drops Reuse and Readability. Drop E11's trim first if judges lose on reuse. Next token lever: narrow test-audit invocation (~−0.1M per attempt).
