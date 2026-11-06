# Guide-body probe: paid results

Result: **not supported**.

The paid run finished on 2026-11-06. It scored the guidance frozen at `5ba65a18` (`technical-prose.md`, SHA-256 `c71e7241…950572`). [PR #110](https://github.com/filipgutica/filip-stack/pull/110) closed unmerged, so that guidance is not on `main`; it remains at [`ad12297a`](https://github.com/filipgutica/filip-stack/blob/ad12297a1f81c1388568c206f5b0de10e1cd05b0/plugins/workflow/skills/technical-writing/references/technical-prose.md). The rules are in [prereg.md](prereg.md), and the judge calibration is in [calibration.md](calibration.md). The per-build numbers behind this page are in [results.json](results.json); the per-judge flag rates are in the table below. Raw prompts, pages, and replies stay on the machine that ran the probe.

Intervals are Wilson 95%.

## Decision rule

| Part | Result | Evidence |
| --- | --- | --- |
| 1. Reader success against base | Fails | Head won 2 pairs, lost 8, tied 5. One-sided sign test p = 0.989. Head win share 0.20 (0.06–0.51). |
| 2. Reader success against vanilla | Fails | Head won 2, lost 6, tied 7. |
| 3. No harm on every brief | Passes | Head met the M1, M2, and M3 limits on all three briefs, against base and against vanilla. |
| 4. Targeted failures against base | Fails | J3 (D3, restatement): 0 wins, 0 losses, 15 ties. Head's total M3 is 0, against 27 for base. |

Parts 1 and 2 use only the extractor and the reader, so the judges cannot change them.

No flag was raised. No win came from the builder model alone. No brief tripped the length flag, because head won no majority of pairs on any brief. Order disagreement stayed under 30% for every judge: Sol 6.1 0.08 (0.05–0.13), Astra 0.11 (0.07–0.17), Opus 5.5 0.16 (0.11–0.23).

## Reader measures

R1 is tasks passed. R2 is words read, through the block that states the last fact a task needs. A lower R2 is better.

| Brief | Arm | Tasks passed | R2 mean | Words mean |
| --- | --- | ---: | ---: | ---: |
| G1 how-to | vanilla | 10/10 | 285 | 772 |
| G1 how-to | base | 10/10 | 293 | 730 |
| G1 how-to | head | 9/10 | 403 | 739 |
| G2 explanation | vanilla | 10/10 | 418 | 879 |
| G2 explanation | base | 10/10 | 403 | 838 |
| G2 explanation | head | 10/10 | 485 | 837 |
| G3 tutorial | vanilla | 10/10 | 624 | 836 |
| G3 tutorial | base | 10/10 | 567 | 804 |
| G3 tutorial | head | 10/10 | 587 | 826 |

Task success over all briefs: vanilla 30/30 (0.89–1.00), base 30/30 (0.89–1.00), head 29/30 (0.83–0.99).

The one failed task (G1, attempt 3, task 1) gave the right steps but did not say that the reader repeats the reading. The grading rule needs "repeat" or "again". The result does not depend on it: base wins that pair on R2 either way.

### Where head loses reading distance

The dry run predicted these two cases. Both follow from the ordering rules the guidance adds:

- **G1 task 2:** head put the Kestrel-04 total-and-outlet check at 0.64 of the page, on average. Base put it at 0.31 and vanilla at 0.27. In the head pages the check is the last step of the procedure. In base and vanilla pages it appears early, as the expected result. Mean depth for this task: head 468 words, base 228, vanilla 208.
- **G2 task 1:** head read 438 words, against 339 for base and 347 for vanilla. The head explanations state the problem first, so the defining facts come later.

These are diagnostics. The measures were fixed before the run and are not changed here.

## Judge measures (head against base)

A judge counts on a question only when it passed calibration. A pair verdict needs both orders to agree, then the counted judges to agree.

| Question | Head wins | Losses | Ties | Note |
| --- | ---: | ---: | ---: | --- |
| D1 false fact | 0 | 0 | 15 | |
| D2 buried key point | 0 | 0 | 0 | No judge counts |
| D3 restatement | 0 | 0 | 15 | Saturated: see below |
| D4 vague example | 0 | 0 | 15 | |
| D5 filler | 0 | 0 | 15 | |
| D6 case dropped (tutorial) | 0 | 0 | 5 | |
| D7 concept before its problem (explanation) | 1 | 0 | 4 | |
| P1 hidden actor | 0 | 2 | 13 | |
| P2 hidden verb | 0 | 0 | 15 | |
| P3 more than one idea | 0 | 0 | 15 | |
| P4 formal word | 2 | 1 | 12 | |
| P5 noun string or double negative | 7 | 0 | 8 | p = 0.008; all three judges, no builder-only win |

**D3 is saturated.** Every judge flagged every head and every base page in both orders: 30 of 30 each. That includes Opus, the only judge that counts on D3; its calibration false-alarm rate was 1 in 14. So the judges could not tell the pages apart on restatement. This is not evidence that head repeats more than base.

### Flag rates by judge

Each cell is the number of page-orders flagged, out of 30, or out of 10 for D6 and D7. "H" is head, "B" is base.

| Question | Sol 6.1 H / B | Astra H / B | Opus 5.5 H / B |
| --- | --- | --- | --- |
| D1 | 0 / 0 | 0 / 0 | 1 / 0 |
| D2 | 0 / 2 | 0 / 5 | 6 / 9 |
| D3 | 30 / 30 | 30 / 30 | 30 / 30 |
| D4 | 0 / 0 | 0 / 0 | 0 / 3 |
| D5 | 24 / 24 | 21 / 20 | 30 / 26 |
| D6 | 0 / 0 | 0 / 0 | 0 / 0 |
| D7 | 0 / 2 | 0 / 3 | 0 / 10 |
| P1 | 10 / 5 | 11 / 8 | 13 / 9 |
| P2 | 1 / 1 | 5 / 5 | 23 / 19 |
| P3 | 5 / 9 | 14 / 12 | 29 / 24 |
| P4 | 6 / 10 | 8 / 10 | 19 / 20 |
| P5 | 2 / 20 | 5 / 18 | 18 / 25 |

## Other diagnostics

None of these changes the verdict.

| Measure | Vanilla | Base | Head |
| --- | ---: | ---: | ---: |
| M3 agent-only facts, all briefs | 18 | 27 | 0 |
| M7 near-duplicate sentence pairs, all briefs | 30 | 42 | 53 |
| M7 on G1 / G2 / G3 | 7 / 12 / 11 | 11 / 6 / 25 | 13 / 6 / 34 |
| Explanation concepts motivated first (G2) | 0.67 | 0.93 | 0.87 |
| How-to concepts motivated first (G1) | 1.00 | 1.00 | 0.60 |
| Tutorial ends on what the reader can do (G3) | 1 of 5 | 0 of 5 | 5 of 5 |
| Worked case used in body sections (G3) | 0.74 | 0.73 | 0.83 |
| Flesch-Kincaid grade, G1 / G2 / G3 | 8.2 / 12.2 / 7.3 | 7.2 / 11.5 / 6.2 | 6.9 / 10.9 / 5.8 |

- **M3:** head left out every agent-only fact. Base leaked 27 and vanilla 18.
- **M7:** head has more near-duplicate sentence pairs than base on G1 and G3. That runs against the rule to say a point once. M7 is reported as registered. It does not replace J3, because Opus counts on D3.
- **Endings:** every head tutorial ends on what the reader can now do. No base tutorial does.
- **Double-coding:** Astra re-extracted 9 builds. Agreement with the Sol 6.1 extractor was 0.988 (0.971–0.995).

## Protocol deviations

Neither deviation changes any measure that parts 1–3 use.

1. **Concurrency.** The prereg allows at most 8 calls at once. Builds ran in batches of 8. From the first extractor batch on, the runner sent 10 calls at once.
2. **Judge call retried without approval.**
   - What happened: the runner mistyped the prompt folder in one Sol 6.1 judge task, so the call could not read its prompt. It replied with a read failure and wrote no reply file.
   - What the rules say: the prereg treats a read failure as an unusable reply, which stops the run until Filip approves a retry. Amendment 2 says: "A call that fails in transport may be retried once from the spare calls without asking: a timeout, an empty reply, or no reply file. Any other unusable reply still stops the run." This call had no reply file, but it also replied with a read failure. Amendment 2 does not say which applies when both are true, so whether it covers this case is ambiguous.
   - What the runner did: it re-sent the same, unchanged prompt file with the corrected path and kept dispatching. The retry succeeded.
   - Cost: the run made 325 calls, against 324 registered and an upper limit of 340.
   - Effect on the result: the call fed only Sol 6.1's votes on one order of one pair. Rule 4 fails on D3, where only Opus counts, and rules 1 and 2 do not use judges.

## Calls

| Stage | Calls |
| --- | ---: |
| Calibration | 90 |
| Builds | 45 |
| Extractor | 45 |
| Double-coding | 9 |
| Reader | 45 |
| Judges | 90 + 1 retry |
| **Total** | **325** |

Under the prereg, the guidance is not revised or rerun without Filip's approval.
