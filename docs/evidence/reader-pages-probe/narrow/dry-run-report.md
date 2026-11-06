# Narrowed probe: dry run on N1

Raw per-call files are not in this repository; they are at [PR #99's head commit](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/).

The tested [reader-pages.md guidance](https://github.com/filipgutica/filip-stack/blob/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/plugins/workflow/skills/technical-writing/references/reader-pages.md) is recorded at that commit; the setup below identifies each run's arm.

Date: 2026-11-05

Status: complete. The pipeline works after one fix, and the paid run can proceed. This is a pipeline check, not a study verdict.

## Setup

| Item | Value |
| --- | --- |
| Head | `c926026b`, the narrowed guidance |
| Base | `85522f76`, `origin/main`; its arm file is byte-identical to the paid run's base B1 arm |
| Arm words, N1 | Vanilla 0; base 1,707; head 3,002, from `build_arms.py --b1` |
| Models and settings | As in [prereg.md](prereg.md) |
| Evidence | [dry-run/](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/narrow/dry-run/): arms, manifest, ledgers, prompts, calls, traces, replies, isolation check, scores |

## Pipeline fault and fix

The first head build read its prompt file but not the arm file the prompt names. The one-line task said "read no other file", and the builder followed that over the prompt. Its reply was set aside in `dry-run/superseded/`. The build task now says to read "the one file it names". The rebuilt head build read exactly its prompt and arm files. Vanilla and base reads were correct the first time, and their builds were kept.

## Calls and isolation

| Call | Count |
| --- | ---: |
| Builds, including one rebuild | 4 |
| Extractor | 3 |
| Comprehension | 3 |
| Judges, head–base only | 3 |
| Total | 13 |
| Failures or timeouts | 0 |

With the brief writer, 14 of the 250 approved calls are used. The isolation check finds 0 violations: each build read its prompt and arm files, and each scoring call read only its prompt file. Every reply parsed and the scorer ran.

## Measures

| Measure | Vanilla | Base | Head |
| --- | ---: | ---: | ---: |
| M1 Fact recall | 1.000 | 1.000 | 1.000 |
| M2 Invented facts | 0 | 1 | 0 |
| M3 Agent-only leaks | 0 | 1 | 1 |
| M4 Opening job statement | 0 | 0 | 1 |
| M5 Start position | 0.241 | 0.094 | 0.235 |
| M6 Fragment rate | 0.000 | 0.091 | 0.000 |
| M7 AI tells | 0 | 3 | 0 |
| M9 Comprehension, of 3 | 3 | 2 | 3 |

All three judges preferred head over base. Base's comprehension miss on question (a) is a key limit: "entry names" does not contain the key word "entries". The key is fixed, so this stays as recorded for the paid run.
