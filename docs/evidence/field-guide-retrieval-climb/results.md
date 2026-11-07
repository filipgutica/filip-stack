# Field Guide retrieval climb: results

Date: 2026-11-06. The climb and probe followed [prereg.md](prereg.md). Result: **not supported**. `main` keeps its matching code.

## Climb

Council: Astra (`gpt-6-astra`), Sol 6.1 (`gpt-6.1-sol`), and Opus 5.5 (`claude-opus-5-5`), all at high effort. Astra and Sol 6.1 share a provider. Under the `score` rule, the only member calls were the three round 1 proposals.

| Round | Change | Score | Precision | Recall | No-relevant false injections | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Start | — | 32.00 | 22.22 | 57.14 | 19 | — |
| 1 | 45 function words added to `retrievalStopwords`, plus a test that fails on the start | 45.95 | 36.96 | 60.71 | 10 | Accepted |
| 2 | 18 more function words, including `need`, `needs`, `already`, `make`, `like` | 48.57 | 40.48 | 60.71 | 6 | Accepted |
| 3 | Drop matches under half the top overlap | 50.00 | 42.50 | 60.71 | 6 | Rejected: +1.43, below 2.0 |

All three members independently proposed the same main change: stop function words from satisfying the two-term overlap. `pnpm check` passed on every candidate, and each score was identical over two runs. The climb added 20 lines: 9 production and 11 test. It stopped when the queue was empty.

## Probe

The final version against base `83f318e` on the 32 held-out prompts:

| Part | Rule | Base | Head | Result |
| --- | --- | --- | --- | --- |
| 1 | Score at least 3.0 above base | 30.30 | 45.16 | Pass (+14.86) |
| 2 | No-relevant false injections not above base | 25 | 9 | Pass |
| 3 | Precision at least base − 3.0 | 20.83 | 40.00 | Pass |
| 4 | Recall at least base − 3.0 (52.56) | 55.56 | 51.85 | **Fail** |
| 5 | `pnpm check` | — | Pass | Pass |

Head lost one relevant record: p40, a request to check what the repository already has before adding a package, against r18, the dependency rule. Its only shared terms were `need` and `already`, which round 2 made stopwords.

## Post hoc

The following was not a decision input. The round 1 version scored 43.48 on the probe, with precision 35.71, recall 55.56, and 11 no-relevant false injections. It would have passed every part. Choosing it now would use probe data, so this probe cannot support shipping it.

## Lessons

- The core problem was precision. Function words such as "does", "same", "what", and "when" let unrelated records reach the two-term threshold.
- Some of round 2's words carry topic in real requests. "Need" and "already" are part of how people describe dependency choices. A stopword list should hold only words that never carry topic.
- The climb set had too few prompts to show that cost. One held-out prompt decided the result.

## Follow-ups

- Test the round 1 version on a fresh held-out set under a new pre-registration.
- Opus 5.5's relative cutoff (round 3) gave +1.43 on the climb set.
- Remaining misses need abbreviation or synonym matching, such as "PR body" for "pull request description" and "evals" for "evaluating".
