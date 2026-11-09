# Judge validation and the owner-profile judge

Date: 2026-11-09. Summary numbers only. Prompts, diffs, judge transcripts, and the profile stay on the machine that ran the climb.

All comparisons use the 12 step-1 pairs per comparison: four DeepSWE tasks (adaptix, csstree, happy-dom, true-myth), three repeats each. In 10 of the 12 pairs, both sides got the same test outcome, so only the judges can separate them.

## Step 1: three judges, three pairs per call

Judges: Astra, Sol 6.1, and Opus 5.5, all at high effort.

| Candidate against vanilla | Card wins (of 12) | Candidate votes (of 36) |
| --- | ---: | ---: |
| `main` | 6 | 21 |
| Round 3 | 7 | 27 |
| Superpowers | 5 | 16 |

## Judge check

### Noise floor: same arm on both sides

Each packet put two runs of the same arm against each other, one of them standing in as the candidate.

| Packet | Stand-in card wins (of 12) | Votes (of 36) |
| --- | ---: | ---: |
| `workflow-main` against `workflow-main` | 8 | 23 |
| Vanilla against vanilla | 7 | 26 |

Because both sides are the same arm, the expected result is 6. Differences of 1 or 2 card wins are within noise.

### Swapped sides, one pair per call

| Comparison | Judged pair wins, step 1 → swap (of 10) | Same arm picked both times (Astra / Sol / Opus, of 12) |
| --- | --- | --- |
| `main` against vanilla | 6 → 10 | 6 / 8 / 8 |
| Round 3 against vanilla | 7 → 7 | 12 / 11 / 9 |

### Position bias

| Call shape | Side A chosen |
| --- | ---: |
| Three pairs per call (same-arm packets) | 50 of 72 (69%) |
| One pair per call (swap packets) | 36 of 72 (50%) |

Conclusion: three-pair calls lean toward side A, and `main`'s result changes when the sides swap. Judge with one pair per call. Treat one or two card wins as noise.

## Owner-profile judge

The owner decided not to rank the pairs by hand: he cannot judge unfamiliar library code reliably. A judge was built from his review taste instead.

### Profile sources

| Source | Size |
| --- | --- |
| His own GitHub review comments at work | 261 comments on 99 PRs |
| Corrections he gave Codex agents | 138 corrections in 71 sessions |
| Stated rules and merged commits on the climb machine | 33 items |

Items supported only by the Workflow `engineering` skill or the global guidance were excluded. A judge built from them would reward the guided arm for following its own guidance.

The result is a profile of 21 ranked preferences and a standalone standard of 14 checks. Both stay on the climb machine.

### Proxy result on the 20 pairs

The proxy was Claude Fable 5.2 at high effort, reading the profile and the standard, with one pair per call. The 20 pairs are those where both sides got the same test outcome (10 for `main`, 10 for round 3). Sides were randomized again before judging.

| Measure | Result |
| --- | --- |
| Prefers the guided arm | 13 of 20 (`main` 7 of 10, round 3 6 of 10) |
| Agreement with step-1 verdicts, three-pair calls (Astra / Sol / Opus) | 12 / 12 / 12 of 20 |
| Agreement with swap verdicts, one pair per call (Astra / Sol / Opus) | 15 / 14 / 14 of 20 |
| Each judge's agreement with itself, step 1 against swap (Astra / Sol / Opus) | 15 / 16 / 14 of 20 |

The proxy agrees with the one-pair-per-call judges about as often as those judges agree with themselves. It agrees less often with the three-pair-call verdicts.

The checks it cited most:

| Check | Decisive in |
| --- | ---: |
| One code path, one source of truth | 13 pairs |
| Correct on traced inputs | 7 pairs |
| Honest types and errors | 7 pairs |
| Contracts preserved | 6 pairs |
| Reuses what exists | 5 pairs |
| Fixed where the behavior lives | 4 pairs |

13 of 20 does not separate the guided arm from chance (two-sided binomial p ≈ 0.26).

## Decision

- The owner-profile judge, Fable 5.2 at high effort with one pair per call, joins the climb's judge panel. It stands in for the owner's own rankings.
- Every judge gets one pair per call.
