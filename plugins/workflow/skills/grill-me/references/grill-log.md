# Grill log

Store one log for each explicit Grill Me session:

```text
~/.engineering-workflow/topics/open/<topic-id>/grills/<date>-<sequence>-<slug>.md
```

Use setup `start-grill` after topic confirmation. The command assigns the date and sequence. Do not reconstruct the filename.

Resume the same log after context compaction or interruption. Use `start-grill --log-file <name>` to validate the existing session file.

Use setup `update-grill` after each resolved answer. Curate the content before the write.

Keep each recorded field on one line. The setup command rejects line breaks before it writes the log.

Record only:

- the focused question
- the recommendation
- the user's decision
- the decision rationale
- the next unresolved question

Do not store a raw transcript, hidden reasoning, speculative conclusions, or unrelated conversation. Keep the user's decision distinct from the recommendation.

The log must link to `../TOPIC.md`. The setup utility adds each log to the manifest in chronological filename order.

If the user changes an earlier decision, append a new decision that names the superseded decision. Do not silently rewrite the historical record.
