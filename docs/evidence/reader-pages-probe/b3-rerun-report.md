# Reader pages probe: B3 rerun

Date: 2026-11-05

Status: study complete. **Not supported. Do not ship the guidance on this evidence.**

The revised head loses B3 to base 4–11 and beats vanilla 12–3. Combining the new B3 result with the paid run's B1, B2, and B4 passes no harm and objective gain against base, but fails judge agreement because B3 has a base majority. Against vanilla, both required parts now pass.

B1, B2, and B4 were not rerun under the revised rule. A regression on those briefs is untested. This is the preregistered selective rerun, not a fresh four-brief evaluation of the revised guidance.

All 46 new calls completed on their first attempt. No saved cell was paid for twice. The PR remains a draft; neither routing evaluation nor another guidance revision ran.

## One-rule revision

Only R4 in `technical-writing/references/reader-pages.md` changed, in local commit `982af5e0fc6d24977f2ec7c9fb3cd621c606d866`.

Before:

> **R4. Show how to start before the details.** Before rules, options, or internals, give the install step or first command and one real example of using it. The example can be an invocation, a command, or a short output. Label illustrative examples as illustrative.

After:

> **R4. Show how to start before the details.** Before rules, options, or internals, give the install step or first command and one real example of using it. The example can be an invocation, a command, or a short output. Label illustrative examples as illustrative. Keep a condition or caveat beside the claim it qualifies, before the reader acts on it. When it applies across subsections, place it in their shared introduction so its scope is clear.

The saved paid-run pages and all 30 B3 judge replies were read before the revision. Four of five original head pages placed the shared caveat at the end of one platform subsection. Judge reasons often read that location as limiting its scope. R4's instruction to put details after the start was the plausible contributor selected for this test; the replies do not establish causation. The new wording names no study subject, fact, runtime, or platform.

The reference is 1,096 words, within its 1,200-word budget. The one-rule commit passes Node 24.19.0 `pnpm check`, `fallow audit`, and `git diff --check`. Commitlint initially rejected an overlong commit-body line; wrapping it resolved that local check without changing the rule.

## Setup and reused evidence

| Item | Value |
| --- | --- |
| Worktree | `~/code/worktrees/rp-probe`, detached; no other checkout edited |
| Starting HEAD and fetched PR branch | `23e2d4efb7ba53a9b1fc4bae26afd858f5f75029` |
| Revised head arm | `982af5e0fc6d24977f2ec7c9fb3cd621c606d866` |
| Base control arm | `0fc048d4e2a843995e2cb5fb842cd3c48a40ee1c`, unchanged paid-run arm |
| Original paid head for B1, B2, B4 | `f6997da132e1e774e25f6d1497a66eb70ddcba76` |
| B3 guidance words | vanilla 0; base 1,424; revised head 2,663 |
| New builds | B3 head only, five attempts |
| Reused B3 controls | Five base and five vanilla builds, their primary extractions and comprehension replies, and their two sampled second extractions |
| Judges | Ten fresh pairs, each judged by Astra high, Sol 6.1 high, and Opus 5.5 high |
| A/B order | Registered balanced order; head is A in five of ten pairs |
| Calls | `delegate_task`, async, general, shared isolation, fresh context |
| Codex settings | Default service tier; high reasoning except low for comprehension |
| Opus settings | `claudeAgent`, `claude-opus-5-5`, effort high, fast mode false |
| Maximum concurrent calls | 8 |

Only head was rebuilt with the unchanged `build_arms.py`. Base and vanilla arm files were copied byte for byte. The saved B3 controls and scores were reused, not rebuilt or rescored by a model. `reused.json` records 32 copied reply/build files with source paths and SHA-256 hashes. The scorer recomputed their measures from the same saved replies. Original control metrics match the paid scores.

`probe.py render` ran exactly once. Its unchanged 20% sampling selected vanilla attempt 1, revised head attempt 2, and base attempt 4: three of 15 builds. Only the revised head second extraction needed a new call. The 30 original B3 judge replies were diagnostic inputs only; every judge pair was judged anew.

## B3 measures

M1 is mean fact recall. M2–M4 and M7–M9 are sums across five attempts. M5 sums normalized start offsets; M6 sums per-build fragment rates. Words sums prose word counts from `metrics.py`. Divide sums by five for per-build means. Reading grades and individual measurements remain in [scores.json](b3-rerun/scores.json).

| Measure | Base | Vanilla | Revised head | Head vs base / vanilla |
| --- | ---: | ---: | ---: | --- |
| M1, fact recall | 1.000 | 1.000 | 1.000 | same / same |
| M2, invented facts | 0 | 0 | 0 | same / same |
| M3, agent-only leaks | 0 | 0 | 0 | same / same |
| M4, opening job statement | 5 | 5 | 5 | same / same |
| M5, start offset | 1.900 | 1.932 | 1.835 | better / better |
| M6, fragment rate | 0.222 | 0.000 | 0.643 | worse / worse |
| M7, AI tells | 0 | 0 | 0 | same / same |
| M8, repeated sentence pairs | 0 | 0 | 0 | same / same |
| M9, comprehension, of 15 | 15 | 15 | 15 | same / same |
| Prose words, reported only | 278 | 247 | 302 | neither |

All reader facts are present, no facts are invented, and comprehension is at ceiling in every arm. Head improves only M5 against base, so B3 no longer supplies the two-measure objective gain it supplied in the original run. The other three briefs still meet part 2, and no brief has an M3/M4 regression. The worse M6 does not itself violate the fixed rule.

Every revised head page puts the shared caveat in the opening. Each new primary extractor counts `To update:` as a fragment. The second extractor agrees on all measured fields for the new head sample, including its fragment and sentence counts. Across all three B3 samples, the scorer's fact/placement/opening agreement is 1.000. The reused vanilla sample retains the original 3-versus-7 sentence-count difference, with zero fragments in both extractions and no M6 effect.

## B3 judges

Counts are overall head–control votes, five votes per judge and 15 per comparison. There are no overall SAME votes.

| Judge | Head–base | Head–vanilla |
| --- | ---: | ---: |
| Astra | 2–3 | 5–0 |
| Sol 6.1 | 2–3 | 5–0 |
| Opus 5.5 | 0–5 | 2–3 |
| Total | **4–11** | **12–3** |

The original B3 counts were 7–8 and 5–10. The revised head now beats vanilla but loses more votes to base. Judge reasons often discuss whether the trust requirement is an explicit action after installation or a condition before installation, and whether command labels are consistent. Judges disagree about that placement. These are uncalibrated diagnostics, not proof that the rule caused the vote changes. No further guidance was tuned after these builds began.

## Combined decision

| Brief | No harm, base / vanilla | Better measures vs base | M3/M4 regression | Head–base | Head–vanilla |
| --- | --- | --- | --- | --- | --- |
| B1, reused | pass / pass | M3, M9 | none | 9–6 | 11–4 |
| B2, reused | pass / pass | M3, M4, M5, M6 | none | 11–4 | 14–1 |
| B3, rerun | pass / pass | M5 only | none | **4–11** | **12–3** |
| B4, reused | pass / pass | M3, M4 | none | 12–3 | 11–4 |

| Rule part | Against base | Against vanilla |
| --- | --- | --- |
| 1. No harm on every brief | pass, 4 of 4 | pass, 4 of 4 |
| 2. Gain on two measures on three briefs; no M3/M4 regression | pass, 3 of 4; no regression | not required |
| 3. Head majority on three briefs and no opposing majority | fail: head wins three, base wins B3 | pass: head wins all four |
| Verdict | **not supported** | required vanilla comparison passes |

The scorer's combined verdict is `do not ship`. B3's standalone `scores.json` correctly says one brief cannot decide the four-brief study; [combined-scores.json](b3-rerun/combined-scores.json) applies the fixed rule to all four. The overall result remains **not supported**.

## Calls, isolation, and limits

| New call | Count |
| --- | ---: |
| Head builds | 5 |
| Primary extractor | 5 |
| Comprehension | 5 |
| Second extractor | 1 |
| Head–base judges | 15 |
| Head–vanilla judges | 15 |
| Total | **46** |
| Retries | **0** |

Model totals are Sol 6.1 25, Astra 11, and Opus 5.5 10. All cells have saved replies and complete traces. Effective models, providers, options, and task text match the ledgers. Five build traces read only their assigned randomized head-arm file; three reread that same file once. All 41 scoring traces contain no commands. All scoring replies parse as JSON with the expected fields. The frozen scorer, key, factsheets, guidance arms, and reused controls retain their manifest hashes.

The local rerun runner initially hit the paid runner's unguarded command-line entry point during import. The bookkeeping fix ran before any dispatch and changed no experiment input. No paid call failed, timed out, was dropped, or was replaced. The existing async helper in `paid-run/tool-helpers.js` was reused unchanged for dispatch and capture.

Limits retained from the paid run: five attempts, uncalibrated judges, a shared deployed-host-guidance confound, extractor definitions unchanged, and automatic completion notices exposing replies to the parent. Actual tokens and billed cost are unverified. No independent reviewer ran because the brief authorizes only study calls. No app check applies to this prose-and-evidence change. Routing evaluation remains unrun.

The first normal push was rejected by the session execution policy: `approval required by policy, but AskForApproval is set to Never`. The rerun therefore used the verified local guidance commit. This differs from the requested push-before-rerun order; it changes no arm content or scoring input. The PR Evaluation section was updated successfully and read back exactly, including its disclosure that the commits remain local. Publication of the files and final remote-head confirmation are incomplete until the commits can be pushed. The PR remains a draft.

## Verification and change ledger

[validation.json](b3-rerun/validation.json) records complete cells, zero retries, the eight-call ceiling, matching dispatch settings and prompts, assigned-file isolation, frozen hashes, and complete balanced judge pairs. `validate.py` checks those contracts; `runner.py combine` recomputes scores and the combined verdict from saved replies. No paid call is needed to repeat either operation. The reused vote chart was inspected at 390 and 728 px in light and dark with no console messages. Final Node 24.19.0 `pnpm check`, `fallow audit`, Python syntax checks, and `git diff --check` pass. No trace item is truncated. The complete check log is saved in `b3-rerun/pnpm-check.log`.

- **Simpler version:** retaining R4 leaves the observed shared-caveat scope problem unaddressed. The revision adds only two sentences to that rule. Reusing controls and the existing scorer avoids ten unnecessary builds and their scoring calls.
- **Readability:** the shared introduction is the placement owner for a caveat spanning subsections. Reports distinguish the B3-only score from the combined verdict, and state that three briefs use older head builds.
- **Scope:** one guidance line replaced in its own commit; zero production or test lines changed. The follow-up adds B3 evidence and reporting, updates study 22 and its experiment log, and updates only the PR Evaluation section. No unrelated source is changed.
- **Reuse:** `runner.py` reuses the paid runner's job/dump helpers and unchanged `probe.py` preparation, rendering, scoring, and decision logic. Its new `init`, `render`, and `combine` functions supply selective-rerun bookkeeping, which the paid runner's full-study entry points cannot do. `sha` supplies local manifest hashing. `validate.py` consolidates saved-evidence assertions; the scorer does not inspect dispatch settings or traces. The vote chart reuses the paid-run chart with only the title, B3 values, and scope text updated.
- **Coverage:** no tests were added, removed, or changed. Existing repository checks cover mechanical integration. The authorized paid rerun measures the guidance behavior, and saved-evidence validation covers call integrity. The revised rule's effects on B1, B2, and B4 remain untested.

## Evidence

[b3-rerun/](b3-rerun/) contains the new head arm, unchanged control arms, manifest, reused-file hashes, build and judge ledgers, double-coding sample, prompts, 46 new replies, copied control replies, dispatch records, complete traces, scores, combined scores, validation, and the two local runner scripts. Resume from `calls.json`: skip saved replies, never rerender completed pair ids, and never pay for a saved cell twice.
