---
name: branch-task-planner
description: "Use when a user requests an external branch task ledger or named-ticket end-to-end execution needs branch-scoped task tracking."
disable-model-invocation: true
---

# Branch task planner

Maintain an external ledger with one top-level task per intended commit.

## Select the authority mode

- **Direct invocation:** Modify only the external ledger for an established branch. This mode is planning-only.
- **Named-ticket end-to-end:** Require confirmed named-ticket end-to-end authority from `$workflow:coordinator`.

Do not infer named-ticket end-to-end authority from a ticket reference or an existing ledger.

## Locate the ledger

1. Read the live Git root and current branch.
2. Stop if direct invocation has no established branch.
3. Resolve or confirm the topic before the ledger path.
4. Check whether the repository is attached to the open topic. If it is not, ask for setup authority, then run `attach-topic --confirm`.
5. Use `$workflow:setup` path resolution for `~/.engineering-workflow/repositories/<repo-id>/topics/<state>/<topic-id>/branches/<branch-id>/TASKS.md`.
6. Consume the returned topic, repository, branch IDs, and relative topic link. Do not reconstruct them.
7. Search the resolved task directory before creating a ledger.
8. Validate ledger metadata against the live topic, root, and branch.

For detached HEAD during named-ticket execution, use the short commit hash with a detached marker until the coordinator creates the authorized branch.

## Direct invocation

The user's explicit request to create or modify a branch task ledger grants external-artifact authority only for that ledger write. It does not grant authority to attach a repository or change `TOPIC.md`.

1. Gather the request and bounded read-only evidence.
2. Propose task boundaries in the conversation.
3. Apply the user's changes to the proposed tasks.
4. If attachment is required, ask for setup authority before the ledger write.
5. Create or update only the external ledger after the repository is attached.
6. Keep each proposed task marked `[ ]`.
7. Set the pointer path to `none`.

Do not create or switch branches. Do not edit repository files. Do not create a repository pointer. Do not commit, push, or publish.

## Named-ticket end-to-end use

Use ticket context and repository evidence to define the ledger.

Read the ledger's Sources block before task planning. If its ticket or plan is ambiguous, follow the durable-source rules in [Engineering Workflow storage](../setup/references/storage.md). Do not rely on an ephemeral brainstorm or conversation session.

1. Create or resume the external ledger.
2. Use one top-level task for each intended Conventional Commit.
3. Let the coordinator run one bounded cycle for each task.
4. After the commit exists, record its subject and short hash in `Commit:`.
5. Mark the task `[x]` only after the ledger records the commit.
6. Preserve incomplete tasks if execution stops.
7. Add a correction task when branch-level verification fails.

Do not combine tasks without approval. Check the repository before each task. The ledger does not prove the live state.

During this mode, check `<git-root>/TASKS.md` and then `<git-root>/.task-ledger` for the pointer path. Add the pointer to the Git exclude file. Refresh it after the active ledger or branch changes. Never edit `.gitignore`. Never stage the pointer.

## Ledger shape

Add a title and metadata block. Include the date, repository, Git root, working directory, branch, task directory, and pointer.

Add this Sources block before Context:

```md
## Sources

- Topic: [TOPIC.md](<relative-topic-link-from-setup>)
- Primary work item: [Jira MA-1234](https://example.atlassian.net/browse/MA-1234) or `Direct request`
- Specification (optional): [SPEC.md](<relative-specification-link-from-setup>)
- Implementation plan (optional): [PLAN.md](<relative-plan-link-from-setup>)
```

Use the nearest durable source. Local sources use relative links from setup path resolution. Jira and GitHub sources use verified HTTPS links. A ticket that spans repositories has one ledger per repository and branch. Each ledger can use the same primary work item. Do not add machine-local paths or session links.

Add Context, Goal, Non-goals, Success Criteria, branch checks, and deferred work when relevant. Use this task shape:

```md
## Task 1: [ ] <title>

**Commit:**

**Files touched:**
- Source: `<path>`
- Tests: `<path>`
- Docs/config: `<path>`

**Expected outcome:** <concrete behavior or artifact>

**Verification:**
- `<command>` proves <claim>

**Risks / assumptions / open questions:**
- <material uncertainty>

**Steps:**
- [ ] <bounded work>
- [ ] <review or verification>
```

Use `[ ]` for incomplete work. Use `[x]` for committed work. Use `[!]` only for a concrete blocker.

Keep each task reviewable and independently verifiable. A task does not grant implementation or commit authority.
