# Walkthrough log

Store one log for each explicit Walkthrough session:

```text
~/.engineering-workflow/topics/open/<topic-id>/walkthroughs/<date>-<sequence>-<slug>.md
```

Use setup `start-walkthrough` after source and topic confirmation. Build the ordered change map before you run the command. Pass `--slices` as a JSON array of `slice` and `description` objects. The command assigns the date and sequence. Do not reconstruct the filename.

For a branch walkthrough, pass the verified base ref. The setup utility records the repository identity, branch, merge base, head, and comparison range. For a last-turn or working-tree walkthrough, it records the current head and labels the range with the source type.

Resume the same log after context compaction or interruption. Use `start-walkthrough --log-file <name>` to validate the existing session file.

The log starts with a `## Slices` table. Each row contains the slice name, a brief description, and its current status. The initial status is `unresolved`.

Use unique slice names. Do not use `complete` as a slice name because the utility reserves it for the terminal state.

A `## Running log` follows the table. Use setup `update-walkthrough` after the user resolves each slice. The command updates the table row and appends one chronological entry. Record only:

- the slice name
- whether the slice was covered, changed, or remains unresolved
- a short behavior summary
- bounded file or contract evidence
- the user's decision, or `none`

Keep each recorded field on one line. The setup command rejects line breaks before it writes the log.

Do not store a raw transcript, prompt, response, hidden reasoning, full diff, code excerpt, credential, or machine-local repository path. Keep decisions distinct from the agent's explanation or recommendation.

The setup utility rejects high-signal credentials, absolute home paths, code fences, and role-labeled transcript lines. This check cannot identify all sensitive meaning. Curate every field before the write.

The log must link to `../TOPIC.md`. The setup utility adds each log to the manifest in chronological filename order.

Append a new slice record when the user changes an earlier decision. Name the earlier slice in the new record. Do not silently rewrite history.

The utility selects the first unresolved table row as the next slice. It selects `complete` only when no unresolved row remains. Preserve unresolved rows when the user stops early.
