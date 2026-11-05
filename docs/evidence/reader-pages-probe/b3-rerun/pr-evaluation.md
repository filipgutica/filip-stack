## Evaluation

### B3 rerun: not supported

The approved one-rule rerun completed all 46 new calls with zero retries.
R4 now places caveats beside the claims they qualify and shared caveats in the shared introduction.
The head arm is local commit `982af5e0fc6d24977f2ec7c9fb3cd621c606d866`.
The normal push was blocked by session execution policy; the revised guidance and new evidence are not yet published on this branch.

| Brief | No harm, base / vanilla | Better measures vs base | Head–base votes | Head–vanilla votes |
| --- | --- | --- | --- | --- |
| B1, reused | pass / pass | M3, M9 | 9–6 | 11–4 |
| B2, reused | pass / pass | M3, M4, M5, M6 | 11–4 | 14–1 |
| B3, rerun | pass / pass | M5 only | **4–11** | **12–3** |
| B4, reused | pass / pass | M3, M4 | 12–3 | 11–4 |

- Overall verdict: **not supported**; combined scorer verdict `do not ship`.
- Against base, no harm passes on all four briefs and objective gain passes on three, with no M3/M4 regression.
- Against base, part 3 fails because B3 has an opposing majority, despite head winning the other three briefs.
- Against vanilla, both required parts now pass; head wins all four briefs.
- B1, B2, and B4 were not rerun under the revised rule, so regression there is untested.
- B3 base and vanilla builds and scores were reused unchanged; only head was rebuilt with `build_arms.py`.
- The new B3 calls were five builds, five primary extractions, five comprehension calls, one second extraction, and 30 fresh judges.
- All five new pages put the shared caveat in the opening; all retain every reader fact, invent none, and score 15 of 15 on comprehension.
- B3 fragment-rate sums are head 0.643, base 0.222, vanilla 0.000; start-offset sums are 1.835, 1.900, and 1.932.
- All build traces read only their assigned arm; all 41 scoring traces have no commands.
- Frozen hashes, effective models/options, task text, balanced pairs, and all 46 saved cells validate.
- Double-coding agrees on measured fact/placement/opening fields for all three B3 samples; only one new head call was needed.
- Five attempts, uncalibrated judges, unchanged extractor definitions, and global host guidance remain limitations; actual tokens and billed cost are unverified.

Reports: `b3-rerun-report.md`, `paid-run-report.md`, `dry-run-3-report.md`.
Evidence: `b3-rerun/`, with new and reused ledgers, prompts, replies, traces, frozen hashes, validation, and combined scores.
Lab notebook: study 22 and the experiment log.

### Original paid run and integration

- The original 312-call study used base `0fc048d4` and merged head `f6997da1`, four briefs, three arms, five attempts, and zero retries.
- Its verdict was not supported: B3 lost 7–8 to base and 5–10 to vanilla, while the other three briefs passed.
- Main was merged as `f6997da1`, preserving breakpoint, visualization, study-21, and G1–G7 content.
- Dry run 3 completed 15 calls with zero retries and no pipeline failure; head won all six overall votes, with no study verdict at one attempt.
- Node 24.19.0 `pnpm check` and `fallow audit` pass for the rule revision.

### Routing and publication

No routing evaluation ran; it remains separate approval.
The PR stays a draft. No merge, ready action, or further guidance revision was performed.
The earlier approval table below is historical: the original paid run and this B3 rerun were approved and completed with unchanged measures.
The rule commit and rerun evidence need a normal push before remote-head verification can pass.
