---
related: [council, sol-loop, merge-council]
---

## What it does

The [council](../council/) members suggest improvements and then judge each
edit. They compare the current and edited versions without knowing which is
which.

## When to use it

Use it at the end of a thread, once the change works and you want more
polish, such as tighter spacing or simpler code. Hill climb judges quality,
taste, and design, so check correctness first, for example with
[sol-loop](../sol-loop/).

The install command above adds hill-climb alone. To add council too, change
`-s hill-climb` to `-s hill-climb council`. Then call it and name what to
improve, for example `/hill-climb tighter spacing on the settings page`. In
Codex, type `$hill-climb`.

## How it works

First, hill climb writes a *climb card*: the goal, three to five criteria for
the judges, the files in scope, and the checks to run. It shows you the card
and keeps it fixed for the whole climb. Then it runs the checks on your change
as it stands, and it stops before editing anything if a check fails.

In the first round, each member suggests up to three improvements.
Each round, hill climb applies the best-supported ideas as one small edit,
runs the checks, and asks the judges. They see diffs for code and screenshots
for UI. If the edit fails a check or does not win most judges, hill climb puts
your files back from a saved copy. It never uses your Git stash or `git clean`.

The climb stays small. It runs three rounds by default and five at most, and
it changes at most 30% of your change's lines or 20 lines, whichever is
larger.

If any edit stayed, the judges also compare your starting version with the
final one. If most prefer the start, the report says so first and recommends
dropping the climb.

Judges are noisy. Blind comparisons and checks reduce the noise but do not
remove it, so treat the result as a polish aid, not as proof of quality. A
five-round climb with three members makes up to 21 council calls, plus
retries. The exact rules are in
[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/hill-climb/SKILL.md).

## What you get

- The final version in your working tree. Hill climb commits it only when
  the thread already allowed commits.
- A report with the climb card, each round's edit and check results, every
  judge's vote and reason, and the votes on start against final.
- Before and after evidence, with paired screenshots for UI, and the climb's
  diff stat.
- Follow-ups it skipped for size or scope, and lessons the original work
  missed.
- A run record in `~/.hill-climb/runs/<id>/`, with a report built from it. If
  you keep a runs page and your host can publish pages, hill climb offers to
  republish it.
