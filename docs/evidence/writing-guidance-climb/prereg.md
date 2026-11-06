# Writing-guidance probe: pre-registration

Status: frozen on 2026-11-06, before the first probe call. The climb in [card.md](card.md) ended after round 2 with round 1's version as its final version.

## Question

Does the climb's final `technical-prose.md` help a first-time reader find what a task needs earlier, without more wrong answers, on briefs the climb never saw? The climb chose its winner on its own four briefs, so its score there is not evidence for shipping. This probe decides whether the change ships.

## Frozen inputs

| Input | Value |
| --- | --- |
| Head | The climb's final `technical-prose.md`, SHA-256 `2c020dafcfbf3095123f00128992b2867ea7c97c6ea1ba97e4acdf3ee9e1e0c7` |
| Base | `technical-prose.md` on `origin/main` at `48453586`, SHA-256 `57dbbc5883dac1468b08340379080c7a364230651b8ef3cf5256f48fbaff40e3` |
| Arm files | Built by `scorer/climb.py arm`, as in the climb. Only `technical-prose.md` differs between base and head. Vanilla is an empty file. |
| Prompts | `scorer/prompts.py` as committed with the climb |
| Briefs | Four new briefs from a fresh, read-only Codex `gpt-6.1-sol` call with the same `BRIEF_WRITER` prompt, one per page type, five tasks each. The call sees no guidance and no climb material. |

## Runs

- Builder: Codex `gpt-6.1-sol`, reasoning `high`. Reader: Codex `gpt-5.6-sol`, reasoning `low`. Both as in the climb.
- 5 attempts per brief per arm: 60 builds and 60 reader calls.
- A pair is one brief and one attempt index. Each comparison has 20 pairs.

## Measures

- Pair score: the climb's score on that build, 100 × the mean over its five tasks. A failed task scores 0; a pass scores 1 − 0.4 × min(depth ÷ word limit, 1).
- Tasks passed per arm, with Wilson 95% intervals.
- Mean depth as a share of the page, per task type: the changed default, the exception, the failure and its recovery, the combined value.
- Mean page length per arm.

## Decision rule

The change ships only if all three hold:

1. **Head beats base.** Head has the higher pair score in at least 15 of the 20 pairs (one-sided sign test, p = 0.021), and the mean pair score difference is at least 1.0 point.
2. **Head beats vanilla** by the same rule.
3. **No harm.** Head passes at least as many tasks as base, less one, over all briefs, and on no brief does it fail more than one task more than base.

A tied pair counts as half a win and half a loss.

## Flags

These are reported and do not change the verdict:

- **Length:** head's mean page length is more than 10% below base's. Then a depth gain may come from cutting content.
- **Brief-only win:** head wins rule 1 on fewer than three of the four briefs.

## Calls and stop rule

- Calls: 1 brief writer, 60 builds, 60 reader calls. Cap: 135, which leaves 14 spare calls.
- At most 8 calls at once, counted from completion notices.
- Any call that leaves no usable reply file gets one retry from the spare calls. A second failure stops the probe.
- Raw prompts, pages, and replies stay on the machine that ran the probe. Only summary numbers are committed.

## Amendment, 2026-11-06, before the first probe build

The climb's final check finished after this file froze. It used no probe data.

- Scorecard pass, start against final. Each judge's overall preference: Sol 6.1 chose the final version; Opus 5.5 and Astra chose the start.
- All three preferred the final version on read depth and the start on fit to the page type. All three rated the two the same on reader task success and on facts beyond the sources.
- The fit finding comes from the tutorial and how-to placement lines. The final version puts recovery before the main path in those page types, which breaks the order a learner or operator works in.
- Mean task scores across judges, from 0 to 10: start 9.15, final 9.38.

Fit to the page type is a card criterion, and the probe's score does not measure it. This amendment only makes the ship rule stricter:

- If the decision rule above fails, nothing ships.
- If it passes, the change does not merge on its own. The user decides. Following the `hill-climb` rule for a final check where a majority prefers the start, the recommendation is to drop the climb. The other options are to ship with the trade-off stated in the PR, or to run a follow-up climb under the `both` rule.
