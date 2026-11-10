---
related: [council, sol-loop, merge-council]
---

## What it does

[Council](../council/) members propose improvements and judge versions without
knowing which is newer. Each round makes one candidate, checks it, and keeps
it only if it wins under the agreed decision rule. Failed or losing edits
are restored from a saved copy.

## When to use it

Use it after a change works and you want tighter copy, spacing, or code. You
can also start from an open-ended goal across named paths, such as improving
the settings pages. Check correctness first, for example with
[sol-loop](../sol-loop/); judge preferences do not prove correctness or quality.

Install hill-climb and council together: replace `-s hill-climb` in the
command above with `-s hill-climb council`. A missing council skill stops the run.

Invoke it explicitly with `/hill-climb` in Claude or `$hill-climb` in Codex.
Name the goal and paths, for example `/hill-climb tighter spacing on the settings page`.
You can also specify a line limit, such as `/hill-climb up to 60 lines, tighten the copy`,
or cap member calls.

For guidance such as a skill, the evidence is work produced under each version,
compared with a no-guidance baseline. A shorter version can win when that
work is no worse.

## How it works

A fixed *climb card* records the goal, three to five criteria, scope, checks,
decision rule, behavior, and budget. For an open-ended goal, or
unclear scope, criteria, decision rule, or budget, the agent asks up to four
questions with suggested answers. It freezes the card after your answers.
Baseline checks run before edits; a failure stops the climb.

Choose judges, a deterministic score, or both. A score comes from a fixed
command that prints one number. A guidance climb uses an answer-key tally
instead. With both, an edit must improve the score
and win a majority of judges. Judges see code diffs, UI screenshots, or text
in reading order, as appropriate.

In round one, each member proposes up to three improvements. The agent applies
the best-supported ideas as a small edit and runs the checks. If only a false
claim in text fails, it gets one repair and recheck. Another failure or a
loss restores the saved version. If outside work changed the same files,
the agent stops without restoring over it. It never uses Git stash or `git clean`.

The default is three rounds, with ten at most. The default size limit is the
larger of 30% of the original change's lines and 20 lines. Behavior stays the
same except for interactions you explicitly allow on the card. A ten-round
climb with the four default members can use up to 48 council calls, plus
retries. A guidance climb adds calls for its readers and baseline.

After accepted edits, the final comparison checks the starting and final
versions with judges, scores, or both. If judges prefer the start, the report
says so first and recommends dropping the climb. A score that fails to beat
the start is also reported first. Blind comparisons reduce judge noise;
they do not remove it.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/hill-climb/SKILL.md)
has the exact budgets, restoration rules, and guidance-evaluation procedure.

## What you get

- The final working-tree version. Commits require prior authorization.
- The climb card, round edits, check results, votes and reasons or scores,
  and the start-to-final comparison.
- For UI and guidance, a 0–10 before-and-after scorecard per screen or task,
  with its biggest remaining issue. UI evidence includes paired screenshots.
- Diff statistics, skipped follow-ups, and lessons the original work missed.
- A run record under `~/.hill-climb/runs/<id>/` and a report built from it.
  If you keep a runs page and the host can publish it, the agent offers to
  republish it.
