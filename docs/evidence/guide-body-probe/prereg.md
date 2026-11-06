# Guide-body probe: pre-registration

Status: plan only. Nothing has run. A dry run and a paid run each need Filip's approval (AGENTS.md, Evaluation).
`scorer/probe.py` still implements the replaced plan. It is rewritten for this plan after Filip approves the call count, and before the dry run.
Revision: on 2026-11-05 this plan replaced the one at commit `0f495b7c`, before any call ran. The change follows an evals review: it measures reader success, calibrates the judges on planted defects, and asks yes/no questions instead of preferences.
Amendment 1 (2026-11-05, before any call): at Filip's request, the reader moved from Claude Haiku 5.5 to Codex `gpt-5.6-sol`. The other roles keep the registered models.
Model: the [reader-pages probe](../reader-pages-probe/prereg.md), lab notebook studies 22 and 23.

## Question

Does the "Guide and lesson bodies" section of `technical-prose.md` ([PR #110](https://github.com/filipgutica/filip-stack/pull/110)) help a first-time reader do a real task with a page an agent wrote? Specifically: does the reader succeed more often, or find what the task needs earlier on the page? And does the section reduce the failures that unguided pages showed most, with no loss of facts and no more leaks?

The section changes no skill description or reference pointer, so routing is out of scope. Each builder gets its arm's guidance as one file, so the probe measures what the guidance says, not whether a host loads it.

## Error analysis

The measures come from 12 pages written with no guidance, 2 for each brief below, before any rule was drafted. A blind Opus 5.5 coder, who never saw the rules, coded 6 of them. I coded the other 6. The pages and codings stay on the operator's machine.

| Failure | Blind coder (6 pages) | Operator (6 pages) | Used as |
| --- | --- | --- | --- |
| A passage restates an earlier point | 6 (24 instances) | 6 | Targeted measure |
| A maintainer-only fact in the body | 4 | 3 | Targeted measure |
| A concept explained before its problem | not coded | 6 | Diagnostic |
| The body ends on a recap | not coded | 6 | Diagnostic |
| An abstract rule with no example | 2 | — | Not measured: the fact sheets give no example for those rules |
| A term used loosely | 2 | — | Not measured: below the two most common failures |
| The worked case dropped | 0 | 0 | Diagnostic only, because the request asked for the rule |

The blind coder confirmed only the first two failures, so only those two are in the decision rule.

## Frozen inputs

The guidance is frozen at PR #110 head `5ba65a18`. It does not change after the first paid build.

| Input | Value |
| --- | --- |
| Head `technical-prose.md` | SHA-256 `c71e7241…950572` |
| Base ref | `origin/main` at `c9d0b990` |
| Base arm file | `build_arms.py c9d0b990`, SHA-256 `bf0450e8…cdca7f7`, 1,378 words |
| Head arm file | `build_arms.py 5ba65a18`, SHA-256 `aff99409…a97e0c797`, 1,795 words |
| Prompts | [scorer/prompts.py](scorer/prompts.py) as committed with this file |
| Reader tasks | `scorer/tasks.json`, written before the dry run and committed before any paid call |

Word counts use the Workflow validator's rule. The two arm files differ only by the new section.

## Arms

| Arm | Guidance file contents |
| --- | --- |
| vanilla | An empty file. AGENTS.md requires a comparison with vanilla. |
| base | At `c9d0b990`: `technical-writing/SKILL.md` and `references/`, `core.md` "Written deliverables", and `DESIGN.md` "Copy and density" |
| head | The same files at `5ba65a18` |

Each build reads its own copy in `<temporary-directory>/g-<random>/<random>.md`. No path names the arm, and a private ledger maps builds to arms.

## Briefs and page types

A fresh, read-only Sol 6.1 call wrote the three briefs, fact sheets, and keys. It saw no guidance, repository, or earlier study. The subjects are fictional. None is a landing page or an install section, so this probe does not overlap the install-heading study.

| Brief | Page type ([Diátaxis](https://diataxis.fr)) | Subject | Worked case |
| --- | --- | --- | --- |
| G1 | How-to guide, about 800 words | Tavrel bead sorter | Kestrel batch |
| G2 | Explanation (the brief says "conceptual lesson"), about 900 words | Orvane parcel trams | Copper Loop scenario |
| G3 | Tutorial, about 900 words | Dovren return board | Temba loan set |

Each [fact sheet](scorer/factsheets/) has 18 facts, 3 of them tagged `[agent-only]`. The facts come in an engineer's order, so a writer has to reorder them for a reader. The comprehension questions in [scorer/key.json](scorer/key.json) are not used; the reader tasks replace them.

## Builder and reader

- Builder: `delegate_task`, Codex `gpt-6.1-sol`, reasoning `high`, service tier `default`, a fresh context for each call. Prompt `BUILD`, identical across arms except for the file path.
- Reader tasks: one fresh, read-only Sol 6.1 call per brief, prompt `TASK_WRITER`. It sees the brief, the page type, and the tagged fact sheet, never a page or the guidance. It writes 2 tasks that together need at most half of the reader facts, each with a pattern answer key.
- Reader: Codex `gpt-5.6-sol`, reasoning `low`, prompt `READER`. It is an older, smaller-effort model than the builder, and it gets only the page and the 2 tasks.

## Measures

Each measure is computed per build. A pair is one brief and one attempt index, in ledger order, so each comparison has 15 pairs. The pairing is fixed now, before any build.

| ID | Measure | How | Role |
| --- | --- | --- | --- |
| R1 | Task success | Tasks passed (0–2), graded by the key in `tasks.json` | Primary |
| R2 | Read depth | For each task, the words from the page's start through the block that first states the last fact the task needs, from the extractor's block numbers. A needed fact that is absent sets the depth to the page's full length. R2 is the mean over the 2 tasks, in absolute words, so filler anywhere before the key fact counts against the page. | Primary |
| M1 | Fact recall | Share of the 15 reader facts present, from the extractor | No harm |
| M2 | Invented facts | Claims not on the fact sheet, from the extractor | No harm |
| M3 | Agent-only leaks | Agent-only facts anywhere on the page, including disclosures, notes, and link text | No harm and targeted |
| J3 | Restatement | Judge question D3, counted as below | Targeted |
| M7 | Mechanical repetition | Prose sentence pairs with word-set Jaccard similarity of 0.6 or more | Fallback for J3 |
| — | Diagnostics | Judge questions D1, D2, D4–D7 and P1–P5; the extractor's motivated-first share, ending type, case use, and forward dependencies; words, Flesch-Kincaid grade, and section count | Reported only |

**Primary pair outcome.** Head wins a pair when it passes more tasks. When both pass the same number, head wins when its R2 is at least 10% lower, and loses when its R2 is at least 10% higher. Anything else is a tie. If every build passes both tasks, R1 is at its ceiling and the outcome rests on R2 alone.

Extractor: `gpt-6.1-sol`, reasoning high, prompt `EXTRACTOR`. It gets the tagged fact sheet, the case, the concepts, and the page with numbered blocks, never the arm or the guidance.
Double-coding: `gpt-6-astra`, reasoning high, re-extracts every fifth build in ledger order (9 builds). Agreement is reported on fact presence, fact block, and motivated-first.

## Judges

Sol 6.1 (`gpt-6.1-sol` high), Astra (`gpt-6-astra` high), and Opus 5.5 (`claude-opus-5-5` high), each reported separately.

Each judge call shows two pages, the brief, the page type, and the fact sheet, with prompt `JUDGE`. It asks yes/no questions for each page:

- D1–D5 apply to every page type: false fact, buried key point, restatement, vague example, and filler.
- D6 (case dropped) applies to the tutorial only, and D7 (concept before its problem) to the explanation only.
- P1–P5 are sentence-clarity questions drawn from the [Federal Plain Language Guidelines](https://digital.gov/guides/plain-language): hidden actor, hidden verb, more than one idea, uncommon word, and noun strings or double negatives.

A "yes" counts only when its quote appears in that page, after whitespace is normalized. No question asks which page is better.

**Both orders.** Each pair is judged twice, once in each A/B order. For one question, a judge's verdict in one order is "head better" when only the other page has the defect, "other better" when only head has it, and a tie otherwise. The judge's verdict for the pair is that verdict when both orders agree, and a tie when they do not.

**Pairs judged.** Head against base only: 15 pairs × 3 judges × 2 orders. Vanilla is compared through R1, R2, and M1–M3.

## Calibration (before any build)

Calibration runs first in the paid sequence. The judge questions are frozen before it starts.

**Defect pages.** Three exemplar pages from the Django documentation (BSD license) stand in for well-regarded docs:

| Page type | Exemplar |
| --- | --- |
| Tutorial | Writing your first app, part 1 |
| How-to guide | How to manage static files |
| Explanation | Working with forms, the HTML forms part |

For each exemplar, the operator does three things:

1. Writes a fact sheet.
2. Removes the defects the page already has, such as the static-files page's two repeated warnings, and records each edit. This makes the result the clean page.
3. Plants defects in copies of the clean page.

- Each broken copy carries two defects of different types, and the operator records each planted span.
- Over 14 broken copies, each type D1–D7 is planted 4 times:
  - D6 only in the tutorial;
  - D7 only in the explanation;
  - D1–D5 spread across all three exemplars.

These files stay on the operator's machine and are not committed.

Each clean–broken pair goes to each judge in both orders. A judge "catches" a planted defect when it answers "yes" for that type on the broken page in both orders, with a quote that shares at least 5 consecutive words with the planted span. A "false alarm" is a "yes" for a type on a clean page, in either order.

**Reliability rule (fixed now).** A judge counts on a question only when it catches at least 3 of the 4 planted defects of that type, and it raises false alarms on that type in at most 20% of the pairs where the question applies. The report gives each judge's catch rate and false-alarm rate per type, with Wilson 95% intervals. With 4 instances, 3 of 4 has an interval of 0.30–0.95.

**Plain-language pairs.** Eight before-and-after sentence pairs from digital.gov's plain-language guides go in one `PLAIN_JUDGE` call per judge per order. A judge counts on P1–P5 when, in at least 6 of the 8 pairs and in both orders, it marks more problems on the "before" version than on the "after" version. These pairs test sentence clarity only.

**Counting votes.** For each question, a pair's verdict comes from the judges that count on it:

- three judges: a strict majority;
- two judges: both must agree;
- one judge: its verdict.

If no judge counts on D3, J3 is replaced by M7, with no other change.

## Decision rule (fixed before any build)

The guidance is **supported** only if all of the following hold.

1. **Reader success against base.** An exact one-sided sign test of the primary pair outcome over the non-tied pairs gives p ≤ 0.05 in head's favor.
2. **Reader success against vanilla.** Head wins more primary pairs than it loses.
3. **No harm, against base and against vanilla, on every brief.** Head's mean M1 is at least the other arm's minus 0.05. Head's summed M2 is at most the other arm's plus 1. The same applies to head's summed M3.
4. **Targeted failures against base.** Head wins more J3 pairs than it loses, or more M7 pairs if J3 is replaced. Head's M3, summed over all briefs, is at most base's.

Otherwise the result is **not supported**. The run then stops and reports, and the guidance is not revised or rerun without Filip's approval.

**Flags.** These do not change the verdict. When one is raised, the report names it, and the PR must name it too:

- **Builder model only:** a J3 or diagnostic win in which `gpt-6.1-sol` is the only counted judge voting for head. That model also builds the pages.
- **Length:** head's mean words on a brief are more than 20% above the other arm's, on a brief where head won a majority of primary pairs.
- **Order:** a judge's two orders disagree on more than 30% of its question verdicts.

## Statistics and detection floor

- **Rates.** Every rate is reported with a Wilson 95% interval: task success per arm, catch and false-alarm rates, and win shares.
- **Sign test.** With 15 non-tied pairs, the one-sided sign test needs 12 head wins (p = 0.018). If head truly wins 80% of pairs, the test finds it 65% of the time; at 85%, 82% of the time; at 90%, 94%. Ties lower the power further: with 10 non-tied pairs, the test needs 9 wins.
- **Detection floor.** The probe can detect only large effects: a win rate of about 85% or more. A null result does not show that the guidance has no effect.

## Coverage against Treude et al.

[Treude, Middleton, and Atapattu (FSE 2020)](https://arxiv.org/abs/2007.10744) name ten dimensions of documentation quality. This probe covers them as follows.

| Dimension | Covered by |
| --- | --- |
| Understandability | R1, the primary measure |
| Structure | R2, D2, ending type, section count |
| Cohesion | D6, case use, forward dependencies |
| Conciseness | J3 or M7, D5, words |
| Readability | P1–P5 and Flesch-Kincaid grade (diagnostic) |
| Clarity | P1–P5, sentence level only |
| Quality (spelling and grammar) | Not measured. Every arm uses the same builder, and neither coding of the 12 unguided pages listed a spelling or grammar failure. |
| Appeal | Not measured. It is a matter of taste, and the judges are asked only about specific defects. |
| Effectiveness (technical vocabulary) | Not measured. The subjects are fictional, so the fact sheet sets the vocabulary. Forward dependencies cover terms used before they are defined. |
| Consistency (terminology) | Not measured. A loose term appeared in only 2 of the coder's 6 pages, below the two failures this probe targets. |

## Runner and stop rule

The parent agent dispatches every call. Each call's task is the one line `TASK`: read one prompt file, write the reply to a named out file, and reply SAVED. Each prompt file and each out file sits alone in its own random folder outside the repository. At most 8 calls run at once.

Every reply is checked as soon as it arrives. A reply is unusable when it is empty, unreadable, or opens with a first-person refusal or read failure. A build reply under 250 words is unusable. A scoring reply is unusable when it has no JSON or lacks a required field.
An unusable reply is a failed call, as is a timeout or an error. On the first failed call, the runner dispatches nothing more and reports. A retry needs Filip's approval and comes out of the spare calls below.

The paid sequence is calibration, builds, extraction and double-coding, reading, and then judging.

## Calls

| Item | Calls |
| --- | ---: |
| Dry run: 3 task-writer calls; calibration on 1 pair in one order and 1 plain-language call, each for 3 judges (6); G1 with 1 attempt per arm: 3 builds, 3 extractions, 1 double-coding, 3 reader calls, and 6 judge calls | 25 |
| Calibration: 14 pairs × 3 judges × 2 orders, plus 6 plain-language calls | 90 |
| Builds: 3 briefs × 3 arms × 5 attempts | 45 |
| Extractor | 45 |
| Double-coding at 20% | 9 |
| Reader | 45 |
| Judges: 15 pairs × 3 judges × 2 orders | 90 |
| **Registered paid total** | **324** |
| **Upper limit**, including 16 spare calls for approved retries | **340** |

By model, the paid run uses `gpt-6.1-sol` for 150 calls, `gpt-6-astra` for 69, `claude-opus-5-5` for 60, and `gpt-5.6-sol` for 45.

The dry run checks:

- the prompts, the arm files, and the stop rule;
- the extractor's block numbers;
- the task keys and the quote check;
- the ledgers.

It gives no verdict. If the dry run shows a pipeline fault, the fix is a dated amendment to this file. It is made before any paid call and needs Filip's approval. A fault in the guidance is not a pipeline fault. The dry-run builds are not reused.

## Dry run (2026-11-05)

The dry run used 25 calls, and none failed. It wrote `scorer/tasks.json`, which is frozen from here on.

- **Pipeline:** every stage ran. The dry run's judges were `gpt-6.1-sol`, `gpt-6-sol`, and `gpt-5.6-sol`, and `gpt-6-sol` did the double-coding. The paid run uses the registered judges and double-coder, with the reader from Amendment 1. Every judge "yes" quote was found in its page (36 of 36).
- **Calibration pages:** all three judges flagged the same lines in the clean tutorial: two filler sentences, one restatement, and a sentence the cleaning step had added. This is a fault in the calibration materials. Amendment 2 below fixes it.
- **Not a verdict:** the dry-run builds are not reused, and their scores decide nothing.

## Amendment 2 (2026-11-05, after the dry run, before any paid call; approved by Filip)

The clean calibration pages were not clean enough. Left as they were, they would raise false alarms on every pair that uses them. The fixes:

- **Tutorial:** remove the two filler sentences and the restatement that the dry-run judges flagged. Also remove the sentence the cleaning step had added in place of the second directory listing.
- **How-to:** remove two filler sentences and fix the reference that one removal left dangling.
- **Explanation:** remove the second opening paragraph, which restates the "Django's role" list, and one filler sentence.
- **Fact sheets:** add two details that the how-to states but its fact sheet left out, so they do not count as unsupported claims.

The broken copies are rebuilt from the new clean pages with the same planted defects. Each edit is recorded with the local calibration files.

**Retries.** A call that fails in transport may be retried once from the spare calls without asking: a timeout, an empty reply, or no reply file. Any other unusable reply still stops the run.

## Known limits

- Global host guidance reaches every arm, vanilla included, through the builder's own instruction files. All arms share this confound. Build traces are checked to confirm that each builder read only its own arm file.
- Five attempts on three briefs is a probe, not a benchmark. See the detection floor above.
- The reader and two of the three judges are OpenAI models, like the builder. Opus 5.5 is the only judge from another provider, so a preference for OpenAI writing cannot be ruled out. Per-judge results and the builder-model flag show how much a result rests on the builder's own model.
- Calibration uses human-written Django pages with planted defects. Catch rates may not carry over to agent-written pages about fictional subjects.
- With 4 planted defects per type, the reliability rule rests on small counts, and its intervals are wide.
- The clean tutorial was edited using the dry-run judges' own flags, so its false-alarm rate is optimistic.
- Each calibration pair differs only by its planted defects, so a judge can find them by comparing the two pages. Head and base pages are written separately, so the catch rates likely overstate how sensitive the judges are in the main run.
- The reader is a model, not a person. R2 measures where the needed facts sit on the page, not how a person scans it.
- The operator plants the defects and knows their spans. The judges never see the spans.
- Actual token use and billed cost are not measured.
