# Two writing rules: frozen pre-registration

Status: frozen before calibration and dry-run model calls on 2026-11-06. Only the fresh brief-writer call has completed. This task prepares the study and checks reader headroom. It does not authorize the paid probe or a guidance release.

## Question and precedent

Do two targeted additions help a reader complete a fictional CLI task, including authentication, current-session activation, and future-session setup? The page should preserve tutorial learning order and an operator's action order.

Study 1's [record](../writing-guidance-climb/results.md) failed its ship rule. Its depth reward favored answers first, including on tutorials. Literal phrase keys also rejected correct answers. This study measures ordered completion, without depth or answer-placement rewards. Its command interpreter compares operations and arguments, not answer prose.

These are custom writing probes because PluginBench runs coding tasks only. The judge calibration follows [the #110 precedent](../guide-body-probe/calibration.md) and lab notebook entry 24: each judge counts only on questions where it detects planted defects without false alarms. That precedent does not make new judges automatically eligible.

## Frozen inputs and arms

The full SHA-256 values are in [inputs.json](inputs.json). The base commit is `d80c974e`, refreshed from `origin/main` before creating this branch.

| Arm | Guidance |
| --- | --- |
| Vanilla | Empty file; no study guidance |
| Base | `technical-prose.md` from the base commit; SHA-256 `57dbbc5883dac1468b08340379080c7a364230651b8ef3cf5256f48fbaff40e3` |
| Head | [Frozen guidance](head-technical-prose.md); SHA-256 `b3610980c1d1ef86d63df952745952dd20f224aac8e9de29ac8ca930bda8c4ac` |

Head preserves base and adds these two rules verbatim from the supplied error analysis, section 3:

> For a how-to guide or a tutorial's setup section, group prerequisites, installation or activation, and the first invocation at the entry point, before detailed use-case lists or operational internals. Distinguish setup for the current session from setup for future sessions when both matter.

> For a how-to guide, present one complete path from the stated starting state to an observable result, ordered by the reader's decisions and actions. Put optional command or feature reference after that path, or link to it.

The arm copies have opaque paths. Builds differ only in guidance within each matched brief and scenario. Each fresh call is instructed to read only its supplied inputs. Ambient host instructions cannot be removed by that prompt; delegated calls do not provide the filesystem isolation of a fresh restricted harness. This is a study limitation, to be checked in the parent review before paid execution.

## Briefs and execution scenarios

A fresh, read-only Codex `gpt-6.1-sol`, high-reasoning writer produced H1, H2, T1 and T2 without seeing treatment guidance or old briefs. Its only write was the raw response artifact. Full sources stay outside the repository as `briefs.json`, frozen at SHA-256 `2338cc544f5415dbd1a07cb613c6ece878bd69b4ec9b68b1b4d67b24ba9a783b`. The portable scenarios and source-checked action rubrics are in [scorer/key.json](scorer/key.json).

| Brief | Type and worked case | Word limit |
| --- | --- | ---: |
| H1 | How-to: move Quaylet's north-api to blue | 440 |
| H2 | How-to: apply Retainro's 90-day invoice retention | 430 |
| T1 | Tutorial: publish Glowfolio's six-photo harbor proof sheet | 470 |
| T2 | Tutorial: publish Tidecards' eight-row reef practice deck | 460 |

Each has 3–5 named source parts, an in-passing authentication prerequisite, adjacent session/persistent setup steps, and optional reference material before its main procedure in the sources. The sources also specify preview, inspection, approval, execution, confirmation, and a recovery condition. All checklist evidence was checked against those sources before freezing. The four workflows share a strong structural template; they are fresh subjects, not four independent workflow families.

Each page has **one** execution scenario and one binary completion task. The initial starting state has the executable installed, no authentication, no activation, and no startup configuration. Its goal includes both immediate use and future shells. The harder variant adds a fresh machine, a new login-shell boundary before task context, and renewal of an expired reservation. Both variants are frozen now.

Builders receive the same starting state and goal as readers. In the harder rerun, the original installed-machine opening is replaced with the same audience, page type, worked case and word limit plus the harder scope. This prevents scoring fresh-machine requirements against a page commissioned only for an installed machine.

## Primary measure and rubric

Builder: Codex `gpt-6.1-sol`, reasoning high. Reader: Codex `gpt-5.6-sol`, reasoning low. A reader sees only its page and one scenario, never the sources, checklist, arm or guidance. It returns an ordered step list with commands, observations, supporting quotations and unstated requirements.

[The scorer](scorer/probe.py) interprets each command's operation, positional arguments and named options. Quoting, whitespace, option order and `--flag=value` are equivalent. Instruction prose may use any synonyms; it is never scored by phrase keys. Exact fictional identifiers remain exact because they name the account, object, destination or file. Observable state uses typed field/value slots, with number words and common nonempty-value synonyms accepted. This is a closed CLI-action rubric, not a general natural-language entailment model.

Every required action needs a quotation found on the page. A task passes only when all required actions, observations and prerequisite edges pass. Authentication and current-session activation precede task context; persistence is separately required. Preview precedes inspection, approval, execution and remote confirmation. Harder tasks also require installation, automatic startup in a new shell, and recovery before execution. Independent setup actions may occur in either order. The first occurrence of each action determines its order; a later duplicate cannot conceal an invalid first attempt. No reward is assigned to a fact's position on the page.

The structured observations are the reader's semantic extraction, not an additional model judge. Quotation grounding verifies presence, not that the quotation entails every observation. The parent must audit this limitation before interpreting a positive effect. Unparseable supported command syntax is an infrastructure/rubric problem to report, not permission to expand a frozen answer key after arm results are known.

## Calibrated secondary judges

Astra (`gpt-6-astra`), Sol 6.1 (`gpt-6.1-sol`) and Opus 5.5 (`claude-opus-5-5`) use high reasoning/effort. Opus is a judge only. The two frozen questions in [prompts.py](scorer/prompts.py) measure:

- **Path:** a complete main task path before optional reference, including execution through confirmation.
- **Entry:** necessary start requirements at the entry point, distinguishing session and future-session setup.

The questions do not require tutorials to put outcomes first. Path concerns the main task sequence; entry separately owns prerequisite placement.

Calibration uses operator-authored short adaptations of the same two Django exemplars used in #110: [first app, part 1](https://docs.djangoproject.com/en/5.2/intro/tutorial01/) and [managing static files](https://docs.djangoproject.com/en/5.2/howto/static-files/). Each has one clean copy, one copy with optional reference moved before the path, and one with setup moved after the path/reference. All facts are retained. These adapted controls are narrower than the original pages, not a claim that those originals are defect-free.

The six variant pages and planting record stay outside the repository as `calibration.json`, SHA-256 `0ce53fa721ac0891743950e2b43c5acf7024862e66ff07a640e9ec4b71e0b6af`. Each judge receives one randomly labeled, shuffled three-copy pack per exemplar: six calibration calls total. Eligibility is per item: catch the planted defect on **both** exemplars with an in-page quotation and flag **neither** clean copy. An ineligible judge's corresponding votes do not count. Two examples are a weak calibration sample; report counts, not a broad reliability claim.

In the paid probe, judge only attempt 1, fixed before outcomes, for each of four briefs. Each of three judges gets one independently randomized head/base pair per brief: 12 calls. A page's defect booleans yield head preference when only base has the defect, base preference when only head has it, otherwise a tie. Count eligible votes only. Missing eligibility for an item leaves the judge gate unverified and blocks a ship verdict.

## Headroom dry run

After calibration, build base only for H1 and T1, two attempts each, then read all four pages: four builds and four readers. If more than 80% of the tasks pass, use the frozen harder scenarios for **both** briefs and rebuild/read once: eight further calls. Record both runs. With four tasks, only 4/4 triggers the rerun.

Do not revise checklists using observed answers. If the harder rerun still exceeds 80%, headroom remains insufficient: report that result and stop before the paid probe. If it falls to 80% or below, freeze the harder variant for all four paid briefs. Otherwise use the initial variant. Dry-run pages are never reused in paid cells.

## Paid design and decision rule

Paid execution needs the parent's approval after reviewing this commit. It is not started here.

Four briefs × three arms × five attempts produce 60 builds and 60 readers. A pair is one brief and attempt index: 20 pairs per comparison. Calls are independent; attempt labels do not imply shared model seeds. Shuffle build order with seed `20261107`; dry-run order uses `20261106`. Judge order uses the recorded deterministic seed and each judge/brief identifier.

The primary gate passes only when all hold:

1. Head beats base in at least 15 of 20 pairs, ties counting half, with mean difference **at least 1 completed task**.
2. Head beats vanilla by the same rule.
3. No brief loses more than one completed task against base across its five attempts.
4. Eligible judges do not prefer base on either item. Conservatively, any eligible base preference blocks that item; no eligible judge means unverified.

**Literal threshold consequence:** each pair contains one binary task, so its difference is at most 1. A mean difference of at least 1 therefore requires 20 head passes and 20 comparison-arm failures. The 15-pair condition becomes redundant. This preserves the supplied gate; it is not silently rescaled to points or checklist items. The parent should resolve any intended different unit before authorizing paid execution, with a dated pre-run amendment.

Report task totals, pair differences, per-brief differences, mean page length and item-level judge votes. Flag a mean head length difference greater than 10% in either direction against base. Length does not change the gate.

Passing does not automatically ship either rule. Rule 1 additionally needs at least one eligible head preference on entry and no eligible base preference. Rule 2 needs the same on path. Ties alone support neither rule. Only supported rules may be proposed for release; publication remains a separate action.

## Call cap, settings and stop rules

| Part | Maximum calls |
| --- | ---: |
| Fresh brief writer | 1 |
| Calibration: three judges × two exemplar packs | 6 |
| Dry run and at most one harder rerun: eight calls each | 16 |
| Paid builds and readers | 120 |
| Paid judges: three × four briefs | 12 |
| Subtotal | 155 |
| Spare, rounded up from 10% | 16 |
| **Hard cap** | **171** |

Use at most three concurrent calls. Every dispatch, including a failed attempt, consumes one call. Reserve the call in `calls.json` before dispatch. A missing or malformed response gets one fresh retry from spare calls; a second failure of that logical call stops the study. A model unavailable at the required settings blocks its stage; do not substitute a model. Any step that would exceed the cap stops before dispatch. Preparation reserves capacity but does not itself invoke a model; report actual dispatches separately from unused reservations.

Codex uses `serviceTier: priority` before 2026-11-06 16:00 fixed MST (23:00 UTC), and `default` at or after that boundary. The writer used priority. Calibration, dry-run, rerun and any later paid part record their actual tiers in the local call ledger and summary report; never assume the writer's tier applies to later calls. Claude has no Codex service-tier setting.

Raw per-call prompts and responses, pages, full sources and dispatch records remain in an external run directory. Committed files contain the frozen design, scorer, derived rubric, hashes and summary results only. Do not commit local machine paths. No live guidance, versions, published skills or routing changes are made by this study.

## Dry-run instrumentation amendment, before the harder rerun or paid calls

The first four base pages and readers completed before this amendment. The initial implementation reported 1/4 tasks passed. Inspection showed that the rejected plans had the required commands, observations and order; quotation matching caused the failures. Markdown list numbers and fenced-code labels interrupted copied passages. Readers also combined nonadjacent correct passages or changed punctuation. This measured citation copying, not the requested completion task, and repeated Study 1's literalism problem.

The correction keeps every scenario, required action, observation, prerequisite edge and decision threshold unchanged. Command operations must now be found in the page's inline code, fenced code or bare command lines. Citation copying is a separate `citationGrounded` diagnostic, not an extra completion requirement. Its normalizer ignores Markdown decoration and accepts explicitly marked omissions only in page order. Observation slots remain the reader's semantic extraction; citation diagnostics do not independently prove their entailment.

Rescoring the same four replies gives **4/4 completion tasks**. The original 1/4 result, pre-dry scorer hashes and amended scorer are retained in the external run record. No builder or reader was recalled. This correction triggers the already frozen harder-scenario rerun once. Parent review must assess the amendment before any paid approval.

**Tier note reiterated after the parent's interruption message:** new Codex calls switch to `default` from 16:00 fixed MST on 2026-11-06 (23:00 UTC). Clock checks during calibration and the first dry run were before that boundary, so those calls used `priority`. The results report records actual tiers for the remaining preparation; the switch applies to later calls even if their prompts were prepared earlier.

## Source-conformance correction and preparation closeout, before paid calls

The harder rerun initially scored 0/4. The same renewal item failed in every reply. Inspection against the original writer response found a derived-key conversion bug: a sentence-ending regex stopped at the dot in each `.plan` filename. All four original writer checklists, sources and reader plans retain the full filename. The derived command keys are repaired to those original values, not adapted to new answers. A cross-step filename regression failed on the truncated key, then passed on the repair. Scenarios, action meanings, prerequisite edges and thresholds remain unchanged. Rescoring the same harder replies gives **4/4**, so headroom remains insufficient. No further rerun is authorized by this plan.

The external record preserves the original 1/4 citation-gated score, original pre-dry scorer hashes, the pre-filename-fix key and 0/4 harder score, and the corrected artifacts.

Rule 2 applies to how-to guides. Its per-rule support therefore needs at least one eligible head preference on H1 or H2; tutorial path votes alone cannot support that rule. The secondary no-base-preference gate still covers both questions across the sampled pages.

Actual model calls in preparation: **23 of 171** (writer 1, calibration 6, builds 8, readers 8). All 21 Codex calls used `priority` before the 23:00 UTC cutoff; the two Opus calls used high effort with no Codex tier. Future Codex calls at or after that cutoff must use `default`, including calls prepared earlier. No paid-probe call ran.

Blinding deviation: the outer dispatch text identified calls as a base-only dry run to distinguish authorized preparation from the prohibited paid probe during automatic approval review. Thus builders and readers did see the base-arm label, despite the intended content-only prompt contract. They did not receive head guidance or the scoring checklist. Together with ambient host instructions and the two scorer repairs, this limits the dry run to instrument debugging and a ceiling warning. The parent must review these deviations and improve isolation/blinding before any later paid design.

The frozen head is unchanged. Results and required next decisions are in [results.md](results.md). The current design is **not ready for a paid efficacy probe**: both scenarios remain at ceiling, and the literal one-binary-task mean-gain threshold is unusually strict. This task commits the negative headroom result; it ships no writing rule.

## Approved judge-led amendment, 2026-11-06, frozen before paid calls

Filip approved a judge-led probe after reviewing the saturated dry runs. This section supersedes the earlier primary measure, decision rule, 12-call judging sample, task-gain requirement, how-to-only support restriction, and stop at the ceiling warning. It authorizes the paid evaluation, not a push or release. The prior dry-run findings and instrument repairs remain part of the record.

**Inputs held fixed.** Keep the four original briefs, word limits, three guidance arms, head SHA-256 and corrected command/observation rubrics. Use the frozen harder scenario for all four briefs. Build 5 fresh pages per brief per arm: 60 builds, then one reader per page: 60 readers. Builders use Codex `gpt-6.1-sol` high; readers use Codex `gpt-5.6-sol` low. Every new Codex call uses `serviceTier: default` from this approval onward. Opus 5.5 remains a judge only.

**Primary judges.** Astra, Sol 6.1 and Opus 5.5 use high reasoning/effort. Their existing calibration eligibility maps entry to R1 and path to R2. All three passed both. For each brief and comparison, each judge receives five matched pairs (attempts 1–5): the five head pages versus the five base pages, then a separate fresh call versus the five vanilla pages. This is 4 briefs × 3 judges × 2 comparisons = **24 calls**. Every pair independently randomizes A/B. Shuffle judge jobs and A/B assignments using the frozen `20261108` seed plus judge, brief, comparison and attempt identifiers. Judges receive the common brief, harder scenario, source material and ten page texts, never guidance or arm names.

The frozen questions in `scorer/prompts.py` are:

- **R1:** start requirements at the entry point, including necessary prerequisites, authentication, installation/activation, first invocation, and the distinction between current-session and future-session setup.
- **R2:** a complete ordered task path through observable confirmation before optional command/feature reference. Preserve tutorial learning order; do not move the result before execution. The approved 20-pair rule evaluates all four briefs, including tutorials.
- **C:** word choice and tone only, excluding task order, placement, completeness and factual coverage. Neither proposed rule targets this control.

Each judge votes A, B or tie separately for each item and pair, with quotations and a reason. Quotation fidelity is diagnostic, not an extra vote-admission gate. Votes count on R1/R2 only from judges eligible for that target item. The amendment requests C but adds no calibration stage for it: use all three judges for C, and report that the control has not been separately calibrated. Do not claim calibrated reliability for C or for fine-grained pairwise ranking; the prior calibration tested planted defects.

**Pair outcome.** For each item and comparison, a strict majority of eligible judges determines head win or comparison win. Otherwise the pair is tied, including split head/comparison/tie votes. A tied pair contributes half a win. Count all 20 matched pairs. Report wins, losses, ties and half-weighted wins, not raw judge-vote totals alone.

**Per-rule decision.** Decide R1 and R2 separately. A rule is supported only when every condition holds:

1. Its half-weighted head wins against base are at least **15/20**.
2. Its half-weighted head wins against vanilla are at least **15/20**.
3. Against base, its wins exceed C's wins by at least **4**. If C itself reaches **15/20** against base, neither rule is supported, regardless of that difference. Report C against vanilla too.
4. Reader no harm passes: head completes at least base minus one task overall **and on every brief**.

Remove the mean reader gain of one task. Readers provide the no-harm floor only. Ties alone can contribute half wins but do not bypass either threshold or specificity check. Retain the length flag: report a head/base mean word-count difference greater than 10% in either direction; it does not change the verdict. A supported rule may be proposed for shipping; this task does not modify live guidance, push or release it.

**Blinding.** Builder IDs are `p01`–`p60`; reader IDs are `r01`–`r60`; judge IDs are `j01`–`j24`. Retry IDs add a neutral `x`. Every prompt, reply and guidance copy uses neutral filenames in opaque directories. Arm/brief/attempt/comparison maps remain in the private external ledger. Builder/reader dispatch titles and task text contain no arm label or version-bearing path. The dispatch wrapper names only the neutral role, role instructions, prompt path and response path. Source facts and the guidance's actual content remain visible as needed. Delegated prompts cannot remove ambient host guidance or enforce filesystem isolation; report that limitation. Do not expose preparation results or the study verdict criteria to builders/readers/judges.

**Budget and stop rules.** The 23 preparation calls are retained in the same ledger. Paid execution adds 60 builds + 60 readers + 24 judge batches = **144**, for **167 calls total**. Allow at most **one spare model call per stage** (build, reader, judge), for a maximum of **170**, below the hard **171-call** cap. The remaining unallocated call is not permission for a second stage retry. Check for an existing response before every dispatch and never resend a completed call. Keep superseded/malformed responses and failure evidence outside the repository. A missing or malformed response may use that stage's one spare; a second failure in that stage stops the study. Content failures and losing votes are results, not retry reasons. Unavailable required models/settings block the stage; substitute nothing. Use at most three concurrent calls. Save dispatch receipts and raw per-call artifacts externally. Stop before any action that would exceed the cap.

**Commit order.** Commit this dated amendment, the updated scorer/prompts/tests and renewed freeze manifest in their own Conventional Commit before the first paid call. After execution, write aggregate R1/R2/C counts versus both comparisons, no harm, verdicts, resource counts, repairs/deviations and limitations to `results.md` and `results.json`; update the lab notebook and commit results on the same branch. Do not push.

**Implementation ledger for this amendment.** Reuse the existing `reserve`, page/scenario preparation, command interpreter, observation scoring, calibration evidence and raw ledger. Replace only the obsolete paid judge preparation, vote collection and decision logic; add `active_calls`, `majority_counts` and a bounded `retry` helper for the new matched-batch contract and preserved retry evidence. Keeping the old attempt-1 judge route cannot deliver 20-pair outcomes against both comparisons. `majority_counts` owns half-win ties; `decision` owns separate rule gates and both no-harm floors. `test_literal_binary_gate_and_incomplete_data` is obsolete because this approval explicitly retires its perfect-sweep requirement; replace it with threshold, specificity, majority/tie, no-harm and incomplete-cell tests. Preserve all seven other scorer tests. A neutral-dispatch test exercises the actual reservation boundary and default-tier option; no model is called by tests. No production runtime, dependency or live-guidance file changes.
