# Engineering guidance climb: card

Status: frozen on 2026-11-06, before any paid call.
Method: a guidance climb, as the `hill-climb` skill's `references/guidance.md` describes, with PluginBench running every attempt. The climb chooses a candidate. The pre-registered probe in [prereg.md](prereg.md) decides whether it ships, because the climb's own tasks choose the winner.

## Why this design

- No PluginBench study has measured the engineering guidance since iteration 7 (2026-09-03). Commits `39dde91`, `8932f1d`, `0c93e0f`, and `d2c1a22` changed it after that study.
- Earlier engineering studies used one SWE-bench task that vanilla always solved, so correctness could not improve. This climb uses six DeepSWE tasks with source-bound correctness and code measures against each task's reference solution.
- The goal is code in the best shape for its next maintainer. Six of the criteria have no mechanical measure, so calibrated blind judges decide rounds. Mechanical measures, correctness, and tokens are gates.

## Card

| Field | Value |
| --- | --- |
| Goal | Change the engineering guidance so that agents leave code in the best shape for its next maintainer, with confirmed correctness no worse than vanilla and bounded token use. |
| Scope | `host-config/guidance/core.md`: the Core principles, Source of truth and authority, Skills and delegation, Evidence, Testing hygiene, and Coding standards sections. `host-config/agents/CODING_STANDARDS.md`. The `SKILL.md` bodies and references of Workflow `engineering`, `test-audit`, `review`, and `simplify`. |
| Frozen | Every skill `description`, the other `core.md` sections, `roles.md`, and the other Workflow skills. |
| Criteria | Ownership boundaries; no leaky abstraction; no over-abstraction; simplicity and low complexity; reuse; extensibility through existing seams, never speculative hooks; no unnecessary overlap; meaningful coverage; no duplicated or dead tests; no dead code; fewer review findings. [harness/review-standard.md](harness/review-standard.md) defines each one. |
| Task set | Six DeepSWE tasks at `datacurve-ai/deep-swe@0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea`, all with reviewed verifier contracts. **Climb:** `true-myth-iterable-collection-combinators`, `csstree-shorthand-expansion-compression`, `happy-dom-abort-pending-body-reads` (TypeScript), `adaptix-name-mapping-aliases` (Python). **Holdout:** `testem-per-launcher-reports` (TypeScript), `dateutil-rfc5545-timezone-interop` (Python). The split is fixed by language before any result exists. Proposers never see holdout traces. |
| Arms | Vanilla and Superpowers (`obra/superpowers` Codex plugin `0722921d`, tree digest `70813996…749b`, run as shipped) are controls in the pilot and the probe. Each Workflow version is a guidance file plus a full `plugins/workflow` copy, built by [harness/build-version.mjs](harness/build-version.mjs). |
| Delivery | The guidance file is the version's own Codex host-config render, with `~/.agents/CODING_STANDARDS.md` and `~/.agents/roles.md` appended under headings that name their paths, because those paths do not exist in a PluginBench container. Every Workflow version uses the same adaptation. PluginBench rejects custom agents, so the `critic`, `reviewer`, and `worker-high` profiles do not exist, and agents fall back to default subagents. |
| Runner | Codex `gpt-6.1-sol`, reasoning `high`, 1,800 s timeout, subagents on with `max_threads: 4`, 3 repeats, PluginBench default jobs and seed. Measurements: `tokens, lines, cyclomatic, cognitive, dead_code, review`, plus `coverage` on true-myth (`@vitest/coverage-v8` 3.2.4), csstree (`c8` 11.0.0), adaptix (coverage.py 7.6.9), and dateutil (coverage.py 7.17.2), with per-test data on the two Python tasks. The happy-dom and testem images ship no coverage tool, so their coverage is unknown. Reviewer: Codex `gpt-6-astra`, reasoning `high`, with the review standard as its fixed guidance. |
| Configs | Each phase runs two evaluations with identical coding settings: [harness/pilot-coverage.yaml](harness/pilot-coverage.yaml) for the four coverage tasks and [harness/pilot-no-coverage.yaml](harness/pilot-no-coverage.yaml) for happy-dom and testem. `require_ready` stops a run when any selected measurement is unavailable on any task, so one evaluation cannot hold both groups. Results are combined per task. |
| Decision rule | `both`, adapted: the gates below, then judges. |
| Gates | 1. **Correctness:** confirmed passes ≥ vanilla − 1 over the 12 climb attempts; no task falls 2 or more below vanilla; unknown correctness does not count as a pass and must not rise by 2 or more. 2. **Tokens:** the mean over tasks of per-task median total coding tokens (root plus children) ≤ 1.3 × vanilla's. 3. **Mechanical, against the incumbent:** mean per-task median net cognitive complexity ratio to reference up by no more than 10%; no more complexity hotspots, introduced unused-code findings, or duplicated test lines in total; changed-line coverage down by no more than 10 points where available; high plus medium review findings not up in total. 4. `node tests/workflow/validate-contracts.mjs` and `node tests/skills/validate-skills.mjs` pass. |
| Judges | Astra, Sol 6.1, and Opus 5.5, each eligible only after calibration. Each judge call gets one task's prompt, read-only starting source, and that task's three matched diff pairs, with A and B randomized per pair. Judges see no traces, final messages, or verifier results. When exactly one side of a pair has confirmed correctness, that side wins the pair without a judge vote; unknown correctness counts as not passing. Judges decide only pairs where both sides passed or both failed, so a smaller patch that fails the task cannot win on simplicity. A judged pair goes to the side that a strict majority of eligible judges prefers; a tie counts half. The candidate needs at least 8 of 12 weighted pair wins over the incumbent. Results report correctness-decided and judged pairs separately. |
| Prune | A candidate with fewer words over the scoped files wins when it is no worse: all gates pass and it gets at least 6 of 12 weighted pair wins. |
| Size limit | 40 added lines over the whole climb. Cuts do not count. |
| Budget | 3 rounds, one candidate each. Calls: 12 reviewer and 3 judge calibration calls; pilot 54 coding plus 54 reviews; 1 error-analysis call; per round 3 proposers, 12 coding, 12 reviews, 12 judges; probe 40 coding, 40 reviews, 18 judges. About 340 model calls, 130 of them coding attempts. Each paid phase needs the user's approval. |
| Proposers | Astra, Sol 6.1, and Opus 5.5, read-only. Each gets the error analysis, the controls' and incumbent's diffs and measures, the judges' reasons, and the Prune line from `references/guidance.md`. Task-specific advice is rejected. |
| Final check | The probe in [prereg.md](prereg.md). |
| Not covered | Claude Code behavior, because PluginBench codes with Codex only (on 2026-11-07 Filip chose to assume the result carries over to Claude Code); peak context per turn, for which the cached and uncached input split is the only proxy; tasks outside one dataset; human review effort; whether the guidance caused a behavior, since traces show only what loaded. |

## Preparation findings (2026-11-06, no model calls)

- **Task source.** The registry dataset `datacurve/deep-swe-1-1` at `sha256:5affcd…a2f5` holds verifier trees that PluginBench has not reviewed. The same six tasks at `datacurve-ai/deep-swe@0b9fabbb` match all six reviewed digests.
- **dateutil repairs.** [harness/prepare-tasks.sh](harness/prepare-tasks.sh) changes two lines of the dateutil environment Dockerfile. The verifier tree is unchanged, and its digest still matches the reviewed contract.
  - The image no longer built. Its Dockerfile downloads the latest `python-dateutil` sdist without a version and extracts `python-dateutil-*.tar.gz`, but PyPI now serves that sdist as `python_dateutil-*`. The script pins `python-dateutil==2.9.0.post0`.
  - The agent could not run the suite. The verifier grades in a pinned prebuilt image, but the agent codes in an image rebuilt from the Dockerfile, where unpinned `requirements-dev.txt` installs pytest 9.2.0. Under the repository's `filterwarnings = error`, pytest 9.2.0's removal warning stops collection, so `pytest tests` runs no test. The script pins the four packages that differ from the grader image: `coverage==7.14.1`, `hypothesis==6.155.2`, `iniconfig==2.3.0`, `pytest==9.0.3`. The suite then passes 2,031 tests in the agent image, as it does in the grader.
- **Agent environments.** In each rebuilt agent image, the reference solution plus the hidden tests pass both the task's `base` and `new` test modes. This shows that agents can run the task's tests where they code.
- **Gradability.** Harbor's `oracle` agent applied each reference solution to the rebuilt images. All six scored reward 1.0, with every fail-to-pass and pass-to-pass test passing. The `nop` agent scored all six 0.0: no fail-to-pass test passed, and every pass-to-pass test passed. Unpinned dependencies have drifted since the tasks were published; for example, dateutil now installs pytest 9.2.0. The oracle result shows that the drift does not break grading.
- **Measurement scope.** The first pilot launches stopped at the readiness gate before any coding call. Four fixes in filipgutica/pluginbench#6 cover PluginBench bugs: file modes, the Fallow version line, the Linux Oxc binding, and coverage.py's line 0. Two measurement inputs cover the rest:
  - [harness/fallow-config.json](harness/fallow-config.json) keeps PluginBench's default test ignores and also ignores `docs/**` and CSS/HTML files. true-myth's docs import a generated typedoc file that does not exist. Fallow also discovers csstree's CSS and HTML fixtures, but PluginBench's JS/TS completeness check does not count them, so the two populations disagree. Neither path holds task code.
  - true-myth's vitest config excludes `src/index.ts` from coverage, so the report misses one source file and the population is incomplete. The coverage command overrides the exclude list.
- **Calibration pairs.** [harness/build-calibration.py](harness/build-calibration.py) builds six planted-defect pairs from the true-myth and adaptix reference solutions. [harness/judge-prompt.md](harness/judge-prompt.md) is the only judge prompt.

## Amendment 1 (2026-11-07, after a harness failure and before any valid result)

The first pilot (`pilot-failed-3`) stopped after 33 of 36 coverage attempts. The study does not use its results.

- **Git identity.** Every task prompt says "commit everything when you are done", and PluginBench grades `git diff <base> HEAD`, so only committed work counts. No agent image set a Git identity, so every `git commit` failed:
  - Vanilla (12 of 12) and Superpowers (11 of 11) set an identity themselves and committed.
  - Workflow `main` (11 of 11) staged the work and stopped to ask which author to use. Its patches were empty, and every one scored 0.
  - That behavior matches the guidance's authority rules, and real checkouts have an identity, so the failure measured the environment rather than code shape. `prepare-tasks.sh` now sets the neutral identity `Task Developer <developer@example.invalid>` in every task's agent environment, for every arm. It uses `[environment.env]` in `task.toml` with Git's `GIT_CONFIG_*` variables, so `git config user.name` reports it as ordinary config. The verifier environment, the verifier trees, and their digests are unchanged.
  - A first fix added the identity to each environment Dockerfile. A smoke test showed that it had no effect: PluginBench runs agents in each task's prebuilt `docker_image` and never builds the Dockerfile.
- **Token accounting.** The host runs Codex CLI 0.167.0, and PluginBench parsed forked-subagent rollouts only from 0.162.1. Every attempt that forked a subagent recorded no usage: 12 of 12 Workflow and 2 of 11 Superpowers attempts in `pilot-failed-3`. Commit `e9f5c8a` in filipgutica/pluginbench#6 accepts 0.167.0, whose rollouts have the same layout. On the smoke test's Workflow trace, accounting is complete, and the two sessions sum to the reported total.
- **Correction to the preparation findings.** For the same reason, the two dateutil Dockerfile repairs never affected a PluginBench run. The prebuilt dateutil image already has pytest 9.0.3 and runs the suite. `prepare-tasks.sh` no longer makes those edits. The "Agent environments" and "Gradability" findings describe images rebuilt from the Dockerfiles, not the prebuilt images that agents code in. For the prebuilt images, the evidence is that vanilla scored reward 1.0 in `pilot-failed-3` on all four tasks that run reached.
  - The pilot reruns every arm fresh. No attempt from `pilot-failed-3` counts, and none is reused as the vanilla cache.
- **Overlap passes.** In `pilot-failed-3`, 8 control attempts scored reward 1.0 with every fail-to-pass and pass-to-pass test passing. PluginBench still recorded their correctness as unknown, because the agent had edited test files that the verifier overwrites with its trusted copies.
  - Those edits cannot change the grade. The verifier grades the agent's production code against its own tests.
  - Under the original rule, an arm that adds tests to existing test files, which this climb's criteria reward, would lose passes for doing so.
  - From now on, an **overlap pass** is an attempt where:
    - the native verifier reports reward 1, with all fail-to-pass and pass-to-pass tests passing; and
    - PluginBench withheld confirmation only because trusted verifier tests overwrite paths the agent changed.
  - An overlap pass counts as a pass in correctness gate 1, in correctness-decided judge pairs, and in the probe's ship rule 1.
  - Results report confirmed passes and overlap passes in separate columns.
  - An attempt with the same overlap whose verifier reports reward 0 counts as a fail, for the same reason.
  - "Unknown" now means only attempts with no usable verifier result. The gate on unknowns applies to those attempts.

## Amendment 2 (2026-11-07, after the PluginBench overhaul and before round 2)

Filip approved these changes before any round-2 result existed.

- **Redundant added tests gate.** Gate 3 adds one check against the incumbent: the mean over tasks of the per-task median of redundant added tests must not rise. PluginBench counts an added test as redundant when every added line it executes is also executed by some other test, existing tests included. The measure exists on true-myth, csstree, and adaptix; happy-dom has no coverage tool, so its value stays missing and the gate covers the other three tasks.
- **Withdrawn true-myth coverage.** True-myth coverage from the pilot and round 1 is withdrawn. Vitest's default remapping counted every line of a loaded file as executed. The profile now uses AST-aware remapping, which counts statements, and writes per-test data. Gate 3's changed-line coverage check uses only figures from the new profile.
- **Gates as data.** Gates 1–3 are [harness/card-gates.yaml](harness/card-gates.yaml), run with `pluginbench compare --gates`, so anyone can rerun a decision from the saved reports.

## Amendment 3 (2026-11-09, after round 2 and before any round-3 result)

Filip approved these changes on 2026-11-09, after seeing round 2's result and before round 3's proposers started. They are a post-round-2 redesign of how the climb picks a candidate, so the notes report round 3 under both the original and the amended gates.

- **Why.** The incumbent fails gate 3 against itself. Pilot `main` and round-2 `main` ran the same guidance and model, yet they differ on every count gate: duplicated test lines 46 and 101, high plus medium review findings 9 and 8, redundant added tests on adaptix 11 and 8, and the cognitive ratio about 2.95 and 0.37, a swing that comes from happy-dom alone. Whichever run is the reference, the other fails gate 3. With zero tolerance on counts that noisy, a candidate as good as `main` probably fails gate 3, and the calibrated judges never run. A council (Astra, Sol 6.1, Opus 5.5) recommended the changes; all three agreed on the first two, and Opus 5.5 alone on the third.
- **Cognitive ratio floor.** The gate leaves out a task whose reference solution adds less than 10 cognitive complexity (`reference_floor: 10`). Only happy-dom falls below it: its reference adds 3, against 69 to 154 on the other tasks, so any floor from 4 to 69 gives the same result. Without happy-dom, `main`'s ratio was 0.49 in both the pilot and round 2.
- **Diagnostics.** Duplicated test lines, high plus medium review findings, and redundant added tests move from gate 3 to [harness/card-diagnostics.yaml](harness/card-diagnostics.yaml). They are reported beside every result and do not decide it; the judges weigh code shape, test value, and the defects the reviewer finds. Complexity hotspots, introduced unused-code findings, and changed-line coverage stay gates in [harness/card-gates.yaml](harness/card-gates.yaml).
- **Judges always run.** Round 3's 12 judge calls run even when gates 1–3 fail; then their result is reported only and does not decide the round.
- **Effect on earlier rounds.** Under the amended gates, round 2's candidate passes gates 1–3 (cognitive ratio 0.46 against 0.49 × 1.1). Rounds 1 and 2 do not reopen: their verdicts stand, and round 2's candidate can return only as a round-3 proposal.
- **The probe is unchanged.** [prereg.md](prereg.md) rule 3 uses "the card's mechanical gate". That means the gates as they stood after Amendment 2, frozen in [harness/probe-gates.yaml](harness/probe-gates.yaml). Amendment 3 does not change what ships.
- **Tasks and repeats are unchanged:** the four climb tasks, three repeats. Broader task selection belongs to a later study.

## Run rules

- **Tasks.** Build `tasks/` with `harness/prepare-tasks.sh`.
- **Environment.** Run PluginBench from filipgutica/pluginbench#6 (`PYTHONPATH` set to its `src/`; the run records its commit), with `umask 022`. Put the PluginBench virtual environment's `bin/` on `PATH` for Vulture 2.16. rust-code-analysis-cli 0.0.25 is in `~/.local/bin`.
- **Readiness.** Every paid run sets `measurement_settings.require_ready: true`.
- **Baseline reuse.** Rounds reuse the pilot's vanilla cohort and the incumbent's saved attempts while PluginBench's comparison identity matches. The probe runs fresh attempts for every arm.
- **Round identity.** Before each round, a dry run must show the same jobs count and comparison identity as the pilot, so vanilla comes from the cache. Otherwise the round's cost doubles; stop and report it.
- **Activation and fallback cost.** For every Workflow attempt, count the attempts that read `engineering/SKILL.md`, the references they load, and the subagents they start. Also count the lookups for things the container lacks, with their tokens: `~/.agents/...` reads, `$field-guide`, `humanizer`, `interface-design`, custom agent profiles, and `delegate_task`. When fewer than 80% of Workflow pilot attempts read `engineering/SKILL.md`, report it beside the result; the always-loaded guidance file still applies.
- **Privacy.** Raw prompts, traces, and diffs stay on the machine that ran the climb. Commit summary numbers only.
