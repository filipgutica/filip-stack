---
name: fleet-sync
description: Refresh filip-stack guidance, standalone skills, and plugins across an enrolled T3 Code fleet. Use for fleet updates or to check which machines remain out of sync.
---

# Fleet sync

Run the same per-machine updater across an explicit fleet, then account for every enrolled machine.

## Establish the fleet

Read `$XDG_CONFIG_HOME/filip-stack/fleet.json`, or `~/.config/filip-stack/fleet.json` when unset. The file is user-owned metadata, not a credential store:

```json
{
  "version": 1,
  "environments": [
    { "environmentId": "an-environment-id", "label": "a-machine" }
  ]
}
```

If no roster exists, enroll the machines the user identifies. In T3, get the local identity with `t3_environment_read` and the agent's existing grants with `t3_environment_links`. A linked-environment list is not the client's saved-connection inventory. Ask for the missing fleet scope when neither the user nor a roster supplies it. Store only confirmed IDs and labels; T3 owns addresses, credentials, and access grants.

For every enrolled remote machine, match its ID against the linked list. Request a missing or expired link with `t3_environment_link`, passing its ID and label as the hint. Request only the access needed for the authorized refresh. A pending card is an automatic wait; resume when its result arrives. A permission denial or offline machine remains an explicit incomplete result. Continue reachable machines. Keep valid grants; do not relink each run.

Outside T3, use only a user-configured remote execution method. A fleet roster does not authorize discovering credentials or creating SSH access.

## Run the updater

For an update, run `filip-stack sync --json` on each machine. For an inspection request, run `filip-stack sync --dry-run --json`; report it as a plan, not verified freshness. Use the canonical `main` checkout and the installed command's `--repo` option when its location differs.

If the launcher predates `sync`, verify a clean canonical main checkout, fast-forward it from its existing origin, and run `node <checkout>/scripts/sync.mjs --json` directly. Report the older launcher separately. Refresh a Homebrew launcher only when the user authorized it, checking that the operation will not upgrade unrelated dependencies. Leave Claude, Codex, runtimes, services, and unrelated packages at their installed versions.

Use local tools for the current machine. For another linked T3 machine, use `delegate_task` with `target.environmentId` and its filip-stack project ID from `t3_project_list`. Read `orchestrator_capabilities` before the first delegate. Use the host's available Implementer target; disclose any required fallback. Give the child only this outcome, its host's applicable rules, the canonical checkout, the command, the boundaries below, and the required report. The child does its work without further delegation. Follow async completion instructions; do not poll or open a top-level thread.

The updater refreshes existing filip-stack installations. It preserves plugin enabled states, scopes, explicit pins, skill host assignments, and local text outside managed guidance blocks. A local edit or an unverifiable installation is a conflict, not permission to force replacement. Preserve the file and report the exact blocker. New installations and baseline changes require a user-selected list; omitted items remain installed.

## Accept the result

Require exit status and the complete JSON result from every machine. Read a delegated result before accepting its claims. Check:

- Source commit and every component's state; a failed component cannot become an overall success.
- Guidance applied commit and target count, skills and their host assignments, plugin versions and verified payloads.
- Explicitly pinned, disabled, missing, blocked, and unreachable components.
- Preservation of machine-local rules and unrelated installations.

Compare observed commits and versions across machines. Different pins or installation selections may be intentional; label them. If an upstream update landed during the run, report that difference and rerun the affected machines against the current source when authorized. Do not call different versions synchronized.

Return one row per enrolled machine, including those that could not run. Name the remaining action beside each incomplete result. Keep the per-machine last-run report at the path returned by the command. Tell the user to restart Claude and start a fresh Codex thread to load updated plugins; keep their active sessions running.
