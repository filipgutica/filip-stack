# Filip Stack

Personal source of truth for shared Claude and Codex setup across my machines.

This repo builds host-specific plugin artifacts from shared source. It no longer
uses raw synced `skills/` and `hooks/` as the primary install surface.

The distribution model is intentionally split:

- Claude: Git-based marketplace install by default, plus a Pages-hosted marketplace file and a local install helper for development and recovery
- Codex: validated local bridge install until there is a clearer public remote plugin install model

## Build

Build the CLI and generated plugin outputs:

```sh
pnpm install
pnpm build
```

This generates:

```text
dist/plugins/claude/filip-stack/
dist/plugins/codex/filip-stack/
dist/marketplaces/claude/filip-stack-local/
dist/publish/claude-marketplace/
```

`dist/` stays gitignored. After cloning or pulling changes, build locally before
trying to load a local plugin install.

## Repo Layout

Hand-edited plugin source lives under:

```text
plugin/shared/
plugin/claude/
plugin/codex/
```

Generated installable plugin roots live under:

```text
dist/plugins/claude/filip-stack/
dist/plugins/codex/filip-stack/
```

Generated Claude marketplace outputs live under:

```text
dist/marketplaces/claude/filip-stack-local/
dist/publish/claude-marketplace/
.claude-plugin/marketplace.json
plugins/filip-stack/
```

`dist/marketplaces/claude/filip-stack-local/` is the canonical marketplace tree.
`dist/publish/claude-marketplace/` is the GitHub Pages friendly copy that CI can
publish directly.
`.claude-plugin/marketplace.json` plus `plugins/filip-stack/` is the tracked
Git-based marketplace layout for `claude plugin marketplace add filipgutica/filip-stack`.

Manifest locations inside the built plugin roots are host-specific:

```text
dist/plugins/claude/filip-stack/.claude-plugin/plugin.json
dist/plugins/codex/filip-stack/.codex-plugin/plugin.json
```

Plugin and marketplace versions are stamped from `package.json` during build so
the release version only needs to be updated in one place.

After changing Claude plugin contents, refresh the tracked Git-based marketplace
files with:

```sh
pnpm sync:claude-marketplace-repo
```

## Install and Update

Local install helpers:

```sh
./bin/filip-stack install claude
./bin/filip-stack install codex
./bin/filip-stack install all
```

After changing anything under `plugin/`, rebuild and refresh local host state:

```sh
pnpm build
./bin/filip-stack update claude
./bin/filip-stack update codex
./bin/filip-stack update all
```

Install and update share the same underlying local sync flow:

- build plugin outputs once
- sync Claude local settings and CLI-managed install/update
- sync Codex local state and trigger Codex's own plugin install step

For day-to-day usage, prefer the Git-based Claude marketplace path below. The
local Claude install helper is primarily for development and recovery.

## Claude Distribution

Claude is the only host in this repo that has a clear traditional marketplace
distribution story today.

Recommended install shape:

```sh
claude plugin marketplace add filipgutica/filip-stack
claude plugin install filip-stack@local-plugins
```

What makes that work:

- the repo root contains `.claude-plugin/marketplace.json`
- the plugin payload is tracked in `plugins/filip-stack/`
- Claude clones the repo as a Git-based marketplace, so relative plugin paths work

For local development or recovery, you can still use:

```sh
./bin/filip-stack install claude
```

Claude install behavior:

- writes a persistent directory-backed marketplace source into `~/.claude/settings.json`
- refreshes that marketplace through Claude's own CLI
- installs or updates `filip-stack@local-plugins` through Claude's own CLI

Pages-hosted marketplace:

- CI also deploys `dist/publish/claude-marketplace/` to GitHub Pages on merge to `main`
- that published `marketplace.json` uses a `git-subdir` plugin source pointing back to this repo's `plugins/filip-stack/`
- use this only if you want a URL-based marketplace entry instead of the simpler Git-based add

URL-based install shape:

```sh
claude plugin marketplace add https://filipgutica.github.io/filip-stack/marketplace.json
claude plugin install filip-stack@local-plugins
```

## Codex Distribution

Codex currently stays local-install only in this repo.

Codex install behavior:

- copies the built plugin into `~/plugins/filip-stack` for the home-local marketplace source
- updates `~/.agents/plugins/marketplace.json`
- enables `filip-stack@filip-stack-local` in `~/.codex/config.toml`
- asks Codex's own app-server to run `plugin/install` for `filip-stack`

Codex notes:

- the local marketplace contract follows the same home-local convention used by the plugin creator guidance:
  `~/.agents/plugins/marketplace.json` plus `./plugins/<plugin-name>` means the plugin source lives at `~/plugins/<plugin-name>`
- Codex does maintain `~/.codex/plugins/cache/<marketplace>/<plugin>` at runtime, but that cache is now populated by Codex itself through the app-server install mutation instead of this repo writing it directly
- this Codex install flow is grounded in the local Codex app-server schema and observed runtime behavior. I did not find official OpenAI docs that describe a public `codex plugin install` CLI command or a documented local-plugin cache flow

Claude notes:

- this flow is grounded in Claude's documented marketplace/plugin commands, not by writing `~/.claude/plugins/*` cache files directly
- if Claude already has a stale broken `local-plugins` marketplace cached from an older install flow, repair it with:

```sh
claude plugin marketplace remove local-plugins
claude plugin marketplace add ./dist/marketplaces/claude/filip-stack-local
claude plugin install filip-stack@local-plugins
```

This is intentionally a thin bridge. The repo does not claim a public hosted
Codex marketplace/install path yet.

## Included Skills

Both generated plugins include:

- `coordinator`
- `project-notes-tracker`

Codex names plugin-provided skills with the plugin prefix in API responses, for example:

- `filip-stack:coordinator`
- `filip-stack:project-notes-tracker`

## Coordinator Hook

The generated plugins bundle a shared coordinator prompt hook that reinforces the
default workflow on normal prompts:

- runs on `UserPromptSubmit`
- nudges the model toward the coordinator workflow directly for ordinary prompts
- keeps the reminder self-gating by saying it applies to non-trivial engineering work
- skips reserved `notes *` control prompts
- runs before the notes hook so workflow routing guidance appears first

## Project Notes Hook

The generated plugins bundle the shared project notes hook. Its runtime behavior
remains repo-local:

- `.notes/todo/`, `.notes/in-progress/`, and `.notes/complete/` hold tracked Markdown tickets
- `.notes/.runtime/` stores machine-managed session bindings and transient hook state and should stay untracked
- Ticket frontmatter carries durable binding metadata: `ticket-id` is stable across moves and `session-id` tracks the currently bound session
- `UserPromptSubmit` supports `notes create: <title>`, `notes use: <ticket>`, `notes plan: <seed>`, `notes approve`, and `notes complete`
- `UserPromptSubmit` can restore an already-linked session when the same session ID is still present
- `notes use:` with no selector lists open tickets instead of guessing a binding
- `UserPromptSubmit` reminds the model to keep the linked `## Work Log` updated during normal tracked work once the ticket has an approved plan
- `UserPromptSubmit` stays quiet during normal prompts when no ticket is bound
- the notes hook remains notes-only and runs after the coordinator hook on `UserPromptSubmit`

Planning remains a two-step flow:

- `notes plan: <seed>` appends the seed under `## Planning Seed` and starts coordinator-driven planning while keeping the ticket in `.notes/todo/`
- `notes approve` writes the approved plan into `## Approved Plan`, stamps `started`, and moves the ticket to `.notes/in-progress/`
- `notes complete` writes `## Completion Summary`, stamps `completed`, and moves the ticket to `.notes/complete/`

## CLI

The CLI is now for globals, shell bootstrap, and local plugin install helpers.

Sync global guidance files:

```sh
./bin/filip-stack
./bin/filip-stack --globals
./bin/filip-stack --dry-run
```

Globals synced by the CLI:

```text
globals/AGENTS.md  -> ~/.codex/AGENTS.md
globals/CLAUDE.md  -> ~/.claude/CLAUDE.md
```

Add a shell alias for the CLI:

```sh
./bin/filip-stack setup
./bin/filip-stack setup --rc-file ~/.zshrc
./bin/filip-stack setup --alias stack-sync
./bin/filip-stack setup --dry-run
```

If `--rc-file` is omitted, setup picks an rc file from the current shell and
falls back to `~/.zshrc`.

## Migration

This repo intentionally retires the old raw-sync model for skills and hooks.

One-time migration:

1. Remove old filip-stack-managed raw skills and hook entries from Claude and Codex host locations.
2. Stop using the old raw skills/hooks sync flow.
3. Run `pnpm install && pnpm build`.
4. Run `./bin/filip-stack install all`.
5. Keep using the CLI only for globals.

## CI

GitHub Actions owns validation and Claude publishing:

- `CI`
  - runs `pnpm typecheck`
  - runs `pnpm test`
  - runs `pnpm build`
  - uploads built artifacts on pushes
- `Publish Claude Marketplace`
  - runs on `main`
  - builds the repo
  - deploys `dist/publish/claude-marketplace/` to GitHub Pages
- `CI` also verifies that `.claude-plugin/marketplace.json` and `plugins/filip-stack/` are in sync with the current Claude build output

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```
