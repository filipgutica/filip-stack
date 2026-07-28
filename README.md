# Filip Stack

`Filip Stack` is a personal plugin marketplace for Claude and Codex.

## Distribution Model

Claude and Codex use this GitHub repository as a Git-based marketplace. Each release assigns a version to the tracked plugin files. No build step is required.

The `filip-stack` Codex marketplace ships one plugin:

- `workflow`: coordinator routing, minimal-code guidance, a layered review field guide, review-cycle checks, and Fallow-based simplification review

The Claude marketplace also ships `workflow`.

The former Codex-only `claude-plugin` now lives in the separate `codex-claude-plugin` marketplace.

## Repo Layout

```text
plugins/workflow/          Workflow plugin payload shared by Claude and Codex
  .claude-plugin/          Claude plugin manifest
  .codex-plugin/           Codex plugin manifest
  skills/                  coordinator, field-guide, minimal-code, review-cycle, and simplification-review skills
.claude-plugin/            Claude git marketplace registry (marketplace.json)
.agents/plugins/           Codex git marketplace registry (marketplace.json)
scripts/                   Stamp and validate scripts
```

## Claude Install

```sh
claude plugin marketplace add filipgutica/filip-stack
claude plugin install workflow@filip-stack
```

Claude reads `.claude-plugin/marketplace.json` at the repository root. This file lists `workflow` and sets its `source` to `./plugins/workflow`.
Git tracks the plugin files directly, so installation does not require a build.

Claude command names include the marketplace alias, so the installed plugin is
addressed as `<plugin-name>@filip-stack`.

To install a released update, run:

```sh
claude plugin update workflow@filip-stack
```

The Claude marketplace version is stamped from `package.json` during the release workflow into:

```text
.claude-plugin/marketplace.json
plugins/*/.claude-plugin/plugin.json
```

## Codex Install

```sh
codex plugin marketplace add filipgutica/filip-stack
```

Then restart Codex, open the plugin directory, and install `workflow` from the
`filip-stack` marketplace.

Codex reads `.agents/plugins/marketplace.json` at the repository root. This file lists `workflow` and sets its source path to `./plugins/workflow`.
Git tracks the plugin files directly, so installation does not require a build.

Codex marketplace commands target the marketplace name directly, so the upgrade
command uses `filip-stack` rather than a `plugin@marketplace` identifier.

To install a released update, run:

```sh
codex plugin marketplace upgrade filip-stack
```

The Codex marketplace version is stamped from `package.json` during the release workflow into:

```text
.agents/plugins/marketplace.json
plugins/*/.codex-plugin/plugin.json
```

## Versioning

Semantic-release manages versions after each push to `main`.
Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

| Commit prefix | Version bump |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` or `BREAKING CHANGE:` | major |

The lefthook `commit-msg` hook runs commitlint against each local commit message.
After a merge to `main`, CI updates `package.json`, both plugin manifests, and both marketplace registries.
It then creates a GitHub release. You do not need to run version commands.

## Included Skills

The `workflow` plugin includes:

- `coordinator`: routes work through Planning, Investigation, or authorized Implementation
- `field-guide`: reads local project and shared guidance and records lessons from committed code-review corrections
- `minimal-code`: guides small, readable changes with little ceremony. It favors existing code and platform features over new abstractions and dependencies. It adds JSDoc only to shared or non-obvious utilities.
- `review-cycle`: reviews the final diff and evidence, ensures meaningful work receives one proportionate independent review tier, drives required revisions, and verifies the accepted result
- `simplification-review`: checks scoped code for behavior-preserving simplification, reuse, efficiency, and cleanup. It uses Fallow first for supported code and styles.

The coordinator loads detailed guidance only for the selected route. Planning can produce artifacts. It can update an external branch ledger when explicitly requested for an established branch. Investigation gathers evidence and presents a fix path. It enters Implementation only with separate authority. Implementation uses `minimal-code` and selects one review tier. After meaningful edits, `review-cycle` confirms that review or invokes the missing tier before acceptance.

Named-ticket end-to-end authority also permits branch setup, task commits, push, and a draft pull request. Review feedback does not inherit that authority from earlier work.

The field guide stores untracked data at `~/.field-guide`. It reads only relevant indexed guidance. It records a lesson only after a code-review correction has a commit. Project guidance stays with its repository. Shared guidance requires a general user preference or committed evidence from at least two project guides.

The field-guide utility provides `init`, `paths`, and `validate` commands. These commands preserve existing guide content and validate repository and commit evidence.

Use `simplification-review` for broad requests about simpler code, reuse, dead code, redundant tests or styles, efficiency, or cleanup. It checks local tracked and untracked changes before the branch diff. It asks for a scope when neither diff provides one. The skill uses the Fallow CLI by default. The Fallow MCP interface remains optional.

The `minimal-code` skill uses original local guidance inspired by [Ponytail](https://github.com/DietrichGebert/ponytail). It does not copy upstream text. Ponytail uses the MIT license. Skill metadata and coordinator routing make `minimal-code` widely available without lifecycle hooks or always-on injection.

## Companion Plugin

When Superpowers is available, `workflow` uses `superpowers:receiving-code-review` for external review comments. The coordinator then verifies each comment against the code and contract.

Without Superpowers, the coordinator still verifies the feedback and selects a correction path by risk. It must not claim that it used Superpowers.

## CI

- **validate**: runs plugin manifest validation for each pull request and push
- **release**: runs after validation on `main`, updates versions and manifests, commits the result, and creates a GitHub release

There is no separate Pages deployment workflow. Claude installs directly from this GitHub repository as a Git-based marketplace.

## Development

```sh
pnpm validate-plugins
pnpm check          # field-guide tests plus plugin manifest validation
```
