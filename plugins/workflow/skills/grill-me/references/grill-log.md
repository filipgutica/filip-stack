# Grill log

Use one plain Markdown log for one explicit session. Prefer a clear date and subject in the filename:

```text
~/.engineering-workflow/<work-item>/grills/YYYY-MM-DD-<subject>.md
```

Use a user-supplied path when present. Do not create a manifest, sequence registry, topic lifecycle, or generated link index.

Use this shape:

```md
# Grill: <subject>

Source: <artifact, request, or link>
Date: YYYY-MM-DD

## Decisions

### <Decision>
- Question: <focused question>
- Recommendation: <recommended answer and assumptions>
- Decision: <user decision>
- Rationale: <why>
- Evidence: <bounded source>

## Changed assumptions

- <old assumption> -> <new fact or decision>

## Open items

- <unresolved question or risk>
```

Append a checkpoint only when a material decision resolves or changes. Keep the user decision distinct from the recommendation. If a later decision supersedes an earlier one, append the new decision and name the superseded entry.

Do not store prompts, transcripts, hidden reasoning, credentials, full diffs, code excerpts, or unrelated conversation. On resume, read the source, latest decision, changed assumptions, and open items before reading older entries.
