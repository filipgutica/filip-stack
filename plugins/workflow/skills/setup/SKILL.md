---
name: setup
description: "Use when a user explicitly asks to configure, inspect, or change external Engineering Workflow artifact storage for a Git repository."
disable-model-invocation: true
---

# Engineering Workflow setup

Configure topic artifacts and repository branch ledgers outside the repository.

This skill changes external user storage. Require explicit setup authority before a write command.

## Commands

Use the bundled utility:

```sh
node <skill-directory>/scripts/engineering-workflow.mjs paths --repo-root <path> [--topic-id <id>]
node <skill-directory>/scripts/engineering-workflow.mjs init --repo-root <path> --ticket-backend local
node <skill-directory>/scripts/engineering-workflow.mjs init --repo-root <path> --ticket-backend <jira|github> --project <scope> --base-url <https-url>
node <skill-directory>/scripts/engineering-workflow.mjs configure-ticket-system --repo-root <path> --system <slug> --project <scope> --base-url <https-url>
node <skill-directory>/scripts/engineering-workflow.mjs topics
node <skill-directory>/scripts/engineering-workflow.mjs init-topic --repo-root <path> --topic-id <id> --title <title> --confirm
node <skill-directory>/scripts/engineering-workflow.mjs attach-topic --repo-root <path> --topic-id <id> --confirm [--external-url <https-url>]
node <skill-directory>/scripts/engineering-workflow.mjs sync-topic --repo-root <path> --topic-id <id>
node <skill-directory>/scripts/engineering-workflow.mjs complete-topic --repo-root <path> --topic-id <id> --reason <reason> [--confirm-warnings]
node <skill-directory>/scripts/engineering-workflow.mjs abandon-topic --repo-root <path> --topic-id <id> --reason <reason> [--confirm-warnings]
node <skill-directory>/scripts/engineering-workflow.mjs reopen-topic --repo-root <path> --topic-id <id> --reason <reason> [--confirm-warnings]
node <skill-directory>/scripts/engineering-workflow.mjs mark-spec-implemented --repo-root <path> --topic-id <id>
node <skill-directory>/scripts/engineering-workflow.mjs start-grill --repo-root <path> --topic-id <id> --slug <slug>
node <skill-directory>/scripts/engineering-workflow.mjs update-grill --repo-root <path> --topic-id <id> --log-file <name> --question <text> --recommendation <text> --decision <text> --rationale <text> --next-question <text>
node <skill-directory>/scripts/engineering-workflow.mjs start-walkthrough --repo-root <path> --topic-id <id> --slug <slug> --source <last-turn|working-tree|branch> [--base-ref <ref>] --slices <json-array>
node <skill-directory>/scripts/engineering-workflow.mjs update-walkthrough --repo-root <path> --topic-id <id> --log-file <name> --slice <text> --status <covered|changed|unresolved> --summary <text> --evidence <text> --decision <text> [--correction <text> --correction-status open | --correction-id <id> --correction-status <resolved|deferred>]
```

`paths` and `topics` are read-only. `paths --topic-id` resolves the topic state from `TOPIC.md`. Use `--topic-state` only to inspect a proposed path before topic creation.

`init` creates root topic-state directories, one repository directory, and `config.json`. It reuses identical configuration and stops on conflicts.

Before repository initialization, ask the user to choose `local`, `jira`, or `github`. Do not infer the backend from the Git remote. Jira and GitHub also require a project scope and base URL.

The `local` backend stores canonical Markdown tickets. Jira and GitHub use the external issue as canonical. Do not create a mirrored local ticket file.

Topics are required for persisted local artifacts. Standalone Jira or GitHub issues do not require a topic until local work starts.

`topics` lists manifests across `open`, `complete`, and `abandoned`. It reports topic directories without manifests and unregistered repository topic directories.

If a durable source links to `TOPIC.md`, use that topic. Otherwise, show open topics and ask the user to select one. Propose a new ID and title only when no existing topic applies.

`init-topic` requires confirmation. It creates an open topic and attaches the current repository. It reuses identical metadata and stops on conflicts.

`attach-topic` requires confirmation and adds the current repository to an open topic. Reopen a complete or abandoned topic before attaching new work. A branch-ledger workflow asks for setup authority before it runs this command. Use `--external-url` only for a verified HTTPS work item.

`sync-topic` refreshes generated manifest links. It reports local artifacts that do not link to `TOPIC.md`.

Lifecycle commands require a reason. They validate all targets before moving the root topic and its registered repository directories.

`complete-topic` returns warnings without changing state. Ask the user to confirm before rerunning it with `--confirm-warnings`. The manifest records the warning acknowledgement.

`mark-spec-implemented` is independent of topic state. Use it only after delivery and verification.

An explicit Grill Me invocation uses `start-grill` after topic confirmation. Use `update-grill` after each resolved answer. Resume with `start-grill --log-file <name>`.

An explicit Walkthrough invocation uses `start-walkthrough` after it builds the change map. Pass the ordered slice names and descriptions with `--slices`. A branch source requires `--base-ref`. Use `update-walkthrough` after each resolved slice.

Use `--correction` and `--correction-status open` when a walkthrough confirms a required change. The command returns a correction ID. Use that ID with `--correction-id` to mark the correction `resolved` or `deferred`. These terminal states cannot change.

Resume with `start-walkthrough --log-file <name>`.

The agent stores only curated one-line walkthrough fields. The utility rejects high-signal credentials, absolute home paths, code fences, and role-labeled transcript lines.

Use `--workflow-root <path>` only for an explicit alternate root or an isolated test. The default is `~/.engineering-workflow`.

Read [storage.md](references/storage.md) before changing paths, manifests, or lifecycle rules.

## Safety

- Resolve the live Git root before a repository write.
- Validate `config.json`, `TOPIC.md`, repository membership, and target paths before changes.
- Do not create repository files or edit `.gitignore`.
- Stop on a conflicting path or malformed manifest.
- Keep external status tracker-owned.
- Do not expose a repository migration command.
- Remove old storage only after a separate, approved post-merge migration verifies all copies.
