# Paired screen: pre-registration

Copy of the pre-registration, including the 2026-11-10 amendment. Machine-local paths and the private owner-profile file name are replaced with descriptions; nothing else is changed.

Date: 2026-11-09. Written before any coding run. No paid call is authorized by this file; the run needs the owner's approval.

## Question

Is `workflow-lean` at least as correct as vanilla on the 25-task DeepSWE panel? If it is, do blind judges prefer the code it leaves behind?

## Arms

| Arm | Delivery | Source |
| --- | --- | --- |
| `vanilla` | Codex built-in instructions only | — |
| `workflow-lean` | `../arms/workflow-lean/AGENTS.md` as guidance, `../arms/workflow-lean/workflow` as plugin | `../src-lean`, which is `../src-r3` plus [ask-fix.diff](ask-fix.diff), built with filip-stack `docs/evidence/engineering-guidance-climb/harness/build-version.mjs` |

- `workflow-lean` differs from the round-3 arm `workflow-r3` only in one `AGENTS.md` line: `diff -r arms/workflow-r3 arms/workflow-lean` shows that line and nothing else. Rebuilding `workflow-r3` from `src-r3` with the same script reproduced `arms/workflow-r3` byte for byte.
- Fixed settings, as in `screen.yaml` (machine-local):
  - Codex harness, `gpt-6.1-sol`, reasoning `high`.
  - Subagents on, `max_threads: 4`.
  - `timeout_seconds: 1800`, `jobs: 2`, `seed: 42`, `repeats: 1`.
- All of these match round 3. Round 3 used 3 repeats.
- PluginBench shuffles the 50 (task, arm) attempts together with seed 42, so the two arms interleave.
- Reviewer, as in round 3: Codex `gpt-6-astra`, `high`, [`review-standard.md`](../harness/review-standard.md), 900 seconds. The reviews are diagnostics. They are needed because `pluginbench judge prepare` reads review packets.
- Measurements: tokens, lines, coverage, and review. This is the panel's selection plus round 3's review.
  - 2026-11-09: restoring cyclomatic, cognitive, and dead_code after the home directory's `package.json` was removed crashed the run during preparation of fd (no model calls): PluginBench `language_analysis.py:690` shlex-splits Rust dep-info, a trailing backslash raises `ValueError`, and the error aborts the whole run. They stay out of this run. They enter no decision rule, so they can be measured later from the coding cache.
  - History: they were first left out because the first `check` exited 2 while installing their JS/TS observer: `corepack npm@10.9.2 ci` fails anywhere under the home directory, because the home directory's `package.json` is empty.
  - The Go tasks would have no complexity or unused-code observer anyway, because `go` and `staticcheck` are not installed.
  - Measurements do not enter the vanilla coding cache key. Once that file is repaired, they can be restored without changing vanilla keys.
  - 23 tasks have no coverage profile.
  - These gaps leave diagnostics unknown. They do not affect the decision.

## Tasks

The 25 panel tasks in `screen.yaml`, unchanged from PluginBench `docs/evidence/deepswe-panel-20261109/vanilla-x2.yaml` at `origin/main` 942f12c.

- The climb's holdouts (`testem-per-launcher-reports`, `dateutil-rfc5545-timezone-interop`) are not in the panel. Every `judge prepare` passes them to `--exclude` anyway.
- Adaptix and csstree are climb tasks that the round-3 candidate was tuned on. See "Sensitivity".
- Every panel instruction says "work on this in a new branch from main". 13 of 25 images have only `master`, so the ask fix's branch case is exercised. All tasks set a neutral Git identity, so its identity case is not.

## Cache

- Vanilla attempts publish to `XDG_CACHE_HOME` set to the screen's own `cache/` folder. This is the root `check` used, and the paid run must use the same root.
- The vanilla cache key includes the prepared image IDs, which are specific to a cache root, and the list of vanilla repeats. So the screen's vanilla attempts cannot reuse round-2 or round-3 vanilla, or a future `vanilla-x2` panel run, and every vanilla attempt is coded fresh.
- Adding the treatment and the reviewer leaves the vanilla keys unchanged. The 25 keys in `check-output/check.json` equal those from a vanilla-only ×1 copy of the panel config, checked under the same cache root. The machine-local `check.txt` records the comparison.
- The PluginBench version does not change keys either. The `origin/main` tree used here (942f12c) is identical to the panel branch head 3df85d5. The panel's `cache-keys.json` shows that branch gives the same vanilla keys as 01597a8 for `round-3.yaml`.
- The vanilla repeat list is part of the cohort context (`baselines.py`, `cohort_contexts`, field `repeats`). A ×1 cohort therefore never shares a key with a ×2 cohort.

## Run (after approval only)

```sh
cd <run folder>/screen
umask 022
export XDG_CACHE_HOME=$PWD/cache
export PYTHONPATH=<PluginBench checkout at origin/main 942f12c>/src
export PATH=<run folder>/bin:<PluginBench venv>/bin:$PATH
python -W ignore -m pluginbench run screen.yaml --output <run folder>/results/screen --yes --foreground
```

Launched 2026-11-09 21:04 as the systemd user unit `egc-screen`; log in `../logs/screen/`. The output path is absolute because PluginBench 942f12c rejects `../` in `--output` during task preparation (and still exits 0).

Output: `../results/screen`, chosen by the run owner.

## Admission (arm-blind)

Admission is decided after coding and before any judge call. It never uses one arm's score alone.

A task is dropped only when one of these holds:

1. **Infrastructure failure on either arm.**
   - An attempt cannot be scored after resume. Examples: a verifier error, a container or Harbor failure, or a Codex outage that resume cannot recover.
   - Or correctness is `unknown` for a reason other than an overlap pass.
   - Overlap passes count as passes (`count_overlap_passes: true`, card Amendment 1).
2. **Both arms fail.**

Not infrastructure, so the outcome stands:

- a timeout,
- an empty patch,
- an attempt that stopped to ask a question ("ask-stop"),
- a failure after the agent used tokens or ran a command.

Ask-stops count as that arm's failure. They are also counted per arm as a diagnostic.

**Ask-stop, defined before unblinding.** An attempt is an ask-stop when both hold:

- Its canonical patch is empty.
- Its final agent message asks the user a question or contains a "Waiting on you" section.

Classify every attempt by reading only its patch and final message, before opening any arm label or judge key.

The admitted set fixes the `admitted` split used below. Because both-fail tasks are dropped, pass-rate differences are over admitted tasks, not all 25.

## Outcomes

Primary:

1. **Correctness.** Each arm's pass (pass or overlap pass) on each admitted task, and the paired difference `workflow-lean − vanilla`.
2. **Judged preference.** `workflow-lean`'s score on each judged pair (defined below).

Secondary (reported, not decisive):

- Input plus output token ratio, `workflow-lean` to vanilla.
- Ask-stops per arm.
- Astra review findings by severity.
- Lines.
- Complexity, unused code, and coverage where measured.

## Analysis

Tasks are the unit. With one attempt per arm, each admitted task is one pair.

**Correctness.** Run `pluginbench compare ../results/screen --gates gates.yaml`, with this gates file written after admission:

```yaml
count_overlap_passes: true
splits:
  admitted: [<admitted task ids>]          # exactly the admitted tasks; any other excluded task makes a bound gate undetermined
gates:
  - name: correctness non-inferiority
    correctness: passes
    against: vanilla
    direction: higher
    bound: lower
    margin: -0.10
  - name: token ceiling
    metrics: [Input tokens, Output tokens]
    against: vanilla
    direction: lower
    bound: upper
    factor: 1.3
```

The paired section gives:

- the mean task pass-rate difference,
- a 10,000-draw task bootstrap (seed 0),
- a two-sided 90% percentile interval. Its lower endpoint (LB) and upper endpoint (UB) are one-sided 95% bounds.

The exact sign test is reported but does not decide anything.

**Judged pairs.** An admitted task where both arms pass. A pair with exactly one pass is decided by correctness and gets no judge call.

**Judged preference.**

- Each judged pair gets 4 votes, one per judge.
- `workflow-lean` wins the pair when at least 3 of the 4 judges prefer it, and vanilla wins when at least 3 prefer vanilla.
- Any other result, including 2–2 splits and splits with tie votes, scores 0.5.
- Pair scores are 1, 0.5, or 0.
- The statistic is the mean pair score. Its lower bound is the 5th percentile of 10,000 bootstrap resamples over judged pairs (seed 0).
- Supporting result: an exact one-sided binomial test on decisive pairs (ties excluded). At p ≤ 0.05 it needs:

| Decisive pairs | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 25 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `workflow-lean` wins needed | 7 | 9 | 10 | 11 | 12 | 13 | 15 | 18 |

**Sensitivity.** Repeat both primary analyses without adaptix and csstree. If the decision on those 23 tasks differs from the full result, report the result as dependent on tuned tasks. In that case, do not advance to confirmation without the owner's review.

## Decision rule

| Correctness | Judged preference | Decision |
| --- | --- | --- |
| Non-inferior: LB ≥ −10 pp | lower bound > 50% | Advance `workflow-lean` to confirmation |
| Non-inferior: LB ≥ −10 pp | lower bound ≤ 50% | `workflow-lean` ships on cost over `main`, if the token gate passes: upper bound of the geometric-mean token ratio to vanilla ≤ 1.3. Otherwise report and do not ship. |
| Not non-inferior: LB < −10 pp | not used | Stop and report. Label the result **inferior** when UB < 0 (`workflow-lean` shown worse than vanilla), otherwise **inconclusive**. Both labels mean stop. |

- The "ships on cost over `main`" branch is not measured in this screen, because there is no `main` arm.
  - The comparison to `main` rests on round 2 (climb tasks): `main` at 6.68M, 3.1× vanilla, against round 3's 2.65M, 1.24×.
  - The screen checks only that `workflow-lean` stays within the card's 1.3× token ceiling against vanilla.
- The inferior or inconclusive labels are added to the stopping rule so a stop is not reported as proof that `workflow-lean` is worse. They change no action.
- If the token gate is `undetermined` because a task's token total is missing, the token condition is not met. Report it, and do not ship on cost. Correctness and judging are unaffected.

### Additions to the brief

The brief fixed the arms, the admission rule, the −10 pp margin, the 50% judged-preference bound, and the three branches. These rules were added here to make the stopping rule executable. Keep or strike each one before the run:

1. The ship-on-cost branch requires the token gate (upper bound ≤ 1.3× vanilla), with `undetermined` counting as not met. This can change the brief's outcome.
2. The inferior and inconclusive labels for a stop. Labels only; the action is the same.
3. The sensitivity veto: if dropping adaptix and csstree changes the decision, do not advance without the owner's review.
4. The inconclusive triggers under "Inconclusive results": fewer than 6 tasks or judged pairs, more than 5 infrastructure drops, one-arm unknowns in 3 or more tasks, and missing judge verdicts.
5. The side-A bias rule in the judge protocol.
6. The 4-vote pair rule (3 of 4 to win, otherwise 0.5) and the bootstrap lower bound as the "judged-preference lower bound".
7. The ask-stop definition.

### Power

Simulated with the bootstrap rule above, 300 replicates per cell:

| Admitted tasks | Discordant share | P(non-inferior), true difference 0 | P(non-inferior), true difference +10 pp |
| --- | --- | --- | --- |
| 15 | 0.1 / 0.2 / 0.3 | 0.51 / 0.26 / 0.19 | 1.00 / 0.65 / 0.40 |
| 20 | 0.1 / 0.2 / 0.3 | 0.58 / 0.40 / 0.32 | 1.00 / 0.84 / 0.63 |
| 25 | 0.1 / 0.2 / 0.3 | 0.51 / 0.38 / 0.30 | 1.00 / 0.82 / 0.58 |

- In the climb, 1–2 of 12 vanilla-candidate pairs were discordant. Panel tasks were picked to be harder, so expect more.
- If `workflow-lean` is exactly as correct as vanilla, this screen declares it non-inferior only about 30–60% of the time.
- A stop is therefore likely to be labeled inconclusive, not inferior.

## Judge protocol

| Judge | Spec | Criteria |
| --- | --- | --- |
| Astra | `codex:gpt-6-astra:high` | [`review-standard.md`](../harness/review-standard.md) |
| Sol 6.1 | `codex:gpt-6.1-sol:high` | [`review-standard.md`](../harness/review-standard.md) |
| Opus 5.5 | `claude:claude-opus-5-5:high` | [`review-standard.md`](../harness/review-standard.md) |
| Fable 5.2 | `claude:claude-fable-5-2:high` | owner-profile criteria (private, not published) |

`judge prepare` takes one criteria file, so there are two prepare directories. Both use the same arms, the same judged tasks in panel order, and the same seed, so the A/B sides match:

```sh
J="--tasks <judged ids, panel order> --exclude testem-per-launcher-reports,dateutil-rfc5545-timezone-interop --seed 20261110"
pluginbench judge prepare ../results/screen=workflow-lean ../results/screen=vanilla $J \
  --criteria review-standard.md --output judging/standard
pluginbench judge prepare ../results/screen=workflow-lean ../results/screen=vanilla $J \
  --criteria <owner-profile criteria> --output judging/filip
pluginbench judge run judging/standard --judge codex:gpt-6-astra:high \
  --judge codex:gpt-6.1-sol:high --judge claude:claude-opus-5-5:high --jobs 3
pluginbench judge run judging/filip --judge claude:claude-fable-5-2:high
pluginbench judge tally judging/standard; pluginbench judge tally judging/filip
```

- Before any `judge run`, confirm that the two `key.json` files assign the same side to each arm on every pair. If they differ, re-prepare `judging/filip`.
- One attempt per arm gives one pair per task, so every call holds one pair.
- The 4-vote combination above is computed from the two directories' verdicts and keys. `tally` scores each directory on its own; its weighted wins are reported but do not decide anything.
- Report each judge's side-A rate and its agreement with the other judges. If a judge picks side A in more than 75% or fewer than 25% of 8 or more pairs, also report the preference result without that judge.
- A failed call is retried with `judge run`. A pair that still lacks any judge's verdict makes the preference result incomplete.

Known differences from the §30 validation of the owner-profile judge:

- In §30, Fable read both the owner profile and the owner-profile review standard. `pluginbench judge` supplies one criteria file and no extra reading, so here Fable reads only the review standard.
- The §30 packets had no starting source. PluginBench gives every judge `source/`.

## Inconclusive results

Any of these makes the screen inconclusive. Report it and do not advance or ship:

- Fewer than 6 admitted tasks, so compare reports "too few tasks". Or fewer than 6 judged pairs on the advance branch.
- Correctness LB < −10 pp with UB ≥ 0.
- More than 5 of 25 tasks dropped for infrastructure.
- Unknown correctness on only one arm in 3 or more tasks. Report this even when those tasks are dropped.
- Missing judge verdicts after retries, on a branch that needs the judged preference.
- The sensitivity analysis changes the decision (see "Sensitivity").

## Changes after this point

Any change to arms, tasks, admission, margins, judges, or the decision rule is an amendment. It is logged with its reason before the key is unblinded. Changes to the judge protocol are logged before any `judge run`.


## Amendment (2026-11-10, before any judging; no results seen)

- The screen run stopped at 02:29 when the host shut down. 45 of 50 attempts were complete: 20 tasks had both arms, and 5 (adaptix, oxvg, skrub, wasmi, textual) had one.
- The resume was refused by PluginBench's runtime drift guard. The only change was Docker's reported host memory: 25198305280 to 25198276608 bytes, after a WSL kernel update (6.18.54 to 6.18.58). Rewriting the roughly 160 hash-bound records was rejected.
- Owner-approved fix: `screen-topup.yaml` codes both arms of those 5 tasks again, 10 attempts, in `../results/screen-topup`. The one-arm attempts for those 5 tasks in `../results/screen` are not used.
- The reviewer was not run for either part. All 25 pairs are judged from attempt diffs, with one pair per call, as planned. Reviews were diagnostics only and enter no decision rule.
- Decision rules, judges, and analysis are unchanged.
