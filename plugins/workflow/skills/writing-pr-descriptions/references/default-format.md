# Default PR description format

Use this format only when the user does not provide a format and the repository has no active PR template.

```md
## Summary
Closes <ticket>

<one or two sentences that state the outcome and necessary context>

## Changes
- <material change and why>
```

Use `Closes <ticket>` when the source provides a ticket or issue. Omit that line when no ticket is known. Never invent a ticket.

Keep **Changes** to concise bullets. Add enough root-cause context to explain a non-obvious fix. Omit a validation or testing section unless the user requests one.
