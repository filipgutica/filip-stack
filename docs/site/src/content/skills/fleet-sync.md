---
related: [agent-ready-environments]
---

## What it does

Each machine runs the same local updater, `filip-stack sync`, against one
shared policy. T3 Code keeps the connection credentials and access grants.
Your policy file decides what each machine gets. The result lists every
enrolled machine, including offline and unlinked ones.

## When to use it

Install the skill, then ask:

> $fleet-sync

The agent reads your machine list from `~/.config/filip-stack/fleet.json`, or
`$XDG_CONFIG_HOME/filip-stack/fleet.json`. The first time, you pick the
machines to enroll and the shared baseline. T3 may ask you to grant access to
a machine. Later runs reuse valid grants and the saved selection. The
[README](https://github.com/filipgutica/filip-stack#sync-this-machine-or-the-fleet) shows an
example policy.

## How it works

Each machine runs `filip-stack sync --json` with the shared policy and its
environment ID, then saves the policy as its own. If its saved policy
differs, it backs that up first.

- Missing baseline skills and plugins are installed. Existing extras stay.
- Per-machine agent targets and exclusions keep each machine's exceptions.
- Scopes, enabled states, and explicit pins stay as they are.
- Missing clients and local edits show up as incomplete components.

When a development checkout is busy, the workflow uses a separate clean clone
of `main`. Guidance applied from an unmerged revision stays in place until
the source contains it; other components still update. A custom Claude or
Codex configuration folder blocks the guidance component until you migrate
it.

To preview one machine, run `filip-stack sync --dry-run --json`. A preview
does not fetch upstream changes, so it does not prove versions are current.

## What you get

A result for each enrolled machine: the shared policy digest, source commits,
plugin versions, selections, and any conflicts or access problems. Each
machine saves its last result in `~/.local/state/filip-stack/last-sync.json`,
or under `XDG_STATE_HOME`.

If chezmoi already carries your shared Field Guide preferences, the workflow
pulls them and merges them through Field Guide. Local unpublished guidance
stays. It does not refresh your other dotfiles.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/fleet-sync/SKILL.md)
defines the complete workflow.
