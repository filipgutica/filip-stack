# Filip Stack

Personal source of truth for shared Claude and Codex setup across my machines.

This is intentionally small. It is not a product, a package, or a configuration
management system.

## What Syncs

By default, sync copies:

- shared skills
- hook scripts and hook-specific config

Global files are ignored by default and only sync when explicitly requested.

## Usage

Install dependencies and build the CLI after cloning or pulling changes:

```sh
pnpm install
pnpm build
```

Then run sync:

```sh
./bin/filip-stack
./bin/filip-stack --skills
./bin/filip-stack --hooks
./bin/filip-stack --globals
./bin/filip-stack --all
./bin/filip-stack --dry-run
./bin/filip-stack --interactive
./bin/filip-stack setup
```

Scope flags:

- no scope flags: sync skills and hooks
- `--skills`: sync only skills
- `--hooks`: sync only hooks
- `--globals`: sync only global files
- `--all`: sync skills, hooks, and globals
- `--all` cannot be combined with `--skills`, `--hooks`, or `--globals`
- `--interactive`: choose scopes interactively
- `--interactive` cannot be combined with scope flags

`--dry-run` can be combined with any scope flag and prints the planned changes
without writing to the target machine.

`--dry-run` can also be combined with `--interactive`.

## Setup Command

Use `setup` to add a shell alias so the CLI can be called from anywhere:

```sh
./bin/filip-stack setup
```

By default, this appends an idempotent entry to your shell rc file:

```sh
alias filip-stack="/path/to/filip-stack/bin/filip-stack"
```

After opening a new shell or reloading the rc file, run sync from any directory:

```sh
filip-stack
filip-stack --all
filip-stack --interactive
```

Choose a specific rc file:

```sh
./bin/filip-stack setup --rc-file ~/.zshrc
./bin/filip-stack setup --rc-file ~/.bashrc
```

Choose a different alias name:

```sh
./bin/filip-stack setup --alias stack-sync
stack-sync --dry-run
```

Preview the rc-file change without writing:

```sh
./bin/filip-stack setup --dry-run
./bin/filip-stack setup --rc-file ~/.zshrc --dry-run
```

If `--rc-file` is omitted, setup picks an rc file from the current shell and
falls back to `~/.zshrc`. Setup can be run repeatedly; if the alias marker is
already present, it leaves the rc file unchanged.

The CLI is written in TypeScript. Built output in `dist/` is generated locally
and is not committed. If `./bin/filip-stack` reports that `dist/cli.js` is missing,
run `pnpm install && pnpm build`.

## Hook Sync

Hooks are config-driven for both Claude and Codex. Syncing hooks now does two
things:

- copies hook scripts
- updates the tool-specific hook config needed to activate them
- enables shared project-notes tracking hooks for both hosts

Claude hooks:

- `hooks/claude/scripts/*` -> `~/.claude/hooks/`
- `hooks/claude/hooks.json` merges into `~/.claude/settings.json`

Codex hooks:

- `hooks/codex/scripts/*` -> `~/.codex/hooks/`
- `hooks/codex/hooks.json` merges into `~/.codex/hooks.json`
- `~/.codex/config.toml` is updated to ensure `[features].codex_hooks = true`

Repo hook config fragments are expected to contain a top-level `hooks` object.
Unrelated existing user settings are preserved.
The checked-in hook fragments install a shared project-notes tracker for both hosts.

The notes hooks use these repo-local conventions:

- `.notes/todo/`, `.notes/in-progress/`, and `.notes/complete/` hold tracked Markdown tickets
- `.notes/.runtime/` stores machine-managed session bindings and transient hook state and should stay untracked
- `SessionStart` ensures `.notes/` exists and restores ticket bindings
- `UserPromptSubmit` supports `notes create: <title>`, `notes use: <ticket>`, `notes plan: <seed>`, `notes approve`, and `notes bypass`
- `UserPromptSubmit` also reminds the model to keep the linked `## Work Log` updated during normal tracked work once the ticket has an approved plan
- `PreToolUse` blocks mutating work when the session has no bound ticket or the ticket has no approved plan

`notes bypass` is session-only. After that prompt, the next prompt becomes the bypass reason unless it is `cancel`.

Planning is now a two-step flow:

- `notes plan: <seed>` tells the model to add the seed under `## Planning Seed` and start planner-driven planning while keeping the ticket in `.notes/todo/`
- Claude can enter planning flow directly; Codex should tell the user to switch to Plan Mode and use `$planner`
- `notes approve` tells the model to write the approved plan into `## Approved Plan`, set `status: "in-progress"`, stamp `started`, and move the ticket to `.notes/in-progress/`
- Tickets should define `## Completion Criteria` once the approved plan is known so the agent can tell when to move them to `.notes/complete/`

## Destinations

```text
skills/*           -> ~/.agents/skills/
hooks/codex/scripts/*   -> ~/.codex/hooks/
hooks/shared/*          -> ~/.codex/hooks/ and ~/.claude/hooks/
hooks/codex/hooks.json  -> ~/.codex/hooks.json (merged)
hooks/claude/scripts/*  -> ~/.claude/hooks/
hooks/claude/hooks.json -> ~/.claude/settings.json (merged)
globals/AGENTS.md  -> ~/.codex/AGENTS.md
globals/CLAUDE.md  -> ~/.claude/CLAUDE.md
```

## Sync Model

Sync is additive and update-oriented:

- create missing files and directories from this repo
- overwrite files and directories that collide with repo-managed names
- do not delete extra local files or directories
- do not use destructive mirroring such as `rsync --delete`

Different local names are safe and left alone. Matching names are considered
repo-managed and may be overwritten by sync.

The Node implementation uses native filesystem APIs rather than shelling out to
`rsync`.

## Included Skills

This repo currently syncs these named shared skills:

- `implementer`
- `investigator`
- `planner`
- `preview-package-install`
- `project-notes-tracker`
- `reviewer`

It intentionally excludes `data-service-review` because that skill is specific
to one environment. Hidden `.system` skills are also excluded.

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```
