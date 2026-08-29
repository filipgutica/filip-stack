# Domain documentation

Update domain documentation as terms and decisions become final. Do not batch resolved updates until the end of the interview.

## Select the context

1. Resolve the live Git root.
2. If the repository has `CONTEXT-MAP.md`, read it and select the matching context.
3. If the repository has only a root `CONTEXT.md`, use that single context.
4. If neither file exists, create a root `CONTEXT.md` when the first domain term is resolved.
5. If the context remains unclear, ask the user before writing.

Before each write, resolve existing glossary and ADR paths through symlinks. For a new target, resolve its nearest existing parent. Require the resolved target or parent to remain inside the live Git root. Reject the write when a mapped path, parent path, or symlink target escapes the repository.

Do not create `CONTEXT-MAP.md` without explicit authority to define multiple contexts.

Place system-wide ADRs in the root `docs/adr/` directory. Place context-specific ADRs in that context's `docs/adr/` directory.

## Glossary format

Preserve an established glossary format. If the repository has no established format, use this compact structure:

```md
# {Context name}

{One or two sentences that define the context and its purpose.}

## Language

**{Canonical term}**:
{One or two sentences that define the term.}
_Avoid_: {Conflicting or ambiguous alternatives}
```

Use `_Avoid_` only when alternatives could cause confusion. Update an existing entry instead of creating a duplicate.

Keep definitions specific to the domain. Exclude general programming terms, implementation details, workflows, plans, and decision rationale.

Group terms under headings only when a clear domain grouping exists.

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

For a new ADR, scan the selected `docs/adr/` directory and increment its highest four-digit prefix. Start with `0001` when the directory has no numbered ADRs.

Do not silently rewrite historical rationale. Record a superseding decision in a new ADR. Mark the earlier ADR as superseded only when the repository uses status metadata.
