---
name: walkthrough
description: "Use only when the user explicitly requests an interactive walkthrough of the last completed agent turn, working tree changes, or branch changes."
disable-model-invocation: true
---

# Walkthrough

Help the user understand and review a change through an interactive, evidence-based conversation.

## Authority

This skill is read-only. Do not edit files, commit, push, publish, or change external state.

Review findings do not grant implementation authority. If the user requests a correction, route it through `$workflow:coordinator`.

## Select the source

Use the source that the user names:

- **Last turn:** Review the last completed agent turn in this conversation. Confirm its files and Git boundary from current evidence. Do not guess when later edits make attribution unclear.
- **Working tree:** Review staged, unstaged, and untracked changes. Separate unrelated or pre-existing changes when the evidence permits it.
- **Branch:** Review committed branch changes against a verified merge base. Use the user's base when provided. State the base and comparison range.

If the source is missing or ambiguous, ask one focused question. Do not start the walkthrough until the source is clear.

## Prepare the walkthrough

1. Inspect the selected diff, changed files, relevant code, tests, and verification evidence.
2. State the source, repository, base, range, and material limits.
3. Build a change map grouped by behavior or decision.
4. Account for every changed file. Group generated or mechanical changes, but label them.
5. Order the slices from public behavior and contracts to implementation, tests, and documentation.

Do not rely on the agent's prior summary when live evidence is available.

## Interactive loop

Explain one coherent slice at a time. Use [presentation patterns](references/presentation-patterns.md) to select the smallest useful visual.

For each slice:

1. Lead with the behavior or decision.
2. Show the smallest code snippet, inline diff, table, or diagram that proves it.
3. Explain why the change exists and how it works.
4. Name meaningful alternatives only when evidence shows they were considered.
5. Explain tests, compatibility, failure modes, and brittle assumptions that affect this slice.
6. Separate facts, inferences, and open questions.
7. Ask one focused question about the user's understanding or decision.
8. Pause for the user's response before the next slice.

Adjust the depth when the user asks to skip, expand, or revisit a slice. Keep a conversational coverage list of completed and remaining slices.

If the user raises a concern, verify it against the live code and contract before classifying it. Classify it as valid, invalid, already addressed, out of scope, or blocked by missing evidence.

## Writing rules

Keep each response short enough to discuss without scrolling through a wall of text. Prefer one to three related files per slice.

Use Humanizer when it is available. Apply `$workflow:ste-writing` in strict mode to the explanatory prose. Preserve code, diff syntax, commands, identifiers, and required technical terms.

Do not force a visual when plain prose is clearer. Do not repeat the full diff after showing the change map.

## Completion

Finish only after the user ends the walkthrough or all slices are covered.

Report:

- covered areas and files
- decisions that the user accepted or changed
- verified findings
- unresolved questions or risks
- verification evidence and limits

Do not treat silence or a request to continue as approval of a decision.
