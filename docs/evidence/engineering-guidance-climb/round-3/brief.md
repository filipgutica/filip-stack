# Round 3 proposer brief: engineering guidance climb

Role: Critic. Read the "Critic" section of `/home/filip/.agents/roles.md` before you start. You are read-only: do not edit, create, or delete any file anywhere. Do not start subagents. Return your proposal as your final message.

## Goal

Propose one set of edits to Filip's engineering guidance. Agents that follow the edited guidance should leave code in better shape for its next maintainer, cost at most 1.3 times the tokens of an agent with no guidance, and pass the task's tests no less often.

## Where round 2 left off

- The incumbent is still `main`. Round 2's candidate ([round-2-candidate.diff](round-2-candidate.diff), 11 lines added and 26 removed against `main`) passed correctness (11 of 12 against vanilla's 12) and tokens (2.36M, 1.10 times vanilla's 2.14M). `main` failed both this round: 10 of 12 and 6.68M.
- Under the gates as they stood, round 2's candidate failed three mechanical gates against `main`: the cognitive complexity ratio (driven by one task whose reference adds almost no complexity), high plus medium review findings (11 against 8), and redundant added tests (15 against 13). No judges ran.
- **Amendment 3** (approved after round 2): the cognitive ratio now leaves out a task whose reference adds under 10 cognitive complexity, and duplicated test lines, review findings, and redundant added tests became reported diagnostics instead of gates. The reason: `main` fails those counts against itself between the pilot and round 2. Under the amended gates, round 2's candidate passes gates 1 to 3. See `measures-round-2-card-gates.txt` and `measures-round-2-card-diagnostics.txt`.
- So the round is now likely to be decided by the blind judges: matched diff pairs against `main`, 8 of 12 weighted pair wins needed. Quality for the next maintainer is what wins pairs.
- Your edits are against `main`. You may keep, change, or drop any of round 2's edits; say which. Round 2's candidate is a strong starting point, not a requirement.

## What you have (all under `/home/filip/code/pluginbench/runs/egc-20261106/round-3/bundle/`)

- `round-2-candidate.diff`: round 2's candidate against `main`.
- `measures-round-2-card-gates.txt`: `pluginbench compare` with the amended gates. `measures-round-2-card-diagnostics.txt`: the diagnostics. `measures-round-2.txt`: the same run under the gates as they stood before Amendment 3.
- `per-task-round-2.txt`: per-task medians for every measure and arm.
- `review-findings-round-2.md`: every P0 to P2 review finding per attempt, with its file and claim.
- `tokens-per-attempt-round-2.txt`: total tokens and outcome for every round-2 attempt.
- `diffs/<task>/<arm>-r<n>-reward<r>.patch`: every round-2 patch. `round-2-candidate` is round 2's candidate, `incumbent-workflow-main` is `main`, and `vanilla-no-guidance` has no guidance.
- `guidance/`: the current `main` text of every file you may edit.
- Raw traces, read-only, if you need to see where turns went: `/home/filip/code/pluginbench/runs/egc-20261106/results/round-2/evidence/`. `plan.json` maps attempt ids to task, arm, and repeat; each attempt's events are in `attempts/<id>/handoff/artifacts/stdout.jsonl`.
- The criteria the reviewer and the judges use: `/home/filip/.t3/worktrees/filip-stack/t3-a50a29c8/docs/evidence/engineering-guidance-climb/harness/review-standard.md` and `harness/judge-prompt.md` in the same folder.

## Rules

- **Holdout tasks are sealed.** Do not open anything about testem or dateutil, in any results folder.
- **Frozen:** every skill `description` in the front matter, the other sections of `core.md`, and `roles.md`.
- **Size limit:** at most 12 added lines against `main`. Cuts do not count.
- **General advice only.** The edits ship as everyday guidance for Claude Code and Codex. A line that names one of these tasks, its library, or its domain is rejected.
- **No rule may target the benchmark itself**, for example "skip review in benchmarks". The edits must hold for real work in Filip's repositories.
- **Word budget:** `tests/workflow/validate-contracts.mjs` limits each Workflow skill body other than Simplify to 3,500 words, and requires the phrase "new bug regression test fails on the pre-fix code for the expected reason" in Engineering.
- **How round 3 decides.** Round 3 codes your candidate fresh on the 4 climb tasks, 3 repeats each. Vanilla and `main` come from round 2.
  1. Correctness: passes at least vanilla's minus 1 over the 12 climb attempts.
  2. Tokens: the mean over tasks of per-task median total tokens at most 1.3 times vanilla's.
  3. Mechanical, against `main` (amended): cognitive complexity ratio to reference within 10%, complexity hotspots, introduced dead code, changed-line coverage within 10 points.
  4. Blind judges compare matched diff pairs against `main`; the candidate needs 8 of 12 weighted pair wins. A pair where exactly one side passed goes to that side.
  Duplicated test lines, review findings, and redundant added tests are reported beside the result.
- **Prune:** Propose cuts as well as additions. Cut a line when the no-guidance outputs already do what it asks, when another line says the same, or when no output shows its effect.

## Questions to settle

- **Pair wins.** Compare round 2's candidate patches with `main`'s on the same task and repeat. Where would a judge prefer `main`, and which guidance line, or missing line, explains it? Cite the patches.
- **Review findings.** Round 2's candidate had 11 high plus medium findings against `main`'s 8 and vanilla's 15. Which findings would better guidance have prevented, and with what general line?
- **Tests.** The candidate added more redundant tests than `main` on one task. Decide whether a guidance line causes it.
- **Tokens.** Keep the candidate's token headroom. Name any edit you expect to add turns, with the trace evidence.

## Output

Return Markdown with these sections:

1. **Edits.** For each edit, against `main`: the file; the exact current text, copied verbatim; the replacement text, or "delete"; one line of evidence from the bundle, citing the file and attempt. Mark each edit that round 2's candidate already made.
2. **Totals.** Added lines, removed lines, and the word-count change over the scoped files, against `main`.
3. **Predicted effect.** Expected pair wins against `main` with reasoning, the token ratio to vanilla with your arithmetic, and the expected effect on each gate and diagnostic.
4. **Risks.** What real-work failure each edit could cause, and which edit you would drop first.

Keep it under 1,200 words, not counting the quoted text.
