---
related: [agent-ready-environments]
---

## What it does

Each machine runs the same local updater, `filip-stack sync`, against one
shared policy that decides what each machine gets. T3 Code keeps the
connection credentials and access grants. The result lists every enrolled
machine, including offline and unlinked ones.

## When to use it

Install the skill, then ask:

> $fleet-sync

The agent reads your machine list from `~/.config/filip-stack/fleet.json`, or
`$XDG_CONFIG_HOME/filip-stack/fleet.json`. The first time, you pick the
machines and the shared baseline. Later runs reuse the saved selection and
access grants. The
[README](https://github.com/filipgutica/filip-stack#sync-this-machine-or-the-fleet) shows an
example policy.

## How it works

Each machine runs `filip-stack sync --json` with the shared policy and its
environment ID, then saves the policy.

- Missing baseline skills and plugins are installed. Existing extras stay.
- Per-machine agent targets and exclusions keep each machine's exceptions.
- Scopes, enabled states, and explicit pins stay as they are.
- Missing clients and local edits show up as incomplete components.

When a development checkout is busy, the workflow uses a clean clone of
`main`. Guidance applied from an unmerged revision stays until the source
contains it. A custom Claude or Codex configuration folder blocks the
guidance component until you migrate it.

To preview one machine, run `filip-stack sync --dry-run --json`. A preview
does not fetch upstream changes, so it does not prove versions are current.

## What you get

A result for each enrolled machine: the policy digest, source commits, plugin
versions, selections, and any conflicts or access problems. Each machine
saves its last result in `~/.local/state/filip-stack/last-sync.json`, or
under `XDG_STATE_HOME`.

If chezmoi carries your shared Field Guide preferences, the workflow pulls
and merges them through Field Guide, without refreshing your other dotfiles.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/fleet-sync/SKILL.md)
defines the complete workflow.
