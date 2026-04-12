# Filip Stack

Personal source of truth for shared Claude and Codex setup across my machines.

This repo now builds self-contained local plugins for both hosts. It no longer
uses raw synced `skills/` and `hooks/` as the primary install surface.

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
```

`dist/` stays gitignored. After cloning or pulling changes, build locally before
trying to load either plugin.

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

Manifest locations inside the built plugin roots are host-specific:

```text
dist/plugins/claude/filip-stack/.claude-plugin/plugin.json
dist/plugins/codex/filip-stack/.codex-plugin/plugin.json
```

## Install and Update

Build plus persistent install:

```sh
./bin/filip-stack install claude
./bin/filip-stack install codex
./bin/filip-stack install all
```

After changing anything under `plugin/`, rebuild and refresh:

```sh
pnpm build
./bin/filip-stack update claude
./bin/filip-stack update codex
./bin/filip-stack update all
```

Install and update now share the same underlying sync flow:

- build plugin outputs once
- sync Claude state and CLI-managed install/update
- sync Codex state and trigger Codex's own plugin install step

Claude install behavior:

- writes a persistent directory-backed marketplace source into `~/.claude/settings.json`
- refreshes that marketplace through Claude's own CLI
- installs or updates `filip-stack@local-plugins` through Claude's own CLI

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

This repo is intentionally local-plugin-first in v1. Hosted marketplace
distribution is out of scope.

## Included Skills

Both generated plugins include:

- `coordinator`
- `project-notes-tracker`

Codex names plugin-provided skills with the plugin prefix in API responses, for example:

- `filip-stack:coordinator`
- `filip-stack:project-notes-tracker`

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

Planning remains a two-step flow:

- `notes plan: <seed>` appends the seed under `## Planning Seed` and starts coordinator-driven planning while keeping the ticket in `.notes/todo/`
- `notes approve` writes the approved plan into `## Approved Plan`, stamps `started`, and moves the ticket to `.notes/in-progress/`
- `notes complete` writes `## Completion Summary`, stamps `completed`, and moves the ticket to `.notes/complete/`

## CLI

The CLI is now only for globals and shell bootstrap.

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

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```
