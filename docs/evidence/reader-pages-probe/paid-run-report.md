# Reader pages probe: paid run

Date: 2026-11-05

Status: complete. **Not supported. Do not ship the guidance on this evidence.**

Head passes no harm and objective gain against base. It has a judge majority on three briefs against each control, but B3 has a majority for base and vanilla. The fixed rule forbids that, so part 3 fails against both controls.

The 312 approved calls all succeeded on their first attempt. No cell was replaced, dropped, or paid for twice. The guidance and scoring inputs stayed fixed after the first paid build. The PR remains a draft, and routing evaluation remains unrun.

## Decision rule

Votes are overall head–control counts out of 15. There are no SAME overall votes. Objective gain applies only against base. No harm is shown against base and vanilla, in that order.

| Brief | Part 1: no harm, base / vanilla | Part 2: better measures against base | Worse on M3 or M4 | Part 3: head–base | Part 3: head–vanilla | Part 3 per brief |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | pass / pass | M3, M9 (2) | none | 9–6 | 11–4 | pass |
| B2 | pass / pass | M3, M4, M5, M6 (4) | none | 11–4 | 14–1 | pass |
| B3 | pass / pass | M5, M6 (2) | none | 7–8 | 5–10 | fail |
| B4 | pass / pass | M3, M4 (2) | none | 12–3 | 11–4 | pass |

| Rule part | Against base | Against vanilla |
| --- | --- | --- |
| 1. No harm on every brief | pass, 4 of 4 | pass, 4 of 4 |
| 2. Gain on at least 2 measures on at least 3 briefs; no M3/M4 regression | pass, 4 of 4; no M3/M4 regression | not required |
| 3. Head majority on at least 3 briefs and no opposing majority | fail: head majority on 3, base majority on B3 | fail: head majority on 3, vanilla majority on B3 |
| Overall | **not supported** | **not supported against vanilla** |

The scorer's machine verdict is `do not ship`. The preregistration's next step for a part-3-only failure is to revise one guidance rule and rerun only the failed brief. B3 is that brief. This run makes neither change: a revision and rerun are separate work, and the current result remains a failure.

## Setup and merge

| Item | Value |
| --- | --- |
| PR | https://github.com/filipgutica/filip-stack/pull/99, draft |
| Original PR head | `f655dde5b285957ad863eb7820bfd4e6edf61f3d` |
| Base arm | `0fc048d4e2a843995e2cb5fb842cd3c48a40ee1c`, current `origin/main` at arm creation |
| Head arm and merge commit | `f6997da132e1e774e25f6d1497a66eb70ddcba76` |
| B1 guidance words | vanilla 0; base 1,707; head 2,973 |
| B2–B4 guidance words | vanilla 0; base 1,424; head 2,631 |
| Study | 4 briefs × 3 arms × 5 attempts |
| Builder | Codex `gpt-6.1-sol`, high reasoning, default service tier |
| Primary extractor | Codex `gpt-6.1-sol`, high reasoning, default service tier |
| Comprehension | Codex `gpt-6.1-sol`, low reasoning, default service tier |
| Double-coding | Codex `gpt-6-astra`, high reasoning, default service tier |
| Judges | Astra high, Sol 6.1 high, Opus 5.5 high; Codex default tier; Opus fast mode false |
| Host calls | `delegate_task`, `mode: async`, `role: general`, `isolation: shared`, fresh context |
| Maximum concurrent calls | 8 |

Main was merged in the dedicated `~/code/worktrees/rp-probe` worktree. The only conflict was in the lab notebook. Resolution retained study 21, study 22, and both experiment logs. Main's breakpoint and visualization content and all G1–G7 edits remain. No other checkout was switched or edited.

Node 24.19.0 `pnpm install --frozen-lockfile` and `pnpm check` passed before the normal merge push. `fallow audit` passed its changed-file gate, excluding two inherited findings.

Dry run 3 used the same arm commits on B1 with one attempt per arm. All 15 calls succeeded without retries. All three builds read only their own arm file, all 12 scoring traces had no commands, and the scorer succeeded. Head kept every reader fact and won all six overall judge votes. This was a pipeline check, not a study verdict. See [dry-run-3-report.md](dry-run-3-report.md).

## Measures

These are the scorer's aggregates over five attempts. M1 is mean recall; M2–M4 and M7–M9 are sums. M5 sums normalized start offsets, M6 sums per-build fragment rates, and words sums the prose word counts from `metrics.py`. Divide a sum by five for its per-build mean. B4 has no M5. Reading grades and individual measurements remain in [scores.json](paid-run/scores.json).

| Brief | Arm | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9, of 15 | Words |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B1 | vanilla | 1.000 | 0 | 1 | 4 | 1.137 | 0.674 | 5 | 0 | 15 | 603 |
| B1 | base | 1.000 | 0 | 4 | 5 | 0.675 | 0.593 | 0 | 0 | 12 | 462 |
| B1 | head | 1.000 | 0 | 0 | 5 | 1.025 | 0.676 | 0 | 0 | 15 | 450 |
| B2 | vanilla | 0.980 | 0 | 10 | 1 | 1.468 | 0.331 | 0 | 0 | 15 | 877 |
| B2 | base | 1.000 | 0 | 10 | 3 | 1.482 | 0.204 | 0 | 0 | 15 | 858 |
| B2 | head | 0.980 | 0 | 3 | 5 | 1.451 | 0.195 | 0 | 0 | 15 | 769 |
| B3 | vanilla | 1.000 | 0 | 0 | 5 | 1.932 | 0.000 | 0 | 0 | 15 | 247 |
| B3 | base | 1.000 | 0 | 0 | 5 | 1.900 | 0.222 | 0 | 0 | 15 | 278 |
| B3 | head | 1.000 | 0 | 0 | 5 | 1.457 | 0.111 | 0 | 0 | 15 | 351 |
| B4 | vanilla | 1.000 | 1 | 9 | 5 | not measured | 0.000 | 15 | 0 | 15 | 1763 |
| B4 | base | 1.000 | 1 | 7 | 4 | not measured | 0.000 | 13 | 4 | 15 | 1727 |
| B4 | head | 1.000 | 0 | 5 | 5 | not measured | 0.107 | 3 | 0 | 15 | 1684 |

B1 head improves leaks and comprehension against base, but its start position and fragment rate are worse. Its mean prose length is 90 words, versus 92.4 for base and 120.6 for vanilla. The preregistration expected B1 to get longer; length is not a decision measure.

On B2, head recall is 0.98 against base's 1.00, within the 0.05 allowance. Head still leaks three agent-only facts across five attempts. On B4, every head build includes the agent-only audit script, accounting for all five head leaks. The guidance reduces leakage but does not eliminate it.

### B3 diagnostic

Head wins 7 of 15 overall votes against base and 5 of 15 against vanilla. All arms retain every reader fact, and every B3 comprehension call scores 3 of 3. The fixed objective measures therefore do not explain the judge loss through missing facts or comprehension.

Twenty-two of the 30 B3 judge reasons mention Node.js. Many prefer the fail-open caveat beside the plugin's opening claim. Several say that placing the caveat at the end of the Codex subsection makes it appear Codex-only. Some prefer head's explicit trust instructions and plain language. These are uncalibrated diagnostics, not proof of a single cause. Saved pages and votes permit inspection without another paid call.

## Calls, isolation, and double-coding

| Call | Count |
| --- | ---: |
| Builds | 60 |
| Primary extractor | 60 |
| Comprehension | 60 |
| Second extractor | 12 |
| Judges, head vs base | 60 |
| Judges, head vs vanilla | 60 |
| Total paid study | **312** |
| Dry run 3 | 15 |
| Total this assignment | **327** |
| Retries | **0** |

Paid calls by model: Sol 6.1 220, Astra 52, Opus 5.5 40. Every effective dispatch model and option matches its recorded target. Every trace's task text matches its saved prompt, with no added role text. All 312 replies are saved and all scoring replies parse as JSON with complete expected fields. The double-coding sample has 12 builds, four per arm and three per brief. Both judge pairings have 15 overall votes on every brief.

All 60 build traces were checked. They read only their own randomly named arm file. Eight builders read that same file twice; none read another file. All 252 scoring traces contain no command execution. SHA-256 checks confirm that all scorer, key, fact-sheet, and arm files still match the frozen manifest.

Double-coding agreement is 1.000 on the scorer's measured fields: fact presence, placement, and the two opening flags. This does not cover sentence counts, fragments, or invented claims. Those fields were also compared: the only difference is build `271be7ea`, with 3 primary versus 7 secondary sentences and zero fragments in both. It has no effect on that build's M6, which is zero either way. See [double-code-other-fields.json](paid-run/double-code-other-fields.json).

## Deviations and limits

- Existing dry-run clarifications were retained: balanced judge order instead of random order, Yes/No prefix formatting where required, and no M5 on B4.
- Guidance was delivered as one randomly named file per build, as in dry run 2. Each file bundles the registered arm inputs and rewrites local links.
- Neither measurement change proposed after dry run 2 was applied. Notes sections retain the existing extractor definition. The B1 facts row can count as a fragment. The brief fixed the measures, and approval of the paid run did not authorize changing them.
- The deployed global host guidance remains a shared confound across arms. This probe measures supplied guidance behavior, not skill routing or an isolated no-guidance host.
- The orchestrator automatically delivered completed replies into the parent thread. The runner did not print reply contents; it saved them from the thread records. The parent could not prevent the automatic notifications.
- Local bookkeeping was corrected when the expanded call ledger exceeded a tool output limit. A transient serialization error was also corrected. Neither correction changed an experiment input, retried a model call, or discarded a reply. There were no model-call failures or timeouts.
- Five attempts per arm and brief give a bounded result. The judges are uncalibrated. The existing extractor and fragment limitations remain.
- Actual token consumption and billed cost were not available and are unverified. No routing evaluation, merge, ready-for-review action, or further study was performed.

## Verification

After scoring, Node 24.19.0 `pnpm check` passed. The final `fallow audit` passed its changed-file gate. `node --check paid-run/tool-helpers.js` and Python compilation of `paid-run/runner.py` passed. No production, guidance, or test file differs from the merged head. The vote chart was inspected at 390 and 728 px in light and dark, with no console messages.

The frozen-input and complete-cell checks are recorded in [validation.json](paid-run/validation.json). All effective dispatch settings and saved task texts were also checked against their ledgers. The scorer completed successfully on every saved build and vote. Independent review did not run; the brief permits only study calls. The whitespace check flags 40 Markdown hard breaks in generated pages and their scoring prompts; those inputs were preserved.

## Change ledger

- **Simpler version:** reuse the existing scorer and dry-run procedure. Only durable call bookkeeping and evidence capture were added; manually tracking 327 calls would not provide the required resume and duplicate-payment protection.
- **Readability:** `do not ship` is the scorer verdict, expressed as **not supported** in this report. Head majority on three briefs does not pass part 3 when B3 has an opposing majority. Tables state aggregate units and vote denominators.
- **Scope:** this follow-up changes zero guidance, production, or test lines after the merge. It adds run evidence and reports, updates study 22 and the experiment log, and updates only the PR's Evaluation section. Main's merged production and test changes are inherited. No unrelated change was made.
- **Reuse:** `build_arms.py`, `probe.py`, `prompts.py`, keys, fact sheets, and metric tools are unchanged. The evidence-only `runner.py` creates ledgers and prompts; `tool-helpers.js` handles async dispatch and saving replies. The existing scorer has no dispatch, retry, or reply-saving API to reuse.
- **Coverage:** no tests were added, changed, or removed. Existing repository checks verify the integration. Saved traces, frozen hashes, complete-cell checks, effective dispatch settings, and the scorer verify the study itself. No independent review agent was started because the brief permits only study calls.

## Evidence

[paid-run/](paid-run/) contains arm files and hashes, build and judge ledgers, the double-coding sample, all prompts and replies, effective dispatch records, complete traces, call bookkeeping, isolation checks, validation, and scores. `runner.py` and `tool-helpers.js` record the orchestration code; `init` and `render` are intentionally one-time stages. Resume from `calls.json` and saved replies; never rerender completed judge pairs or relaunch a saved cell.
