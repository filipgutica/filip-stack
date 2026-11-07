# Engineering guidance climb: calibration

Date: 2026-11-07, before the pilot's first coding call. Inputs: the six planted-defect pairs from [harness/build-calibration.py](harness/build-calibration.py), the [judge prompt](harness/judge-prompt.md), and the [review standard](harness/review-standard.md). Calls: 15, with no retries.

## Judges

Each judge made one call over all six pairs. The A/B side of each pair was drawn with seed 20261106.

| Pair | Planted defect | Defect side | Astra | Sol 6.1 | Opus 5.5 |
| --- | --- | --- | --- | --- | --- |
| 1 | Single-use `MaybeCollector` class | A | clean | clean | clean |
| 2 | Unused `allJust` helper | A | clean | clean | clean |
| 3 | Exported internal `unsafeJustValues` | A | clean | clean | clean |
| 4 | Second `describe` repeating the same tests | A | clean | clean | clean |
| 5 | Unused `_alias_count` method | A | clean | clean | clean |
| 6 | Single-use `AliasValidationRunner` | B | clean | clean | clean |

Every judge preferred the clean side in 6 of 6 pairs, so all three are eligible. Every reason named the planted symbol. In pair 3, all three also noticed a behavior change that the leaked helper caused: `Array.from` reads the whole iterator, so `sequence` no longer stops at the first failure.

Limit: the seeded draw put the defect on side A in five pairs. Every judge chose A in pair 6, where A was the clean side, but one pair is weak evidence against a position bias. Climb rounds draw sides per pair and report how often each judge chose A.

## Reviewer proxy

One Codex `gpt-6-astra` call per side, with the review standard. This proxy runs outside PluginBench's review path.

| Measure | Result |
| --- | --- |
| Defect sides with a finding that names the planted symbol | 6 of 6 |
| Clean sides with a finding that names a planted symbol | 0 of 6 |
| High plus medium findings per clean side | 4 to 8, mean 5.8 |

The clean-side findings are mostly real gaps in the reference solutions. Examples: `traverse` accepts `ReadonlyArray` where the task asks for `Iterable`; the toolbelt helpers repeat the new Maybe combinators; neither reference adds tests. So the count is the reviewer's baseline level on reference-quality code, not a false-alarm rate. Review findings stay in the mechanical gate.
