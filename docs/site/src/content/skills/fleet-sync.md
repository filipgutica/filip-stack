---
related: [agent-ready-environments]
---

## What it does

Give fleet-sync a shared **policy** file listing your machines, a **baseline**
of skills and plugins, and per-machine exceptions, or name them on the first
run. The agent runs the updater on enrolled machines to apply updates or
inspect drift, expanding to every linked T3 Code machine only when you ask. T3
Code keeps credentials and access grants. You get a per-machine report of
commits, plugin versions, conflicts, and next actions.

## When to use it

Install the skill, then ask to sync your fleet or inspect drift:

> Sync the fleet and report any machines that are out of sync.

The agent reads `~/.config/filip-stack/fleet.json` (or under
`$XDG_CONFIG_HOME`). Pick machines and a baseline on the first run. Later runs reuse them. The
[README](https://github.com/filipgutica/filip-stack#sync-this-machine-or-the-fleet)
shows an example policy. Outside T3 Code, it uses only a configured remote
method and never creates SSH access.

## How it works

1. **Match machines.** Checks linked T3 Code environments, requests missing or
   expired links, and continues with reachable machines.
2. **Use clean `main`.** Uses a clean clone when your checkout is busy.
   Inspections use existing source without fetching.
3. **Merge Field Guide preferences.** Before running the updater, if chezmoi
   manages Field Guide files, a refresh pulls and merges them without touching
   other dotfiles.
4. **Sync safely.** Runs `filip-stack sync` (`--dry-run` for inspections).
   Missing baseline items install, existing ones refresh, and `design-system`
   updates from its own marketplace. Extras, exclusions, pins, and local
   guidance stay intact. A published skill that a machine has not installed,
   that is not in the baseline, and that it does not exclude is listed as
   `unselected` in the JSON report, not installed.
5. **Isolate conflicts.** Local edits, missing clients, and unmerged guidance
   stay put without blocking other items.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/fleet-sync/SKILL.md)
defines the workflow.

## What you get

- One row per enrolled machine, including offline or denied ones, with policy
  digest, commits, plugin versions, conflicts, and next actions.
- After a refresh, each machine's last-run report at the returned path
  (`--dry-run` returns JSON without saving a report).
- A reminder to restart Claude and open a new Codex thread for updated plugins.
