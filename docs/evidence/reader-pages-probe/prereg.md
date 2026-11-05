<!-- Copied unchanged from the 2026-11-04 writing audit. Relative links point to that audit folder, outside this repository. -->

# Writing guidance probe: pre-registration

Status: plan only. Nothing has run. A paid run needs Filip's approval (AGENTS.md, Evaluation).
Model: the design-language probe (`~/code/design-previews/ui-audit-2026-11-04/impl/probe-study/probe-run-2026-11-04.md`). That probe found no support at 3 attempts per arm, so this one uses 5.

## Question

Do the proposed writing edits (G1–G3, G5–G7 in [changes.md](../guidance-drafts/changes.md)) make agents write reader pages that a first-time reader understands better, with no loss of facts?

Routing is tested separately with `pnpm eval:routing`, which covers G2's description and pointer and G4's scenario. This probe hands each builder its guidance files directly, so it measures what the guidance says, not whether the host picks it.

## Arms

| Arm | Guidance folder contents |
| --- | --- |
| vanilla | Nothing. The brief and fact sheet only. AGENTS.md requires comparing with vanilla. |
| base | At `origin/main`: `technical-writing/SKILL.md` and `references/`, `core.md` "Written deliverables", `DESIGN.md` "Copy and density", and for B1 only `cli-tool-template` "Pages site" |
| head | The same files with G1–G3 and G5–G7 applied |

Each build reads from its own folder, `$TMPDIR/writing-probe/g-<random>/`. No path names the arm, and a private ledger maps builds to arms, as in the design-language probe.

## Builder

- Host: `delegate_task`, Codex `gpt-6.1-sol`, reasoning `high`, service tier `default`.
- Prompt, identical across arms apart from the folder and the brief:

> Read every file in `<folder>` and follow it (skip this step when the folder is empty). `<brief>` Use only the facts in the fact sheet below; do not add facts. Reply with the page copy as Markdown and nothing else. Do not edit files, start subagents, or browse.
> `<fact sheet>`

## Briefs

The subjects are fictional, so the head guidance's examples (devps, hill-climb, the lesson) cannot leak answers.
Each fact sheet tags some facts `[agent-only]`. These are true, but a reader page should link them or leave them out. They make leakage measurable.

### B1. Tool landing page: `portlog`

Brief: "Write the landing page copy for `portlog`, following the tool page section order."

Fact sheet:

1. portlog records which process held each local TCP port over time.
2. It answers "what was on port 3000 an hour ago?" after the process has exited.
3. Install: `brew install example/tap/portlog`.
4. `portlog start` runs a background recorder. `portlog stop` stops it.
5. `portlog who 3000` shows every process that held port 3000, newest first.
6. `portlog who 3000 --since 2h` limits it to the last two hours.
7. `portlog free 3000` stops the process that holds port 3000 now, after confirmation. `-y` skips the confirmation.
8. History is kept for 7 days, in `~/.portlog/`.
9. Runs on macOS and Linux. Written in Go. MIT license.
10. It never records command-line arguments, because they can hold secrets.
11. `[agent-only]` The recorder polls `lsof` every 2 seconds on macOS and reads `/proc/net/tcp` on Linux.
12. `[agent-only]` The store is SQLite in WAL mode, with a busy timeout of 500 ms.
13. `[agent-only]` Releases use release-please, and `fix:` makes a patch.
14. `[agent-only]` The `who` query uses the index `idx_port_time`.

Comprehension questions:
(a) What does portlog do?
(b) What do you run first after installing it?
(c) Can it show a process that already exited?

### B2. Skill page: `release-notes`

Brief: "Write the docs-site page for the `release-notes` skill with the sections What it does, When to use it, How it works, and What you get."

Fact sheet, written in the style of contract text on purpose:

1. Drafts release notes from merged PRs between two tags.
2. Manual only: `/release-notes <from-tag> <to-tag>`.
3. Groups PRs by Conventional Commit type: features, fixes, and breaking changes first.
4. Skips PRs labeled `skip-notes`.
5. Never publishes. It writes `RELEASE_NOTES.md` in the working tree and stops.
6. A breaking change needs a migration line. If the PR body has none, the draft marks it `TODO: migration`.
7. Requires `gh` signed in. It stops if `gh auth status` fails.
8. Neighbor: `technical-writing` edits prose. `release-notes` gathers the PRs and drafts.
9. If either tag does not exist, it stops before drafting.
10. `[agent-only]` Resolve the tags with `git rev-list -n1 <tag>`. The exit reason for a missing tag is `TAG_UNRESOLVED`.
11. `[agent-only]` Fetch PRs with `gh pr list --state merged --search "merged:<from>..<to>" --json number,title,labels,body --limit 500`.
12. A PR with labels of more than one type goes in the group that most of its labels name.
13. `[agent-only]` The grouping counts labels with a strict-majority rule, and the code breaks ties by label order.
14. `[agent-only]` Keep a private ledger at `$TMPDIR/release-notes/<id>/ledger.md`.

Comprehension questions:
(a) Will it publish a release?
(b) How do you run it?
(c) What happens to a breaking change with no migration note?

### B3. README section: "Install and update"

Brief: "Write the README's opening paragraph and its Install and update section for the `tidy-hooks` plugin."

Fact sheet:

1. `tidy-hooks` is a Claude and Codex plugin. It blocks `git commit` when staged files contain merge markers.
2. Claude: `claude plugin marketplace add example/tidy`, then `claude plugin install tidy-hooks@tidy`.
3. Codex: `codex plugin marketplace add example/tidy`, then `codex plugin add tidy-hooks@tidy`.
4. Codex skips plugin hooks until you review and trust them.
5. Update in Claude with `claude plugin update tidy-hooks@tidy`. Update in Codex with `codex plugin marketplace upgrade tidy`, then restart Codex.
6. The hook fails open: if Node.js is missing, commits proceed.
7. `[agent-only]` The hook entry is `hooks/pre-tool-use.mjs`, and it parses `bash -c` wrappers with a shell tokenizer.
8. `[agent-only]` Hook timeout 5 s, set in `hooks.json`.

Comprehension questions:
(a) What does the plugin stop?
(b) What extra step does Codex need before the hook runs?
(c) What happens without Node.js?

### B4. Lesson opening

Brief: "Write the first two sections, about 350 words, of a lesson for engineers titled 'Flaky tests and agents'."

Fact sheet:

1. An agent that sees a red test tries to fix the code, even when the test is flaky.
2. A flaky test fails sometimes without any code change.
3. Agents tend to rerun until green, or to weaken the assertion.
4. Quarantine means moving a known-flaky test out of the required gate while it is fixed, with an owner and a date.
5. A required gate that sometimes fails teaches agents and people to ignore it.
6. Measuring flakiness: rerun each test 20 times on the same commit, and count failures.
7. `[agent-only]` The audit script is `scripts/flake-scan.mjs --runs 20 --json`.
8. `[agent-only]` This lesson's rubric is the author's own and is not from a vendor.

Comprehension questions:
(a) What is a flaky test?
(b) Why does it matter more with agents?
(c) What does quarantine mean?

## Measures

Every measure is computed per build and summed over the 5 attempts for each brief.

| ID | Measure | How | Better |
| --- | --- | --- | --- |
| M1 | Fact recall | Share of non-agent-only facts present, from a structured extractor call that gets the checklist. A second model double-codes 20% of builds. | Higher |
| M2 | Invented facts | Claims not on the fact sheet, from the same extractor | Lower |
| M3 | Agent-only leaks | Agent-only facts stated in the explanation. Not a leak: a fact in a sources note, a link, or a disclosure, or a statement of only its reader-observable effect (for example, "it stops if a tag is missing") | Lower |
| M4 | Opening job statement | 1 if the first two sentences name the subject and say what it does, and a reason to want it appears within the first 120 words. Extractor, double-coded. | Higher |
| M5 | Start before details | Word offset of the first install step, command, or example, divided by total words | Lower |
| M6 | Fragment rate | Share of sentences with no finite verb, from the extractor. Cross-checked against `tools/tells.py` `fragment` and label-shorthand patterns. | Lower |
| M7 | AI tells | `tools/tells.py` counts for humanizer §1, §8, §12, §16, §19, §25 | Lower |
| M8 | Repetition | Number of sentence pairs with a word-set Jaccard similarity of 0.6 or more | Lower |
| M9 | Comprehension | A fresh `gpt-6.1-sol` call at low reasoning gets only the page and the 3 questions. A fixed key grades the answers (0–3). | Higher |
| — | Length, reading grade | Words, and Flesch-Kincaid grade from `tools/metrics.py`. Reported, but not in the rule. | Neither. B1 should get longer. |

Judges: Astra, Sol 6.1, and Opus 5.5 see each head-vs-base pair and each head-vs-vanilla pair blind. Each pair is shown as A and B in random order, in a fresh context, with the brief but not the guidance.
Judges answer A, B, or SAME on two questions, then overall:

- "Could a first-time reader do what they came to do?"
- "Does it read like a careful person wrote it?"

The judges are uncalibrated diagnostics, as AGENTS.md notes. The rule below uses them as one part of the decision.

## Decision rule (fixed before any build)

Ship G1–G3 and G5–G7 only if all three parts hold, for head against base:

1. **No harm.** On every brief, M1 for head is at least M1 for base minus 0.05, and M2 for head is at most M2 for base plus 1.
2. **Objective gain.** Head is better than base on at least 2 of M3, M4, M5, M6, and M9, on at least 3 of the 4 briefs. Head is worse than base on M3 or M4 on no brief.
3. **Judges agree.** Most of the 15 overall votes (3 judges × 5 attempts) prefer head on at least 3 of the 4 briefs. No brief has a majority for base.

Head must also meet parts 1 and 3 against vanilla. If it fails against vanilla, the guidance as a whole is not earning its context, whatever the base comparison shows. Report that as its own finding.
If part 1 fails, reject the edits and look at the leaks. If only part 2 or part 3 fails, revise one rule and rerun only the briefs that failed.

## Cost

| Item | Calls |
| --- | ---: |
| Builds: 4 briefs × 3 arms × 5 attempts | 60 |
| Extractor (M1–M4, M6) | 60 |
| Double-coding at 20% | 12 |
| Comprehension (M9) | 60 |
| Judges: 4 briefs × 5 attempts × 2 pairings × 3 judges | 120 |
| **Total** | **312** |

Opus 5.5 handles 40 of the judge calls. Everything else runs on Codex.
Before this, do a dry run with 1 attempt per arm on B1 only: 3 builds, 3 extractor calls, 3 comprehension calls, and 6 judges, 15 calls in all. It checks the prompt, the extractor, the comprehension key, and the ledger.
`pnpm eval:routing --dry-run`, then a real run once approved, covers G2 and G4.
