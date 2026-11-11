# Loop-only rejection pilot: pre-registration (draft)

Date: 2026-11-10. Draft. No paid call is authorized by this file. The run needs the owner's approval after the dry run.

## Question

Can a much smaller engineering guidance bring the guided arm's cost down to near vanilla on harder tasks without losing correctness that vanilla gets? This pilot only rejects. A pass justifies a larger, separately approved panel run. It cannot show non-inferiority or justify shipping.

## Why this candidate

The paired screen (notebook §32) stopped inconclusive. `workflow-lean` passed 80% against vanilla's 90% at 1.65× vanilla's tokens. A four-member council (Astra, Sol 6.1, Opus 5.5, Fable 5.2) measured the screen traces independently. They agreed on these facts:

- Over the 19 paired tasks with token totals, lean used 25.0M more tokens than vanilla, and nearly all of the excess was cached input.
- Three reviewer subagents used 7.27M of that, 29%. They started on additive format work under the "persisted data or formats" trigger. Three of them forked the parent's history.
- The tasks without a reviewer still ran at about 1.45×. Lean made more requests (about 614 against 498) and more shell commands (835 against 657). It read test-audit in 15 to 20 of its attempts and technical-writing in 13 to 18, depending on how each member counted.

The members proposed two kinds of change:

- **Narrow the triggers (Opus, Fable).** Their own projections land at about 1.35–1.45×, above the card's 1.3× ceiling.
- **Subtract to the engineering loop (Astra, Sol).** This is the only proposal with a projected path under 1.3×.

Cost comes first, so this pilot tests subtraction. Opus's three-trigger bundle is the fallback if subtraction loses correctness.

## Arms

| Arm | Delivery |
| --- | --- |
| `vanilla` | Codex built-in instructions only |
| `workflow-loop` | `../arms/workflow-loop/AGENTS.md` as guidance, no plugin |

`workflow-loop` is 475 words and 3,081 bytes, against `workflow-lean`'s 2,994 words and 19,476 bytes plus the plugin's skill listing. All its text comes from `../arms/workflow-lean/`, the screened arm, and not from `main`:

- From `AGENTS.md`, "Source of truth and authority": the "Start state-changing work…" bullet and the ambiguity bullet, which carries the ask fix.
- From `workflow/skills/engineering/SKILL.md`: "Work the change" steps 1–9 and "Finish". The only change is at the end of step 9, where "required checks and review gates pass" becomes "required checks pass", because the arm has no review route.

Everything else is left out. That includes the rest of `core.md`, the final-message ledger, the footer, delegation and roles, coding standards, the plugin, its skills and references, and the routes to review and test-audit. No `$workflow:` pointer remains.

Fixed settings are those of the screen top-up. See `loop.yaml` (machine-local):

- Codex harness, `gpt-6.1-sol`, reasoning high.
- Subagents on, `max_threads: 4`.
- `timeout_seconds: 1800`, `jobs: 2`, `seed: 42`, `repeats: 1`.

There is no reviewer and there are no judges. The measurements are tokens and lines.

## Tasks

Six panel tasks, chosen for diagnosis, not as a representative sample:

| Task | Screen: vanilla / lean | Screen tokens: vanilla / lean | Why |
| --- | --- | --- | --- |
| go-critic-doc-link-checker | fail / overlap pass | 1.25M / 2.01M | lean-only pass |
| tomlkit-toml-table-converters | overlap pass / fail | 1.21M / 4.91M | vanilla-only pass, reviewer started |
| etree-xml-diff-patch | overlap pass / fail | 1.39M / 5.99M | vanilla-only pass, reviewer started |
| skrub-duration-encoding | overlap pass / overlap pass | 2.41M / 2.01M (top-up) | lean cheaper than vanilla |
| fd-deterministic-multi-key-sorting | pass / overlap pass | 1.05M / 1.77M | ordinary, no reviewer |
| sql-formatter-bigquery-pipe-formatting | pass / pass | 0.59M / 0.97M | ordinary, no reviewer |

The screen totals on these six are vanilla 7.90M and lean 17.66M.

Excluded:

- Adaptix and csstree, the climb's tuning tasks.
- The climb's two holdouts. They are not in the panel.
- The other 17 panel tasks, which stay available for the confirmation run.

## Control

Vanilla runs in the same PluginBench run, either as cache hits or coded fresh.

- **PluginBench version.** The paid run uses PluginBench `main` after two changes merge: PR #29, which takes Docker capacity out of the cache keys, and the fix for Claude judges and the CLI's `@builtin` plugins. A run started on that `main` is saved as schema 3, and 942f12c cannot continue it. One run uses one version, and only one PluginBench process runs at a time.
- **Hits.** After #29, a `run --dry-run` with `PYTHONPATH` on the merged `main` and `XDG_CACHE_HOME` on the screen's cache root shows a hit or a miss for each vanilla attempt. A hit needs the screen's jobs, seed, repeats, model, reasoning, harness, CLI version, limits, and task assets, so `loop.yaml` keeps seed 42, jobs 2, repeats 1, and `gpt-6.1-sol` high. A hit makes the cached screen attempt the control. A miss codes vanilla fresh.
- **Version 942f12c.** On 942f12c every screen vanilla attempt misses, because the capacity hash changed after the WSL kernel update.
- **No historical control.** Do not use the stored screen records in place of a fresh vanilla. Baseline drift is a known threat (notebook "Validity threats").
- **No reviewer.** The pilot makes no judge call, so it needs no review packets. A later panel run that is judged keeps the reviewer in its config, so that `judge prepare` works. Its first judging step is one judge call on one pair, because on `main` the judge sandbox also denies writes to `/` and `/tmp` (PR #23).

## Outcomes and decision rule

Correctness counts a pass or an overlap pass (card Amendment 1). It is judged against vanilla's result in this run.

**Reject `workflow-loop`** if either holds:

1. It fails a task that this run's vanilla passes.
2. The geometric mean of its per-task token ratio to vanilla (input plus output) is above 1.3, the card's ceiling.

**Otherwise it advances** to a panel run. That run needs its own pre-registration and the owner's approval.

**Inconclusive:** an attempt that is still unscored after resume, or a missing token total. A timeout, an empty patch, or an ask-stop is that arm's failure, not infrastructure.

Report, without letting them decide:

- the 90% CI of the token ratio (task bootstrap, seed 0, 10,000 draws);
- the aggregate token totals;
- each task's ratio to lean's stored screen attempt;
- go-critic, which vanilla failed in the screen and only lean passed;
- the mechanisms in each trace: `spawn_agent` calls, model requests, shell commands, test commands, and final-message length.

**What this pilot cannot detect:**

- **Correctness loss.** Suppose both arms pass each task with probability 0.9 and fail independently. Then a candidate exactly as correct as vanilla avoids rule 1 on 5 vanilla-passing tasks only about 59% of the time. So a pass is weak evidence for correctness, and a rejection is weak evidence against it. A rejection triggers the fallback candidate, not a conclusion.
- **Small cost differences.** The screen's per-task log-ratio SD is about 0.4. A six-task 90% CI is therefore about ±30% wide. The 1.3 bar is applied to the point estimate.

## Cost estimate

These figures cover model usage only and are taken from the screen's records. Dollars are not estimated, because there is no price table.

| Component | Low | Expected | High |
| --- | ---: | ---: | ---: |
| `workflow-loop`, 6 attempts (0.8× / 1.2× / 2.2× vanilla's 7.90M) | 6.3M | 9.5M | 17.7M |
| Vanilla, 6 attempts, if the cache misses (0.7× / 1.0× / 2.0×) | 5.5M | 7.9M | 15.8M |
| **Total, vanilla cached** | 6.3M | 9.5M | 17.7M |
| **Total, vanilla fresh** | 11.8M | 17.4M | 33.5M |

- The high case for the candidate assumes it costs as much as lean did on these tasks.
- All calls are Codex `gpt-6.1-sol`. On 2026-11-10 the Codex weekly window stood at 59% used, against 18% expected at that point (resets 2026-11-16).
- Wall clock: 6–12 attempts at `jobs: 2`, about 1–2 hours.

## Run (after approval only)

```sh
cd <run folder>/loop
umask 022
export XDG_CACHE_HOME=<run folder>/screen/cache
export PYTHONPATH=<PluginBench checkout>/src
export PATH=<run folder>/bin:<PluginBench venv>/bin:$PATH
python -W ignore -m pluginbench run loop.yaml --output <run folder>/results/loop --yes
```

The PluginBench commit is merged `main` with PR #29 and the Claude-judge fix, confirmed with the PluginBench audit thread before the start. The output path must be absolute.

Dry run on 2026-11-10 used PluginBench 942f12c, with no preparation and no model calls. It planned 12 coding attempts and 0 reviews. The `workflow-loop` `AGENTS.md` had sha256 `4c96ea9e…` and 3,081 bytes, with no skills and no plugins. A dry run does not resolve cache hits. On 942f12c the 6 vanilla attempts are expected to miss, so they are planned as fresh.

## Approval and pinned setup (2026-11-10, before any coding)

- The owner approved the candidate and the paid pilot ("whatever you recommend").
- PluginBench `main` is pinned at **9ea60af**, a fresh clone in `../pb-main`. It includes #29 (cache keys without Docker capacity), #31 (Claude CLI built-in plugins), and #23 (sandbox denies writes outside the granted roots).
- `pluginbench check loop.yaml` on 9ea60af, with `XDG_CACHE_HOME` on the screen's cache root, reported **vanilla 6 of 6 hits**. See `check-main.txt`.
  - The skrub hit is the top-up's attempt `60b341255a4c206f`, which the screen used.
  - So the control is exactly the screen's vanilla attempt on each of the six tasks.
- Paid work: 6 `workflow-loop` coding attempts. Expected 9.5M tokens, range 6.3–17.7M.

## Changes after this point

Any change to the arms, tasks, control, or decision rule is an amendment. Log it with its reason before the run starts, or, if it comes after the run, before any result is read.
