# Reader pages probe: dry run 3

Date: 2026-11-05

Status: complete. All 15 calls succeeded without retries. The scorer ran successfully, and every build read only its own arm file. The approved paid run can proceed.

This repeats dry run 2 on B1, with one attempt per arm. It checks the pipeline and gives no study verdict.

## Setup

| Item | Value |
| --- | --- |
| Base | `0fc048d4e2a843995e2cb5fb842cd3c48a40ee1c`, current `origin/main` at arm creation |
| Head | `f6997da132e1e774e25f6d1497a66eb70ddcba76`, merge of main into PR #99 |
| Arm words | Vanilla 0; base 1,707; head 2,973, from `build_arms.py --b1` |
| Models | Builds and extraction: Sol 6.1 high; comprehension: Sol 6.1 low; judges: Astra high, Sol 6.1 high, Opus 5.5 high |
| Call settings | `delegate_task`, async, general, shared; Codex service tier default; Opus fast mode false |
| Evidence | [dry-run-3/](dry-run-3/): arms, manifests, prompts, ledgers, dispatch records, traces, replies, isolation check, and scores |

The notebook conflict was resolved by retaining study 21, study 22, and both experiment logs. Main's breakpoint and visualization content and all G1–G7 edits remain. Node 24.19.0 `pnpm install --frozen-lockfile` and `pnpm check` passed. `fallow audit` passed its changed-file gate, excluding two inherited findings.

## Isolation and calls

The saved trace of each build contains one command: `cat` of its assigned randomly named arm file. No build read another file. The caller prompt is the rendered build prompt. Extraction, comprehension, and judge prompts were delivered as task text. All scoring traces contain no file-read commands.

| Call | Count |
| --- | ---: |
| Builds | 3 |
| Extractor | 3 |
| Comprehension | 3 |
| Judges | 6 |
| Double-coding | 0 |
| Total | 15 |
| Retries | 0 |

## Measures

| Measure | Vanilla | Base | Head |
| --- | ---: | ---: | ---: |
| M1 Fact recall | 1.000 | 1.000 | 1.000 |
| M2 Invented facts | 0 | 0 | 0 |
| M3 Agent-only leaks | 1 | 1 | 0 |
| M4 Opening job statement | 1 | 1 | 1 |
| M5 Start position | 0.214 | 0.145 | 0.199 |
| M6 Fragment rate | 0.133 | 0.125 | 0.083 |
| M7 AI tells | 1 | 0 | 0 |
| M8 Repeated sentence pairs | 0 | 0 | 0 |
| M9 Comprehension, of 3 | 3 | 2 | 3 |
| Words, metrics.py | 131 | 101 | 125 |

Head won all three overall judge votes against base and all three against vanilla. On this brief, no harm holds against both controls. Head improves M3, M6, and M9 against base. The four-brief decision is not decidable from this smoke test.

## Fixed protocol and limits

The guidance, scorer, briefs, fact sheets, keys, and decision rule were not changed. The scorer's existing clarifications remain: balanced judge order, Yes/No answer formatting where needed, and no M5 on B4. Neither proposed measurement change from dry run 2 was applied: notes sections retain the existing extractor definition, and the B1 facts row remains eligible for the fragment count.

The deployed host guidance remains a confound shared by all arms. The orchestrator automatically sends completed replies into the parent thread; the runner does not print reply contents and saves them from the thread record. No routing evaluation was run. The PR remains a draft.
