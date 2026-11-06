# UX guidance probe: dry run

Date: 2026-11-06

Status: scorer repairs verified and the final free pipeline completed. No paid model call has run. The paid run remains outside this PR, after merge and Filip's approval, with a hard ceiling of 72 calls.

## Changes since the original freeze

The original freeze was `a070ca6`. The [pre-registration amendment table](prereg.md#stated-changes-since-the-original-freeze) records every change. Guidance files and scripts under test are unchanged.

| Finding | Repair and direct evidence |
| --- | --- |
| S1 | `where` matches only the element; `what` matches only the problem. Fix text earns no credit. D6 requires an asserted token/palette problem rather than bare colour descriptors. All three added adversarial answers scored +1 on the original scorer and −1 after repair. |
| S2 | Saturation waives positive gain only against the saturated control. Review no-harm against both controls and at least 2 successful head builds remain required. Artifact-based scoring regressions reproduce the original false support. |
| S3 | Every Codex judge tool event invalidates the run; all inputs are attached or inline. The validator rejects discovery commands, relative reads, and shell expansion. `validate` now exits nonzero on a problem. |
| S4 | A residual guidance identifier stops bundling before judge prompts, ledger, or commands are produced. The check covers identical files too, and removes stale runnable commands from earlier bundles. |
| S5 | Fixture secrets and created dates are deterministic. Captures use a fixed clock, 2026-11-06T12:00:00Z. Identical-build evidence is checked below. |
| S6 | Tasks require current field errors, visible secrets and list entries, and a successful second submission after a visible failure. A `?fail=once` API scenario permits recovery without changing the page URL. |
| S7 | A scorer-side navigation adapter waits for all three seeded names before the unchanged `ui-check` screenshots and scans. A defect appearing after a 4-second API delay fails the adapted scan; the unadapted scan incorrectly exits 0. |
| S8 | All 4 `ui-modes` overflow rows are excluded from scoring, including text-200. Ordinary reflow belongs to `ui-check`. No independent calibration established extra mode-specific overflow detection, so that evidence is not claimed. The 12 behavioral task checks remain. |
| S9 | The PR replaces repeated CI results with runnable, free reviewer steps for self-tests, frozen hashes, and local browser calibration. |

The key's rule text and D6 patterns, three adversarial answers, two duplicate-case removals, and new build calibration files change the local hash manifest. The review pages and decoys are unchanged. Their content remains outside Git.

## Scorer and test value

`probe.py selftest` passes 25 of 25 cases: 20 local review answers and 5 judge parsing cases. The original scorer passed its original 24 cases while mis-scoring all three new false findings.

`scorer_test.py` passes three owner-boundary tests. Running those tests against the original scorer produces eight failing subcases: four unsupported verdicts, three accepted commands, and one unblocked bundle.

### Coverage record

Each entry names its owning boundary. No production export, flag, or hook exists only for tests.

| Added or changed test | Behavior and regression protected | Existing coverage that missed it |
| --- | --- | --- |
| `selftest/R1-fix-leak.txt` | A false contrast finding about summary labels remains −1 even when its fix names legal-text contrast. | `R1-nearmiss` did not put the planted element in fix text. Original result: +1. |
| `selftest/R2-fix-leak.txt` | Purple role badges claimed to rely on colour alone are X3, not D6, including when the problem repeats “purple”. | `R2-nearmiss` omitted purple; field separation alone still credited the descriptor in the problem. Original result: +1. |
| `selftest/R3-fix-leak.txt` | A false Save prominence finding remains −1 when its fix suggests a focus ring. | `R3-nearmiss` did not suggest the planted defect's fix. Original result: +1. |
| `scorer_test.py:test_saturation_retains_no_harm_and_build_success` | Real score artifacts cannot support review harm against either control or 0/1 successful head builds; saturated ties with 2 builds and unsaturated positive gains remain eligible. | The old self-test covered tally and judge parsing, not final verdicts. Four negative subcases were falsely supported on baseline. |
| `scorer_test.py:test_codex_judge_rejects_all_execution` | Judge traces reject discovery, relative reads, and shell expansion, while plain reasoning/replies remain allowed. | Existing path heuristics accepted all three commands. No new shell allowlist duplicates confinement. |
| `scorer_test.py:test_bundle_blocks_residual_markers_even_in_identical_files` | A trailing identifier blocks the actual bundle operation, including identical source files and stale commands. | Existing marker counts did not stop judge preparation. Baseline produced bundles. |
| `calibrate.mjs:bad-error` | An existing `aria-errormessage` without a current error fails the empty-name task. | Valid reference builds cannot expose this false pass. Original task accepted it. |
| `calibrate.mjs:hidden-secret` | A hidden input cannot satisfy the user-visible secret outcome. | The readonly-input reference proves permitted markup, not hidden-output rejection. Original task accepted it. |
| `calibrate.mjs:hidden-list` | Hidden text cannot satisfy the visible key-list outcome. | Existing name-count matching accepted hidden text. Original task accepted it. |
| `calibrate.mjs:message-list` | A status message that names the key cannot stand in for a visible list entry, on create or on retry. | `hidden-list` hides the entry but keeps it in a list; text matching anywhere still passed here. The `f61efd6` task accepted both cases. |
| `calibrate.mjs:definition-list` | A visible entry in other list markup, here `dl`/`dt`/`dd`, counts as listed on create and on retry. | The other builds all use `ul`/`li`. The `5a4551d` row-or-list-item task rejected both cases. |
| `calibrate.mjs:masked-list` | A list that shows a masked secret ending in the last four counts as listed; the masked copy does not replace the full secret. | `reference2` shows no masked copy. The `ff02633` task took the masked match and rejected both cases. |
| `calibrate.mjs:secret-panel` | A secret panel that shows the name and last four beside the full secret in a field is not a list entry, on create or on retry. | `message-list` names the key without the last four. The `ff02633` task accepted both cases. |
| `calibrate.mjs:stale-alert` | An unchanged hidden alert cannot satisfy failure reporting. | Existing live-region text matching ignored visibility and freshness. Original task accepted it. |
| `calibrate.mjs:no-retry` | An enabled button whose second submission does nothing fails recovery. | The old task never retried. Original task accepted it. |
| `calibrate.mjs:delayed-overflow` | The actual frozen scanner must see seeded rows before scanning populated overflow. | Static clean/planted review pages cannot expose asynchronous scan timing. Unadapted exit 0; adapted exit 1 with overflow. |
| `ux-tasks.mjs:empty name` | Native `:user-invalid` or current visible associated error text establishes submission feedback. | Existing bare ARIA-reference/invalid-state checks could pass without feedback. Owned by the task's browser calibration above. |
| `ux-tasks.mjs:create` | Both secret and listed name must be visible after submission. | Hidden input values and hidden text counts passed before. Owned by the two distinct output calibrations above. |
| `ux-tasks.mjs:failure recovery` | A newly visible failure keeps the name; a second submission creates the key. | Enabled-button-only proof never observed a retry. Owned by stale-alert and no-retry calibrations. |

| Removed test or gate | Remaining proof or retired contract |
| --- | --- |
| `selftest/R2-empty.txt` | `R1-empty.txt` runs the identical `NONE` input through the same shared finding parser and expects score 0, false 0. No page-specific pattern runs for `NONE`. |
| `selftest/R3-empty.txt` | Same canonical `R1-empty.txt` proof; both removed files had identical inputs and expectations. |
| `ui-modes:no horizontal overflow`, all 4 modes | Drop the overlapping counted gate. `ui-check` retains ordinary reflow at 320/375/1280 in light/dark, empty/populated. Mode-specific overflow has no independent calibrated risk and is diagnostic only. |

The local build calibration runs 20 outcomes: ten valid tasks (two references, `definition-list`, and `masked-list`), nine targeted adversarial tasks, and one delayed populated scan. All match. Each adversarial case fails with the original task/scanner and passes with the repair. References use custom field errors and native validation respectively; one shows the secret in a readonly input. Cross-product mutant checks were omitted because each defect has one task owner.

## Guidance and isolation

The arms rebuilt to the original bundle hashes:

| Arm | Files | Markdown words | Bundle sha256 |
| --- | ---: | ---: | --- |
| vanilla | 0 | 0 | `e3b0c442…b855` |
| base | 3 | 2,441 | `88f344a4…a74d` |
| head | 7 | 3,180 | `47748d82…a7b9` |

`interface-design`, `ui-check.mjs`, and `ui-modes.mjs` are byte-identical to the original freeze. The scorer-side adapter changes when scanning starts; the skill's checks stay untouched.

The free rerun points Claude's exact command at `mock.mjs`. Codex's exact command points at the refusing `listen.mjs` provider, using a dummy local key, empty judge HOME, and scratch CODEX_HOME. No credentials are copied. Synthetic Codex replies exercise score parsing after capture; they are not model judgments.

First-request equivalence is checked after normalizing random folder/workspace names and session identifiers. The original confinement evidence remains: restricted outside reads/writes are refused, and successful outside reads invalidate the trace. Any paid Codex tool event now invalidates the run, regardless of path. The first real Codex trace still needs manual inspection for event-format and login contamination, as preregistered.

## Gates and evidence

Browser tools: Playwright 1.65.0, `@axe-core/playwright` 4.14.0, Chromium 158.0.8127.18. They are installed in scratch space. All browser verification ran outside the sandbox; no Chromium check remains blocked.

The second valid reference independently passes the frozen runners: `ui-check` reports 0 axe nodes, 0 of 12 overflowing pages, and 6 off-token values; `ui-modes` reports 16 raw passes, with 12 behavioral passes counted. Token values remain diagnostic, as preregistered.

Ordinary reflow has one counted owner, `ui-check`. We dropped `ui-modes` overflow counting rather than claim extra defect coverage without a per-defect, per-mode calibration. Its raw four overflow results remain available for inspection. Behavioral tasks still exercise reduced motion, dark, text-200, and grayscale.

The original static review-page calibration is unchanged: clean pages had 0 axe nodes, 0 of 18 overflowing views, and 0 off-token values; planted pages had 27, 4 of 18, and 12. `ui-check` reports evidence for four planted defects; three affect its exit status. Off-token colour remains diagnostic. Five planted defects need judgment.

## Final pipeline rerun

The rerun completed prepare → fake attempts → validate → tally → gates → screenshots → blind bundles → fake/captured judges → validate → score. It used one attempt per task per arm, without a paid endpoint. After tightening D6, tally and score reran against the final key with the same results.

| Stage | Result |
| --- | --- |
| Prepare and attempts | 12 workspaces and 12 exact Claude commands against the local fake model. |
| First requests | Identical within each task after normalization. Reviews: 15,502 bytes; builds: 15,007. No user-guidance marker; the fixture's `DESIGN.md` is expected. |
| Tally | 9 scored review replies, mean 3.0 in every arm, 0 false findings, 0 unparsed replies. |
| Isolation | 18 traces checked: 12 attempts, 2 fake Opus judges, 4 capture-only Codex judges. No problems. |
| Head and base builds | Both `ui-check` exit 0, 0 axe nodes, 0 of 12 overflow; both 12/12 counted behavioral tasks; both 15/15 screenshot states. |
| Bare vanilla stub | `ui-check` exit 2 because seeded rows never appear; 0/12 behavioral tasks; 6/15 screenshot states. Fails gates. |
| Deterministic evidence | Head and base wrote identical implementations. All 15 PNG pairs are byte-identical. Their bundle contains 0 differing screenshots and 0 differing source files. |
| Blind bundles | 2 pairs; 0 residual markers. Head vs vanilla has 30 screenshots and 3 source files. |
| Judges | 2 Opus replies through the fake model; 4 Codex requests captured and refused locally, followed by synthetic replies solely for scoring. |
| Final score | `not supported; positive review gain waived against saturated controls; no-harm retained`. No void pair or short review arm. This is a synthetic pipeline result, not a guidance verdict. |
| Frozen files | All 19 scorer-file hashes and 150 local calibration-file hashes verify; original arm bundle hashes still match. |
| Repository checks | `pnpm install --frozen-lockfile`, `pnpm check`, and `git diff --check` pass. Fallow 3.18.0 audit passes; its configured scope excludes `docs/evidence`, so it adds no scorer correctness evidence. Its `doctor` subcommand is unavailable in this installed version. |

One preliminary free rerun was stopped before completion while readiness and task timeout handling were finalized. The results above come from the subsequent complete rerun. All endpoints in both reruns were local; no paid call occurred.

## Engineering ledger

- **Simpler version:** splitting tally fields fixes S1 alone, but leaves false support, judge contamination, invisible task outcomes, and asynchronous scans. A fixed sleep before scanning does not prove populated content arrived. The unchanged scanner exposes no readiness option, so the scorer adapts its navigation boundary.
- **Readability:** `review_gain_waived` records the saturation exception beside the always-required review result. `raw_exit` and `counted` distinguish the runner's 16 raw checks from 12 scored behavioral checks.
- **Scope:** only study scorer/fixture/test support and the two study records change. No skill or guidance file changes. Public calibration content stays local. Against `a070ca6`: tooling/fixture +90/−27 lines; gates, regressions, and calibration support +171/−33; records +190/−207. The only adjacent cleanup closes judge reply files, whose repeated reads exposed resource warnings in verdict regression runs.
- **Reuse:** reuse `ui-check` and `ui-modes` unchanged, their real CLI boundaries, existing `waitFor`, and the local fake model. `ready-check.mjs` owns readiness because the frozen CLI has no hook. `listed` replaces a raw count with a browser visibility predicate. `failureLines` replaces stale live-region matching with current rendered text. `calibrate.mjs` runs the same task module against local pages; `scorer_test.py` consumes real run artifacts rather than duplicating the verdict algorithm.
- **Coverage:** the tables above map every added/changed check and both removed tests to observable behavior and baseline evidence. No independent review ran in this implementation sub-agent; final acceptance belongs to the parent.

## Paid-run stop point

No paid call or merge is authorized here. The paid run remains 54 attempts plus 18 judges: 60 Opus calls, 6 Astra calls, and 6 Sol calls, at the registered effort. No retry fits beyond the hard 72-call ceiling without separate approval.

After merge, Filip must approve the paid run and sign Codex in to a scratch home. The protocol runs the first three review attempts and first Codex judge as stop checks. Raw requests, traces, workspaces, screenshots, calibration pages, decoys, and the answer key remain local.
