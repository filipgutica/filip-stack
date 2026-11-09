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
- PluginBench `01597a8`, with PR #18: a backend failure before the first model turn stops the run unscored and uncached, and a background run starts in its own systemd scope. `check` on that commit: 12 of 12 vanilla cache hits, with the same keys as round 2.
- The run started in its own systemd scope on 2026-11-09 and finished without incidents.

## Result

Vanilla (12 cached attempts, the same cohort round 2 coded) and `workflow-main` come from round 2; `workflow-r3` was coded fresh. 12 climb attempts each.

| Gate | Candidate | Against | Limit | Result |
| --- | ---: | ---: | ---: | --- |
| Passes: confirmed + overlap (vanilla 11 + 1; `main` 10 + 0) | 10: 8 + 2 | vanilla | ≥ 11 | fail |
| Tokens, mean of task medians | 2.65M | 2.14M | ≤ 2.78M | pass (1.24×) |
| Cognitive ratio to reference (Amendment 3 floor) | 0.44 | 0.49 | ≤ 0.54 | pass |
| Complexity hotspots | 9 | 11 | ≤ 11 | pass |
| Introduced dead findings | 4 | 5 | ≤ 5 | pass |
| Changed-line coverage | 98.32 | 98.26 | ≥ 88.26 | pass |

Diagnostics, against `main`: duplicated test lines 50 against 101, high plus medium review findings 7 against 8, redundant added tests 7.67 against 13. Under the frozen pre-Amendment-3 gates ([probe-gates.yaml](../harness/probe-gates.yaml)) the candidate also passes every mechanical gate (cognitive ratio 0.33 against 0.37 over 4 tasks) and fails only correctness.

The two misses:

- **csstree r1:** a test failure. `main` also failed csstree r1.
- **happy-dom r3:** an empty patch. The agent found no `main` branch, asked which branch to base its fix on, and stopped with a "Waiting on you" footer before editing. No round-3 edit touches that behavior: it comes from `core.md`'s ambiguity and pause rules, which `main` shares.

**Judges (report-only, because gate 1 failed).** Astra, Sol 6.1, and Opus 5.5, one call per task, 3 matched pairs each, sides drawn with seed 20261109. Before the calls, both arms' diffs were normalized to `a/` and `b/` path prefixes without `index` lines, because the two sources used different diff headers.

| Pairs | Candidate | `main` |
| --- | ---: | ---: |
| Decided by correctness (2) | 1 (adaptix r3) | 1 (happy-dom r3) |
| Judged (10) | 3 | 7 |
| Weighted total (12) | 4 | 8 |

The candidate needed 8. Because it has fewer scoped words than `main`, the card's Prune rule would have lowered that to 6, but Prune also requires every gate to pass; with 4 wins and a failed correctness gate, the candidate loses under either rule. The brief stated only the 8-win rule. The judges' majority went to `main` on csstree (3 of 3), true-myth r1 and r2, adaptix r2, and happy-dom r2. Their most common reasons for `main` were code that handles more of the abstraction's real cases, such as grammar wrappers or heterogeneous types, and fewer unrequested additions. Judges chose side A in 6 (Astra), 6 (Sol 6.1), and 7 (Opus 5.5) of 12 pairs.

## Outcome

Round 3 was the last budgeted round. No candidate passed the decision rule, so `main` stays the incumbent and the climb has no head to ship. The probe compares a head against `main`; with no head, it does not run.

What the climb found:

- **Tokens:** rounds 2 and 3 cut `main`'s cost from 6.68M to 2.36M and 2.65M per task median (vanilla 2.14M), mostly by narrowing when a separate review starts and when the hygiene reference loads.
- **Quality:** blind judges still prefer `main`'s code on 7 of 10 judged pairs, while the reviewer finds slightly fewer defects in the candidate's. One untested explanation is that `main`'s separate review and longer verification produce the extra handling the judges reward; a later study would have to isolate it.
