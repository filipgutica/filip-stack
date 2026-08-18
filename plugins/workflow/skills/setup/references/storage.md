# Engineering Workflow storage

Use one external project root for specifications, tickets, branch ledgers, and fallback worktrees.

```text
~/.engineering-workflow/<repo-id>/
├── config.json
├── topics.json
├── specs/
│   └── <topic-id>/
│       ├── BRAINSTORM.md
│       ├── SPEC.md
│       └── PLAN.md
├── tickets/
│   └── <topic-id>/
│       ├── todo/
│       ├── in-progress/
│       └── done/
├── branches/
│   └── <branch-id>/TASKS.md
└── worktrees/
    └── <branch-id>/
```

Derive `<repo-id>` from a readable slug of the normalized `origin` URL plus a short stable hash. If a repository has no `origin`, use the repository name and a short hash of the Git common directory.

Replace non-portable characters in repository and branch names with `-`. Add a short stable hash to branch IDs so distinct names cannot collapse to one directory. Keep the stored repository identity in `config.json` so a path cannot silently change ownership.

The configuration has this shape:

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

`ticketBackend` can be `local`, `jira`, or `github`. The value selects storage behavior. Setup must ask the user to choose when no backend is configured. It must not infer the choice from the Git remote. The value does not grant publishing authority.

Setup safely reuses an existing configuration when requested values are omitted or identical. It rejects an explicitly different backend, project scope, or base URL without modifying the existing configuration.

For the `local` backend, the local Markdown ticket is canonical. Its lifecycle directory owns its status.

For the `jira` or `github` backend, the Jira or GitHub issue is canonical. Do not create a mirrored local Markdown ticket or synchronize external status into the local lifecycle directories. Topic initialization can still create the standard empty directories for layout compatibility.

`externalTicketSystem` is optional for the `local` backend. It identifies an external system that a local ticket can reference. For a `jira` or `github` backend, it identifies the canonical external project and is required to complete setup. `system` is a lowercase portable slug, `project` is the provider's project scope, and `baseUrl` is an absolute HTTPS URL. For example, `project` can be a Jira project key or a GitHub `owner/repository` value.

For a `jira` or `github` backend, `externalTicketSystem.system` must match `ticketBackend`. The `local` backend can associate with any valid external system.

For a `jira` or `github` backend, initialize the backend and association atomically with the bundled utility. Use `configure-ticket-system` only to add an optional association to a `local` backend or safely reuse an identical association. A different association conflicts and requires a separate, explicit reassociation operation.

For a `jira` or `github` backend, use the configured system as the ticket destination. With publishing authority, create or update the external issue and return its verified ID and URL. Without publishing authority, return the draft in the conversation. Do not persist a local Markdown copy in either case.

For the `local` backend, persist the Markdown ticket. Add `externalLinks` only when the local ticket has a verified relationship to external work.

The association does not grant publishing authority. It does not store credentials or external status. Existing local tickets remain valid without an external link.

## Topics

A topic is a stable, repository-scoped workstream. It groups related brainstorms, specifications, plans, and local tickets.

A topic is not a branch, ticket, ticket status, or conversation. Its ID is an immutable portable slug. Its display title can change.

Topic IDs must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`. For example, use `field-guide-memory`.

Store topic metadata in `topics.json`:

```json
{
  "schemaVersion": 1,
  "topics": [
    {
      "id": "field-guide-memory",
      "title": "Field Guide Memory",
      "status": "active",
      "createdAt": "2026-08-17T12:00:00.000Z",
      "updatedAt": "2026-08-17T12:00:00.000Z"
    }
  ]
}
```

Each topic ID must be unique. Status must be `active` or `archived`. Persisted topic-scoped artifacts under Engineering Workflow storage require an active topic. A standalone Jira or GitHub issue does not require a topic. Archived topics remain readable.

Topic initialization creates active topics. It does not change titles or archive topics. Those update commands are deferred.

Do not store derived paths in the registry. Sort entries by topic ID. Preserve all valid non-target topic entries during updates.

Schema version 1 permits only the documented registry and topic properties. Reject unsupported properties instead of changing their values.

Reject malformed JSON, unsupported schema versions, invalid fields, duplicate IDs, and invalid timestamps. Do not replace a malformed registry.

Use the bundled utility to discover or validate topics. Do not load the registry into agent context for unrelated work.

Create only the artifacts that the user requests. Files in one topic can share context without duplicating their full contents.

## Local tickets

This section applies to the `local` backend. Jira and GitHub backends leave the lifecycle directories empty and use the external tracker as the canonical ticket store.

Store each local Markdown ticket in exactly one lifecycle directory:

```text
tickets/<topic-id>/todo/
tickets/<topic-id>/in-progress/
tickets/<topic-id>/done/
```

The containing lifecycle directory is the ticket's authoritative status. Do not duplicate status in Markdown frontmatter.

Use `TICKET-<number>-<slug>.md` for ticket filenames. The number must contain at least three digits. The slug uses lowercase letters, digits, and single hyphens.

For example, `TICKET-001-short-title.md` has the stable ticket ID `TICKET-001`. Keep the filename when the ticket changes status. Ticket IDs must be unique within a topic.

Keep the local filename when you link a ticket to external work. Do not add Jira, GitHub, or other external IDs to the filename.

Use optional `externalLinks` frontmatter when a local ticket has a verified relationship to external tickets or issues. `externalLinks` is an optional YAML sequence of mappings.

```yaml
---
externalLinks:
  - system: "jira"
    id: "MA-1234"
    url: "https://example.atlassian.net/browse/MA-1234"
  - system: "github"
    id: "#456"
    url: "https://github.com/example/repository/issues/456"
---
```

Each mapping contains only `system`, `id`, and `url`. All three values must be strings. `system` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`, `id` must not be empty, and `url` must be an absolute HTTPS URL.

Omit `externalLinks` when the ticket has no external link. One local ticket can link to more than one external system. It can also have multiple links to the same external system.

Verify each external ID and URL before persistence. Do not add external status. The lifecycle directory remains the authoritative local status.

An external link does not grant publishing authority. Creating, updating, or transitioning external work still requires explicit publishing authority.

New local tickets start in `todo/`. Ticket creation, linking, transition, reassociation, and frontmatter validation commands are deferred.

## Compatibility

Do not move existing specs or tickets automatically. Topic listing reports topic directories that do not have registry entries.

Topic initialization can adopt an existing specs directory without changing its files. It can adopt tickets only when they already follow the lifecycle and filename contracts.

Flat legacy tickets remain readable for manual migration. They block automatic topic adoption because initialization cannot choose a lifecycle status safely.

## Legacy migration

Map each legacy file from:

```text
~/.project-tasks/<repo>/<branch>/TASKS.md
```

to:

```text
~/.engineering-workflow/<repo-id>/branches/<branch-id>/TASKS.md
```

Read the Git root and branch from each legacy ledger. Resolve the target repository identity from that live Git root. Do not use the legacy directory name as the new repository identity.

For an interactive migration, require `--repo-root` and `--branch` to limit the operation. Copy files first. Compare the source and target bytes. Preserve matching targets. Stop on a target with different content. Do not delete `~/.project-tasks` during the copy operation.
