# Guide-body probe: calibration results

Paid calibration ran on 2026-11-05: 90 calls, none unusable. It ran before any build, and this summary was committed before the first build call.
The rules are in [prereg.md](prereg.md), under Calibration. A judge counts on a question when it catches at least 3 of 4 planted defects in both orders, and raises false alarms in at most 20% of the pairs where the question applies. Intervals are Wilson 95%.

## Defect questions

| Question | Judge | Catches | Catch interval | False alarms | False-alarm interval | Counts |
| --- | --- | ---: | --- | ---: | --- | --- |
| D1 false fact | Sol 6.1 | 4/4 | 0.51–1.00 | 1/14 | 0.01–0.32 | yes |
| D1 false fact | Astra | 4/4 | 0.51–1.00 | 4/14 | 0.12–0.55 | no |
| D1 false fact | Opus 5.5 | 4/4 | 0.51–1.00 | 1/14 | 0.01–0.32 | yes |
| D2 buried key point | Sol 6.1 | 4/4 | 0.51–1.00 | 3/14 | 0.08–0.48 | no |
| D2 buried key point | Astra | 4/4 | 0.51–1.00 | 4/14 | 0.12–0.55 | no |
| D2 buried key point | Opus 5.5 | 4/4 | 0.51–1.00 | 4/14 | 0.12–0.55 | no |
| D3 restatement | Sol 6.1 | 4/4 | 0.51–1.00 | 3/14 | 0.08–0.48 | no |
| D3 restatement | Astra | 4/4 | 0.51–1.00 | 3/14 | 0.08–0.48 | no |
| D3 restatement | Opus 5.5 | 4/4 | 0.51–1.00 | 1/14 | 0.01–0.32 | yes |
| D4 vague example | Sol 6.1 | 3/4 | 0.30–0.95 | 0/14 | 0.00–0.21 | yes |
| D4 vague example | Astra | 2/4 | 0.15–0.85 | 0/14 | 0.00–0.21 | no |
| D4 vague example | Opus 5.5 | 4/4 | 0.51–1.00 | 0/14 | 0.00–0.21 | yes |
| D5 filler | Sol 6.1 | 4/4 | 0.51–1.00 | 2/14 | 0.04–0.40 | yes |
| D5 filler | Astra | 4/4 | 0.51–1.00 | 1/14 | 0.01–0.32 | yes |
| D5 filler | Opus 5.5 | 4/4 | 0.51–1.00 | 1/14 | 0.01–0.32 | yes |
| D6 case dropped | Sol 6.1 | 3/4 | 0.30–0.95 | 0/5 | -0.00–0.43 | yes |
| D6 case dropped | Astra | 3/4 | 0.30–0.95 | 0/5 | -0.00–0.43 | yes |
| D6 case dropped | Opus 5.5 | 3/4 | 0.30–0.95 | 0/5 | -0.00–0.43 | yes |
| D7 concept before its problem | Sol 6.1 | 3/4 | 0.30–0.95 | 0/5 | -0.00–0.43 | yes |
| D7 concept before its problem | Astra | 4/4 | 0.51–1.00 | 0/5 | -0.00–0.43 | yes |
| D7 concept before its problem | Opus 5.5 | 4/4 | 0.51–1.00 | 0/5 | -0.00–0.43 | yes |

## Plain-language pairs

A judge counts on P1–P5 when it marks more problems on the "before" version than on the "after" version in at least 6 of 8 pairs, in both orders.

| Judge | Pairs passed | Interval | Counts |
| --- | ---: | --- | --- |
| Sol 6.1 | 7/8 | 0.53–0.98 | yes |
| Astra | 7/8 | 0.53–0.98 | yes |
| Opus 5.5 | 6/8 | 0.41–0.93 | yes |

## Judges that count

| Question | Judges |
| --- | --- |
| D1 | Sol 6.1, Opus 5.5 |
| D2 | none |
| D3 | Opus 5.5 |
| D4 | Sol 6.1, Opus 5.5 |
| D5 | Sol 6.1, Astra, Opus 5.5 |
| D6 | Sol 6.1, Astra, Opus 5.5 |
| D7 | Sol 6.1, Astra, Opus 5.5 |
| P1–P5 | Sol 6.1, Astra, Opus 5.5 |

## What this means for the decision rule

- **J3 (restatement)** rests on Opus 5.5 alone. Sol 6.1 and Astra caught every planted restatement but raised false alarms in 3 of 14 pairs each, just over the 20% cap. J3 is not replaced by M7, because one judge counts.
- **D2 (buried key point)** has no counted judge. It is a diagnostic only, so the rule does not change.
- Catch rates come from pairs that differ only by the planted defects. They likely overstate how sensitive the judges are on head and base pages, which are written separately (Known limits).
