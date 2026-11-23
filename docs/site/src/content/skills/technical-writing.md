---
related: [planning, review]
---

## What it does

Give your agent a draft, source files, or branch and name the document or
section. It writes or revises in plain, active prose while keeping facts,
decisions, links, commands, and required headings intact. Before finishing, it
runs a **first-reader review** so a newcomer can follow it without your thread.
You get copy in your format, with missing facts marked.

## When to use it

Install [Workflow](../../#install), then name the document and format:

> Write the PR description for this branch.

Use it for docs, Confluence pages, reports, READMEs, procedures, release notes,
error text, comments, and PR descriptions. It clarifies [planning](../planning/)
prose while leaving decisions to Planning. For a read-only audit, use
[review](../review/).

## How it works

1. It confirms audience, purpose, format, and sources, editing only the named
   part.
2. It uses plain words, active sentences, consistent terms, and one topic per
   paragraph.
3. For PR descriptions, it states the problem before the new behavior and
   stays short: one line per change, and only the file names a reviewer needs.
   A simple bug fix is a few plain sentences, without Root cause or Impact
   sections.
   It adds fitting verification (runnable commands or requests for backend,
   API, or CLI changes) and notes real gaps.
4. It rereads as a newcomer, separating facts from open questions.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/technical-writing/SKILL.md)
links
[prose rules](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/technical-writing/references/technical-prose.md)
and
[PR guidance](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/technical-writing/references/pull-requests.md).

## What you get

- Finished text in your format, true to sources.
- Limits and open questions where evidence is missing.

Drafting does not authorize publishing.
