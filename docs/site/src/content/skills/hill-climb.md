---
related: [council, sol-loop, merge-council]
---

## What it does

[Council](../council/) members suggest improvements, and judges compare two
versions without knowing which is newer. A failed or losing edit is undone
from a saved copy.

## When to use it

Use it after a change already works and you want tighter copy, spacing, or
code. You can also start from an open-ended goal across named paths, such
as improving the settings pages. Check correctness first, for example with
[sol-loop](../sol-loop/):
judges' preferences do not prove the work is correct.

It needs `council`, which the install command above includes, and at least
two council members that can run. The [council page](../council/) lists the
models.

Run `/hill-climb` in Claude or `$hill-climb` in Codex with a goal and paths:

> /hill-climb tighter spacing on the settings page

You can also set a line limit, such as
`/hill-climb up to 60 lines, tighten the copy`, or cap the model calls.

## How it works

Before any edit, the agent writes a *climb card* with the goal, three to five
criteria, scope, checks, how a winner is decided, and the budget. The card
then stays fixed. If the goal or limits are unclear, it asks up to four
questions first.

Each round makes one small edit and runs the checks. The edit stays only if
it wins under the card's rule: judges, a score from a command you name, or
both. For guidance such as a
skill, judges compare work done under each version with a no-guidance
baseline, and holdout tasks check that the gain carries over.

- Three rounds by default, ten at most.
- At most 20 lines or 30% of the original change, whichever is larger,
  unless you set another limit. Behavior stays the same, except interactions
  you allow on the card.
- A ten-round climb with four members can make up to 48 council calls, plus
  retries. A guidance climb adds more.
- It restores from its own saved copy, never Git stash or `git clean`, and
  stops if other work changes the same files.

At the end, judges or the score compare the starting and final versions. If
the start wins, the report recommends dropping the climb. Blind comparison
reduces judge noise but does not remove it.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/hill-climb/SKILL.md)
has the full procedure.

## What you get

- The final version in your working tree. Commits need your prior approval.
- The climb card, each round's edit, checks, votes or scores, and the
  start-to-final comparison.
- For UI and guidance, a 0–10 before-and-after score per screen or task, with
  paired screenshots for UI.
- Diff statistics, skipped follow-ups, and a run record under
  `~/.hill-climb/runs/<id>/`.
