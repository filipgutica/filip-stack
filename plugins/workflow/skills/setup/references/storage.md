# Engineering Workflow storage

Use one external project root for specifications, tickets, branch ledgers, and fallback worktrees.

```text
~/.engineering-workflow/<repo-id>/
├── config.json
├── specs/
│   └── <topic>/
│       ├── BRAINSTORM.md
│       ├── PLAN.md
│       └── SPEC.md
├── tickets/
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
  "repository": {
    "identity": "remote:github.com/example/repository",
    "origin": "git@github.com:example/repository.git",
    "root": "/path/to/repository"
  }
}
```

`ticketBackend` can be `local` or `jira`. The value selects storage behavior. It does not grant Jira publishing authority.

Create only the artifacts that the user requests. The files in one topic directory can share context without duplicating their full contents.

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
