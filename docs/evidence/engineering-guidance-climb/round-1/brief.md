# Round 1 proposer brief: engineering guidance climb

Role: Critic. Read the "Critic" section of `/home/filip/.agents/roles.md` before you start. You are read-only: do not edit, create, or delete any file anywhere. Return your proposal as your final message.

## Goal

Propose one set of edits to Filip's engineering guidance. Agents that follow the edited guidance should leave code in better shape for its next maintainer, cost at most 1.3 times the tokens of an agent with no guidance, and pass the task's tests no less often.

## What you have (all under `/home/filip/code/pluginbench/runs/egc-20261106/round-1/bundle/`)

- `error-analysis-pilot.md`: where the incumbent's tokens go, which code differences are real, and hypotheses H1 to H5 with projected token ratios. Read it first.
- `measures-climb.txt`: per-arm pilot measures on the 4 climb tasks. `tokens_M` is the mean over tasks of per-task median total coding tokens.
- `diffs/<task>/<arm>-r<n>-reward<r>.patch`: every pilot patch on the climb tasks.
  - `vanilla-no-guidance`: the baseline, with no guidance.
  - `superpowers`: a control plugin, shown for comparison.
  - `incumbent-workflow-main`: the current guidance, which you are editing.
  - `reward1` means the task's hidden tests passed.
- `guidance/`: the current text of every file you may edit:
  - `host-config/guidance/core.md`, only these sections: Core principles, Source of truth and authority, Skills and delegation, Evidence, Testing hygiene, and Coding standards.
  - `host-config/agents/CODING_STANDARDS.md`.
  - `plugins/workflow/skills/{engineering,test-audit,review,simplify}/`: the `SKILL.md` bodies and their `references/`.
- The criteria and their definitions: `/home/filip/.t3/worktrees/filip-stack/t3-a50a29c8/docs/evidence/engineering-guidance-climb/harness/review-standard.md`.

## Rules

- **Frozen:** every skill `description` in the front matter, the other sections of `core.md`, and `roles.md`.
- **Size limit:** at most 40 added lines over the whole climb, which runs three rounds. Cuts do not count against the limit. Aim for 15 or fewer added lines this round.
- **General advice only.** The edits ship as everyday guidance for Claude Code and Codex. A line that names one of these tasks, its library, or its domain is rejected.
- **No rule may target the benchmark itself**, for example "skip review in benchmarks". The edits must hold for real work in Filip's repositories.
- **The gates decide a round, in this order:**
  1. Correctness: passes at least vanilla's minus 1 over the 12 climb attempts.
  2. Tokens: at most 1.3 times vanilla's. Vanilla is 1.67M, so the target is 2.17M or less. The incumbent uses 4.59M.
  3. Mechanical measures may not worsen against the incumbent: cognitive complexity ratio to reference, complexity hotspots, introduced dead code, duplicated test lines, and changed-line coverage.
  4. Blind judges, applying the criteria, compare matched diff pairs. The candidate needs 8 of 12 pairs against the incumbent.
- **Prune:** Propose cuts as well as additions. Cut a line when the no-guidance outputs already do what it asks, when another line says the same, or when no output shows its effect. Rewrite a prohibition as the behavior to produce. Include at least one cut when one exists.

## Questions to settle

- **Review.** The error analysis says no projection gets under 1.3× while a subagent review runs on ordinary feature work. Decide what should still trigger a subagent review in real work, and what the agent should check in its own thread instead. Name any value the review currently provides that would be lost. The error analysis cites the lifecycle catches on happy-dom.
- **Quality.** Find what the incumbent's diffs do better than vanilla's, using the diffs themselves, and keep the guidance that produces it. The error analysis says the clearest difference is fewer and less redundant tests.
- **Cost.** Find what loads on every attempt but changes no outcome.

## Output

Return Markdown with these sections:

1. **Edits.** For each edit, give:
   - the file;
   - the exact current text, copied verbatim;
   - the replacement text, or "delete";
   - one line of evidence from the bundle, citing the file and attempt.
2. **Totals.** Added lines, removed lines, and the word-count change over the scoped files.
3. **Predicted effect.** The token ratio to vanilla, with the arithmetic from the error analysis's components, and the expected effect on each quality criterion.
4. **Risks.** What real-work failure each edit could cause, and which edit you would drop first.

Keep it under 1,200 words, not counting the quoted text.
