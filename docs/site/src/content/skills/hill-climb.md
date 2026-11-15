---
related: [council, sol-loop, merge-council]
---

## What it does

[Council](../council/) members suggest improvements, and judges compare two
versions without knowing which is newer. A failed or losing edit is undone
from a saved copy.

## When to use it

Use it after a change already works and you want tighter copy, spacing, or
code. You can also give an open-ended goal for named paths, such as improving
the settings pages. Check correctness first, for example with
[sol-loop](../sol-loop/): judges' preferences do not prove that the work is
correct.

It needs `council`, which the install command above also installs, and an
agent that can run council's OpenAI and Claude models. With the default
members, those are Astra (OpenAI's `gpt-6-astra`), Sol (OpenAI's
`gpt-6.1-sol`), Opus (Claude Opus 5.5), and Fable (Claude Fable 5.2).

Run `/hill-climb` in Claude or `$hill-climb` in Codex with a goal and paths:

> /hill-climb tighter spacing on the settings page

You can also set a line limit, such as
`/hill-climb up to 60 lines, tighten the copy`, or cap the number of model
calls.

## How it works

Before any edit, the agent writes a *climb card*: the goal, three to five
criteria, scope, checks, how a winner is decided, and the budget. If the goal
or limits are unclear, it asks you up to four questions with suggested
answers. Then the card is fixed for the whole climb.

Each round makes one small edit and runs the checks. The edit stays only if
it wins: by a majority of judges, by a score from a command you name, or by
both. Judges see code diffs, screenshots, or text, as fits the work. For
guidance such as a skill, they compare work done under each version with a
no-guidance baseline. Holdout tasks, which no judge sees during the climb,
check that the gain carries over.

Limits to know:

- The default is three rounds, and ten at most.
- The climb may change at most 20 lines or 30% of the original change's
  lines, whichever is larger, unless you set another limit.
- Behavior stays the same, except interactions you allow on the card.
- A ten-round climb with four members can make up to 48 council calls, plus
  retries. A guidance climb adds more.
- It restores from its own saved copy and never uses Git stash or
  `git clean`. If other work changes the same files, the climb stops without
  overwriting it.

At the end, judges or the score compare the starting and final versions. If
the start wins, the report says so first and recommends dropping the climb.
Blind comparison reduces judge noise but does not remove it.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/hill-climb/SKILL.md)
has the full procedure, including how scores are validated, how edits are
restored, and how guidance is evaluated.

## What you get

- The final version in your working tree. Commits need your prior approval.
- The climb card, each round's edit, check results, votes or scores, and the
  start-to-final comparison.
- For UI and guidance, a 0–10 before-and-after score per screen or task, with
  its biggest remaining issue. UI evidence includes paired screenshots.
- Diff statistics, skipped follow-ups, and lessons the original work missed.
- A run record under `~/.hill-climb/runs/<id>/` and a report built from it.
  If you keep a runs page and the host can publish it, the agent offers to
  update it.
