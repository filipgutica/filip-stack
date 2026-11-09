# Round 2 proposer brief: engineering guidance climb

Role: Critic. Read the "Critic" section of `/home/filip/.agents/roles.md` before you start. You are read-only: do not edit, create, or delete any file anywhere. Do not start subagents. Return your proposal as your final message.

## Goal

Propose one set of edits to Filip's engineering guidance. Agents that follow the edited guidance should leave code in better shape for its next maintainer, cost at most 1.3 times the tokens of an agent with no guidance, and pass the task's tests no less often.

## Where round 1 left off

- The incumbent is still `main`. Round 1's candidate ([round-1-candidate.diff](../round-1/candidate.diff)) passed the correctness gates and failed the token gate: 2.91M against a limit of 2.17M (vanilla 1.67M). `main` uses 4.59M. Against `main` it also failed two mechanical gates, duplicated test lines (106 against 46) and high plus medium review findings (10 against 9), and passed the rest; see `measures-round-1.txt`. (Corrected after launch: the first version of this brief said it passed every mechanical gate.)
- Round 1's candidate started no subagents, and every attempt read `engineering/SKILL.md`. Its tokens still ran 1.75 times vanilla's, with the largest gap on happy-dom (3.7M to 7.1M per attempt against vanilla's 2.1M to 3.3M).
- Almost all tokens are cached input: every extra turn re-reads the whole context. Turns and context size drive cost, not new text.
- Your edits are against `main`. You may keep, change, or drop any of round 1's edits; say which.

## What you have (all under `/home/filip/code/pluginbench/runs/egc-20261106/round-2/bundle/`)

- `error-analysis-pilot.md`: the pilot error analysis from round 1. Its hypotheses H1 to H5 still apply.
- `measures-round-1.txt`: `pluginbench compare` output with the card's gates for vanilla, `workflow-main` (from the pilot), and `workflow-r1` on the 4 climb tasks.
- `tokens-per-attempt.txt`: total, uncached, output, and reasoning tokens and minutes for every climb attempt.
- `activation-round-1.txt`: for each round-1 attempt, the skill and references it read, the subagents it started, and the lookups it made for things the container lacks.
- `diffs/<task>/<arm>-r<n>-reward<r>.patch`: every pilot and round-1 patch on the climb tasks. `round-1-candidate` is round 1's candidate, `incumbent-workflow-main` is `main`, and `vanilla-no-guidance` has no guidance.
- `guidance/`: the current text of every file you may edit, as in round 1.
- Raw traces, read-only, if you need to see where turns went: `results/pilot/round-1-coverage/evidence/` and `results/pilot/round-1-no-coverage/evidence/` under `/home/filip/code/pluginbench/runs/egc-20261106/`. `plan.json` maps attempt ids to task, arm, and repeat; each attempt's events are in `attempts/<id>/handoff/artifacts/stdout.jsonl`.
- The criteria: `/home/filip/.t3/worktrees/filip-stack/t3-a50a29c8/docs/evidence/engineering-guidance-climb/harness/review-standard.md`.

## Rules

- **Frozen:** every skill `description` in the front matter, the other sections of `core.md`, and `roles.md`.
- **Size limit:** at most 40 added lines over the whole climb. Round 1's candidate added 16. Cuts do not count. Aim for 12 or fewer added lines this round, counted against `main`.
- **General advice only.** The edits ship as everyday guidance for Claude Code and Codex. A line that names one of these tasks, its library, or its domain is rejected.
- **No rule may target the benchmark itself**, for example "skip review in benchmarks". The edits must hold for real work in Filip's repositories.
- **Word budget:** `tests/workflow/validate-contracts.mjs` limits each Workflow skill body other than Simplify to 3,500 words.
- **The gates decide the round, in this order.** Round 2 codes vanilla, `main`, and your candidate fresh, side by side.
  1. Correctness: passes at least vanilla's minus 1 over the 12 climb attempts.
  2. Tokens: the mean over tasks of per-task median total tokens at most 1.3 times vanilla's.
  3. Mechanical measures may not worsen against `main`: cognitive complexity ratio to reference, complexity hotspots, introduced dead code, duplicated test lines, changed-line coverage, high and medium review findings, and, new this round, redundant added tests.
  4. Blind judges compare matched diff pairs against `main`. The candidate needs 8 of 12 weighted pair wins.
- **Prune:** Propose cuts as well as additions. Cut a line when the no-guidance outputs already do what it asks, when another line says the same, or when no output shows its effect. Rewrite a prohibition as the behavior to produce.

## Questions to settle

- **Turns.** Find what makes round 1's candidate take more turns than vanilla on the same task: extra reading, extra check runs, re-verification, reporting. Name the guidance line that causes each, with trace evidence.
- **Quality.** Keep what makes `main`'s and round 1's diffs better than vanilla's, with evidence from the diffs. The clearest difference so far is fewer and less redundant tests.
- **Fallback lookups.** Every round-1 attempt looked up `~/.agents/` twice. Decide whether a guidance line causes it and whether it costs turns.

## Output

Return Markdown with these sections:

1. **Edits.** For each edit, against `main`: the file; the exact current text, copied verbatim; the replacement text, or "delete"; one line of evidence from the bundle, citing the file and attempt. Mark each edit that round 1's candidate already made.
2. **Totals.** Added lines, removed lines, and the word-count change over the scoped files, against `main`.
3. **Predicted effect.** The token ratio to vanilla with your arithmetic, and the expected effect on each quality criterion and on redundant tests.
4. **Risks.** What real-work failure each edit could cause, and which edit you would drop first.

Keep it under 1,200 words, not counting the quoted text.
