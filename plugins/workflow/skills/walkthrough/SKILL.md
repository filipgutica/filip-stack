---
name: walkthrough
description: "Use only when the user explicitly requests an interactive walkthrough of the last completed agent turn, working tree changes, or branch changes."
disable-model-invocation: true
---

# Walkthrough

Help the user understand and review a change through an interactive, evidence-based conversation.

## Authority

The walkthrough and repository review are read-only. Do not edit repository files, commit, push, or publish.

An explicit `$workflow:walkthrough` invocation grants external-artifact authority for one walkthrough log under a confirmed topic. It does not grant setup, topic creation, specification, plan, ticket, implementation, or other external-write authority.

A concern, question, or proposal does not grant implementation authority.

If the user explicitly requests a bounded correction, use the authorized correction cycle below. The implementation cycle runs outside this read-only skill.

## Select the source

Use the source that the user names:

- **Last turn:** Review the last completed agent turn in this conversation. Confirm its files and Git boundary from current evidence. Do not guess when later edits make attribution unclear.
- **Working tree:** Review staged, unstaged, and untracked changes. Separate unrelated or pre-existing changes when the evidence permits it.
- **Branch:** Review committed branch changes against a verified merge base. Use the user's base when provided. State the base and comparison range.

If the source is missing or ambiguous, ask one focused question. Do not start the walkthrough until the source is clear.

## Persist the walkthrough

An explicit invocation creates one curated topic log by default. Read [walkthrough-log.md](references/walkthrough-log.md) before the first slice.

Use the setup utility to resolve an existing topic. A durable source or registered external work can select the topic. Otherwise, show open topics and ask the user to select one. Do not infer a topic from the branch name.

Create no log before source and topic confirmation. If setup, topic creation, or repository attachment is required, use `$workflow:setup` only with explicit setup authority. Without that authority, continue in the conversation and state that no walkthrough log was persisted.

After you build the change map, use setup `start-walkthrough` to create the log. Pass the ordered slice names and brief descriptions with `--slices`. For a branch walkthrough, pass the verified base ref. Resume an interrupted walkthrough with `start-walkthrough --log-file <name>`.

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

The log starts with a summary table. Each row contains a slice name, brief description, and current status. A chronological running log follows the table.

After the user resolves a slice, use setup `update-walkthrough` before the next slice. Record only the curated status, summary, evidence, and decision. The utility updates the table, appends the running-log entry, and selects the first unresolved slice. Do not store the conversation or full coverage map.

The utility rejects high-signal credentials, absolute home paths, code fences, and role-labeled transcript lines. This check is a backstop. Curate every field before the write.

If the user raises a concern, verify it against the live code and contract before classifying it. Classify it as valid, invalid, already addressed, out of scope, or blocked by missing evidence.

## Authorized correction cycle

If the user explicitly requests a bounded correction during the walkthrough:

1. Pause the walkthrough.
2. Record the current slice and coverage state in the walkthrough log when one exists.
3. Route the correction through `$workflow:coordinator`.
4. Complete the authorized implementation, verification, and review cycle.
5. Refresh the selected diff and coverage map.
6. Revisit each changed or superseded slice.
7. Resume the walkthrough from the updated evidence.

If the correction expands the agreed scope or changes a public contract, confirm that authority before implementation.

## Writing rules

Keep each response short enough to discuss without scrolling through a wall of text. Prefer one to three related files per slice.

Use Humanizer when it is available. Apply `$workflow:ste-writing` in strict mode to the explanatory prose. Preserve code, diff syntax, commands, identifiers, and required technical terms.

Do not force a visual when plain prose is clearer. Do not repeat the full diff after showing the change map.

## Completion

Finish only after the user ends the walkthrough or all slices are covered.

If all slices are covered, update the final resolved slice and set the next slice to `complete`. If the user stops early, preserve the unresolved next slice so the session can resume.

Report:

- covered areas and files
- decisions that the user accepted or changed
- verified findings
- unresolved questions or risks
- verification evidence and limits

Do not treat silence or a request to continue as approval of a decision.
