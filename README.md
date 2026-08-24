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
granting authority to modify them. An explicit invocation can save one curated
walkthrough log under a confirmed topic. The log keeps a slice-status table and
a chronological running log.

Both the Claude and Codex marketplaces distribute this plugin. The separate
`codex-claude-plugin` marketplace distributes the Codex-only `claude-plugin`.

## Repository layout

```text
plugins/workflow/          Workflow plugin payload shared by Claude and Codex
  .claude-plugin/          Claude plugin manifest
  .codex-plugin/           Codex plugin manifest
  hooks/                   Shared local lifecycle hooks
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

3. Run `/hooks` and confirm that the plugin `UserPromptSubmit` hook is enabled.

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

### Automatic field-guide hook

The packaged `UserPromptSubmit` hook supports local Claude Code on macOS and
Linux. It does not require a global `CLAUDE.md` instruction.

The local host must have Node.js 20.16 or newer. Git must be on PATH.
The launcher searches PATH and common macOS and Linux install locations. It also
searches the default NVM, fnm, Volta, asdf, and mise locations. Set
`WORKFLOW_NODE` to the executable path for another installation.

Claude remote execution and Windows are not supported.

The Claude hook sends bounded lifecycle instructions at `UserPromptSubmit`. It
instructs the agent to decide `capture`, `ask`, or `skip` before the final
response.

Workflow does not register Codex lifecycle hooks. Codex shows hook runs and
injected context, and `suppressOutput` is not implemented. Codex agents use the
Field Guide through normal skill routing.

The Claude hook does not register a `Stop` continuation. Claude can show its
block reason. End-of-task evaluation is instructed but not enforced.

The hook fails open. If it is disabled, untrusted, or unavailable, the task can finish without automatic evaluation. The field-guide skill remains available manually.

The normal task response remains intact for `skip` and `capture`. A `skip` evaluation writes no memory and adds no field-guide notice. A `capture` adds only the concise change notice. An `ask` returns only the focused question.

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

Named-work-item end-to-end authority applies to a ticket, specification, or
plan. It permits branch setup, external ledger maintenance, bounded commits,
push, and a draft pull request. The coordinator composes a plan when complexity
requires it. It does not create tickets when the primary work item is already
self-contained.

For meaningful implementation, the coordinator states one active slice with an
outcome, boundary, and verification signal. It defers independent work and
continues the active slice unless the user replaces the priority. Review
compares the final diff with the active slice before acceptance. Review feedback
does not grant implementation or publishing authority.

### External artifacts

Planning artifacts and branch task ledgers stay outside repositories under:

```text
~/.engineering-workflow/
├── topics/<open|complete|abandoned>/<topic-id>/
└── repositories/<repo-id>/topics/<open|complete|abandoned>/<topic-id>/
```

`TOPIC.md` is the topic registry and navigation entry point. A topic owns its
specification, plan, local tickets, grill logs, and walkthrough logs. Repository
directories own configuration and branch ledgers. One topic or ticket can span
repositories. Directory names show whether work is open, complete, or abandoned.

An explicit `writing-specs` invocation writes `SPEC.md` under an open topic by
default. The topic must be user-identified or the only open topic. When multiple
open topics exist, the user must choose one. Plans and local ticket drafts need
an explicit storage request. An explicit `grill-me` invocation creates one
curated topic log after topic confirmation. An explicit `walkthrough` invocation
creates one curated log with source provenance after source and topic confirmation.

Topic lifecycle commands audit known work, move root and repository topic
directories together, and preserve acknowledged warnings in `TOPIC.md`. A
specification uses Draft, Ready, or Implemented independently of topic state.
The new layout has no repository migration command. A one-time interactive
local migration occurs after merge and release.

### Durable source links

Only durable, retrievable artifacts are workflow sources. A brainstorm can stay
ephemeral, so downstream work does not depend on a session link. The first
persisted specification, plan, ticket, grill log, walkthrough log, or ledger can
identify `Direct request`. Every local artifact links to `TOPIC.md`. Local
artifacts use relative links to local sources. Jira and GitHub work items use
verified HTTPS links and never machine-local paths. A ledger records its
primary work item plus optional specification and plan sources, then maps each
task to its commit. Artifact levels can be skipped. A multi-repository ticket
uses one ledger per repository and branch, with the same primary work item.

### Field guide

The field guide stores untracked data at `~/.field-guide`. It reads only relevant
indexed guidance and keeps project guidance with its repository. It can capture
obvious durable user preferences, corrections, and repeated misses during normal
work. It asks before storing ambiguous observations. Committed code-review
corrections remain a first-class evidence and history path.

The Claude plugin hook instructs one end-of-task learning evaluation before the
final response. The agent decides `capture`, `ask`, or `skip`. The evaluation is
not enforced by a Stop continuation. Codex uses normal skill routing instead of
an automatic lifecycle hook. The hook never ingests a transcript or writes
field-guide data.

You can open `~/.field-guide` as an Obsidian vault to read and audit guidance.
The optional `.obsidian/` directory is disposable client state. Field-guide
commands ignore it, and no field-guide contract depends on Obsidian.

Shared guidance requires either a general user preference or independent generic
evidence from at least two repositories. The utility provides bounded retrieval,
candidate matching, submission, lifecycle, audit, maintenance, and validation
commands. It preserves existing review records and validates typed evidence.

You can also open `~/.engineering-workflow` as an Obsidian vault to audit
planning artifacts. Git worktrees live separately under
`~/code/worktrees/<project>/`. Do not create vaults inside topic, ticket
lifecycle, or branch directories.

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
