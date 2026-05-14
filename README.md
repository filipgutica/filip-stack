# Filip Stack

Personal Claude and Codex plugin marketplace.

## Distribution Model

Both Claude and Codex are distributed directly from this GitHub repo as git-based marketplaces. No build step required — plugin payloads are tracked directly in git and versioned on release.

The `filip-stack` Codex marketplace ships two plugins:

- `workflow` — coordinator and Fallow-backed simplification review
- `project-notes` — project notes ticket tracking plus notes hooks

The Claude marketplace also ships `workflow` and `project-notes`.

The former Codex-only `claude-plugin` now lives in the dedicated
`codex-claude-plugin` marketplace.

## Repo Layout

```text
plugins/workflow/          Workflow plugin payload shared by Claude and Codex
  .claude-plugin/          Claude plugin manifest
  .codex-plugin/           Codex plugin manifest
  skills/                  coordinator and simplification-review skills
plugins/project-notes/     Project notes plugin payload shared by Claude and Codex
  .claude-plugin/          Claude plugin manifest
  .codex-plugin/           Codex plugin manifest
  hooks/claude.json        Claude hooks (uses ${CLAUDE_PLUGIN_ROOT})
  hooks/codex.json         Codex hooks (uses ${CODEX_PLUGIN_ROOT})
  skills/                  project-notes-tracker skill
  scripts/                 Hook runtime (project-notes-hook.mjs)
.claude-plugin/            Claude git marketplace registry (marketplace.json)
.agents/plugins/           Codex git marketplace registry (marketplace.json)
scripts/                   Stamp and validate scripts
src/                       Minimal CLI source for Codex hook setup
tests/                     Hook integration tests
dist/                      Build output (gitignored)
```

## Claude Install

```sh
claude plugin marketplace add filipgutica/filip-stack
claude plugin install workflow@filip-stack
claude plugin install project-notes@filip-stack
```

Claude reads `.claude-plugin/marketplace.json` at the repo root, which lists
the `workflow` and `project-notes` plugins and points their `source` values at
`./plugins/workflow` and `./plugins/project-notes`. No build step required —
the plugin payloads are tracked directly in git.

Claude command names include the marketplace alias, so the installed plugin is
addressed as `<plugin-name>@filip-stack`.

Updates are automatic: when a new version is released, run:

```sh
claude plugin update workflow@filip-stack
claude plugin update project-notes@filip-stack
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

Then restart Codex, open the plugin directory, and install `workflow` and
`project-notes` from the `filip-stack` marketplace.

Codex reads `.agents/plugins/marketplace.json` at the repo root, which lists
the `workflow` and `project-notes` plugins and points their source paths at
`./plugins/*`. No build step required — the plugin payloads are
tracked directly in git.

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

The `project-notes` plugin bundles its Codex lifecycle hooks through
`plugins/project-notes/.codex-plugin/plugin.json`, which points at
`./hooks/codex.json`. Enable Codex hook support before relying on those
plugin-bundled hooks:

```toml
[features]
hooks = true
plugin_hooks = true
```

Restart Codex after changing `~/.codex/config.toml`, then verify the active
feature state with:

```sh
codex features list
```

Older Codex versions may not support plugin-bundled hooks. In that case,
install the global Codex notes hooks separately:

```sh
node dist/cli.js codex-hooks
node dist/cli.js codex-hooks --dry-run
```

This fallback command installs or updates `~/.codex/hooks.json` so reserved
project-notes prompts such as `notes create: <title>` and
`notes plan: <seed>` route through the `project-notes` hook runtime without
depending on plugin hook loading.

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

The `project-notes` plugin includes:

- `project-notes-tracker` — local ticket lifecycle (create, plan, approve, complete)

The coordinator guidance is intentionally proportional: use the lightest safe workflow for the task, keep bounded mechanical changes local when possible, and reserve explorer or critic passes for real unknowns, behavior risk, or weak verification.
Use `simplification-review` for broad natural-language requests about simplifying code, improving reuse, reducing overcomplication or over-abstraction, finding dead or unused code, removing redundant tests or styles, checking efficiency, or validating cleanup after generated code. It reviews `git diff` plus `git status --short` first, then `git diff origin/main`, and asks for scope only when neither local nor branch changes produce a usable surface. The skill works through the Fallow CLI by default; Fallow MCP is optional when already available.

## Project Notes Hook

Fires on `UserPromptSubmit` and `Stop`. Runtime state is repo-local:

- `.notes/todo/`, `.notes/in-progress/`, `.notes/complete/` — tracked Markdown tickets
- `.notes/.runtime/` — machine-managed session state (gitignored)

Commands: `notes create: <title>`, `notes track: <ticket>`, `notes plan: <seed>`,
`notes approve`, `notes complete`.

## CI

- **validate** — runs on all PRs and pushes: plugin manifest validation, typecheck, test, build
- **release** — runs on push to `main` after validate: semantic-release bumps version,
  stamps plugin manifests, commits back, creates GitHub release

There is no separate Pages deployment workflow. Claude installs directly from this GitHub repo as a git-based marketplace.

## Development

```sh
pnpm validate-plugins
pnpm typecheck
pnpm test
pnpm build
pnpm check          # validate plugin manifests + typecheck + test + build
```
