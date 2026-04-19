# Filip Stack

Personal source of truth for shared Claude and Codex setup across my machines.

## Distribution Model

- **Claude** — Git-based marketplace. Add the repo as a marketplace once; updates pull automatically on version bump.
- **Codex** — Local bridge install via CLI helper.

Claude distribution is repo-backed only. There is no GitHub Pages marketplace publish path.

## Repo Layout

```text
plugins/filip-stack/       Claude marketplace plugin payload (skills, hooks, scripts)
                           Also the shared source for the Codex build
plugin/codex/              Codex-specific build templates (plugin.json, hooks.json)
.claude-plugin/            Git marketplace registry (marketplace.json)
globals/                   AGENTS.md and CLAUDE.md synced to host home dirs
scripts/                   Build, validate, and stamp scripts
src/                       TypeScript CLI source
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

Build first, then use the CLI helper:

```sh
pnpm install && pnpm build
node dist/cli.js setup              # adds shell alias to your rc file
filip-stack install codex           # local bridge install
```

After pulling changes, refresh Codex:

```sh
pnpm build
filip-stack update codex
```

## CLI

Add a shell alias so the CLI is available from anywhere:

```sh
node dist/cli.js setup
node dist/cli.js setup --rc-file ~/.zshrc
node dist/cli.js setup --alias stack-sync
node dist/cli.js setup --dry-run
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
`plugins/filip-stack/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`,
and creates a GitHub release. No manual version commands needed.

## Included Skills

Both Claude and Codex plugins include:

- `coordinator` — main engineering workflow skill (planning, implementation, review, investigation, simplification)
- `project-notes-tracker` — local ticket lifecycle (create, plan, approve, complete)

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
