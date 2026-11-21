---
related: [council, sol-loop, full-send]
---

## What it does

Give hill climb a working change to polish, or an open-ended goal and paths.
Your agent freezes criteria, pass/fail checks (**gates**), and a budget, then
runs small rounds. Each round tests one edit from [council](../council/) models
and keeps it only if gates pass and blind judges, a score rule, or both pick it
over the saved copy. You get final edits in your working tree, a start-to-final
check, and a run record.

## When to use it

Use hill climb after a change works for tighter copy, cleaner code, UI polish,
or leaner guidance, or for an open-ended goal on named paths.

Do not use it on broken code or new features. Check correctness first, such as
with [sol-loop](../sol-loop/): judge preferences do not prove code works.

It needs `council` (included above) and at least two [council](../council/)
models.

Run `/hill-climb` in Claude or `$hill-climb` in Codex with a goal and paths:

> /hill-climb tighter spacing on the settings page

You can also set a line limit (`/hill-climb up to 60 lines, tighten the copy`)
or cap model calls.

## How it works

1. **Freeze the climb card.** Your agent writes a **climb card** (goal, three
   to five criteria, scope, gates, winning rule, and budget), asks up to four
   questions if unclear, and verifies all gates pass.
2. **Edit and gate each round.** Council models propose edits read-only. Each
   round applies a small edit within the line limit and runs all gates, keeping
   behavior unchanged unless allowed on the card.
3. **Keep winners, restore losers.** An edit stays if it wins under blind
   `judges` (strict majority of at least two, without seeing which is newer), a
   `score` beating the kept version by the card's minimum gain (a frozen
   command, or an answer-key tally for guidance), or `both` (majority and
   minimum gain). Guidance climbs also accept shorter no-worse edits and check
   holdout tasks. Losers restore from a saved copy (never Git stash or `git
   clean`) only after checking nothing else changed scoped or locked files.
   Otherwise the climb stops without restoring.
4. **Stop and check start vs. final.** Climbs run three rounds by default (ten
   max). The default cumulative limit for the climb is the larger of 20 lines
   or 30% of the original change, with exceptions for user limits, rewrites, or
   fresh starts. At the end, start and final are compared (recommending you
   drop the climb if start wins), and guidance climbs compare final against no
   guidance.

Read
[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/hill-climb/SKILL.md),
[scores](https://github.com/filipgutica/filip-stack/blob/main/skills/hill-climb/references/score.md),
and
[guidance climbs](https://github.com/filipgutica/filip-stack/blob/main/skills/hill-climb/references/guidance.md)
for full rules.

## What you get

- Final edits in your working tree (commits need prior approval).
- The climb card, round edits, gate results, votes or scores, and
  start-to-final check.
- For UI and guidance, a 0 to 10 scorecard per screen or task, with paired UI
  screenshots.
- Diff stats, declined follow-ups, and a run record in
  `~/.hill-climb/runs/<id>/`.
