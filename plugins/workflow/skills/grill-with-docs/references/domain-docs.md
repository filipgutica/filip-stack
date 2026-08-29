# Repository documentation

Update repository documentation as information and decisions become final. Do not batch resolved updates until the end of the interview.

## Select the document

1. Resolve the live Git root.
2. Inspect the root README, package READMEs, documentation directories, and links between them.
3. Select the smallest existing document whose audience needs the resolved information.
4. If ownership remains unclear, ask the user before writing.

Before each write, resolve existing documentation and ADR paths through symlinks. For a new ADR, resolve its nearest existing parent. Require the resolved target or parent to remain inside the live Git root. Reject the write when a path, parent path, or symlink target escapes the repository.

Do not create a general documentation file under this authority. Ask the user to approve its audience and purpose first.

Use the repository's established ADR directory. If none exists, use the root `docs/adr/` directory unless repository ownership makes that location unclear.

## Document updates

Preserve the document's audience, format, and scope. Update the section that already owns the information. Avoid a new catch-all section.

Keep updates factual and concise. Exclude tentative language, interview history, plans, and decision rationale that belongs in an ADR or grill log.

Use an existing `CONTEXT.md`, glossary, or `CONTEXT-MAP.md` only when the repository already relies on that convention. Do not create these files by default.

When a resolved term belongs in an existing glossary, update its existing entry instead of creating a duplicate.

## ADR gate

Create or update an ADR only when all three conditions are true:

1. The decision is costly to reverse.
2. A future reader would find the choice surprising without its context.
3. The decision resolves a genuine tradeoff between credible alternatives.

If any condition is false, keep the decision in the grill log and conversation.

## ADR format

Use the repository's established ADR format when one exists. Otherwise, use this compact form:

```md
# {Short decision title}

{One to three sentences that state the context, decision, and reason.}
```

Add optional status, considered options, or consequences only when they help a future reader.

For a new ADR, scan the selected ADR directory and increment its highest four-digit prefix. Start with `0001` when the directory has no numbered ADRs.

Do not silently rewrite historical rationale. Record a superseding decision in a new ADR. Mark the earlier ADR as superseded only when the repository uses status metadata.
