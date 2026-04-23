# Filip Stack

Personal source of truth for shared Claude and Codex setup across my machines.

## Distribution Model

Both Claude and Codex are distributed directly from this GitHub repo as git-based marketplaces. No build step required — plugin payloads are tracked directly in git and versioned on release.

## Repo Layout

```text
plugins/filip-stack/       Plugin payload shared by Claude and Codex (skills, hooks, scripts)
  .claude-plugin/          Claude plugin manifest
  .codex-plugin/           Codex plugin manifest
  hooks/claude.json        Claude hooks (uses ${CLAUDE_PLUGIN_ROOT})
  hooks/codex.json         Codex hooks (uses ${CODEX_PLUGIN_ROOT})
  skills/                  Shared skill SKILL.md and openai.yaml files
  scripts/                 Hook runtime (project-notes-hook.mjs)
.claude-plugin/            Claude git marketplace registry (marketplace.json)
.agents/plugins/           Codex git marketplace registry (marketplace.json)
globals/                   AGENTS.md and CLAUDE.md synced to host home dirs
scripts/                   Stamp and validate scripts
src/                       TypeScript CLI source (globals sync + shell setup)
tests/                     Hook integration tests
dist/                      Build output (gitignored)
```

## Claude Install

```sh
claude plugin marketplace add filipgutica/filip-stack
claude plugin install filip-stack@local-plugins
```

Claude reads `.claude-plugin/marketplace.json` at the repo root, which points
`source` at `./plugins/filip-stack`. No build step required — the plugin payload
is tracked directly in git.

Claude command names include the marketplace alias, so the installed plugin is
addressed as `filip-stack@local-plugins`.

Updates are automatic: when a new version is released, run:

```sh
claude plugin update filip-stack@local-plugins
```

The Claude marketplace version is stamped from `package.json` during the release workflow into:

```text
.claude-plugin/marketplace.json
plugins/filip-stack/.claude-plugin/plugin.json
```

## Codex Install

```sh
codex plugin marketplace add filipgutica/filip-stack
```

Then restart Codex, open the plugin directory, and install `filip-stack` from the `filip-stack` marketplace.

Codex reads `.agents/plugins/marketplace.json` at the repo root, which points
`source` at `./plugins/filip-stack`. No build step required — the plugin payload
is tracked directly in git.

Codex marketplace commands target the marketplace name directly, so the upgrade
command uses `filip-stack` rather than a `plugin@marketplace` identifier.

Updates are automatic: when a new version is released, run:

```sh
codex plugin marketplace upgrade filip-stack
```

The Codex marketplace version is stamped from `package.json` during the release workflow into:

```text
.agents/plugins/marketplace.json
plugins/filip-stack/.codex-plugin/plugin.json
```

Install the global Codex notes hooks separately:

```sh
filip-stack codex-hooks
```

This command installs or updates `~/.codex/hooks.json` so reserved project-notes prompts such as `notes create: <title>` and `notes plan: <seed>` route through Filip Stack's hook runtime even if Codex does not honor plugin-bundled hooks consistently.

> **Note:** Codex hook support is not documented as part of the plugin system. This repo keeps `plugins/filip-stack/hooks/codex.json` bundled with the plugin as a best-effort path, but `filip-stack codex-hooks` is the reliable setup path for the notes hook flow.

## CLI

Add a shell alias so the CLI is available from anywhere:

```sh
node dist/cli.js setup
node dist/cli.js setup --rc-file ~/.zshrc
node dist/cli.js setup --alias stack-sync
node dist/cli.js setup --dry-run
```

Install or update the global Codex notes hooks:

```sh
filip-stack codex-hooks
filip-stack codex-hooks --dry-run
```

Sync global guidance files:

```sh
filip-stack
filip-stack --globals
filip-stack --dry-run
```

Globals synced:

```text
globals/AGENTS.md  ->  ~/.codex/AGENTS.md
globals/CLAUDE.md  ->  ~/.claude/CLAUDE.md
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
`plugins/filip-stack/.claude-plugin/plugin.json`,
`plugins/filip-stack/.codex-plugin/plugin.json`,
`.claude-plugin/marketplace.json`, and `.agents/plugins/marketplace.json`,
and creates a GitHub release. No manual version commands needed.

## Included Skills

Both Claude and Codex plugins include:

- `coordinator` — main engineering workflow skill (planning, implementation, review, investigation, simplification)
- `project-notes-tracker` — local ticket lifecycle (create, plan, approve, complete)

The coordinator guidance is intentionally proportional: use the lightest safe workflow for the task, keep bounded mechanical changes local when possible, and reserve explorer or critic passes for real unknowns, behavior risk, or weak verification.

## Project Notes Hook

Fires on `UserPromptSubmit` and `Stop`. Runtime state is repo-local:

- `.notes/todo/`, `.notes/in-progress/`, `.notes/complete/` — tracked Markdown tickets
- `.notes/.runtime/` — machine-managed session state (gitignored)

Commands: `notes create: <title>`, `notes track: <ticket>`, `notes plan: <seed>`,
`notes approve`, `notes complete`.

## CI

- **validate** — runs on all PRs and pushes: typecheck, test, build
- **release** — runs on push to `main` after validate: semantic-release bumps version,
  stamps plugin manifests, commits back, creates GitHub release

There is no separate Pages deployment workflow. Claude installs directly from this GitHub repo as a git-based marketplace.

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check          # typecheck + test + build
```
