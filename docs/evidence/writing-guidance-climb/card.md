# Writing-guidance climb: card

Status: frozen on 2026-11-06, before round 1.
Method: a guidance climb, as the `hill-climb` skill's `references/guidance.md` describes. The climb chooses a candidate. A separate pre-registered probe on fresh briefs decides whether it ships, because the climb's own tasks chose the winner.

## Why this design

Two probes failed: the [reader-pages probe](../reader-pages-probe/prereg.md) and the [guide-body probe](../guide-body-probe/results.md). In the guide-body probe, readers passed 29–30 of 30 tasks in every arm, so read depth decided every pair. Judges also flagged every page for restatement, so that question could not separate them. This climb changes three things:

- Writers work from messy sources, not a clean fact sheet: help output, a changelog that changes a default, a thread with an exception, and maintainer notes. Each brief sets a word limit.
- Reader tasks turn on those traps: the changed default, the exception, the failure and its recovery, and a combined value.
- One score that counts success first and depth second. No judge votes decide a round.
- Error analysis of the no-guidance and current pages' reader failures comes before any rule is proposed.

## Card

| Field | Value |
| --- | --- |
| Goal | Change `technical-prose.md` so pages agents write let a first-time reader do real tasks correctly, and find what each task needs early, across the four Diátaxis page types. |
| Scope | `plugins/workflow/skills/technical-writing/references/technical-prose.md` only. A new reference file would change a pointer, which needs a routing evaluation. |
| Criteria | Reader task success; read depth; fit to the page type; no fact beyond the fact sheet. |
| Task set | Four briefs, one per page type: tutorial, how-to guide, reference, explanation. A fresh, read-only Sol 6.1 call wrote the briefs, sources (about 1,200 words each), and tasks without seeing any guidance. Each brief has a word limit of 450 to 500 and five reader tasks with pattern answer keys; each key item lists its accepted synonyms. |
| Attempts | Three builds per brief per version. Builder: Codex `gpt-6.1-sol`, reasoning `high`. Reader: Codex `gpt-5.6-sol`, reasoning `low`, one call per build. |
| Versions | Baseline: an empty guidance file. Start: `origin/main` at `48453586`. Each non-baseline version is one file holding the technical-writing `SKILL.md`, its references, `core.md` "Written deliverables", and `DESIGN.md` "Copy and density". Only `technical-prose.md` differs between versions. |
| Decision rule | `score`. |
| Score | For each task: 0 when the answer fails its key; otherwise 1 − 0.4 × min(depth ÷ the brief's word limit, 1). Depth is the words from the top of the page through the block that holds the last passage the reader quoted. A quoted passage that is not on the page is ignored; a pass with no valid passage gets the page's full length as its depth. The version's score is 100 × the mean over all tasks and attempts. Higher is better. |
| Smallest gain | 1.0 point. In the pilot, the score of one attempt set (20 tasks) varied with a standard deviation of 0.33 to 0.53, so a version's mean over 3 attempts has a standard error near 0.3, and a difference between two versions near 0.4. One point is about 2.5 of those. |
| Gates | `technical-prose.md` stays at 1,200 words or fewer; `node tests/workflow/validate-contracts.mjs`; `node tests/skills/validate-skills.mjs`. |
| Behavior | Not applicable: guidance only. |
| Budget | 5 rounds. Size limit: 40 added lines, because rules per page type need room. Call cap: 240 for the whole climb. Used before round 1: 98 (two pilots). Planned: 4 error-analysis calls, 3 proposers, 24 per round (12 builds, 12 readers), 3 for the final scorecard. Five rounds: 98 + 4 + 3 + 120 + 3 = 228, which leaves 12 spare calls. |
| Proposers | The council lineup: Astra, Sol 6.1, Opus 5.5. Each gets the baseline and start pages, the reader failures, and the error analysis, as the Prune step allows. |
| Final check | One scorecard pass by each council judge, then the final version against the baseline by score. |
| Not covered | Real pages from real repositories; skills that load the guidance on their own; any reader other than the one model. |

## Pilot findings

- Pilot 1 used clean fact sheets. With the keys corrected for synonyms, readers passed nearly every task under both versions: builders copy every fact. Its material is not used in the climb.
- Pilot 2 used messy sources. Both versions passed 60 of 60 tasks over 3 attempts each. Success is at ceiling for this builder and reader, so read depth carries the score, and success acts as a guard: one failed task costs more than any depth gain.
- Pilot 2's builds are the climb's baseline and start attempts. Baseline (no guidance) scored 78.55. Start (`main`) scored 79.51.

## Run rules

- **Isolation.** Each build reads only its version's file, with a random name. The build prompt says not to use any skill or plugin. The operator reads the activity of pilot builds to confirm that no skill loaded. A build that loaded a skill is void and is rerun.
- **Retries.** Any call that leaves no usable reply file gets one retry from the spare calls, whatever its reply says. A second failure stops the climb.
- **Concurrency.** At most 8 calls at once.
- **Privacy.** Prompts, pages, and replies stay on the machine that ran the climb. Only summary numbers are committed.
