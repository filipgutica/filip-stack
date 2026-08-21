# Engineering Workflow storage

Use one workflow root for topic artifacts and repository branch ledgers.

```text
~/.engineering-workflow/
├── topics/
│   ├── open/
│   │   └── <topic-id>/
│   │       ├── TOPIC.md
│   │       ├── SPEC.md
│   │       ├── PLAN.md
│   │       ├── tickets/
│   │       │   ├── todo/
│   │       │   ├── in-progress/
│   │       │   └── done/
│   │       ├── grills/
│   │           └── <date>-<sequence>-<slug>.md
│   │       └── walkthroughs/
│   │           └── <date>-<sequence>-<slug>.md
│   ├── complete/
│   └── abandoned/
└── repositories/
    └── <repo-id>/
        ├── config.json
        └── topics/
            ├── open/
            │   └── <topic-id>/
            │       └── branches/<branch-id>/TASKS.md
            ├── complete/
            └── abandoned/
```

Topic paths show the topic state. A topic uses `open`, `complete`, or `abandoned`. Topic artifacts and repository topic directories must use the same state.

Each topic owns at most one primary `SPEC.md` and one optional `PLAN.md`. It also owns local tickets, grill logs, and walkthrough logs. A topic or ticket can cover work in multiple repositories.

Each repository owns only its configuration and branch ledgers. A repository appears once under `repositories/`.

## Repository identity and configuration

Derive `<repo-id>` from the normalized `origin` URL and a short stable hash. If no `origin` exists, use the repository name and a hash of the Git common directory.

Replace non-portable repository and branch characters with `-`. Add a stable hash so two names cannot use the same directory.

Store repository ownership in `config.json`:

```json
{
  "schemaVersion": 1,
  "ticketBackend": "local",
  "externalTicketSystem": {
    "system": "jira",
    "project": "MA",
    "baseUrl": "https://example.atlassian.net"
  },
  "repository": {
    "identity": "remote:github.com/example/repository",
    "origin": "git@github.com:example/repository.git",
    "root": "/path/to/repository"
  }
}
```

`ticketBackend` can be `local`, `jira`, or `github`. Setup must ask the user to choose when no backend exists. It must not infer the backend from the Git remote.

The `local` backend stores canonical Markdown tickets. The `jira` and `github` backends use external issues as canonical tickets. They do not create mirrored local ticket files.

`externalTicketSystem` is optional for the `local` backend. It is required for a `jira` or `github` backend. It stores no credentials or external status.

For a `jira` or `github` backend, `externalTicketSystem.system` must match `ticketBackend`. A standalone Jira or GitHub issue does not require a topic until local work starts.

Setup reuses an identical configuration. It stops on a different backend, project, base URL, or repository identity.

## Topic manifest

`TOPIC.md` is the sole topic registry and navigation entry point. Do not create `topics.json`.

Topic IDs must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`. IDs are unique across all topic states and do not change during a state transition.

The setup utility owns a strict frontmatter subset. Each value uses JSON syntax on one line.

```yaml
---
schemaVersion: 1
id: "field-guide-memory"
title: "Field Guide Memory"
state: "open"
createdAt: "2026-08-20T12:00:00.000Z"
updatedAt: "2026-08-20T12:00:00.000Z"
repositories: ["github.com-example-repository-0123abcd"]
externalWork: ["https://example.atlassian.net/browse/MA-1234"]
transitions: [{"from":null,"to":"open","at":"2026-08-20T12:00:00.000Z","actor":"User","reason":"Topic created","warnings":[]}]
---
```

The frontmatter permits only the documented fields. Reject missing fields, unknown fields, duplicate IDs, invalid timestamps, invalid URLs, and state-directory mismatches.

`repositories` contains each attached repository ID once. A matching repository topic directory must exist in the same state. Reject an unregistered repository topic directory.

`externalWork` contains verified HTTPS URLs. External tracker status remains tracker-owned.

`transitions` records each topic state change. A transition contains the previous state, target state, time, actor, reason, and acknowledged warnings.

The setup utility owns the generated links section between its markers. It preserves the human-written `## Notes` section and all content outside the generated markers.

The generated section links to the specification, plan, local tickets, grill logs, walkthrough logs, external work, repository directories, and branch ledgers. Run `sync-topic` after an artifact changes.

## Topic selection and attachment

Use `topics` to list all topic manifests before creating a persisted artifact. A durable topic link selects its existing topic.

If no durable link selects a topic, show the available open topics. Ask the user to select one or confirm a proposed new topic. Do not infer a topic from a branch or artifact name.

`init-topic` requires explicit confirmation. It creates one open manifest and attaches the current repository.

`attach-topic` requires confirmation and adds one repository membership to an open topic. A branch-ledger workflow asks for setup authority before it runs the command. Reopen a complete or abandoned topic before attaching new work. The command is idempotent.

Use `attach-topic --confirm --external-url <https-url>` to register verified Jira or GitHub work. This operation does not grant tracker publishing authority.

## Durable source links

Only durable, retrievable artifacts are sources. An ephemeral brainstorm needs no session ID or link. The first persisted artifact can use `Direct request`.

Each local artifact links to its `TOPIC.md`. It also records the nearest useful durable source when one exists.

Local artifacts use relative links. Jira and GitHub work items use verified HTTPS links. External tickets and pull requests must not link to machine-local paths.

Artifact levels are optional. A flow can skip a specification, plan, or ticket when the next artifact contains enough context.

A branch ledger identifies its topic and primary work item. It can also identify a specification or plan. A cross-repository ticket uses one ledger for each repository and branch.

When an artifact is ambiguous, read its declared source and continue upstream. The ledger controls execution order and commit boundaries. A ticket controls its bounded goal, scope, and acceptance criteria. A specification controls shared requirements and design. A durable brainstorm note records rationale and alternatives.

Stop for clarification when upstream artifacts conflict or leave required behavior unclear.

## Local artifact links

Use these topic links:

- `SPEC.md`: `Topic: [TOPIC.md](TOPIC.md)`
- `PLAN.md`: `Topic: [TOPIC.md](TOPIC.md)`
- `tickets/<state>/<file>.md`: `topic: "[TOPIC.md](../../TOPIC.md)"`
- `grills/<file>.md`: `Topic: [TOPIC.md](../TOPIC.md)`
- `walkthroughs/<file>.md`: `Topic: [TOPIC.md](../TOPIC.md)`
- A branch ledger uses the relative path returned by the setup utility.

Do not reconstruct a branch-ledger link or path manually. Use `paths --topic-id <id>` after topic attachment.

## Topic lifecycle

Use explicit commands for topic state changes:

- `complete-topic` moves an open topic to `complete`.
- `abandon-topic` moves an open topic to `abandoned`.
- `reopen-topic` moves a complete or abandoned topic to `open`.

Each command validates all target paths before it moves a directory. It moves the root topic and every registered repository topic directory together. It updates generated links and branch-ledger topic links after the move.

`complete-topic` audits known work first. It reports these warnings:

- A specification is not `Implemented`.
- A local ticket is in `todo` or `in-progress`.
- A branch ledger has an incomplete task.
- An artifact has a missing or invalid topic link.
- A repository membership or topic directory is missing or unregistered.
- An external status cannot be verified.

The command returns the warnings without changing state. The user can confirm completion with warnings. The command then records the warnings, acknowledgement reason, actor, and date in `TOPIC.md`.

Topic completion does not change ticket, ledger, specification, or external tracker state.

## Specification lifecycle

A specification uses `Draft`, `Ready`, or `Implemented` in its metadata table.

Use `mark-spec-implemented` only after delivery and verification. The command changes `Draft` or `Ready` to `Implemented`. It does not change topic state.

## Grill logs

An explicit Grill Me session creates one log after topic confirmation. Use `<date>-<sequence>-<slug>.md` under `grills/`.

Update the log after each resolved answer. Record the curated question, recommendation, decision, rationale, and next unresolved question. Do not store a raw transcript or hidden reasoning.

Resume an existing session by its log filename. Do not create a second log for the same session.

## Walkthrough logs

An explicit Walkthrough session creates one log after source and topic confirmation. Use `<date>-<sequence>-<slug>.md` under `walkthroughs/`.

Use `start-walkthrough` to record a fixed provenance header. The header records the source, repository ID, branch, base, head, range, and start time.

Pass `--slices` as a JSON array of ordered `slice` and `description` objects. The command creates a summary table and sets each status to `unresolved`.

For a branch source, pass `--base-ref`. The setup utility uses `git merge-base HEAD <base-ref>` for the base. It records `<base>...<head>` as the range.

For a last-turn or working-tree source, the base is `none`. The range is `<source>@<head>`.

The repository field uses the stable repository ID. It does not store a local repository path.

The running log follows the summary table. Use `update-walkthrough` after the user resolves a slice. The command updates the table row and appends one curated entry.

The command selects the first unresolved table row as the next slice. It selects `complete` only when no unresolved row remains.

Each recorded field must use one line. Do not store a prompt, transcript, response, hidden reasoning, full diff, code excerpt, credential, or local repository path.

The utility rejects high-signal credentials, absolute home paths, code fences, and role-labeled transcript lines. This check cannot identify all sensitive meaning. The agent must curate each field.

Resume an interrupted session with its log filename. The setup utility validates the log before it resumes or appends a slice.

## Local tickets

This section applies only to the `local` backend.

Store each ticket in one lifecycle directory under its topic:

```text
topics/<topic-state>/<topic-id>/tickets/todo/
topics/<topic-state>/<topic-id>/tickets/in-progress/
topics/<topic-state>/<topic-id>/tickets/done/
```

The containing lifecycle directory owns ticket status. Do not duplicate status in frontmatter.

Use `TICKET-<number>-<slug>.md`. The number has at least three digits. Ticket IDs are unique within a topic.

New local Markdown tickets must include `topic` and `source` frontmatter strings. `source` accepts `Direct request`, a relative Markdown link, or a verified HTTPS Markdown link.

```yaml
---
topic: "[TOPIC.md](../../TOPIC.md)"
source: "[SPEC.md](../../SPEC.md)"
---
```

Existing local tickets without `source` remain valid. All persisted tickets require the topic link.

Use optional `externalLinks` frontmatter for verified external relationships. It is an optional YAML sequence of mappings.

```yaml
externalLinks:
  - system: "jira"
    id: "MA-1234"
    url: "https://example.atlassian.net/browse/MA-1234"
  - system: "github"
    id: "#456"
    url: "https://github.com/example/repository/issues/456"
```

Each mapping contains only `system`, `id`, and `url`. All three values must be strings. A ticket can link to multiple items in the same external system.

Keep the local ticket filename when external work exists. Do not add Jira, GitHub, or other external IDs to the filename. Do not add external status.

An external link does not grant publishing authority or authority to change external work.

## Compatibility

The new layout has no old-layout fallback or repository migration command. A one-time interactive migration occurs after merge and release.

The migration is an external operation. It inventories files, asks for ambiguous mappings, copies artifacts, compares bytes, and retains old files until the user approves cleanup.

Obsidian can open the workflow root as a vault. Treat `.obsidian/` as disposable client state. Workflow commands ignore it.

Git worktrees are not Workflow artifacts. Store fallback worktrees under `~/code/worktrees/<project>/`.
