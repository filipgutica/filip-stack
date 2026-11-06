# Writing-rules probe: judge-led results

The approved judge-led probe is complete. R1: **not supported**; R2: **not supported**. No live guidance was changed and nothing was pushed.

The amendment was committed at `ba7537e627916feaec1b2aa14b51eab463d7b817` before the first paid call. The head remains SHA-256 `b3610980c1d1ef86d63df952745952dd20f224aac8e9de29ac8ca930bda8c4ac`.

## Primary judge outcomes

Each cell below is a majority outcome across calibrated target-item judges for 20 matched brief/attempt pairs. Ties count as half a win. C uses all three judges without separate control calibration.

| Item | Head wins vs base | Base wins | Ties | Weighted wins / 20 | Head wins vs vanilla | Vanilla wins | Ties | Weighted wins / 20 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 15 | 12.5 | 5 | 0 | 15 | 12.5 |
| R2 | 0 | 0 | 20 | 10 | 0 | 0 | 20 | 10 |
| C | 0 | 0 | 20 | 10 | 0 | 0 | 20 | 10 |

| Rule | At least 15 vs base | At least 15 vs vanilla | Rule minus C vs base | Specificity passes | Verdict |
| --- | --- | --- | ---: | --- | --- |
| R1 | no | no | 2.5 | no | not supported |
| R2 | no | no | 0 | no | not supported |

R1's five winning pairs in each comparison were H1 (one) and H2 (four). All ten tutorial pairs tied. R2 and C had no majority wins or losses on any brief.

C reaches the blocking threshold of 15/20 against base: **no**. Specificity needs a rule-minus-C difference of at least four. Each rule is decided separately, conditional on reader no harm.

## Reader no harm

**Pass.** The floor is head at least base minus one task overall and on every brief. There is no reader-gain requirement.

| Brief | Head / 5 | Base / 5 | Vanilla / 5 | Head minus base |
| --- | ---: | ---: | ---: | ---: |
| H1 | 5 | 5 | 5 | +0 |
| H2 | 5 | 5 | 5 | +0 |
| T1 | 5 | 5 | 5 | +0 |
| T2 | 5 | 5 | 5 | +0 |
| **Total / 20** | **20** | **20** | **20** | **+0** |

## Length and resources

| Arm | Mean words |
| --- | ---: |
| vanilla | 394.05 |
| base | 396.60 |
| head | 395.85 |

Length flag (>10% mean difference between head and base): **no**.

Calls used: **167/171**: 23 preparation calls plus 144 paid calls. Planned paid execution was 60 builds, 60 readers and 24 five-pair judge batches. Retries: 0; at most one per stage. Codex tier counts: priority 21, default 136. Opus calls: 10, all in judge seats. Every new Codex dispatch used default.

## Calibration, blinding and limits

- Astra, Sol 6.1 and Opus 5.5 each caught 2/2 planted entry defects and 2/2 planted path defects with 0/2 clean false alarms on both items. Eligibility was reused unchanged. C was not separately calibrated; prior calibration also does not directly validate fine-grained preference ranking.
- Builder/reader dispatches used neutral IDs and opaque paths. Private arm maps stayed outside model prompts. A/B order was randomized separately for every judge pair. The preparation dispatch-label leak was not repeated.
- Ambient host guidance and unrestricted filesystem access could not be removed by delegated prompts. These are instruction-bounded calls, not isolated sandboxes.
- Four fictional CLI briefs share a strong workflow template. Five attempts and repeated judge votes do not make them twenty independent subject areas. Both rules were added together; item-specific votes do not isolate the causal contribution of each rule.
- Reader completion uses a closed command-operation and observation rubric. Its structured observations depend on the reader's semantic extraction. Citation fidelity is diagnostic, not an independent entailment proof. No human reader or real CLI execution was measured.
- The preparation runs remained at 4/4 completion on both scenarios after two documented instrument repairs. The approved amendment retained the harder scenarios and made readers a no-harm floor. No scorer or rubric was tuned to paid-arm outcomes.
- Raw prompts, pages, responses, private maps and dispatch receipts stay outside the repository. The committed JSON contains aggregate outcomes only.

## Verification and implementation ledger

A separate decoding of all 360 raw judge votes reproduced the reported 120 item/comparison/pair outcomes. The complete reader grid contains 60 unique cells. All 144 paid calls have one dispatch receipt each; peak concurrency was three. Returned provider metadata matches every requested model and option, including default tier for all new Codex calls. The amendment commit precedes the first paid dispatch, and every frozen artifact hash still matches. No independent scorer-review agent ran.

All 13 focused scorer tests passed. `pnpm check` exited 0 on Node v24.19.0, and the final Fallow audit exited 0. `git diff --check` passed. No scientific method, prompt, key or scorer change was made after paid dispatch began. The external dispatcher changed from whole-batch waiting to a rolling pool and then completion-driven asynchronous returns; prompts, settings, shuffled jobs and the three-call limit were retained. Late notices were reconciled without resending completed calls.

### Implementation ledger

- **Simpler version:** keep the old attempt-1 judge route and reader-gain gate. It cannot produce 20 majority pairs against both comparisons, and the approved amendment explicitly removes the perfect-sweep requirement.
- **Readability:** `majority_counts` owns strict majorities and half-win ties. `decision` separately owns each rule's 15/20 thresholds, the four-win control gap, C's blocking threshold, and both reader no-harm floors. The control and reader gates remain visible in the result tables.
- **Scope:** zero production-runtime lines changed. Against the preparation commit, the amendment added 177 study-code/prompt lines and removed 75; it added 94 test lines and removed 13. This results commit changes only aggregate evidence and the required lab notebook. No dependency, version, live guidance, website, PR or release changed.
- **Reuse:** `active_calls` reuses the original ledger and preserves superseded evidence without double-counting cells. The original `load`/`scored_rows` loops could not do that. `majority_counts` replaces the old single-attempt defect comparison because five-pair majority/control outcomes have a different unit. `retry` reuses `reserve` and enforces the approved one-spare-per-stage contract; no retry was needed. Existing command interpretation, page preparation and calibration evidence were retained.

### Coverage record

All seven still-applicable preparation tests were retained. `test_scoring.py:test_literal_binary_gate_and_incomplete_data` was removed because this approval retires its mean-one-task/perfect-sweep contract. Its incomplete-cell protection remains in the replacement suite.

| Added test in `scorer/test_scoring.py` | Distinct regression caught |
| --- | --- |
| `test_per_rule_specificity_with_no_reader_gain` | Requiring reader improvement after its retirement, missing the four-win control gap, or coupling the two rule verdicts. The old gate test required the obsolete perfect sweep. |
| `test_majority_ties_count_half` | Counting raw judge votes instead of pair majorities, or scoring split/tied majorities as zero or a full win. No old test had five-attempt judge majorities. |
| `test_control_fifteen_blocks_both_and_vanilla_is_required` | Supporting either rule when C reaches 15, or accepting a base-only win below 15 against vanilla. The old route had no C or vanilla judging. |
| `test_no_harm_needs_overall_and_each_brief` | Letting gains on another brief hide a loss of two, or letting four allowed per-brief losses hide an excessive overall loss. The old test did not isolate both floors. |
| `test_incomplete_or_duplicate_cells_have_no_verdict` | Issuing a verdict with a missing reader cell, missing judge vote, or duplicated vote replacing a required cell. Replaces and extends the obsolete test's incomplete-reader check. |
| `test_paid_dispatches_are_neutral_and_default_tier` | Exposing arm labels in actual reserved dispatches, using priority on new calls, reserving a cell twice, or exceeding the 171-call cap. Preparation used named IDs and did not exercise the new paid reservation boundary. |
