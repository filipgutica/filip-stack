---
related: [council, sol-loop, merge-council]
---

## What it does

The [council](../council/) members suggest improvements and then judge each
edit. They compare the current and edited versions without knowing which is
which.

## When to use it

Use it at the end of a thread, once the change works and you want more
polish, such as tighter spacing or simpler code. You can also start it with
no change at all and a goal instead, such as "improve the UX of the settings
pages". It can also climb guidance, such as a skill: each version is judged
by the work agents produce while following it, compared with agents that get
no guidance. Hill climb judges quality, taste, and design, so check correctness
first, for example with [sol-loop](../sol-loop/).

The install command above adds hill-climb alone. To add council too, change
`-s hill-climb` to `-s hill-climb council`. Then call it and name what to
improve, for example `/hill-climb tighter spacing on the settings page`. In
Codex, type `$hill-climb`.

## How it works

First, hill climb writes a *climb card*: the goal, three to five criteria for
the judges, the files in scope, and the checks to run. When your request
leaves something open, such as which files to change or what "better" means,
it asks you up to four questions first, each with a suggested answer. It
shows you the card and keeps it fixed for the whole climb. Then it runs the checks on your change
as it stands, and it stops before editing anything if a check fails.

In the first round, each member suggests up to three improvements.
Each round, hill climb applies the best-supported ideas as one small edit,
runs the checks, and asks the judges. They see diffs for code and screenshots
for UI. When the only failed check is a false claim in the text, hill climb
corrects it once and checks again. If the edit still fails a check or loses,
hill climb puts your files back from a saved copy. If
something outside the climb changed
those files, it stops instead, so your changes survive. It never uses your Git
stash or `git clean`.

Instead of judges, or as well as them, a score can decide each round: a
command you already have that prints one number, such as an accessibility
checker's violation count. With both, an edit must improve the score and win
most judges.

The climb stays small. It runs three rounds by default and ten at most. By
default it changes at most 30% of your change's lines, or 20 lines when that
is larger. Ask for a different limit when you call it, for example
`/hill-climb up to 60 lines, tighten the copy`. You can also cap the number
of council calls. Behavior stays the same unless you name the interactions
the climb may change, such as focus order in a form.

If any edit stayed, hill climb compares your starting version with the final
one. Judges vote on the two versions, a score climb compares their scores
instead, and a climb that uses both does both. If the start wins, the report
says so first and recommends dropping the climb.

Judges are noisy. Blind comparisons and checks reduce the noise but do not
remove it, so treat the result as a polish aid, not as proof of quality. A
ten-round climb with three members makes up to 36 council calls, plus
retries. The exact rules are in
[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/hill-climb/SKILL.md).

## What you get

- The final version in your working tree. Hill climb commits it only when
  the thread already allowed commits.
- A report with the climb card, each round's edit and check results, every
  judge's vote and reason or each score, and the start-against-final
  comparison. For UI and guidance climbs, it adds a scorecard: each screen
  or task scored from 0 to 10 before and after, with its biggest remaining
  issue.
- Before and after evidence, with paired screenshots for UI, and the climb's
  diff stat.
- Follow-ups it skipped for size or scope, and lessons the original work
  missed.
- A run record in `~/.hill-climb/runs/<id>/`, with a report built from it. If
  you keep a runs page and your host can publish pages, hill climb offers to
  republish it.
