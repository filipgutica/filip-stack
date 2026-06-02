# Filip Stack

Personal Claude and Codex plugin marketplace.

## Distribution Model

Both Claude and Codex are distributed directly from this GitHub repo as git-based marketplaces. No build step required — plugin payloads are tracked directly in git and versioned on release.

The `filip-stack` Codex marketplace ships one plugin:

- `workflow` — coordinator and Fallow-backed simplification review

The Claude marketplace also ships `workflow`.

The former Codex-only `claude-plugin` now lives in the dedicated
`codex-claude-plugin` marketplace.

## Repo Layout

```text
plugins/workflow/          Workflow plugin payload shared by Claude and Codex
  .claude-plugin/          Claude plugin manifest
  .codex-plugin/           Codex plugin manifest
  skills/                  coordinator and simplification-review skills
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

- `coordinator` — main engineering workflow skill (planning, implementation, review, investigation, delegation, synthesis)
- `simplification-review` — analyze-first simplification, cleanup, reuse, efficiency, and maintainability review skill scoped to local changes, untracked files, branch diff, or an explicit area. Uses Fallow as the primary deterministic analysis engine for supported JS/TS/Vue/Nest, dead-code, duplication, health, dependency, and CSS/SCSS/CSS Module cleanup signals.

The coordinator guidance is intentionally proportional: use the lightest safe workflow for the task, keep bounded mechanical changes local when possible, honor explicit subagent or role-based workflow requests, and reserve explorer or critic passes for real unknowns, behavior risk, weak verification, or requested review roles.
Use `simplification-review` for broad natural-language requests about simplifying code, improving reuse, reducing overcomplication or over-abstraction, finding dead or unused code, removing redundant tests or styles, checking efficiency, or validating cleanup after generated code. It reviews `git diff` plus `git status --short` first, then `git diff origin/main`, and asks for scope only when neither local nor branch changes produce a usable surface. The skill works through the Fallow CLI by default; Fallow MCP is optional when already available.

## CI

- **validate** — runs on all PRs and pushes: plugin manifest validation
- **release** — runs on push to `main` after validate: semantic-release bumps version,
  stamps plugin manifests, commits back, creates GitHub release

There is no separate Pages deployment workflow. Claude installs directly from this GitHub repo as a git-based marketplace.

## Development

```sh
pnpm validate-plugins
pnpm check          # validate plugin manifests
```
