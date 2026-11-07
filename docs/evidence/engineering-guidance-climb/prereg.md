# Engineering guidance probe: pre-registration

Status: frozen on 2026-11-06, before any paid call. The climb in [card.md](card.md) chooses the head. This probe decides whether it ships.

## Question

Does the climb's final engineering guidance leave holdout-task code in better shape than `main` and vanilla do, with confirmed correctness no worse than either and total tokens within 1.3 × vanilla?

## Frozen inputs

| Input | Value |
| --- | --- |
| Head | The climb's final scoped files, recorded by SHA-256 when the climb ends. |
| Base | `origin/main` at `83f318e39d6b49a311e95968fa0b6b9fff858457`. Built version digest `477584fa…0999`. |
| Controls | Vanilla; Superpowers `0722921d`, tree digest `70813996…749b`. |
| Tasks | `testem-per-launcher-reports` and `dateutil-rfc5545-timezone-interop` at `datacurve-ai/deep-swe@0b9fabbb`. |
| Runner, reviewer, measurements | As on the card. |
| Judges | The judges that passed calibration, with the same prompt as the climb rounds. |

## Runs

- Four arms (vanilla, Superpowers, base, head), 5 repeats each, randomized order: 40 coding attempts and 40 reviews. dateutil runs in the coverage evaluation and testem in the no-coverage evaluation, with identical coding settings, as the card's Configs field describes. Both evaluations start fresh; neither reuses earlier attempts.
- A pair is one task and one attempt index. Each comparison has 10 pairs.
- Judge comparisons: head against base, head against vanilla, and head against Superpowers. Each judge gets one call per task and comparison: 18 calls.

## Decision rule

Head ships only when all four hold:

1. **Correctness:** head's confirmed passes are at least vanilla's and at least base's, over 10 attempts each.
2. **Tokens:** head's mean over tasks of per-task median total coding tokens is at most 1.3 × vanilla's.
3. **Mechanical:** head passes the card's mechanical gate against base.
4. **Pairs:** head gets at least 8 of 10 weighted pair wins against base and at least 8 of 10 against vanilla. Pairs are decided as on the card: a pair where exactly one side has confirmed correctness goes to that side, and judges decide the rest. Eight of ten is a one-sided sign test at p = 0.055; the probe is directional, not conclusive.

Head against Superpowers is reported. It does not change the verdict.

## Flags

These are reported and do not change the verdict:

- **Task-only win:** head wins rule 4 against base on only one of the two tasks.
- **Correctness-led win:** more than half of head's pair wins against base come from pairs where only head passed. Then the result reflects correctness more than code shape.
- **Activation:** fewer than 80% of head attempts read `engineering/SKILL.md`.

## Calibration (before the pilot)

- Planted-defect pairs from the reference solutions of two climb tasks. Each pair holds the clean reference and the same reference with one planted defect: an unneeded layer, a dead helper, a leaked internal export, or a duplicated test.
- A judge is eligible when it prefers the clean side in at least 5 of 6 pairs. At least two judges must be eligible, or the climb stops.
- Reviewer calibration is a proxy: one direct Codex `gpt-6-astra` call per pair, with the review standard, outside PluginBench's review path. The reviewer sees each side of a pair in a separate call. It flags a defect when a finding names the planted symbol, or its file and line. It must flag the planted defect in at least 5 of 6 defect sides, and its high plus medium findings on the clean sides are reported as its false-alarm level. Otherwise review findings become a reported diagnostic and leave the gate. The proxy uses 12 calls.

## Stop rule

- Any call that leaves no usable result gets one retry. A second failure stops the phase.
- An attempt that times out keeps its PluginBench result, which counts as not confirmed.
- If the probe fails any rule, `main` keeps its guidance.
