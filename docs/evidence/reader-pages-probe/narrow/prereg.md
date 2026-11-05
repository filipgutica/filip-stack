# Reader pages probe, narrowed scope: pre-registration

Date: 2026-11-05

Status: plan only. No build has run. Filip approved this probe and its paid run, at most 250 calls.

## Why

The paid run supported the reader-pages guidance on B1 (tool landing page), B2 (skill page), and B4 (lesson opening), but not on B3 (a README install and update section). The one allowed R4 revision made B3 worse (4–11 against base). See [../paid-run-report.md](../paid-run-report.md) and [../b3-rerun-report.md](../b3-rerun-report.md).

Commit `c926026b` reverts R4 to its paid-run wording and limits the reference to pages a reader uses to decide whether to use something or to start learning it. Procedure and reference sections follow technical prose instead. The narrowed claim was formed after seeing B1, B2, and B4, so only new briefs can test it.

## Question

On new briefs of the three supported page types, does the narrowed guidance make agents write pages that a first-time reader understands better than base and vanilla, with no loss of facts?

## Fixed choices

Everything not listed here copies [../prereg.md](../prereg.md) unchanged: the builder, its prompt, the measures M1–M9, the extractor, comprehension and judge prompts, the judges, the double-coding share, and the call settings.

| Item | Value |
| --- | --- |
| Head arm | `c926026b6cfcd5d46ee80ee097d2c7a56d91566f`, the Step 1 commit |
| Base arm | `85522f76cc69781ac239ac2cd2f3443b25d499e3`, `origin/main` when this was written. Its arm inputs match the paid run's base `0fc048d4`. |
| Vanilla arm | An empty file |
| Briefs | N1 tool landing page, N2 skill page, N3 lesson opening, below |
| N1 arm contents | N1 is the tool landing page, so its base and head arms add the CLI tool template "Pages site" section, as B1's did (`build_arms.py --b1`) |
| Attempts | 5 per arm per brief |
| Builder | Codex `gpt-6.1-sol`, high reasoning, default service tier |
| Extractor | Codex `gpt-6.1-sol`, high; double-coding Codex `gpt-6-astra`, high, on 20% of builds |
| Comprehension | Codex `gpt-6.1-sol`, low |
| Judges | Astra high, Sol 6.1 high, Opus 5.5 high (`claudeAgent`, effort high, fast mode false), blind, balanced A/B order |
| Calls | `delegate_task`, async, role general, shared isolation, fresh context, read-only instruction, at most 8 running |
| Scorer | [scorer/](scorer/), a copy of [../scorer/](../scorer/) with the three new briefs and the narrowed rule; see below |

## Who wrote the briefs

One fresh read-only Sol 6.1 call (high reasoning, default tier) wrote the three briefs, fact sheets, `[agent-only]` tags, comprehension questions and keys, and the M1 checklist. It saw only the original Briefs section with B1, B2, and B4 as format examples, and their scoring keys. It did not see `reader-pages.md`, any guidance file, or any result. Its trace shows one command: reading its own prompt file. Its request, reply, and trace are in [brief-writer/](brief-writer/).

One format fix was made: the reply wrote the tag as `[agent-only]` without backticks, and the scorer strips only the backticked form from build prompts. The tags were wrapped in backticks (4 in N1, 4 in N2, 2 in N3). No fact, question, or key was changed. [brief-writer/format-fixes.json](brief-writer/format-fixes.json) records this.

## Briefs

### N1. Tool landing page

Brief: "Write the landing page copy for `sackview`, following the tool page section order."

Fact sheet:

1. sackview shows what is inside a ZIP archive before you unpack it.
2. Each entry shows its name, compressed size, and unpacked size.
3. Install: `pipx install sackview`.
4. `sackview inspect photos.zip` lists the archive's entries.
5. `sackview inspect photos.zip --largest 10` shows the ten entries with the largest unpacked sizes, largest first.
6. `sackview inspect photos.zip --find '*.csv'` shows only entries whose names match the pattern.
7. It displays the total unpacked size so you can check available disk space before extracting elsewhere.
8. It never extracts entries or changes the archive.
9. Inspection works offline and sends no archive contents to a service.
10. It supports ZIP archives only; other archive formats produce an unsupported-format message.
11. `[agent-only]` Entry metadata is read through the internal ZipDirectoryReader adapter.
12. `[agent-only]` Size totals use unsigned 64-bit accumulators.
13. `[agent-only]` Unsupported formats return exit code 24.
14. `[agent-only]` The package build copies its command schema from packaging/commands.json.

Comprehension questions:

(a) What does sackview show you? Key: says it shows the contents or entries of a ZIP archive.
(b) What command lists the entries in photos.zip? Key: names sackview inspect photos.zip.
(c) Does sackview extract files? Key: says no.

M5 start pattern: the first code block or install or command span, as `start` in [scorer/key.json](scorer/key.json) defines it.

### N2. Skill page

Brief: "Write the docs-site page for the `term-weave` skill with the sections What it does, When to use it, How it works, and What you get."

Fact sheet:

1. Drafts a glossary of project terms from documents in a supplied folder.
2. Manual only: `/term-weave <source-folder>`.
3. Accepts Markdown and plain-text documents. Ignores other file types.
4. Use when project vocabulary is scattered across documents or newcomers encounter unexplained terms.
5. Every drafted definition includes a link to the passage that supports it.
6. Does not invent definitions. Lists terms without a supporting explanation under Unresolved terms.
7. If sources give conflicting definitions, preserves both definitions in one entry, links each source, and marks the entry Conflict.
8. Writes GLOSSARY.md in the working directory. Never changes the source documents.
9. Sorts glossary entries alphabetically. Places Unresolved terms after the defined entries.
10. `[agent-only]` Candidate extraction uses the private collectTermCandidates routine.
11. `[agent-only]` The source manifest is stored at .term-weave/source-manifest.json.
12. If the supplied folder is missing or contains no readable supported documents, stops and explains the problem without drafting.
13. `[agent-only]` An unreadable input set uses the internal reason INPUT_SET_EMPTY.
14. `[agent-only]` Evaluation scores source attribution separately from definition completeness.

Comprehension questions:

(a) Will term-weave change the source documents? Key: says no.
(b) How do you run it? Key: names /term-weave with a source folder.
(c) What happens when two sources define the same term differently? Key: says it preserves both definitions with their sources and flags the conflict.

M5 start pattern: the first code block or install or command span, as `start` in [scorer/key.json](scorer/key.json) defines it.

### N3. Lesson opening

Brief: "Write the first two sections, about 350 words, of a lesson for engineers titled 'Renaming rooms in the Kestrel directory'."

Fact sheet:

1. Kestrel is a fictional directory of shared work rooms; each room has a room key and a display name.
2. A room key is assigned when the room is created and never changes or gets reused for another room.
3. A display name is the human-readable label people see, and room owners can change it.
4. Saved links identify rooms by their keys. Kestrel looks up the key and displays the room's current name when a link is opened.
5. A link built from a display name can stop finding the room after a rename, because the name has changed.
6. To verify a rename, save a room link beforehand, rename the room, and open the saved link; it should reach the same room and show the new name.
7. `[agent-only]` The storage schema calls the key column room_ref and the display-name column title_text.
8. `[agent-only]` The lesson's private grading guide assigns separate marks for identity, naming, and verification.

Comprehension questions:

(a) What stays the same when a room is renamed? Key: names the room key or permanent identifier.
(b) Can a link built from a display name stop working after a rename? Key: says yes.
(c) Which link should you open to verify that a rename preserved access? Key: says to open the room link saved before the rename.

M5 start pattern: none, as for B4.

## Decision rule (fixed before any build)

For head against base:

1. **No harm.** On every brief, M1 for head is at least M1 for base minus 0.05, and M2 for head is at most M2 for base plus 1.
2. **Objective gain.** Head is better than base on at least 2 of M3, M4, M5, M6, and M9, on at least 2 of the 3 briefs. Head is worse than base on M3 or M4 on no brief.
3. **Judges agree.** Most of the 15 overall votes prefer head on at least 2 of the 3 briefs, and no brief has a majority for base.

Head must also meet parts 1 and 3 against vanilla. There is no revision round: if any part fails, the result is not supported.

The scorer copy changes only two things in `probe.py`: it reads the briefs from `scorer/briefs.json`, and `decision()` requires 2 of 3 briefs instead of 3 of 4. `prompts.py`, `build_arms.py`, and `tools/` are byte copies.

## Delivery change from the paid run

The paid run's dispatcher passed each prompt as task text from a script. This run's dispatcher is the parent agent itself, which cannot pass a long prompt without retyping it. So every call gets the same one-line task: read one named prompt file and follow it. Each prompt file sits alone in its own randomly named folder outside the repository. The file holds exactly the prompt the paid run would have sent.

The isolation check changes to match. A build may read exactly its prompt file and its arm file. A scoring call may read exactly its prompt file. Replies and traces are saved from the T3 state database, read-only, so they do not pass through the parent agent. A test against five saved B3-rerun replies matched byte for byte.

## Cost

| Item | Calls |
| --- | ---: |
| Brief writer, done | 1 |
| Dry run on N1, 1 attempt per arm | 15 |
| Builds: 3 briefs × 3 arms × 5 attempts | 45 |
| Extractor | 45 |
| Double-coding at 20% | 9 |
| Comprehension | 45 |
| Judges: 3 briefs × 5 attempts × 2 pairings × 3 judges | 90 |
| **Total** | **250** |

The total equals the approved ceiling, so no call can be retried. If any call fails or times out, the run stops and reports. The dry run continues to the paid run unless the pipeline is broken, as `probe-99-paid.md` defines it; a broken dry run also stops the run, because repeating it would exceed the ceiling.
