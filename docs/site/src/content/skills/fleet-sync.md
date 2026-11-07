---
related: [agent-ready-environments]
---

## What it does

Fleet Sync uses the same local updater on every enrolled machine. It keeps a
roster of environment IDs and labels, while T3 Code keeps connection credentials
and access grants. The result includes offline and unlinked machines.

## When to use it

Install the skill, then ask:

> Sync filip-stack across my fleet.

The agent reads your roster from `~/.config/filip-stack/fleet.json`, or from
`$XDG_CONFIG_HOME/filip-stack/fleet.json`. On first use, identify the machines
to enroll. T3 may ask you to grant access to a machine. Valid grants are reused.

## How it works

Each machine runs `filip-stack sync --json`. That command updates its clean
main checkout, applies managed guidance, and refreshes its existing filip-stack
standalone skills and Claude/Codex plugins. It preserves local guidance and
installation choices. Local edits stop the affected component and appear in
the result.
Custom Claude/Codex configuration directories require a guidance migration;
the updater reports that component as blocked before writing default locations.

Use `filip-stack sync --dry-run --json` to preview one machine. A preview does
not fetch upstream changes or prove that installed versions are current.

## What you get

A result for every enrolled machine, with source commits, plugin versions,
skill selections, and any remaining conflicts or access problems. The command
saves each machine's last result in
`~/.local/state/filip-stack/last-sync.json`, respecting `XDG_STATE_HOME`.

Shared Field Guide preferences still use your configured dotfile transport.
The updater merges the local preferences file; it does not distribute that file.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/fleet-sync/SKILL.md)
defines the complete workflow.
