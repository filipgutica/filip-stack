# Walkthrough log

Store one log for each explicit Walkthrough session:

```text
~/.engineering-workflow/topics/open/<topic-id>/walkthroughs/<date>-<sequence>-<slug>.md
```

Use setup `start-walkthrough` after source and topic confirmation. Build the ordered change map before you run the command. Pass `--slices` as a JSON array of `slice` and `description` objects. The command assigns the date and sequence. Do not reconstruct the filename.

Pass `--reviewer user` for the human-facing Walkthrough. Pass `--reviewer agent` for Agent Walkthrough.

The utility records Reviewer as `user` or `agent`. An omitted value defaults to `user`. Legacy logs without the field remain valid.

For a branch walkthrough, pass the verified base ref. The setup utility records the repository identity, branch, merge base, head, and comparison range. For a last-turn or working-tree walkthrough, it records the current head and labels the range with the source type.

Resume the same log after context compaction or interruption. Use `start-walkthrough --log-file <name>` to validate the existing session file. A branch log with a stale branch range cannot resume or accept an update until its recorded branch and head match the current checkout.

After a correction commit changes a branch walkthrough, use `start-walkthrough --log-file <name> --refresh-range --base-ref <ref>` before marking the correction resolved. Stay on the recorded branch. The recorded head must remain an ancestor of the current head, and the merge base must remain unchanged. The command refreshes the stored head and range before the next slice. Start a new log and rebuild coverage if history was rewritten or the merge base changed.

The log starts with a `## Slices` table. Each row contains the slice name, a brief description, and its current status. The initial status is `unresolved`.

Use unique slice names. Do not use `complete` as a slice name because the utility reserves it for the terminal state.

A `## Corrections` table follows the slice table. Each row contains a stable ID, slice name, correction, and status.

Use these correction statuses:

- `open`: The correction still needs work.
- `resolved`: The authorized correction and its verification are complete.
- `deferred`: The user postponed the correction.

Log a valid correction as soon as the live evidence confirms that a change is needed. Use `update-walkthrough` with `--correction <text>` and `--correction-status open`. The command returns the new correction ID.

Update the same row with `--correction-id <id>` and `--correction-status resolved|deferred`. Do not create a second row for a status change.

Use the correction's source slice when you update its status. The utility rejects a correction ID paired with a different slice.

Keep a correction short and actionable. Associate it with the slice where the walkthrough found it. Do not record questions, recommendations, invalid findings, or already addressed findings.

A `## Running log` follows the table. Use setup `update-walkthrough` after the reviewer resolves each slice. The command updates the table row and appends one chronological entry. Record only:

- the slice name
- whether the slice was covered, changed, or remains unresolved
- a short behavior summary
- bounded file or contract evidence
- the reviewer decision, or `none`
- `Corrections: <id>` for the correction handled by this entry, or `Corrections: none`

Keep each recorded field on one line. The setup command rejects line breaks before it writes the log.

Do not store a raw transcript, prompt, response, hidden reasoning, full diff, code excerpt, credential, or machine-local repository path. Keep decisions distinct from the agent's explanation or recommendation.

The setup utility rejects high-signal credentials, absolute home paths, code fences, and role-labeled transcript lines. This check cannot identify all sensitive meaning. Curate every field before the write.

Existing logs without a `## Corrections` section remain valid. The next `update-walkthrough` call adds an empty corrections table before it applies the update.

The log must link to `../TOPIC.md`. The setup utility adds each log to the manifest in chronological filename order.

Append a new slice record when the user changes an earlier decision. Name the earlier slice in the new record. Do not silently rewrite history.

The utility selects the source slice of the first open correction before any unresolved table row. It selects `complete` only when no open correction and no unresolved row remain. Preserve unresolved rows when the user stops early.

Existing logs may still select the first unresolved row or `complete` while a correction is open. The utility accepts that previous order and normalizes it when the walkthrough resumes or updates.
