# Field guide storage

Use `~/.field-guide` unless the utility receives an explicit `--guide-root`.

Use these terms:

- A **review record** stores evidence for one correction commit.
- A **project pattern** stores durable project guidance.
- **Shared guidance** stores a promoted cross-project preference.

```text
~/.field-guide/
├── .obsidian/          # Optional client-owned vault settings
├── init.md
├── memory.json         # Versioned operational metadata
├── shared/
└── projects/
    └── <repo-key>/
        ├── init.md
        ├── patterns.md
        └── reviews/
```

## Indexes

Every Markdown file below the guide root must be reachable from the nearest index:

- Root `init.md` links each shared topic and project `init.md`, with a one-line description.
- Project `init.md` links `patterns.md` and every review record, with a one-line description.
- Keep indexes concise. Do not copy the linked file contents into the index.

`memory.json` follows `schemas/memory-v1.schema.json`. Markdown remains the
readable guidance and evidence surface. JSON stores identity, lifecycle,
evidence, and retrieval metadata that Markdown links cannot enforce. The
utility validates both layers and never replaces malformed state.

After the first submission, `memory.md` contains the indexed canonical record.
It includes readable guidance and one complete JSON block with evidence,
pointers, source keys, transitions, and timestamps. `memory.json` is a validated
machine cache. The utility writes canonical Markdown before it replaces the
cache. A cache write failure cannot remove the new canonical record. Validation
reports a stale cache or a changed readable view.

Use `migrate` to preview creation of `memory.json`. Add `--apply` to create the
empty versioned store. Migration preserves all Markdown indexes, patterns, and
review records.

## Observation submissions

Use `submit --input <json-file>` after migration. The input must follow
`schemas/submission-v1.schema.json`. The agent decides whether an observation is
clear enough to submit. The utility owns all behavior after submission.

The utility normalizes Unicode, case, whitespace, and terminal punctuation for
exact fingerprints. It never creates two records with the same scope, subject,
and normalized learning. A repeated source returns `duplicate-evidence`. A new
independent source reinforces the existing record.

An explicit user preference becomes active immediately. An inferred project
record becomes active after two independent evidence events. An inferred shared
record also needs evidence from two repository identities and `generic: true`.
Confidence is audit metadata. It does not count as evidence.

Evidence pointers use a closed allowlist:

- `conversation`: client, thread ID, one optional message or turn ID, and one optional safe URL.
- `review`: provider, repository identity, pull-request number, comment ID, and one optional safe URL.
- `commit`: repository identity and one full lowercase commit hash.
- `local-artifact`: repository identity, repository-relative path, optional heading, and SHA-256 content digest.
- `manual`: one short source label.

The utility derives source keys. Inputs cannot set evidence IDs or source keys.
Manual evidence and conversation evidence without an occurrence ID do not count
for promotion. URLs must use HTTPS. They cannot contain user information,
queries, local hosts, or IP hosts. Only review URLs can contain fragments.

Guidance can include one sanitized pattern and one sanitized antipattern. Each
example must identify its language and contain at most 40 lines. Both examples
can contain at most 6 KB of UTF-8 text.

The optional `.obsidian/` directory is not part of the index contract. Field-guide
commands ignore all files below it.

## Obsidian compatibility

You can open `~/.field-guide` as an Obsidian vault for read-only inspection and
manual audits. Obsidian stores vault settings under `.obsidian/`.

Treat `.obsidian/` as disposable client state. Do not store guidance, evidence,
schemas, or agent instructions there. Field-guide commands must work without
Obsidian and must not read `.obsidian/` during guidance retrieval.

Obsidian links, plugins, properties, and views are optional. They must not define
field-guide identity, lifecycle, validation, or retrieval behavior.

## Review record

Use one record per correction commit. A record may contain multiple review rounds that led to that commit.

```md
# <concise learning title>

- Date: `YYYY-MM-DD`
- Repository: `<repository name>`
- Branch: `<branch>`
- Commit: `<full 40-character hash>`
- Commit link: <URL or `not available`>
- Review source: <pull-request URL, comment URL, user review, or other concise source>
- Outcome: `accepted` or `modified`

## Review rounds

### Round 1

- Feedback: <what was challenged>
- Evaluation: <why it was valid and how it applied here>
- Change: <what changed>
- Verification: <focused evidence>

## Durable learning

- Lesson: <generalized preference or anti-pattern>
- Scope: `project` or `shared`
- Guidance file: <relative link to patterns.md or shared topic>
```

Replace every placeholder before saving the record.

Use `accepted` when the change applies the feedback as given. Use `modified` when the implementation adapts it.

Omit later review rounds when there was only one.

## Project patterns

Keep `patterns.md` organized by stable topic. Each project pattern states:

- the preferred pattern or anti-pattern
- when it applies
- a link to at least one supporting review record.

When later evidence changes a pattern, update the guidance and retain the historical review records.

## Shared promotion

Create a focused file under `shared/` only for cross-project guidance.

Promote a preference immediately when the user states that it is general. Otherwise, require committed evidence from two project guides.

Record one of these evidence shapes near the top of the shared file:

```md
- Promotion: `explicit-general-preference`
- Preference source: <where the user stated the general preference>
```

```md
- Promotion: `multi-project-evidence`

## Evidence

- [<first project review>](../projects/<repo-key>/reviews/<record>.md)
- [<second project review>](../projects/<repo-key>/reviews/<record>.md)
```

Multi-project evidence must link indexed review records from two project guides. Keep both repositories available during validation.

The utility verifies commits, promotion data, evidence links, and related local Markdown links.

Project-specific contracts and conventions stay in that project's `patterns.md`, even when they recur within one repository.
