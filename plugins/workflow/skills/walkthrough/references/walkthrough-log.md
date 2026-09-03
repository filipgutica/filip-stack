# Walkthrough log

Use one plain Markdown log for one explicit walkthrough. Prefer this location when the user selected a work item:

```text
~/.engineering-workflow/<work-item>/walkthroughs/YYYY-MM-DD-<subject>.md
```

Use a supplied path when present. Do not create manifests, sequence registries, repository mirrors, or generated indexes.

Use this shape:

```md
# Walkthrough: <subject>

Source: <working tree, exact range, or pull request>
Reviewer: <user or agent>
Date: YYYY-MM-DD

## Slices

- [ ] <slice>: <behavior and files>

## Decisions

### <slice>
- Status: <accepted, changed, unresolved>
- Behavior: <short summary>
- Evidence: <bounded source and verification>
- Decision: <reviewer decision or none>

## Corrections

- [ ] <slice>: <small required correction and verification>

## Open items

- <risk or question>
```

Update the log only when a slice decision or correction state changes. Use `[x]` only after the reviewer accepts a slice or verification proves a correction. Preserve unresolved entries when the walkthrough stops.

If the selected range changes, record the new exact range and revisit affected slices. Start a new log when rewritten history makes the earlier range incomparable.

Do not store prompts, transcripts, hidden reasoning, credentials, full diffs, code excerpts, absolute machine paths, or noisy command output. On resume, read the source, unresolved slices, corrections, and open items first.
