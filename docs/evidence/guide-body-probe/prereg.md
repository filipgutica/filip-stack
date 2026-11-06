# Guide-body probe: pre-registration

Status: plan only. Nothing has run. A dry run and a paid run each need Filip's approval (AGENTS.md, Evaluation).
Model: the [reader-pages probe](../reader-pages-probe/prereg.md), lab notebook studies 22 and 23.

## Question

Does the "Guide and lesson bodies" section of `technical-prose.md` ([PR #110](https://github.com/filipgutica/filip-stack/pull/110)) make agents write guide and lesson bodies that build section by section, carry one case through, and motivate each concept before they explain it? And does it do this with no loss of facts and no more leaks?

The section changes no skill description or reference pointer, so routing is out of scope. This probe hands each builder its arm's guidance as one file, so it measures what the guidance says, not whether a host loads it.

## Frozen inputs

The guidance is frozen at PR #110 head `94520c77`. It does not change after the first paid build.

| Input | Value |
| --- | --- |
| Head `technical-prose.md` | SHA-256 `695dc6d1…a8a463` |
| Base ref | `origin/main` at `c9d0b990` |
| Base arm file | `build_arms.py c9d0b990`, SHA-256 `bf0450e8…cdca7f7`, 1,424 words |
| Head arm file | `build_arms.py 94520c77`, SHA-256 `f527c38d…dc07dd35`, 1,693 words |
| Scorer | `scorer/` as committed with this file; the dry run records each file's hash |

The two arm files differ only by the new section.

## Arms

| Arm | Guidance file contents |
| --- | --- |
| vanilla | An empty file. AGENTS.md requires a comparison with vanilla. |
| base | At `c9d0b990`: `technical-writing/SKILL.md` and `references/`, `core.md` "Written deliverables", and `DESIGN.md` "Copy and density" |
| head | The same files at `94520c77` |

`build_arms.py` builds both files the same way as in the reader-pages probe, without its B1 option. Each build reads its own copy in `<temporary-directory>/g-<random>/<random>.md`. No path names the arm, and a private ledger maps builds to arms.

## Builder

- Host: `delegate_task`, Codex `gpt-6.1-sol`, reasoning `high`, service tier `default`, role `general`, shared isolation, a fresh context for each call.
- Prompt: `BUILD` in [scorer/prompts.py](scorer/prompts.py), identical across arms except for the file path. The builder gets the brief and the fact sheet with its tags removed.

## Briefs

A fresh, read-only Sol 6.1 call wrote the three briefs, fact sheets, keys, and checklists. It saw no guidance, repository, or earlier study. The subjects are fictional, and none is a landing page or an install section, so this probe does not overlap the install-heading study.

| Brief | Kind | Subject | Worked case | Concepts |
| --- | --- | --- | --- | --- |
| G1 | Multi-step how-to guide, about 800 words, 6 steps | Tavrel bead sorter | Kestrel batch | Baseline card, route map |
| G2 | Conceptual lesson, about 900 words | Orvane parcel trams | Copper Loop scenario | Usable capacity, queue ratio, balanced transfer |
| G3 | Tutorial, about 900 words, 5 steps | Dovren return board | Temba loan set | Identity token, date bands |

Each [fact sheet](scorer/factsheets/) has 18 facts, 3 of them tagged `[agent-only]`. The facts come in an engineer's order: mechanism before the problem it solves, steps slightly out of order, and the case last. A writer has to reorder them for a reader.

[scorer/key.json](scorer/key.json) holds each brief's reader facts, agent-only facts, case, concepts with their motivating facts, step order, four comprehension questions, and answer key.

Two answer keys were tightened before any build. Both changes are recorded in the key:

- G2(c) passed any answer containing "ratio", a word in the question itself.
- G3(b) passed an answer that put the items in the wrong pockets.

## Measures

Every measure is computed per build. Shares are averaged and counts are summed over the 5 attempts.

| ID | Measure | How | Better |
| --- | --- | --- | --- |
| M1 | Fact recall | Share of the 15 reader facts present, from the extractor | Higher |
| M2 | Invented facts | Claims not on the fact sheet, including invented example details, from the extractor | Lower |
| M3 | Agent-only leaks | Agent-only facts anywhere on the page. A fact in a disclosure, a notes section, or link text counts as a leak. This is fixed now because the head guidance invites disclosures. `M3_main`, main text only, is reported but not in the rule. | Lower |
| M4 | Comprehension | A fresh `gpt-6.1-sol` call at low reasoning gets only the page and the 4 questions. The fixed key grades its answers (0–4). One question per brief tests the step order (G1, G3) or the dependency between concepts (G2). | Higher |
| M5 | Case carried through | Share of body sections that use the worked case by name or by its details, from the extractor. The opening and notes sections are excluded. A page with no body sections scores 0. | Higher |
| M6 | Motivated first | Share of the brief's concepts where the page states the problem the concept solves before, or where, it first explains the concept. From the extractor. | Higher |
| M7 | Repetition | Number of prose sentence pairs with a word-set Jaccard similarity of 0.6 or more | Lower |
| — | Diagnostics | Words, Flesch-Kincaid grade, body-section count, ending type (next action, summary, or other), and forward dependencies. Reported, but not in the rule. | — |

Extractor: `gpt-6.1-sol`, reasoning high, prompt `EXTRACTOR`. It gets the tagged fact sheet, the case name, and the concept names, never the arm or the guidance.
Double-coding: `gpt-6-astra`, reasoning high, re-extracts every fifth build in ledger order (9 builds). Agreement is reported on fact presence and location, motivated-first, and case-section counts.

## Judges

Astra (`gpt-6-astra` high), Sol 6.1 (`gpt-6.1-sol` high), and Opus 5.5 (`claude-opus-5-5` high) see each head-vs-base pair and each head-vs-vanilla pair blind. Each gets the brief, never the guidance.
The A/B order is balanced: across attempts and pairings, head is A in half the pairs.
Judges answer A, B, or SAME on three questions:

- "follow": Could a first-time reader follow the page from start to finish and do or understand what it teaches?
- "story": Does the page read as one story, with each section building on the last?
- "overall": Which draft is better overall?

Judges are uncalibrated diagnostics, as AGENTS.md notes. The rule uses the overall votes as one of its parts.

## Decision rule (fixed before any build)

The guidance is **supported** only if all of the following hold.

Against base:

1. **No harm.** On every brief, head's M1 is at least base's M1 minus 0.05. Head's M2 is at most base's M2 plus 1, and head's M3 is at most base's M3 plus 1.
2. **Objective gain.** Head is better than base on at least 2 of M4, M5, M6, and M7, on at least 2 of the 3 briefs. A tie is not better. Head is worse than base on M5 or M6 on no brief.
3. **Judges agree.** A strict majority of the 15 overall votes (3 judges × 5 attempts) prefers head on at least 2 of the 3 briefs. No brief has a strict majority for base.

Against vanilla, parts 1 and 3 must also hold, with vanilla in place of base.

Otherwise the result is **not supported**. The run then stops and reports, and the guidance is not revised or rerun without Filip's approval.

## Runner and stop rule

The parent agent dispatches every call. Each call's task is one line: read one prompt file and follow it. Each prompt file sits alone in its own random folder outside the repository (`prompts.json` maps calls to files). At most 8 calls run at once.

Every reply is checked with `probe.py check` as soon as it arrives. A reply is unusable when it is empty, unreadable, or a refusal or read failure. A build reply under 250 words is unusable. A scoring reply is unusable when it has no JSON or is missing a required field.
An unusable reply is a failed call, as is a timeout or an error. On the first failed call, the runner dispatches nothing more and reports. A retry needs Filip's approval and comes out of the spare calls below.

## Calls

| Item | Calls |
| --- | ---: |
| Dry run: G1, 1 attempt per arm. 3 builds, 3 extractions, 1 double-coding, 3 comprehension, 6 judges | 16 |
| Builds: 3 briefs × 3 arms × 5 attempts | 45 |
| Extractor | 45 |
| Double-coding at 20% | 9 |
| Comprehension | 45 |
| Judges: 3 briefs × 5 attempts × 2 pairings × 3 judges | 90 |
| **Registered total** | **250** |
| **Upper limit**, including 10 spare calls for approved retries | **260** |

By model, the paid run uses Sol 6.1 for 165 calls, Astra for 39, and Opus 5.5 for 30.
The dry run checks the prompts, the arm files, the stop rule, the extractor fields, the comprehension key, and the ledgers. It gives no verdict. If the dry run shows a pipeline fault, the fix is a dated amendment to this file, made before any paid build and with Filip's approval. A fault to the guidance is not a pipeline fault.
The dry-run builds are not reused in the paid run.

## Known limits

- Global host guidance reaches every arm, vanilla included, through the builder's own instruction files. This confound is shared by all arms, as in the reader-pages probe. Build traces are checked to confirm that each builder read only its own arm file.
- Five attempts on three briefs is a probe, not a benchmark. A null result does not show that the guidance has no effect.
- M5 and M6 depend on the extractor's judgment. Double-coding reports how often a second model agrees.
- Actual token use and billed cost are not measured.
