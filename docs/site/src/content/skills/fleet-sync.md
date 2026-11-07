---
related: [agent-ready-environments]
---

## What it does

Fleet Sync applies one declared baseline through the same local updater on
every enrolled machine. T3 Code keeps connection credentials and grants;
your policy file owns the selections and exceptions. The result includes
offline and unlinked machines.

## When to use it

Install the skill, then ask:

> $fleet-sync

The agent reads your roster from `~/.config/filip-stack/fleet.json`, or from
`$XDG_CONFIG_HOME/filip-stack/fleet.json`. On first use, identify the machines
to enroll and choose the shared baseline. T3 may ask you to grant access to a
machine. Valid grants and the saved selection are reused on later runs.

## How it works

Each machine runs `filip-stack sync --json` with the shared policy and its
environment ID. Missing baseline skills and plugins are installed; existing
extras remain. Per-machine agent targets and skill/plugin exclusions preserve
exceptions. Existing scopes, enabled states, and explicit pins remain intact.
Missing clients and local edits appear as incomplete components.

The workflow uses a separate clean main clone when a development checkout is
busy. Guidance applied from an unmerged revision is retained until the selected
source contains it or already matches all managed content. Other components
can update while that guidance remains blocked.
Custom Claude/Codex configuration directories require a guidance migration;
the updater reports that component as blocked before writing default locations.

Use `filip-stack sync --dry-run --json` to preview one machine. A preview does
not fetch upstream changes or prove that installed versions are current.

## What you get

A result for every enrolled machine, with the shared policy digest, source
commits, plugin versions, selections, and remaining conflicts or access problems. The command
saves each machine's last result in
`~/.local/state/filip-stack/last-sync.json`, respecting `XDG_STATE_HOME`.

When chezmoi already transports shared Field Guide preferences, the fleet
workflow pulls that source and merges its preferences through the Field Guide
owner. Local unpublished guidance is preserved. Other dotfiles remain outside
that preference refresh, and uninitialized setup phases are left untouched.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/fleet-sync/SKILL.md)
defines the complete workflow.
