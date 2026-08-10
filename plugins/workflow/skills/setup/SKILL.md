---
name: setup
description: "Use when a user explicitly asks to configure, inspect, or migrate external Engineering Workflow artifact storage for a Git repository."
---

# Engineering Workflow setup

Configure project artifacts outside the repository.

This skill changes external user storage. Require explicit setup or migration authority before running a write command.

## Commands

Use the bundled utility:

```sh
node <skill-directory>/scripts/engineering-workflow.mjs paths --repo-root <path>
node <skill-directory>/scripts/engineering-workflow.mjs init --repo-root <path> --ticket-backend <local|jira>
node <skill-directory>/scripts/engineering-workflow.mjs migrate-ledgers --source-root <path>
```

`paths` is read-only. `init` creates missing directories and `config.json`. It preserves a valid existing configuration.

`migrate-ledgers` is a dry run unless the command includes `--apply`. It copies legacy ledgers and verifies each copy. It never deletes the source tree.

Use `--workflow-root <path>` only for an explicit alternate root or an isolated test. The default is `~/.engineering-workflow`.

Read [storage.md](references/storage.md) before changing the layout or migration rules.

## Safety

- Resolve the live Git root before a write.
- Do not create repository files.
- Do not edit `.gitignore`.
- Stop on an existing target with different content.
- Report conflicts and incomplete migrations.
- Remove legacy storage only as a separate, explicitly authorized action after verification.
