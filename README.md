# Filip Stack

Filip Stack is a personal plugin marketplace for Claude and Codex. It distributes
the shared `workflow` plugin directly from this GitHub repository.

## What the workflow plugin includes

The `workflow` plugin provides six skills:

- `branch-task-planner` interactively creates or modifies an external branch
  task ledger. Direct invocation is planning-only.
- `coordinator` routes work through Planning, Investigation, or authorized
  Implementation.
- `field-guide` reads local guidance and records lessons from committed
  code-review corrections.
- `minimal-code` favors small, readable changes and existing code over new
  abstractions and dependencies. It adds JSDoc only to shared, exported, or
  non-obvious utilities.
- `review-cycle` accepts the final diff, review coverage, and verification
  evidence. It runs a missing standard or adversarial review when required.
- `simplification-review` audits Minimality, Reuse, Ownership, Complexity, and
  Cleanup. Use it directly or when an implementation has material
  simplification risk. It uses Fallow first for supported code and styles.

Both the Claude and Codex marketplaces distribute this plugin. The separate
`codex-claude-plugin` marketplace distributes the Codex-only `claude-plugin`.

## Repository layout

```text
plugins/workflow/          Workflow plugin payload shared by Claude and Codex
  .claude-plugin/          Claude plugin manifest
  .codex-plugin/           Codex plugin manifest
  skills/                  branch-task-planner, coordinator, field-guide, minimal-code, review-cycle, and simplification-review skills
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

- Planning can invoke `branch-task-planner` to create or modify only an external
  branch ledger for an established branch.
- Investigation gathers evidence and presents a fix path.
- Implementation requires implementation authority. It uses `minimal-code`, selects
  one review tier, and runs `review-cycle` after meaningful edits. The review
  cycle confirms the completed review or invokes the missing tier.

Named-ticket end-to-end authority also permits branch setup, task commits, push,
and a draft pull request. For each ledger task, the coordinator uses one bounded
sub-plan, implementation, verification, independent review, `review-cycle`, and
commit cycle. Review feedback does not grant implementation or publishing
authority.

### Field guide

The field guide stores untracked data at `~/.field-guide`. It reads only relevant
indexed guidance and keeps project guidance with its repository. It records a
lesson only after a code-review correction has a commit.

Shared guidance requires either a general user preference or committed evidence
from at least two project guides. The `field-guide` utility provides `init`,
`paths`, and `validate` commands. These commands preserve existing content and
validate repository and commit evidence.

### Simplification review

Use `simplification-review` directly to find simplification opportunities. The
coordinator can also use it when a change has material duplication, reuse,
ownership, or complexity risk. The skill is read-only and does not replace an
independent review tier.

The skill audits Minimality, Reuse, Ownership, Complexity, and Cleanup. It uses
the Fallow CLI by default. The Fallow MCP interface is optional.

### Companion plugin

When Superpowers is available, `workflow` uses
`superpowers:receiving-code-review` for external review comments. The
coordinator verifies each comment against the code and contract.

Without Superpowers, the coordinator still verifies the feedback and selects a
correction path by risk. The coordinator must not claim that it used
Superpowers.

### Attribution

The `minimal-code` skill uses original local guidance inspired by
[Ponytail](https://github.com/DietrichGebert/ponytail). It does not copy upstream
text. Ponytail uses the MIT license. Skill metadata and coordinator routing make
`minimal-code` available without lifecycle hooks or always-on injection.

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
