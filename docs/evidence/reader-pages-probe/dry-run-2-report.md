# Reader pages probe: dry run 2

Raw per-call files are not in this repository; they are at [PR #99's head commit](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/).

The tested [reader-pages.md guidance](https://github.com/filipgutica/filip-stack/blob/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/plugins/workflow/skills/technical-writing/references/reader-pages.md) is recorded at that commit; the setup below identifies each run's arm.

Date: 2026-11-04

Status: dry run complete. The paid run has not started. It needs Filip's approval.

This dry run repeats [dry run 1](dry-run-report.md) after the guidance revision. It uses the same brief (B1), the same 3 arms, and the same 15 calls.
One attempt per arm is a smoke test. It shows whether the pipeline works and whether the leak repeats, and it gives no verdict.

## Result

The head page leaked no agent-only facts. In dry run 1 it leaked all 4.

- The extractor found 0 agent-only facts on the head page. I checked the page by hand, and it has none.
- Head kept every reader fact (M1 = 1.00) and invented none.
- No judge said that the head page explained internals. In dry run 1, all 6 judges did.
- The base page put 1 agent-only fact, the `lsof` polling, in its Good to know section. See [Scorer checks](#scorer-checks).

At n=1, judges preferred base over head 2 of 3, and head over vanilla 2 of 3.

## What changed since dry run 1

| Change | Where |
| --- | --- |
| R7 asks who needs each fact. Facts that only a maintainer, operator, or agent needs are left off the page, or linked when an owner exists. Notes sections such as Good to know follow the same rule. A trust-related mechanism becomes the effect the reader sees. Disclosures are only for a named second reader. | `reader-pages.md` at `efa0d41c` |
| The final check keeps every fact the reader needs, not every fact from the source. It adds a check that no section explains internals. | `reader-pages.md` |
| The R7 example "The skill defines this rubric itself" was removed. It was close to B4's agent-only fact 8. | `reader-pages.md` |
| Good to know "holds what a user should know, not how the tool is built" | `cli-tool-template/SKILL.md` |
| Judge A/B order is balanced, not random. Head is A when `(attempt + pairing index) % 2 == 0`. Here head was B against base and A against vanilla. | [`probe.py`](scorer/probe.py) |
| Every call used `delegate_task` `role: general`. | — |

The head arm file is 2,966 words. The base arm file is unchanged from dry run 1, byte for byte.

## Setup

The setup is the same as dry run 1, except for these items:

| Item | Value |
| --- | --- |
| Head arm | `efa0d41c`, built by [`build_arms.py`](scorer/build_arms.py) `--b1` |
| Base arm | `754754a4`, the same commit as dry run 1 |
| Build prompts | Rendered by `probe.py prepare` from [`factsheets/B1.md`](scorer/factsheets/B1.md) with the tags removed. They match dry run 1's prompts byte for byte, except for the file path. |
| Files | [`dry-run-2/`](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/dry-run-2/): `ledger.json`, `judge-ledger.json`, `arms/`, `prompts/`, `builds/`, `extract/`, `comp/`, `judges/`, `scores.json` |

### Call count

| Call | Count |
| --- | ---: |
| Builds: 3 arms × 1 attempt on B1 | 3 |
| Extractor (Codex `gpt-6.1-sol`, high) | 3 |
| Comprehension (Codex `gpt-6.1-sol`, low) | 3 |
| Judges: 2 pairings × Astra, Sol 6.1, Opus 5.5 | 6 |
| Double-coding (20% of 3 builds rounds down to 0) | 0 |
| **Total** | **15** |
| Retries | 0 |

Each build took 19 to 30 seconds.

## Isolation check

I read the trace of every build, one extractor (`cfa462c7`), and one Opus judge (`7fce915a`).

| Call | Arm | Commands or reads in trace |
| --- | --- | --- |
| Build `f949fa1a` | vanilla | `cat` of its empty arm file |
| Build `93d1e87b` | base | `cat` of its arm file |
| Build `cfa462c7` | head | `cat` of its arm file |
| Extractor `cfa462c7` | — | `cat` of its prompt file |
| Judge `7fce915a`, Opus | — | `Read` of its prompt file |

In these 5 traces, each task message starts with the prompt text, with no added role line. I did not read the other 10.
The host-instruction confound from dry run 1 remains: Codex and Claude children load the deployed global guidance, which holds today's `core.md`.

## Measures

| Measure | Vanilla | Base | Head | Head vs base |
| --- | ---: | ---: | ---: | --- |
| M1 Fact recall | 1.00 | 1.00 | 1.00 | same |
| M2 Invented facts | 0 | 0 | 0 | same |
| M3 Agent-only leaks, extractor | 0 | 0 | 0 | same |
| M3 Agent-only leaks, by hand | 0 | 1 | 0 | better |
| M4 Opening job statement | 1 | 1 | 1 | same |
| M5 Start position | 0.217 | 0.141 | 0.191 | worse |
| M6 Fragment rate, extractor | 0.077 | 0.111 | 0.200 | worse |
| M6 cross-check, `tells.py` fragments | 0 | 0 | 0 | same |
| M7 AI tells | 0 | 0 | 0 | same |
| M8 Repeated sentence pairs | 0 | 0 | 0 | same |
| M9 Comprehension (of 3) | 3 | 3 | 3 | same |
| Words, `metrics.py` (reported only) | 111 | 114 | 72 | — |

The rule uses the extractor's M3. The by-hand row shows that the extractor missed a leak on the base page.

Dry run 1 compared with dry run 2, head arm only:

| Measure | Dry run 1 | Dry run 2 |
| --- | ---: | ---: |
| M3 Agent-only leaks | 4 | 0 |
| M5 Start position | 0.143 | 0.191 |
| M6 Fragment rate | 0.083 | 0.200 |
| Words | 163 | 72 |
| Judge overall votes for head | 0 of 6 | 3 of 6 |

### Judge votes

Unblinded with [`judge-ledger.json`](https://github.com/filipgutica/filip-stack/blob/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/dry-run-2/judge-ledger.json).

| Pairing | Head shown as | Judge | Reader | Careful | Overall | Reason, in short |
| --- | --- | --- | --- | --- | --- | --- |
| head vs base | B | Astra | base | base | base | Base explains its example, keeps the fuller section structure, "and includes recording details missing from Draft B" |
| head vs base | B | Sol 6.1 | base | base | base | Base has a clearer worked example and keeps the separate Keys section |
| head vs base | B | Opus 5.5 | SAME | head | head | Base uses headings that mean nothing to a reader ("The capture", "Keys" for one flag) "and includes recorder internals" |
| head vs vanilla | A | Astra | head | head | head | Head has a short quick start, a command table, and separate retention and privacy notes |
| head vs vanilla | A | Sol 6.1 | vanilla | SAME | vanilla | Vanilla puts instructions beside each command |
| head vs vanilla | A | Opus 5.5 | SAME | head | head | Head is tighter, with a command table and no tagline |

Two judges named base's internals, from opposite sides. Opus held them against base. Astra counted them in base's favor. No judge mentioned internals on the head page.

### Decision rule, computed on one brief

| Part | Against base | Against vanilla |
| --- | --- | --- |
| 1. No harm (M1, M2) | holds | holds |
| 2. Objective gain | fails: better on none of the 5 measures by the extractor, or on M3 only by hand | not applied |
| 3. Judges | fails: base majority, 2 of 3 | holds on this brief: head majority, 2 of 3 |
| Verdict | not decidable: 1 of 4 briefs scored | — |

## Scorer checks

- **Extractor missed a base leak.** The base page states the `lsof` polling under Good to know. The extractor marked it `sources_note`, so M3 does not count it. The extractor prompt says only that a sources note, a link, or a disclosure is not a leak. It does not say whether a notes section is main text. The extractor was also inconsistent: in dry run 1 it coded head's Good to know facts as `explanation`. Double-coding in the paid run measures this. See decision 1 below.
- **The facts row counts as a fragment.** Every extractor counted "macOS and Linux · Written in Go · MIT license" as a fragment. The tool page template requires this row. On the short head page it is 1 of 5 sentences, so it alone gives the head M6 of 0.200.
- **Comprehension ceiling.** All three B1 pages scored 3 of 3 again.
- **Rescoring dry run 1.** The updated `probe.py` gives the same measures, votes, and rule output for dry run 1's saved replies. Its rendered extractor and comprehension prompts for B1 match dry run 1's byte for byte.
- **Keys for B2 to B4.** `grade()` passed 27 synthetic answers, including "Not stated" for every question and "No." against a Yes key. The "no" prefix now needs a whole word, so "Not stated" does not pass it.

## Paid-run readiness

Ready:

- Briefs, fact sheets, comprehension questions, and answer keys for B1 to B4: [`key.json`](scorer/key.json), [`factsheets/`](scorer/factsheets/)
- Build prompts from the ledger: `probe.py prepare`
- Balanced A/B order. In a simulated 60-build ledger, head is A in 5 of 10 pairs for each brief.
- `role: general` for every call
- Double-coding: `probe.py render` writes `double-code.json` with 12 of 60 builds, 4 for each arm and 3 for each brief. `score` reports agreement when `extract2/<build>.json` exists.
- Arms for B2 to B4: `build_arms.py <ref> <out>` without `--b1`. Run it from the repository root.

Still manual:

- Writing `ledger.json` and placing each arm file in a random folder. Both dry runs did this with inline Python that is not committed.
- Saving each reply to `builds/`, `extract/`, `comp/`, and `judges/`.
- Running `render` once. It gives judge pairs new random ids, so a second render after the judge calls orphans their replies.

Decisions for Filip before the paid run:

1. **Extractor definition of main text.** Option: add one sentence to the extractor prompt, for example "A notes section, such as Good to know or an FAQ, is main text." This would have counted the base leak. It changes a measure after a result was seen, so it needs your approval. Without it, M3 undercounts leaks in notes sections, and that hides some base leaks.
2. **The facts row in M6.** Option: exclude the template's facts row from the fragment count on B1. Without this, M6 favors longer pages on B1.
3. **M5 on B4.** The lesson brief has no install step or command, so the key sets no start pattern, and M5 is not measured on B4. Part 2 on B4 then counts 4 measures, not 5. This is a clarification of the preregistration.
4. **Approve the paid run**: 312 calls, as estimated in [dry run 1](dry-run-report.md#paid-run-estimate).
