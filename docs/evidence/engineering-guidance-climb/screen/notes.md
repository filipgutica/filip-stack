# Paired screen notes

Date: 2026-11-10. Result of the pre-registered screen in [prereg.md](prereg.md). Numbers: [summary.json](summary.json), computed with [analyze.py](analyze.py).

## Setup

- Arms: vanilla Codex and `workflow-lean`, one attempt each.
- `workflow-lean` is the round-3 candidate plus one `core.md` line, the [ask fix](ask-fix.diff). The line says to close a reversible environment gap, such as a missing `main` branch or Git identity, instead of stopping to ask.
- Tasks: the 25-task DeepSWE panel. It is harder and more varied than the 4 climb tasks. Adaptix and csstree are the only climb tasks in it.
- Runner: Codex `gpt-6.1-sol`, reasoning high, subagents on (`max_threads: 4`), 1,800-second timeout.

## Interruption and top-up

- A host shutdown stopped the run with 45 of 50 attempts complete. 20 tasks had both arms. Adaptix, oxvg, skrub, wasmi, and textual had one.
- PluginBench refused the resume. Its runtime drift guard saw Docker's reported host memory change by 28 KiB after a WSL kernel update.
- The owner approved a top-up that coded both arms of those 5 tasks again (10 attempts). The 5 one-arm attempts from the first part are not used.

## Deviations from the pre-registration

- **No reviewer.** Neither part ran the Astra reviewer. Reviews were diagnostics only and enter no decision rule.
- **Judging from diffs.** `pluginbench judge prepare` needs review packets, so a local script built the judge folders in the same format from attempt diffs. It used one pair per call, with sides drawn as planned.
- **Two judges missing.** Opus 5.5 and Fable 5.2 (owner profile) produced no valid verdicts. PluginBench's Claude harness treats the Claude CLI's built-in startup plugins as custom configuration and fails verification on every call. The judged preference was not needed, because correctness decided the outcome.

## Admission

Admission was arm-blind and done before any judge call.

| Outcome | Tasks |
| --- | ---: |
| Admitted | 20 |
| Dropped, both arms failed: termenv, ts-pattern, tengo, bandit | 4 |
| Dropped, infrastructure: cattrs. The vanilla attempt was never graded, because PluginBench's source export refuses the agent's `.venv` symlinks. | 1 |

- Ask-stops: 0 in each arm.
- The only empty patch was `workflow-lean` on oxvg. It timed out after 1,958 seconds while still testing.

## Result

| Measure | All admitted (20) | Without adaptix and csstree (18) |
| --- | ---: | ---: |
| Pass rate, `workflow-lean` | 80% | 78% |
| Pass rate, vanilla | 90% | 94% |
| Difference, 90% CI | −10 pp [−30, +10] | −17 pp [−39, 0] |
| Sign test p | 0.69 | 0.38 |
| Token ratio (geometric mean), 90% CI | 1.65× [1.42, 1.93] | 1.67× [1.42, 2.00] |

- Discordant tasks:
  - `workflow-lean` passed and vanilla failed: csstree and go-critic.
  - Vanilla passed and `workflow-lean` failed: oxvg (the timeout), tomlkit, etree, and anko-typed-variable-bindings.
- **Decision: stop, inconclusive.**
  - Correctness is not non-inferior: the lower bound, −30 pp, is below the −10 pp margin.
  - The upper bound, +10 pp, is not below 0, so the label is inconclusive, not inferior.
- **Sensitivity.** Without the two tuned tasks, the upper bound is exactly 0. That is still not below 0, so the label and the decision do not change.
- **Tokens.** Input plus output over 19 tasks; oxvg has no token total.
  - Totals over admitted tasks: vanilla 37.0M (median 1.47M per task) and `workflow-lean` 57.6M (median 2.01M).
  - The 1.3× ceiling fails. On the 4 climb tasks, the same round-3 guidance was 1.24× vanilla.
- **Judges, diagnostic only.** On the 14 pairs where both arms passed:
  - Astra preferred `workflow-lean` in 9 and Sol 6.1 in 8.
  - They agreed on 13 of 14.
  - They chose side A in 5 and 6 pairs.
- **Usage.** All 55 coding attempts used 125.1M input plus output tokens, including the 5 unused one-arm attempts. Judge usage was not recorded.

## PluginBench issues

The issues this screen found went to the PluginBench audit thread:

- a non-UTF-8 file that the change leaves untouched breaks line measurement;
- source export refuses symlinks;
- the Claude harness rejects built-in plugins;
- `report` cannot rebuild an interrupted run;
- `judge prepare` requires review packets.
