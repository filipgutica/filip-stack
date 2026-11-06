# Writing-rules probe: calibration and headroom results

**Not ready for a paid efficacy probe.** Base passes all four tasks on both the initial and harder scenarios. The single authorized harder rerun did not create headroom. No paid-probe call ran, and no writing rule is supported for release by this preparation.

## Headroom

| Scenario | H1 | T1 | Total | Mean page words |
| --- | ---: | ---: | ---: | ---: |
| Initial: installed tool, fresh shell, no login or setup | 2/2 | 2/2 | **4/4 (100%)** | 455.00 |
| Harder: fresh machine, new shell, expired-reservation recovery | 2/2 | 2/2 | **4/4 (100%)** | 391.75 |

The initial 100% rate exceeded 80%, triggering the frozen harder scenarios. Both attempts were rebuilt for each brief. The harder rate also exceeded 80%. No further scenario revision or model call was made. H2 and T2 have not been built or read; neither head nor vanilla has been built.

These are corrected semantic completion rates. Two instrument failures were found and preserved:

- The initial citation-gated implementation reported 1/4. Citation copying across Markdown and nonadjacent passages caused false task failures. Completion now depends on page-supported command operations, required observations and prerequisite order; quotation copying is diagnostic.
- The harder implementation initially reported 0/4 because derived renewal keys truncated `.plan` filenames. Original sources, original writer checklists and all reader plans agreed on the full filenames. Correcting that conversion error gives 4/4 on the unchanged replies. A source-independent cross-step filename regression failed before repair and passes afterward.

Both corrections are dated in the [pre-registration](prereg.md). They use no paid-arm outcomes. The original scores, input hashes, pre-repair key and raw replies remain in the external run record. These preparation results are instrument debugging and a ceiling warning, not an efficacy result.

## Judge calibration

| Judge | Path caught | Path clean false alarms | Entry caught | Entry clean false alarms | Eligible items |
| --- | ---: | ---: | ---: | ---: | --- |
| Astra | 2/2 | 0/2 | 2/2 | 0/2 | Both |
| Sol 6.1 | 2/2 | 0/2 | 2/2 | 0/2 | Both |
| Opus 5.5 | 2/2 | 0/2 | 2/2 | 0/2 | Both |

Six calls covered two adapted Django exemplars, each with one clean and two separately planted copies. Labels were shuffled per judge and exemplar. Counts satisfy the frozen eligibility rule; this tiny sample does not establish broad judge reliability. No head/base comparison was judged.

## Calls, tiers and interruptions

| Part | Completed model calls |
| --- | ---: |
| Fresh writer | 1 |
| Calibration | 6 |
| Initial base builds/readers | 8 |
| Harder base builds/readers | 8 |
| **Used / cap** | **23 / 171** |

All 21 Codex calls used `priority`, before 16:00 fixed MST on 2026-11-06 (23:00 UTC). The two Opus calibration calls used high effort and no Codex tier. At or after that cutoff, new Codex calls must use `default`, even when their prompt was prepared earlier.

An intentional interruption and automatic approval refusals occurred before calibration child threads or output files were created. Recovery checked output files and the live thread inventory. A clock check and the parent's explicit calibration/dry-run authorization resolved the refusal. No finished call was resent; no model retry was used. All 23 model calls have response files. Automatic approval refusals that never reached a model are not counted as model calls.

The outer dispatch text named the base-only dry run to establish the approved scope. This leaked the arm label to builders/readers and deviated from intended blinding. Delegated prompts also cannot remove ambient host guidance. The four briefs share a strong procedural template. These limits require parent review before a later study.

## Frozen artifacts and next decision

- Head SHA-256: `b3610980c1d1ef86d63df952745952dd20f224aac8e9de29ac8ca930bda8c4ac`.
- [inputs.json](inputs.json) records original guidance and raw-material hashes. [freeze.json](freeze.json) freezes the amended pre-registration and final scorer.
- [results.json](results.json) contains portable aggregates. Full per-call files and sources stay outside the repository.
- The parent needs a new pre-run decision about task difficulty, isolation/blinding, and the requested mean gain of one binary task. That literal gain requires perfect head wins in all 20 pairs. This task does not change the threshold or authorize another probe.

## Verification

The eight focused scorer tests pass. The repository's required `pnpm check` exited 0 on Node v24.19.0 after the final scorer changes. Fallow audit exited 0 outside the sandbox; its pinned version lacks `doctor`, and it warned about the site's unresolved inherited Astro tsconfig. No JavaScript or TypeScript changed. Independent scorer review did not run; the parent owns that acceptance step.

## Implementation ledger

- Simpler version: reusing Study 1's `grade` and `depth_of` would keep literal phrase keys and reward early answers. It cannot check authentication, persistence, ordered execution or observable completion. The new scorer uses a command AST and a prerequisite graph, with no extra scoring-model calls.
- Readability: `command_meaning` compares executable operations and arguments; it does not match instruction prose. `score_reader` separates `pass` from `citationGrounded`, so a citation-copying defect cannot masquerade as a task failure. The prereg records the diagnostic's demotion after the initial dry run.
- Scope: zero production-runtime or live-guidance lines change. Added study code: 416 scorer lines and 59 prompt lines. Added tests: 93 lines. All added executable code and tests are study-local Python; the head guidance file is an evidence snapshot. The lab notebook is the required cross-study index. No version, package manifest, lockfile, website, PR or release changes are included.

### Reuse

| New functions | Existing code checked and reason for local ownership |
| --- | --- |
| `load`, `save`, `digest`, `key` | Study 1's `load`, `dump`, `briefs` and #110's `key` have the same small I/O pattern. Local standard-library helpers avoid importing old prompt modules and source schemas. `digest` owns the new frozen-input check. |
| `normalize`, `grounded_quote`, `command_meaning`, `page_commands`, `fact_value`, `score_reader` | Study 1's `norm`, `grade`, `has`, `depth_of` and `blocks` operate on answer strings or word positions. They do not interpret CLI operations, permit independent setup order, or separate citation quality from completion. |
| `tier`, `reserve`, `initialize`, `judge_prompt`, `prepare_builds`, `prepare_readers`, `prepare_calibration`, `prepare_judges` | Study 1's `prompt_file`, `cmd_arm`, `cmd_builds`, `cmd_reads` and #110's `init`/`calib-init` informed opaque paths and local ledgers. They bundle different guidance, tasks or calibration units. This study's helpers prepare files only and never call models. |
| `scored_rows`, `dry_score`, `calibration_score`, `collect_votes`, `decision`, `main` | Study 1's `task_rows`, `pair_scores`, `compare`, `main` and #110's calibration scorer assume different task units and response schemas. The new functions require complete cells, literal binary-task thresholds, and per-item eligibility from six calibration packs. |

### Coverage

The old studies have no existing test for this new execution schema. The filename invariant was confirmed red on the truncated key before repair, then green on the source-correct key. Each added test protects a separate risk:

| Test | Regression caught |
| --- | --- |
| `test_plan_filename_is_preserved_across_the_entire_path` | Renewal or another plan operation using a filename different from the one preview created; this catches a key-conversion bug that answer fixtures alone missed. |
| `test_complete_paths_and_alternative_independent_order` | Rejecting a complete task or forcing an unsupported order among independent setup steps; covers four briefs and both scenarios. |
| `test_missing_authentication_persistence_and_confirmation_fail` | Passing a plan that skips authentication, future-shell persistence or remote confirmation. |
| `test_execution_before_approval_cannot_be_hidden_by_duplicate` | Hiding an invalid early execution behind a later repeated command. |
| `test_acknowledgment_is_not_completion_and_citations_are_diagnostic` | Counting a submission acknowledgment as completion, letting a fabricated command pass when absent from the page, or confusing citation copying with task failure. |
| `test_semantic_syntax_and_number_words` | Rejecting equivalent flag order, quoting, `--flag=value`, or an equivalent numerical observation. |
| `test_citations_across_markdown_and_explicit_omissions` | Failing citation diagnostics solely because of list numbers/fences, or accepting reordered/invented fragments. |
| `test_literal_binary_gate_and_incomplete_data` | Producing a verdict from incomplete cells or silently weakening the mean gain of one binary task. |

No existing test was removed. A new assertion that made an unsupported quotation fail completion was changed during dry-run instrumentation repair: exact quotation copying is not a required task-completion item in the brief. Its distinct provenance diagnostic remains tested.
