# Reader pages probe: dry run

Date: 2026-11-04

Status: dry run complete. The paid run has not started. It needs Filip's approval.

The dry run checks the pipeline: briefs, arms, builder target, file delivery, scoring calls, scorer, and decision rule.
It ran 1 attempt per arm on B1 only, so it gives no verdict.
The fixed rule needs 4 briefs and 5 attempts per arm.

## Result

The pipeline works end to end. All 15 calls returned usable output on the first try, with no retries.

At n=1 the head arm lost B1. This is a diagnostic, not a decision:

- Judges preferred base over head 3 of 3, and vanilla over head 3 of 3.
- Head leaked all 4 agent-only facts into its "Good to know" section. Base leaked 2 and vanilla leaked 1.
- Every judge's reason named the leaked internals, such as the index name, release-please, or the SQLite busy timeout.

If the paid run shows the same pattern, rule part 2 fails on M3 and part 3 fails on the judges.
See [What to decide before the paid run](#what-to-decide-before-the-paid-run).

## Setup

| Item | Value |
| --- | --- |
| Guidance commit (head arm) | `ee69079a` on `feat/reader-pages-guidance` |
| Base arm | `origin/main` at `754754a4` |
| Arm files | [`build_arms.py`](scorer/build_arms.py) joins each ref's `technical-writing` `SKILL.md` and all its references, `core.md` "Written deliverables", `DESIGN.md` "Copy and density", and, for B1, `cli-tool-template` "Pages site" into one file. Base has 1,703 words and head has 2,832. Saved copies are in [`dry-run/arms/`](dry-run/arms/). |
| Delivery | Each build got one randomly named file in its own folder under `/tmp/claude-502/writing-probe/g-<random>/`. Vanilla got an empty file. No path names the arm. [`ledger.json`](dry-run/ledger.json) maps each build to its arm. |
| Link and skill names | `build_arms.py` rewrites relative links to "the `<file>` part of this file" and replaces `$workflow:` skill names with plain names. Without that, a builder could follow a link into the checkout or load the installed base skill. |
| Builder | `delegate_task`, Codex `gpt-6.1-sol`, `reasoningEffort: high`, `serviceTier: default`, async |
| Extractor | Codex `gpt-6.1-sol`, high, default tier |
| Comprehension | Codex `gpt-6.1-sol`, low, default tier |
| Judges | Astra: Codex `gpt-6-astra`, high, default tier. Sol 6.1: Codex `gpt-6.1-sol`, high, default tier. Opus 5.5: Claude `claude-opus-5-5`, effort high. |
| Scoring prompts | [`prompts.py`](scorer/prompts.py). Each scoring child was told to read one prompt file that held only the page, the brief, and fixed material. Rendered prompts are in [`dry-run/prompts/`](dry-run/prompts/). |
| Scorer | [`probe.py`](scorer/probe.py) computes M1 to M9 and the decision rule. [`tools/`](scorer/tools/) is the audit's `tells.py` and `metrics.py`, unchanged. |

### Call count

| Call | Count |
| --- | ---: |
| Builds: 3 arms × 1 attempt on B1 | 3 |
| Extractor | 3 |
| Comprehension | 3 |
| Judges: 2 pairings × 3 judges | 6 |
| Double-coding (20% of 3 builds rounds to 0) | 0 |
| **Total** | **15** |
| Retries | 0 |

Each build took 21 to 33 seconds. `delegate_task` does not report token use, so this dry run gives no token measure to scale from.

## Isolation check

The task requires that each builder read its arm file and nothing else.
The thread trace of each build shows one command, `cat` of its own arm file. It shows no other file read and no skill load.

| Build | Arm | Commands in trace |
| --- | --- | --- |
| `2ef8d37e` | vanilla | `cat` of its empty arm file |
| `2ed7d728` | base | `cat` of its arm file |
| `714ea11f` | head | `cat` of its arm file |

I also read the traces of one extractor (`714ea11f`) and one Opus judge (`6032d03b`). Each shows one read: its own prompt file.

These confounds remain:

- **Host instructions reach the builders.** Codex loads the deployed global `~/.codex` guidance on its own, and the trace does not show it. That guidance contains today's `core.md`, so base text reaches the vanilla and head arms too. The design-language probe found the same confound.
- **Host instructions reach the judges.** The preregistration says judges see the brief but not the guidance. Claude judges load `~/.claude/CLAUDE.md`, and Codex judges load `~/.codex`. Both contain today's "Written deliverables" text. This affects every pairing equally.
- **Judge role line.** The judge calls used `delegate_task` `role: review`, and T3 added "Act as the review sub-agent for this task." before the prompt. Builders used `role: general` and got no added line. The paid run should use `role: general` for every call.
- **Working directory.** Children run with this worktree as their working directory. No build read from it.

## Clarifications to the preregistration

The preregistration leaves these points open. The dry run applied them and the paid run should keep them:

1. **The builder's fact sheet omits the `[agent-only]` tags.** With the tags, M3 would measure whether the builder obeys the tags, not whether the guidance helps it tell reader facts from operator facts. The extractor still gets the tagged sheet.
2. **One file, not a folder.** Each arm is one file, and the prompt says "Read the file `<path>` and follow it (skip this step when the file is empty). Read no other file." Vanilla gets an empty file, so all three prompts have the same shape.
3. **M1 is a mean share per brief.** Every other measure is a sum over attempts, as the preregistration says.
4. **"Most of the 15 overall votes" means at least 8 head votes.** A SAME vote counts for neither arm.
5. **Comprehension is graded in code** against [`key.json`](scorer/key.json), so it adds no model calls. The preregistration named the questions only. The key now holds a pass rule for each B1 question. Keys for B2 to B4 must be written before the paid run starts.

## Measures

| Measure | Vanilla | Base | Head | Head vs base |
| --- | ---: | ---: | ---: | --- |
| M1 Fact recall | 1.00 | 1.00 | 1.00 | same |
| M2 Invented facts | 0 | 0 | 0 | same |
| M3 Agent-only leaks | 1 | 2 | 4 | worse |
| M4 Opening job statement | 1 | 1 | 1 | same |
| M5 Start position (share of words before the first command) | 0.217 | 0.133 | 0.143 | worse |
| M6 Fragment rate, extractor | 0.143 | 0.111 | 0.083 | better |
| M6 cross-check, `tells.py` fragments | 3 | 0 | 0 | same |
| M7 AI tells | 0 | 0 | 0 | same |
| M8 Repeated sentence pairs | 0 | 0 | 0 | same |
| M9 Comprehension (of 3) | 3 | 3 | 3 | same |
| Words, `metrics.py` (reported only) | 125 | 109 | 163 | — |

### Judge votes

Votes are unblinded with [`judge-ledger.json`](dry-run/judge-ledger.json). Head was shown as A in both pairs.

| Pairing | Judge | Reader | Careful | Overall |
| --- | --- | --- | --- | --- |
| head vs base | Astra | SAME | base | base |
| head vs base | Sol 6.1 | SAME | base | base |
| head vs base | Opus 5.5 | SAME | base | base |
| head vs vanilla | Astra | vanilla | vanilla | vanilla |
| head vs vanilla | Sol 6.1 | vanilla | vanilla | vanilla |
| head vs vanilla | Opus 5.5 | SAME | vanilla | vanilla |

### Decision rule, computed on one brief

| Part | Against base | Against vanilla |
| --- | --- | --- |
| 1. No harm (M1, M2) | holds | holds |
| 2. Objective gain | fails: better only on M6, and worse on M3 | not applied |
| 3. Judges | fails: base majority, 3 of 3 | fails: vanilla majority, 3 of 3 |
| Verdict | not decidable: 1 of 4 briefs scored | — |

[`scores.json`](dry-run/scores.json) holds per-build values, extractor quotes, comprehension answers, and the rule output.

## Scorer checks

- **Control run.** Before the real builds, a synthetic run with planted defects scored as expected. One page had fragments, two leaks, a missing opening, a repeated sentence, and no start command. One clean page beat it on every measure, and the rule returned "not decidable" for a single brief.
- **Extractor.** I checked each extractor answer against the pages by hand. The leak counts (1, 2, 4) and fact recall match. One schema difference: two extractor replies gave `first_two_sentences` as a list and one gave a string. The scorer reads only the booleans, so this does not change a score.
- **Comprehension ceiling.** All three B1 pages scored 3 of 3, so M9 cannot separate the arms on B1. B2 to B4 have harder questions.
- **Reading grade.** `metrics.py` reads the head page's `<dl>` HTML as one long sentence, which gives a grade of 14.6. The rule does not use grade.

## What to decide before the paid run

1. **Whether to revise the guidance first.** The head builder kept every fact. It treated "Good to know" as a safe place for the internals. Two head lines may push toward that:
   - The reader-pages check "every fact from the source is still on the page, linked, or behind a disclosure"
   - The cli-tool-template wording that Good to know definitions are full sentences

   The preregistration fixes the rule, not the guidance, and allows one revision after a failed run. A paid run with today's head text may fail on M3. Revising R7 or that check first is cheaper, but the change then needs its own dry run.
2. **Counterbalance the A/B order.** Random order put head as A in both dry-run pairs. For the paid run, balance it so that head is A in half the pairs for each brief.
3. **Write the comprehension keys for B2 to B4** before any build.

## Paid-run estimate

| Item | Vanilla | Base | Head | Total |
| --- | ---: | ---: | ---: | ---: |
| Builds: 4 briefs × 5 attempts | 20 | 20 | 20 | 60 |
| Extractor | 20 | 20 | 20 | 60 |
| Double-coding at 20%, second model | 4 | 4 | 4 | 12 |
| Comprehension | 20 | 20 | 20 | 60 |
| **Per arm, before judges** | **64** | **64** | **64** | **192** |
| Judges: head vs base | | | | 60 |
| Judges: head vs vanilla | | | | 60 |
| **Total** | | | | **312** |

By model:

- Judges: 40 each on Astra, Sol 6.1, and Opus 5.5.
- Builds, extractor, and comprehension: 180 calls on Codex `gpt-6.1-sol`.
- Double-coding: the preregistration asks for a second model, so the 12 calls go to Codex `gpt-6-astra` at high reasoning.
- Totals: Sol 6.1 220 calls, Astra 52, and Opus 40, for 312.

The dry run measured no tokens. In the design-language probe, each Codex build used about 180,000 input tokens and 4,300 output tokens. That builder read a larger folder and wrote full HTML pages, so treat it as an upper bound for these builds.
