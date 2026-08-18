---
name: setup
description: "Use when a user explicitly asks to configure, inspect, or migrate external Engineering Workflow artifact storage for a Git repository."
disable-model-invocation: true
---

# Engineering Workflow setup

Configure project artifacts outside the repository.

This skill changes external user storage. Require explicit setup or migration authority before running a write command.

## Commands

Use the bundled utility:

```sh
node <skill-directory>/scripts/engineering-workflow.mjs paths --repo-root <path>
node <skill-directory>/scripts/engineering-workflow.mjs init --repo-root <path> --ticket-backend local
node <skill-directory>/scripts/engineering-workflow.mjs init --repo-root <path> --ticket-backend <jira|github> --project <scope> --base-url <https-url>
node <skill-directory>/scripts/engineering-workflow.mjs configure-ticket-system --repo-root <path> --system <slug> --project <scope> --base-url <https-url>
node <skill-directory>/scripts/engineering-workflow.mjs topics --repo-root <path>
node <skill-directory>/scripts/engineering-workflow.mjs init-topic --repo-root <path> --topic-id <topic-id> --title <title>
node <skill-directory>/scripts/engineering-workflow.mjs migrate-ledgers --repo-root <path> --branch <branch> --source-root <path>
```

`paths` is read-only. `init` creates missing directories and `config.json`. It safely reuses an existing configuration when values are omitted or identical. An explicitly different backend or external project configuration is a conflict.

Before initializing a repository without a configured backend, ask the user to choose `local`, `jira`, or `github`. Do not infer the choice from the Git remote. For Jira or GitHub, also collect and verify the project scope and base URL. Pass all three values to `init` so it writes one complete configuration. These choices do not grant publishing authority.

The `local` backend stores canonical Markdown tickets. The `jira` and `github` backends use the external issue as canonical and do not create mirrored local ticket files.

`configure-ticket-system` associates an initialized repository with one default external ticket system. It safely reuses an identical association and stops on a conflict. The association does not grant publishing authority.

`topics` is read-only. It lists registered topics and reports unregistered topic directories.

`init-topic` requires explicit setup authority. It registers an active topic and creates its required directories.

Topics are required for persisted topic-scoped artifacts under Engineering Workflow storage. Standalone Jira or GitHub issues do not require a topic.

The command safely reuses an identical topic. It stops on conflicting metadata or malformed existing state.

Concurrent topic initialization stops with a retry message. It does not overwrite another topic update.

Both topic commands require an initialized project with a valid `config.json`.

`migrate-ledgers` is a dry run unless the command includes `--apply`. Use `--repo-root` and `--branch` to limit an interactive migration. It reads each ledger's Git root and branch metadata, copies matching ledgers to the resolved project root, and verifies each copy. It never deletes the source tree.

Use `--workflow-root <path>` only for an explicit alternate root or an isolated test. The default is `~/.engineering-workflow`.

Read [storage.md](references/storage.md) before changing the layout or migration rules.

## Safety

- Resolve the live Git root before a write.
- Validate `config.json` ownership and `topics.json` before topic writes.
- Do not create repository files.
- Do not edit `.gitignore`.
- Stop on an existing target with different content.
- Report conflicts and incomplete migrations.
- Remove legacy storage only as a separate, explicitly authorized action after verification.
