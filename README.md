# Filip Stack

Filip Stack is a personal plugin marketplace for Claude and Codex. It distributes
the shared `workflow` plugin directly from this GitHub repository.

## What the workflow plugin includes

The `workflow` plugin is an engineering reference guide and execution workflow.
Its skills are grouped by purpose:

- **Planning and writing:** `brainstorming`, `grill-me`, `writing-specs`,
  `writing-plans`, `spec-to-tickets`, `writing-tickets`, `ste-writing`, and
  `writing-skills`.
- **Implementation and debugging:** `implementation`, `minimal-code`,
  `systematic-debugging`, `using-git-worktrees`, and
  `subagent-driven-development`.
- **Review and improvement:** `walkthrough`, `receiving-code-review`,
  `review-cycle`, `simplification-review`, and `field-guide`.
- **Coordination and state:** `coordinator`, `branch-task-planner`, and `setup`.

`setup`, `branch-task-planner`, `spec-to-tickets`, `using-git-worktrees`, and
`subagent-driven-development` are manual-only. They run only when the user
explicitly requests them or an explicitly authorized coordinator route requires
them.

`walkthrough` is manual-only. It explains and reviews selected changes without
granting authority to modify them.

Both the Claude and Codex marketplaces distribute this plugin. The separate
`codex-claude-plugin` marketplace distributes the Codex-only `claude-plugin`.

## Repository layout

```text
plugins/workflow/          Workflow plugin payload shared by Claude and Codex
  .claude-plugin/          Claude plugin manifest
  .codex-plugin/           Codex plugin manifest
  skills/                  Planning, writing, implementation, review, coordination, and setup skills
  THIRD_PARTY_NOTICES.md   License notice for adapted upstream guidance
.claude-plugin/            Claude git marketplace registry (marketplace.json)
.agents/plugins/           Codex git marketplace registry (marketplace.json)
scripts/                   Stamp and validate scripts
```

## Install with Claude

1. Add the marketplace:

   ```sh
   claude plugin marketplace add filipgutica/filip-stack
   ```

2. Install the `workflow` plugin:

   ```sh
   claude plugin install workflow@filip-stack
   ```

Claude identifies the installed plugin as `workflow@filip-stack`. Run this
command to update it:

```sh
claude plugin update workflow@filip-stack
```

## Install with Codex

1. Add the marketplace:

   ```sh
   codex plugin marketplace add filipgutica/filip-stack
   ```

2. Restart Codex.
3. Open the plugin directory.
4. Install `workflow` from the `filip-stack` marketplace.

Codex upgrades the marketplace instead of an individual plugin. Run this command
to install marketplace updates:

```sh
codex plugin marketplace upgrade filip-stack
```

## Releases and versioning

Claude and Codex install the tracked plugin files directly from this repository.
Installation does not require a build. Both root marketplace registries point to
`./plugins/workflow`.

CI runs semantic-release after each push to `main`. Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/):

| Commit prefix | Version bump |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` or `BREAKING CHANGE:` | major |

The lefthook `commit-msg` hook runs commitlint for each local commit. When a
release is due, CI updates `package.json`, the plugin manifests, and both
marketplace registries. CI then creates a GitHub release. You do not need to run
version commands.

The release workflow stamps the version from `package.json` into:

```text
.claude-plugin/marketplace.json
.agents/plugins/marketplace.json
plugins/*/.claude-plugin/plugin.json
plugins/*/.codex-plugin/plugin.json
```

## How the workflow operates

The coordinator loads detailed guidance only for its selected route:

- Planning selects only the requested output: brainstorming, a specification, a
  plan, ticket decomposition, ticket writing, or an external branch ledger.
- Investigation reproduces the problem, gathers evidence, and presents a fix
  path without changing repository files.
- Implementation requires implementation authority. It uses proportional
  test-first evidence and `minimal-code`, selects one review tier, and runs
  `review-cycle` after meaningful edits.

Named-ticket end-to-end authority permits branch setup, external ledger
maintenance, task commits, push, and a draft pull request. For each ledger task,
the coordinator uses one bounded sub-plan, implementation, verification,
independent review, `review-cycle`, and commit cycle. Review feedback does not
grant implementation or publishing authority.

### External artifacts

Planning artifacts and branch task ledgers stay outside repositories under:

```text
~/.engineering-workflow/<repo-id>/
```

The repository ID uses a readable slug of the normalized `origin` URL plus a
short stable hash. A repository without an `origin` uses its name and a short
hash of the Git common directory. Branch directories also include a short stable
hash to prevent slug collisions. The storage tree holds repository
configuration, specifications, plans, local ticket drafts, and branch task
ledgers. The `setup` skill initializes the tree and can copy legacy ledgers from
`~/.project-tasks`. Migration is conflict-safe and does not delete the source.

Plans, specifications, and local ticket drafts return in the conversation by
default. Writing them to external storage requires an explicit request. Direct
`branch-task-planner` use can create or update only the external ledger. It
cannot create a branch, edit repository files, commit, push, or publish.

### Field guide

The field guide stores untracked data at `~/.field-guide`. It reads only relevant
indexed guidance and keeps project guidance with its repository. It can capture
obvious durable user preferences, corrections, and repeated misses during normal
work. It asks before storing ambiguous observations. Committed code-review
corrections remain a first-class evidence and history path.

You can open `~/.field-guide` as an Obsidian vault to read and audit guidance.
The optional `.obsidian/` directory is disposable client state. Field-guide
commands ignore it, and no field-guide contract depends on Obsidian.

Shared guidance requires either a general user preference or independent generic
evidence from at least two repositories. The utility provides bounded retrieval,
candidate matching, submission, lifecycle, audit, maintenance, migration, and
validation commands. It preserves existing review records and validates typed
evidence.

You can also open `~/.engineering-workflow` or one repository directory as an
Obsidian vault to audit planning artifacts. Exclude `worktrees/` from indexing.
Do not create vaults inside topic, ticket lifecycle, branch, or worktree
directories.

### Simplification review

Use `simplification-review` directly to find simplification opportunities. The
coordinator can also use it when a change has material duplication, reuse,
ownership, or complexity risk. The skill is read-only and does not replace an
independent review tier.

The skill audits Minimality, Reuse, Ownership, Complexity, and Cleanup. It uses
the Fallow CLI by default. The Fallow MCP interface is optional.

### Attribution

The `minimal-code` skill uses original local guidance inspired by
[Ponytail](https://github.com/DietrichGebert/ponytail). It does not copy upstream
text. Ponytail uses the MIT license. Skill metadata and coordinator routing make
`minimal-code` available without lifecycle hooks or always-on injection.

Selected implementation, debugging, worktree, subagent, review, and skill-writing
guidance is adapted from pinned
[Superpowers](https://github.com/obra/superpowers) 6.2.0 sources. These local
adaptations narrow the triggers, authority, and execution rules to this plugin.
They do not require the Superpowers plugin at runtime.

Some provenance records link to pinned
[Matt Pocock skills](https://github.com/mattpocock/skills) as idea-only
inspiration for specifications and implementation. No substantial text was
copied from those sources. See
[THIRD_PARTY_NOTICES.md](plugins/workflow/THIRD_PARTY_NOTICES.md) and each
adapted skill's `references/upstream.md` for source pins and local decisions.

## CI

- `validate` runs plugin manifest validation for each pull request and push.
- `release` runs after validation on `main`. It updates versions and manifests,
  commits the result, and creates a GitHub release.

There is no separate Pages deployment workflow.

## Development

```sh
pnpm validate-plugins
pnpm check          # field-guide tests plus plugin manifest validation
```
