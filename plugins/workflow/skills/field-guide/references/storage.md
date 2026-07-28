# Field Guide Storage

Use `~/.field-guide` unless the utility receives an explicit `--guide-root`.

```text
~/.field-guide/
├── init.md
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
- Keep indexes concise; do not copy the linked file's contents into the index.

## Review Record

Use one record per correction commit. A record may contain multiple review rounds that led to that commit.

```md
# <concise learning title>

- Date: `YYYY-MM-DD`
- Repository: `<repository name>`
- Branch: `<branch>`
- Commit: `<full 40-character hash>`
- Commit link: <URL or `not available`>
- Review source: <PR/comment URL, user review, or other concise source>
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

Do not use placeholders. Omit later review rounds when there was only one.

## Project Patterns

Keep `patterns.md` as current guidance, organized by stable topic rather than chronology. Each entry states:

- the preferred pattern or anti-pattern;
- when it applies;
- a link to at least one supporting review record.

When later evidence changes a pattern, update the guidance and retain the historical review records.

## Shared Promotion

Create a focused file under `shared/` only for cross-project guidance. Promote immediately when the user explicitly states a general preference. Otherwise require matching committed evidence from at least two project guides and link both records.

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

Multi-project evidence must link indexed review records from at least two distinct project guides. The utility verifies each commit in the repository path recorded by that project guide, so those repositories must remain locally available when validating shared evidence. It also validates the promotion mode, the explicit preference source or cross-project record links, and the relevant local Markdown links.

Project-specific contracts and conventions stay in that project's `patterns.md`, even when they recur within one repository.
