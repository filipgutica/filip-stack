# Filip Stack

Personal Claude and Codex plugin marketplace.

## Distribution Model

Both Claude and Codex are distributed directly from this GitHub repo as git-based marketplaces. No build step required — plugin payloads are tracked directly in git and versioned on release.

The `filip-stack` Codex marketplace ships one plugin:

- `workflow` — coordinator routing, minimal-code posture, layered review field guide, review cycle, and Fallow-backed simplification review

The Claude marketplace also ships `workflow`.

The former Codex-only `claude-plugin` now lives in the dedicated
`codex-claude-plugin` marketplace.

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

Claude reads `.claude-plugin/marketplace.json` at the repo root, which lists
the `workflow` plugin and points its `source` value at `./plugins/workflow`.
No build step required — the plugin payload is tracked directly in git.

Claude command names include the marketplace alias, so the installed plugin is
addressed as `<plugin-name>@filip-stack`.

Updates are automatic: when a new version is released, run:

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

Codex reads `.agents/plugins/marketplace.json` at the repo root, which lists
the `workflow` plugin and points its source path at `./plugins/workflow`.
No build step required — the plugin payload is tracked directly in git.

Codex marketplace commands target the marketplace name directly, so the upgrade
command uses `filip-stack` rather than a `plugin@marketplace` identifier.

Updates are automatic: when a new version is released, run:

```sh
codex plugin marketplace upgrade filip-stack
```

The Codex marketplace version is stamped from `package.json` during the release workflow into:

```text
.agents/plugins/marketplace.json
plugins/*/.codex-plugin/plugin.json
```

## Versioning

Versioning is automated via semantic-release on every push to `main`.
Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

| Commit prefix | Version bump |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` or `BREAKING CHANGE:` | major |

Commit messages are validated locally by commitlint via the lefthook `commit-msg` hook.
On merge to `main`, CI bumps `package.json`, stamps the version into
`plugins/*/.claude-plugin/plugin.json`,
`plugins/*/.codex-plugin/plugin.json`,
`.claude-plugin/marketplace.json`, and `.agents/plugins/marketplace.json`,
and creates a GitHub release. No manual version commands needed.

## Included Skills

The `workflow` plugin includes:

- `coordinator` — high-level router with focused Planning, Investigation, and authorized Implementation flows
- `field-guide` — consults and maintains layered local project and shared guidance derived from committed code-review corrections
- `minimal-code` — default implementation posture for small, readable, low-ceremony changes. Reuses existing code first, prefers platform and standard-library features before dependencies, avoids speculative abstractions and scaffolding, keeps explanations concise, and adds useful JSDoc to shared or non-obvious utility functions without trading away correctness or verification.
- `review-cycle` — final diff-and-evidence acceptance gate for scope drift, test artifacts, metadata preservation, review-tier evidence, and verification after meaningful edits and before final response, commit, PR, completion claim, or broad verification
- `simplification-review` — analyze-first simplification, cleanup, reuse, efficiency, and maintainability review skill scoped to local changes, untracked files, branch diff, or an explicit area. Uses Fallow as the primary deterministic analysis engine for supported JS/TS/Vue/Nest, dead-code, duplication, health, dependency, and CSS/SCSS/CSS Module cleanup signals.

The coordinator keeps its root router small and loads detailed Planning, Investigation, or Implementation guidance only for the selected route. Implementation uses `minimal-code`, selects one proportionate review tier, and finishes meaningful edits with `review-cycle`. Named-ticket branch setup, task commits, push, and draft PR creation remain explicitly authorized end-to-end behavior.

The field guide lives outside repositories at `~/.field-guide`. It loads only relevant indexed guidance and records review learning only after the corresponding correction commit exists. Project guidance remains local to its repository; shared guidance requires an explicit general preference or supporting committed evidence from multiple projects.
Use `simplification-review` for broad natural-language requests about simplifying code, improving reuse, reducing overcomplication or over-abstraction, finding dead or unused code, removing redundant tests or styles, checking efficiency, or validating cleanup after generated code. It reviews `git diff` plus `git status --short` first, then `git diff origin/main`, and asks for scope only when neither local nor branch changes produce a usable surface. The skill works through the Fallow CLI by default; Fallow MCP is optional when already available.

The `minimal-code` skill is inspired by [Ponytail](https://github.com/DietrichGebert/ponytail)'s minimalism posture, but the workflow plugin uses original local guidance rather than vendored upstream text. Ponytail is MIT licensed. This skill has no lifecycle hooks or always-on injection; broad use comes from skill metadata and coordinator routing.

## Companion Plugin

`workflow` works best with Superpowers installed because coordinator routes pure written plans and some execution workflows to `superpowers:*` skills when they are available.

If Superpowers is not installed, coordinator should state:

```text
Superpowers is not available; falling back to default planning behaviour.
```

It then continues with the closest safe default workflow and must not claim that a Superpowers workflow was used.

## CI

- **validate** — runs on all PRs and pushes: plugin manifest validation
- **release** — runs on push to `main` after validate: semantic-release bumps version,
  stamps plugin manifests, commits back, creates GitHub release

There is no separate Pages deployment workflow. Claude installs directly from this GitHub repo as a git-based marketplace.

## Development

```sh
pnpm validate-plugins
pnpm check          # field-guide tests plus plugin manifest validation
```
