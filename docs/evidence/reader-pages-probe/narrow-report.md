# Reader pages probe: narrowed guidance

Date: 2026-11-05

Status: study complete, with five failed scoring calls that were not retried. **Not supported. Do not ship the guidance on this evidence.**

Against base, the narrowed head passes no harm and judge agreement on all three briefs: it wins 10–5, 11–4, and 10–5. Objective gain against base is undetermined, because the five failed calls leave N2's measures incomplete. Against vanilla, head fails judge agreement: vanilla wins the N1 tool landing page 14–1. That part uses only judge votes, which the failed calls did not touch, so the verdict holds whatever the missing cells contain.

The run did not stop when the five calls failed, as the pre-registration requires. The section on failed calls explains why and what that changes. The PR remains a draft. Routing evaluation did not run.

## Guidance change

Commit `c926026b6cfcd5d46ee80ee097d2c7a56d91566f` narrows the scope and reverts R4's caveat sentences from the B3 rerun (`982af5e0`). The reference is 1,093 words, within its 1,200-word budget. The `SKILL.md` pointer and the skill description are unchanged.

Scope before:

> Apply this guidance to writing that a person reads to decide whether to use something, or to learn how to use it. That covers product and tool pages, docs pages, guides and lessons, skill pages, and READMEs.

Scope after:

> Apply this guidance to pages a reader uses to decide whether to use something or to start learning it: tool and product landing pages, skill pages, and the opening of a guide or lesson. […]
>
> Procedure and reference sections, such as install and update steps, option tables, and changelogs, follow technical prose instead. This holds even when they sit on the same page as a landing section.

R4 returns to its `23e2d4ef` wording. The removed sentences were: "Keep a condition or caveat beside the claim it qualifies, before the reader acts on it. When it applies across subsections, place it in their shared introduction so its scope is clear."

## Setup

| Item | Value |
| --- | --- |
| Pre-registration | [narrow/prereg.md](narrow/prereg.md), commit `95860f40`, written before any build |
| Head arm | `c926026b6cfcd5d46ee80ee097d2c7a56d91566f` |
| Base arm | `85522f76cc69781ac239ac2cd2f3443b25d499e3`, `origin/main` when the study was registered |
| Vanilla arm | No guidance |
| Briefs | N1 tool landing page, N2 skill page, N3 lesson opening, written by one fresh read-only Sol 6.1 call |
| Attempts | 5 per arm per brief |
| Builds and extractor | Sol 6.1, high reasoning |
| Comprehension | Sol 6.1, low reasoning |
| Second extraction | Astra, high reasoning, 9 builds sampled at 20% |
| Judges | Astra high, Sol 6.1 high, Opus 5.5 high (`claudeAgent`, effort high, fast mode off) |
| Calls | `delegate_task`, async, general role, shared isolation, read-only task text, at most 8 at once |
| Codex service tier | Default for every call |

The three subjects are fictional:

- N1: `sackview`, a ZIP archive inspector, installed with `pipx install sackview`.
- N2: `term-weave`, a glossary drafting skill, run as `/term-weave <source-folder>`.
- N3: the opening of a lesson, "Renaming rooms in the Kestrel directory", about stable room identity.

## Scoring

`narrow/scorer/` is a copy of `../scorer/`. `prompts.py`, `build_arms.py`, and `tools/` are byte copies. `probe.py` has three changes: a header comment, loading the briefs from `briefs.json`, and `decision(..., briefs_required=2, total_briefs=3)` for the narrowed rule's "2 of 3 briefs". `key.json`, `briefs.json`, and the three fact sheets are new. [validation.json](narrow/paid-run/validation.json) records their SHA-256 hashes.

`probe.py score` stops on the five failed replies because they contain no JSON, so this run has no `scores.json`. [partial.py](narrow/partial.py) imports `probe.py` and reuses its `per_build`, `aggregate`, and `decision` functions without changing them. It leaves each failed call's measures unknown and applies the rule twice. In one pass every unknown value favours head; in the other it favours the other arm. Every test in the rule is monotone in each measure, so a verdict that is the same in both passes cannot depend on the missing cells. M2 has no upper bound, so `partial.py` uses 99 as a stand-in for "very many invented facts". [partial-scores.json](narrow/paid-run/partial-scores.json) holds both passes.

## Measures

M1 is mean fact recall. M2–M4 and M7–M9 are sums across five attempts. M5 sums normalized start offsets, and M6 sums per-build fragment rates. Lower is better for M2, M3, M5, M6, M7, and M8. Words are reported only.

N1, tool landing page, complete:

| Measure | Base | Vanilla | Head |
| --- | ---: | ---: | ---: |
| M1, fact recall | 1.000 | 1.000 | 1.000 |
| M2, invented facts | 2 | 0 | 0 |
| M3, agent-only leaks | 4 | 1 | 3 |
| M4, opening job statement | 4 | 1 | 5 |
| M5, start offset | 0.622 | 1.114 | 1.200 |
| M6, fragment rate | 0.504 | 0.000 | 0.000 |
| M7, AI tells | 0 | 0 | 0 |
| M8, repeated sentence pairs | 0 | 0 | 0 |
| M9, comprehension, of 15 | 12 | 10 | 15 |
| Prose words | 592 | 555 | 519 |

N2, skill page. The base and vanilla columns are missing one extraction and one comprehension reply each. Head is missing one comprehension reply. Each cell shows the sum or mean over the attempts that were scored, with the number of attempts in brackets.

| Measure | Base | Vanilla | Head |
| --- | ---: | ---: | ---: |
| M1, fact recall | 1.000 (4) | 1.000 (4) | 1.000 (5) |
| M2, invented facts | 0 (4) | 0 (4) | 0 (5) |
| M3, agent-only leaks | 0 (4) | 0 (4) | 0 (5) |
| M4, opening job statement | 4 (4) | 2 (4) | 5 (5) |
| M5, start offset | 1.852 (5) | 1.833 (5) | 1.454 (5) |
| M6, fragment rate | 0.091 (4) | 0.364 (4) | 0.160 (5) |
| M7, AI tells | 0 (5) | 0 (5) | 0 (5) |
| M8, repeated sentence pairs | 0 (5) | 0 (5) | 0 (5) |
| M9, comprehension | 12 of 12 (4) | 12 of 12 (4) | 12 of 12 (4) |
| Prose words | 714 (5) | 713 (5) | 778 (5) |

N3, lesson opening, complete. N3 has no start pattern by design (prereg: "M5 start pattern: none, as for B4"), so M5 does not apply.

| Measure | Base | Vanilla | Head |
| --- | ---: | ---: | ---: |
| M1, fact recall | 1.000 | 1.000 | 1.000 |
| M2, invented facts | 0 | 0 | 0 |
| M3, agent-only leaks | 5 | 5 | 5 |
| M4, opening job statement | 1 | 5 | 5 |
| M5, start offset | n/a | n/a | n/a |
| M6, fragment rate | 0.000 | 0.000 | 0.000 |
| M7, AI tells | 0 | 0 | 1 |
| M8, repeated sentence pairs | 0 | 0 | 0 |
| M9, comprehension, of 15 | 15 | 15 | 15 |
| Prose words | 1,694 | 1,810 | 1,766 |

The second extraction agrees with the first on every fact, placement, and opening field of all 9 sampled builds (agreement 1.000). The scorer does not compare fragment counts, sentence counts, or invented claims. None of the sampled builds is one of the failed cells.

## Judges

Overall votes, head first, five per judge and 15 per comparison. There are no SAME votes.

| Brief | Judge | Head–base | Head–vanilla |
| --- | --- | ---: | ---: |
| N1 | Astra | 4–1 | 1–4 |
| N1 | Sol 6.1 | 4–1 | 0–5 |
| N1 | Opus 5.5 | 2–3 | 0–5 |
| N1 | **Total** | **10–5** | **1–14** |
| N2 | Astra | 4–1 | 5–0 |
| N2 | Sol 6.1 | 4–1 | 5–0 |
| N2 | Opus 5.5 | 3–2 | 3–2 |
| N2 | **Total** | **11–4** | **13–2** |
| N3 | Astra | 4–1 | 5–0 |
| N3 | Sol 6.1 | 4–1 | 5–0 |
| N3 | Opus 5.5 | 2–3 | 1–4 |
| N3 | **Total** | **10–5** | **11–4** |

Opus 5.5 is the least favourable judge, or tied for it, in every comparison. It prefers base on N1 and N3, and vanilla on N1 and N3.

Because the dry run judged only head against base, the paid run was the first to exercise head-versus-vanilla judging. A script checked that every one of the 90 judge prompts contains the exact text of its two ledger pages, in the A and B order the ledger records. All 90 passed. On N1, vanilla was page A in two pairs and page B in three.

### N1 against vanilla, as a diagnostic

Head beats vanilla on N1 on M4 (5 vs 1) and M9 (15 vs 10), yet the judges chose vanilla 14–1. The rule uses the judges, and this report does not explain the result away. Two observations may help a later study, but neither establishes a cause:

- All five vanilla N1 pages have an install heading. No head or base page has one; they put `pipx install sackview` inside the opening section.
- In the 15 head-versus-vanilla reasons, "install" appears in 14, "heading" in 12, and "safety" or "safe" in 5. This count matched keywords and did not read the reasons themselves.

The new scope says install steps "follow technical prose instead", but it does not say where they go on the page. R4 still asks for the install step before the details.

## Decision rule

| Part | Against base | Against vanilla |
| --- | --- | --- |
| 1. No harm on every brief | Pass on N1, N2, N3 | Pass on N1, N2, N3 |
| 2. Better on at least 2 of M3/M4/M5/M6/M9 on at least 2 of 3 briefs, with no M3/M4 regression | **Undetermined.** N1 passes (M3, M4, M6, M9). N3 fails (M4 only). N2 depends on the missing cells. No brief regresses on M3 or M4 | Not required |
| 3. Head majority on at least 2 of 3 briefs, with no opposing majority | Pass: 10–5, 11–4, 10–5 | **Fail:** N1 has a vanilla majority, 1–14 |
| **Verdict** | | **Not supported** |

N2's part 1 passes in both passes, because head's complete M1 and M2 meet the threshold against any value of the missing cells. N2's part 2 is better on M5 in both passes, and needs one more measure. Head gets it if base's missing page leaks an agent-only fact (M3), lacks the opening statement (M4), or has a fragment rate above 0.069 (M6), or if head's missing comprehension score beats base's (M9). In the head-favouring pass all four pass; in the other pass none does.

## Failed calls

Five Sol 6.1 scoring calls, all on N2, could not read their prompt files. In each trace the shell read command stalled, the model retried once or twice, and it then replied that it could not read the file. No tool command completed, so the trace has no read to check.

| Cell | Arm, attempt | Lost measures |
| --- | --- | --- |
| `extract-b5eb61b1`, `comp-b5eb61b1` | base 2 | M1, M2, M3, M4, M6, M9 |
| `extract-cfaddc98`, `comp-cfaddc98` | vanilla 2 | M1, M2, M3, M4, M6, M9 |
| `comp-d9144b27` | head 1 | M9 |

The pre-registration says: "If any call fails or times out, the run stops and reports." The runner did not stop, because it checked only that a reply existed, not what it said. The platform marked these runs completed, and the runner saved the replies like any other. Dispatch continued through all 90 judge calls before scoring found the failures. The judge calls read only build pages, so the failed scoring calls did not affect them. The deviation cost no extra calls: the judge calls were part of the registered 234.

No call was retried. The registered ceiling is 250 calls. With 248 used, 2 remain, and completing N2 needs 5.

## Isolation

All 229 completed calls stayed within their assigned files. Each of the 45 builds read exactly its prompt file and its arm file. Each of the other 184 scoring calls read only its prompt file. The five failed calls have no completed command in their traces. The trace drops a command that never returns, so their isolation cannot be fully verified; their replies contain no page content. [isolation-check.json](narrow/paid-run/isolation-check.json) records them as five `missing_read` entries in its violations list. They are failed reads, not reads of other files.

Every pointer file the calls read matches its saved prompt byte for byte. All calls used the registered settings; [validation.json](narrow/paid-run/validation.json) lists them per call type.

## Calls and corrections

| Item | Calls |
| --- | ---: |
| Brief writer | 1 |
| Dry run on N1 (12 cells, plus one superseded head build) | 13 |
| Paid run: 45 builds, 45 extractions, 45 comprehension, 9 second extractions, 90 judges | 234 |
| **Total** | **248 of 250** |
| Retries | 0 |

The pre-registration amendment says the dry run used 14 calls and the total is 249. Both numbers are off by one. The dry run used 13 calls, as [dry-run-report.md](narrow/dry-run-report.md) records, and 14 counts the brief writer too. The total is 248.

The first push of the guidance commit was refused with "remote: fatal error in commit_refs", although GitHub had received the commit. The branch ref was moved to the commit through the GitHub API without force. Later pushes succeeded normally.

## Not verified

- Actual tokens and billed cost.
- Part 2 against base, which depends on the five missing N2 cells.
- Isolation of the five failed calls, beyond what their traces show.
- Why vanilla wins N1. The heading and keyword counts above are diagnostics only.

## Evidence

- [narrow/prereg.md](narrow/prereg.md)
- [narrow/dry-run-report.md](narrow/dry-run-report.md) and [narrow/dry-run/](narrow/dry-run/)
- [narrow/paid-run/](narrow/paid-run/): arms, ledgers, prompts, builds, replies, traces, `partial-scores.json`, `isolation-check.json`, and `validation.json`
- [narrow/scorer/](narrow/scorer/), [narrow/partial.py](narrow/partial.py), [narrow/runner.py](narrow/runner.py), and [narrow/isolation.py](narrow/isolation.py)
- [narrow/brief-writer/](narrow/brief-writer/)
