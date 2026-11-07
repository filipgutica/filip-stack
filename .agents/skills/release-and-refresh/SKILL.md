---
name: release-and-refresh
description: Ship accepted filip-stack changes through a pull request, verify their releases, and refresh the filip-stack CLI, plugins, standalone skills, and host config. Use for an authorized release or host refresh in this repository.
metadata:
  internal: true
---

# Release and refresh

Complete the requested release from the current filip-stack checkout. A full run includes committing and pushing the accepted changes, managing and merging the feature PR and any required CLI release and Homebrew formula PRs after checks, verifying publication, and refreshing the installed CLI, plugins, standalone skills, and host config. Confirm the request covers that scope, including `filipgutica/homebrew-tap` when needed. A single request for this full workflow is sufficient; do not ask again at each step. Respect narrower requests such as review only or refresh only. Skill selection alone does not authorize publication. Reuse authorization already given in the conversation.

This is a repository development skill. Keep it outside `plugins/`; the Claude entrypoint links to this canonical directory. Refresh the filip-stack CLI as below; leave the Claude and Codex binaries at their installed versions. Change global instructions only through host config, as below.

## Establish the release candidate

- Verify the repository identity, current branch, dirty files, upstream, and existing PR. Fetch origin before comparing with main. Preserve unrelated changes and stage only the accepted work.
- Read `.github/workflows/{ci,cli,release}.yml`, `.releaserc.json`, `release-please-config.json`, and the root and CLI package manifests for the current checks and release contracts. Plugins use semantic-release; `cli/` uses release-please with independent `cli-vX.Y.Z` tags. Run `pnpm check`; pnpm switches to the version pinned by `packageManager` in `package.json`, which CI also uses. Report unavailable checks accurately; do not treat a blocked command as passing.
- Review the final diff and apply the appropriate independent review from the engineering workflow. Use a truthful conventional commit. Semantic-release owns version stamping and changelog generation; do not edit versions by hand or manufacture a release-triggering change.

## Publish and merge

1. Commit the accepted files if needed, push the current topic branch, and create or update its PR against main. Describe the actual change and verification. With `gh`, pass multiline descriptions through `--body-file`.
2. Confirm the remote branch SHA equals the local candidate. Merge only after every required check on that exact PR head has passed; failed, pending, or unavailable checks block merging. Resolve applicable review feedback and verify there are no unresolved review threads or blocking reviews.
3. Recheck the PR head and mergeability immediately before merging. Use `gh pr merge <number> --merge --match-head-commit <sha>` when merge commits remain supported. Do not bypass branch protection or force-push to make a merge succeed. If the candidate changes, repeat the affected review and checks.

## Wait for the release

- Record the merge commit. Track the main-branch CI run associated with it, including the release job. Poll in bounded intervals and keep the user informed.
- After success, fetch tags and verify the published GitHub release and tag contain the merged change. Check the tag's package, marketplace, and plugin manifest versions agree. A green PR or a pre-existing latest release is not release evidence.
- If semantic-release produces no release, inspect its result and explain why. Do not silently refresh an older version as if this change shipped. If a run fails, inspect the failure before retrying; stop dependent refresh work until a valid release exists.

When the change touches `cli/`, also track the **Release** workflow and its CLI release PR. Merging the feature PR opens or updates that PR; merging the release PR publishes `cli-vX.Y.Z`. A full release request covers this second PR in filip-stack. Verify its exact head and checks before merging. Release PRs opened with `GITHUB_TOKEN` do not trigger PR workflows; run `ci.yml` and `cli.yml` manually on the release PR branch when needed. A successful release-please run that only opened a PR is not publication evidence.

Verify the published CLI tag contains the requested CLI change and that its `cli/package.json` version equals the tag version. Keep plugin `vX.Y.Z` and CLI `cli-vX.Y.Z` evidence separate. When `cli/` did not change, use the latest published stable CLI release as the refresh target.

## Choose the refresh route

Refresh the launcher with the CLI section below. Install standalone skills newly added by the merged PR with the explicit-host command in the standalone section. Then run `filip-stack sync --json` from the clean canonical main checkout. It owns the normal refresh of existing standalone skills, host config, shared preferences, and installed Claude/Codex plugins. Require a successful result and inspect every component, including pinned and skipped entries. The per-machine JSON report records versions, payload checks, and any local conflict. The remaining manual sections are recovery guidance for a blocked or older installation; do not repeat a successful component's writes.

When the authorized request includes the fleet, use the installed `fleet-sync` standalone skill and its user-owned roster. Account for every enrolled machine, including offline and unlinked environments. Reuse valid T3 grants. Keep missing permissions and machine-local conflicts visible rather than claiming the fleet is current from one successful host. A local-only release request does not expand to the fleet.

## Refresh the filip-stack CLI

Inspect `command -v filip-stack`, `brew list --versions filip-stack`, and `brew info --json=v2 filipgutica/tap/filip-stack`. Update an installed Homebrew CLI with:

```sh
brew update
brew upgrade filipgutica/tap/filip-stack
filip-stack --version
```

Compare the installed formula and CLI version with the published `cli-vX.Y.Z` release. The tap's **Update formulae** workflow selects CLI tags, creates the first formula when a CLI release exists, and opens a separate formula PR. A GitHub release alone does not make it available to Homebrew. When the formula is absent or behind, inspect the workflow and formula PR. With authorization covering the tap, trigger the workflow if needed, verify the formula's tag and checksum, and merge its exact head after all applicable checks and reviews pass. Otherwise, report the pending PR. Leave the CLI refresh incomplete until the formula ships.

Verify `command -v filip-stack` resolves to the Homebrew command. A legacy `~/.local/bin/filip-stack` symlink can shadow it; report that path and the correction needed rather than claiming the new executable is active. Preserve installations managed by another method, and report a missing CLI without installing one unless the request authorizes installation. Record the actual version and executable path.

## Refresh standalone skills

Standalone skills in `skills/` ship from `main` when they merge; semantic-release does not version them. Find the installed ones in `~/.agents/.skill-lock.json` entries whose `source` is `filipgutica/filip-stack`, and note each skill's current hosts: Codex reads `~/.agents/skills/<name>`, and Claude reads a `~/.claude/skills/<name>` link.

Also find the standalone skills the merged PR added: `git diff --diff-filter=A --name-only <merge commit>^1 <merge commit> -- 'skills/*/SKILL.md'`. Install each new skill for Claude and Codex. A skill that existed before this PR and is not installed was left out on purpose; leave it out.

Reinstall the installed skills and install the new ones in one command, with hosts named explicitly. Do not use `npx skills update`: it reinstalls into every detected agent.

```sh
npx skills add filipgutica/filip-stack -g -a claude-code codex -s <names> -y
```

Run a separate command without `claude-code` for installed skills that have no Claude link. The command installs the current `main`, so record `git ls-remote origin main` just before it runs. Verify that each installed directory matches `skills/<name>` at that revision, that the lock records the filip-stack source, and that no new host directory appeared. If `main` has advanced past the merge commit, report the installed revision.

## Refresh host config

Host config ships from `main` without a version. On every release, run `status` from a checkout on `main`: the first entry of `git worktree list` when it is on `main` and clean. It catches drift from a hand edit or an earlier merge that skipped this step. Run `update` when the merged PR changed `host-config/` or `scripts/host-config.mjs`, or when `status` lists any target that is not `current`.

```sh
node <main checkout>/scripts/host-config.mjs status
node <main checkout>/scripts/host-config.mjs update
```

`update` pulls with `--ff-only` and applies. When `status` lists an `edited` or `edited-remove` target, stop and show the user its diff. Use `--force` only with their approval, because it overwrites the local edit and keeps it as `<file>.bak`. Afterwards, `status` must show the merge commit or a later one as applied, and every target as `current`.

## Refresh both hosts

Inspect installed plugin inventory and current CLI help first; command syntax can change. Refresh only the installed filip-stack plugins, preserving their scope and enabled state. The current marketplace is named `filip-stack`, with Workflow and Field Guide installed in both hosts.

Run only the commands applicable to the discovered installations. The Claude examples assume both plugins are installed at user scope; pass the actual installed scope when needed.

```sh
codex plugin marketplace upgrade filip-stack
codex plugin list --marketplace filip-stack
claude plugin marketplace update filip-stack
claude plugin update workflow@filip-stack -y
claude plugin update field-guide@filip-stack -y
claude plugin list
```

Codex marketplace upgrade refreshes its Git snapshot. Verify installed payloads afterward; if they remain stale, inspect `codex plugin add --help` for the supported reinstall/update path rather than editing caches manually. Use the relevant host CLI for installation changes. Preserve any explicit marketplace pin; do not repoint a pinned source without authorization.

Verify each host's installed inventory, cache path, and manifest version against the release. Compare installed runtime files with the tagged `plugins/<name>/` source; distinguish host-generated metadata from source files. Check Workflow has no hooks, Field Guide has its expected hooks, and development assets have not entered either payload. Cache-directory existence alone is insufficient. If main has advanced, identify the actual installed commit/version instead of assuming it matches the target release.

Report the PR, release tag, checks, CLI version and executable path, verified plugin versions for each host, the standalone skills refreshed and newly installed, and the host config commit applied. Tell the user to restart Claude and start a fresh Codex thread to load the updated plugins. Do not close active sessions for them. If the CLI or either host cannot update, report its actual state and the remaining action without claiming the whole release is complete.
