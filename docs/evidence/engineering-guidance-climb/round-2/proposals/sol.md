# Round 2 proposal: Sol 6.1 (gpt-6.1-sol, high)

Final message, 2026-11-07. Replacement texts are verbatim; current texts are abbreviated to their opening words.

12 added lines and 46 removed lines against `main`. Retain round 1's narrower review triggers and preservation checks, while reducing repeated verification and reporting.

**A. `core.md` principle 5** → "5. **Prove your change follows these principles.** Inspect the final diff against principles 1–4, resolve departures within scope, and rerun only checks invalidated by those edits. Report the material design tradeoff, verification results, and remaining limits once in the final response."
Evidence: true-myth r3 `07bbdd34ffd297b3` line 105 generates a per-test coverage report after the commit (about 110k tokens).

**B. Engineering steps 1–9** →

```markdown
1. Inspect Git state, requested behavior, production owner, affected callers, and nearest tests; define preserved behavior and compare a simpler solution before editing.
2. Preserve existing tests and fixtures unless repository evidence proves their contract changed or they are wrong. Follow sibling types, error channels, and ordering; for lifecycle changes, trace cancellation, teardown, and late events before editing.
3. Add coverage only for credible regressions existing tests miss. For a bug fix, establish a focused baseline and confirm a representative test for each distinct failure mechanism fails on the original code for the expected reason; batch related cases.
4. Make the smallest causal change; inspect the diff for accidental changes, duplication, dead code, redundant state, needless indirection, and test value. Run affected tests and required repository checks; reuse valid results across skills and rerun only checks invalidated by edits or needed to investigate a failure.
5. Classify failures before editing. Use one focused diagnostic or retry for an unrelated or infrastructure failure; repeat only after new evidence or an environment change. Report blocked checks as incomplete.
```

Evidence: happy-dom r3 `7664ae7ccd0f8d7d` `host-trace-0.jsonl:387` schedules up to ten baseline retries.

**C. Engineering test-layer paragraph** ("Prefer extending existing cases…") → "Prefer shared setup and table-driven cases for distinct behavior; exercise combinations only when their interaction changes the contract. A second test layer needs a distinct failure mechanism. Use dependency injection at real boundaries when it makes tests deterministic."
Evidence: happy-dom vanilla r3 adds 556 test lines across three files; incumbent r3 adds 229 in one file.

**D. Engineering hygiene pointer** → "Keep each authorized commit focused on one verified outcome, with its tests and documentation. Read [hygiene](references/commit-and-pr-hygiene.md) for deciding boundaries between multiple commits or PRs, or preparing a PR."
Evidence: `activation-round-1.txt` records hygiene reads in 11/12 attempts.

**E. Engineering review pointer** (and delete "Do not use review as a substitute for a blocked or failed test.") → "Read [delegation and review](references/delegation-and-review.md) before delegating, when checking review feedback, and before a change that is hard to undo after merge: security or authentication, migrations, persisted data or formats, or removing or renaming a published API. Follow it and any user or repository review requirements. Other changes use steps 2–4."

**F. `delegation-and-review.md` three bullets** → "- Use a separate adversarial reviewer for security or authentication, migrations, persisted data or formats, or removal or renaming of a published API; honor additional user or repository requirements. Other changes use focused checks and main-thread diff inspection."

**G. Test-audit junk-pattern paragraph** ("Then check the test against every junk pattern…") → "For authoring, use the four questions above; consult [value criteria](references/value-criteria.md) only when a test's distinct risk or retention is uncertain. Rewrite tests that depend on implementation details at the owning boundary."
Evidence: true-myth r3 `07bbdd34ffd297b3:39` loads the 802-word reference during authoring.

**H. Test-audit audit-reading block** (from "Tests justify their maintenance cost…" through "…inspect the dependency source or types directly.") → "For audit mode, read [value criteria](references/value-criteria.md) and inspect each candidate's complete test, production owner, relevant callers, overlapping coverage, CI routing, and dependency source or types before deciding what to retain; read scoped instructions first and history when needed to resolve the contract."

**I. Test-audit** delete "Before handoff, write the [coverage record](references/value-criteria.md#coverage-record) against the final diff." and its blank line.
Evidence: true-myth r3 `07bbdd34ffd297b3:105` performs a separate late reporting command.

Drop round 1's reviewer orchestration edits and Finish truncation; retain `main` there.

## Totals

| File | Added | Removed | Words |
| --- | ---: | ---: | ---: |
| Core | 1 | 8 | −133 |
| Engineering | 8 | 14 | −29 |
| Delegation reference | 1 | 3 | −4 |
| Test Audit | 2 | 21 | −79 |
| Total | 12 | 46 | −245 |

## Predicted effect

About 1.29× vanilla, projected: (2.21+1.21+1.37+3.80)/(1.91+0.84+1.30+2.62) = 1.288 (adaptix, csstree, true-myth, happy-dom medians in millions). Needs about twelve fewer late calls on happy-dom. The two `~/.agents` lookups are one command's start and completion events; credit no savings. The comparison file contradicts the brief's mechanical-pass summary: 106 vs 46 duplicated lines and 10 vs 9 findings.

## Risks

Less written accountability (A/I); representative regressions could miss a manifestation (B); combinations can hide interactions (C); missed commit-boundary guidance (D); lifecycle defects lose independent review, the largest correctness risk (E/F); authoring loses exhaustive junk-pattern checks (G/H). Drop G first if redundant tests increase.
