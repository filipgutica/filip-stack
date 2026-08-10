# Engineering Workflow storage

Use one external project root for specifications, tickets, branch ledgers, and fallback worktrees.

```text
~/.engineering-workflow/<repo-id>/
├── config.json
├── specs/
├── tickets/
├── branches/
│   └── <branch>/TASKS.md
└── worktrees/
    └── <branch>/
```

Derive `<repo-id>` from the normalized `origin` URL. If a repository has no `origin`, use the repository name and a short hash of the Git common directory.

Replace non-portable characters in repository and branch names with `-`. Keep the stored repository identity in `config.json` so a path cannot silently change ownership.

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

## Legacy migration

Map each legacy file from:

```text
~/.project-tasks/<repo>/<branch>/TASKS.md
```

to:

```text
~/.engineering-workflow/<repo>/branches/<branch>/TASKS.md
```

Copy files first. Compare the source and target bytes. Preserve matching targets. Stop on a target with different content. Do not delete `~/.project-tasks` during the copy operation.
