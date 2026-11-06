# term-weave

## What it does

`term-weave` drafts a glossary of project terms from documents in a supplied folder. Every drafted definition links to the passage that supports it.

## When to use it

Use it when project vocabulary is scattered across documents or newcomers encounter unexplained terms.

Run it manually:

```text
/term-weave <source-folder>
```

## How it works

The skill reads Markdown and plain-text documents and ignores other file types. If the folder is missing or contains no readable supported documents, it stops and explains the problem without drafting.

It does not invent definitions. Terms without a supporting explanation go under **Unresolved terms**.

When sources give conflicting definitions, it preserves both definitions in one entry, links each source, and marks the entry **Conflict**.

## What you get

A `GLOSSARY.md` file in the working directory, with entries sorted alphabetically and **Unresolved terms** after the defined entries. The source documents remain unchanged.
