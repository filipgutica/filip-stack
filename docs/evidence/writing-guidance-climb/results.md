# Writing-guidance climb and probe: results

Result: **not supported**. The climb's final version of `technical-prose.md` failed all three parts of the probe's decision rule on fresh briefs, so it does not ship. `main` keeps its current `technical-prose.md`.

## What was tested

The climb added one section, "Place answers in documentation pages", and cut one first-reader line (+11/−1 lines; file SHA-256 `2c020daf…`). The section asks writers to put each reader task's answer early, with one rule per Diátaxis type:

- Tutorial: open with the worked case's expected result, and give the check and action for an interruption near the start.
- How-to guide: give prerequisites, approvals, and timing before the first command, and each failure's recovery before the success path's details.
- Reference: put each key's default, overrides, and interactions in its row, and the unknown-key rule and error codes right after the table.
- Explanation: open with a short model of the behaviors, including failure and the caller's response.

It also asked writers to keep the facts for one decision together, and to show each command a recovery step reruns.

## Climb

The climb ran under the `score` rule on its own four briefs, with 3 attempts per brief and version. See [card.md](card.md).

| Version | Score | Tasks passed |
| --- | --- | --- |
| No guidance (baseline) | 78.55 | 60/60 |
| `main` (start) | 79.51 | 60/60 |
| Round 1 (accepted, final) | 84.88 | 60/60 |
| Round 2 (rejected: +0.68, below the 1.0 bar) | 85.56 | 60/60 |

The climb stopped after round 2 because its proposal queue was empty. It used 156 of 240 calls.

Final-check scorecard. Each judge rated the start and final pages for every task:

| Judge | Start mean | Final mean | Overall | Read depth | Fit to page type |
| --- | --- | --- | --- | --- | --- |
| Sol 6.1 | 9.00 | 9.65 | Final | Final | Start |
| Opus 5.5 | 9.10 | 9.30 | Start | Final | Start |
| Astra | 9.35 | 9.20 | Start | Final | Start |

All three judges rated the versions the same on task success and on facts beyond the sources. All three found that recovery-first tutorials and how-to guides break the order a learner or operator works in. Before the first probe build, [prereg.md](prereg.md) was amended so that a probe pass would go to the user instead of merging.

## Probe

The probe used four fresh briefs from a new writer call, with no product reused from the climb. It ran 3 arms × 4 briefs × 5 attempts: 60 builds and 60 reader calls, plus 1 brief-writer call. The cap was 135 calls; the probe used 121. Every reply was usable, so no call was retried. `scorer/probe.py` applies the rule.

| Arm | Score | Tasks passed (95% CI) | Mean words |
| --- | --- | --- | --- |
| Vanilla | 74.20 | 92/100 (0.85–0.96) | 399 |
| Base (`main`) | 73.41 | 90/100 (0.83–0.94) | 406 |
| Head (climb final) | 75.53 | 92/100 (0.85–0.96) | 405 |

| Rule | Result | Verdict |
| --- | --- | --- |
| 1. Head beats base in ≥ 15/20 pairs, mean ≥ +1.0 | 11/20, +2.12, sign p = 0.41 | Fail |
| 2. Head beats vanilla the same way | 14/20, +1.33, sign p = 0.058 | Fail |
| 3. No harm: total ≥ base − 1, no brief more than 1 worse | 92 vs 90 overall; reference 21 vs 25 | Fail |

Flags: page length was even (405 vs 406 words). Head beat base on 2 of 4 briefs (explanation 5/5 pairs, how-to 3/5, tutorial 2/5, reference 1/5).

Where the arms differed:

- **Reference, error recovery (t3):** base 5/5, head 1/5, vanilla 1/5. Four head answers were correct in substance ("the same retained cursor") but missed the key's literal phrases ("same cursor").
- **Tutorial, interrupted pack (t3):** base 3/5, head 2/5, vanilla 4/5. Head answers gave the right commands but not a rerun verb that the key requires. Head did put the recovery answer earlier: depth 143 words, against 345 for base.
- **Explanation, unknown commit (t3):** base 0/5, head 5/5, vanilla 4/5.
- **How-to, explicit pruning option (t4):** head 5/5, base and vanilla 3/5.

Post hoc sensitivity check, not part of the rule: counting every task as passed so that only depth scores, head beats base in 13 of 20 pairs (+1.14). That is still below the 15 the rule requires. Head beats vanilla in 16 of 20 (+1.66). The depth gain the climb measured on its own briefs did not hold against `main` on fresh briefs.

## Lessons

- A reader scored on depth rewards answer-first order. That works against the sequence a tutorial or how-to needs, which all three judges saw. A future placement climb should use the `both` rule, so that fit to the page type counts.
- Literal answer keys still cost correct answers. Synonym lists help, but a key that needs a phrase such as "same cursor" fails equivalent wording. Key literalism is a measurement gap; it does not justify new guidance.
- The scorecard's task-success and read-depth questions repeat what the reader score measures directly, so they were redundant. Fit to the page type and facts beyond the sources have no other owner.

Raw prompts, pages, and replies stay on the machine that ran the study. The climb's run record id is `2026-11-06-filip-stack-writing-guidance-climb`.
