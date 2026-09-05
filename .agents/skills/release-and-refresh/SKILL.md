---
name: release-and-refresh
description: Ship accepted filip-stack changes through a pull request, wait for semantic-release, and refresh the released plugins in local Claude and Codex installations. Use for an authorized release or host refresh in this repository.
---

# Release and refresh

Complete the requested release from the current filip-stack checkout. For a full run, confirm the user request authorizes committing the accepted changes, pushing the branch, creating or updating its PR, merging after checks, waiting for release, and refreshing the installed filip-stack plugins in Claude and Codex. A single request for this full workflow is sufficient; do not ask again at each step. Respect narrower requests such as review only or refresh only. Skill selection alone does not authorize publication. Reuse authorization already given in the conversation.

This is a repository development skill. Keep it outside `plugins/`; the Claude entrypoint links to this canonical directory. Do not upgrade host binaries or change global instructions as part of a plugin refresh.

## Establish the release candidate

- Verify the repository identity, current branch, dirty files, upstream, and existing PR. Fetch origin before comparing with main. Preserve unrelated changes and stage only the accepted work.
- Read `.github/workflows/ci.yml`, `.releaserc.json`, and `package.json` for the current checks and release contract. Use the pnpm major version declared by CI and run `pnpm check` (currently pnpm 10; `npx --yes pnpm@10 check` selects it when the host has another major). Report unavailable checks accurately; do not treat a blocked command as passing.
- Review the final diff and apply the appropriate independent review from the engineering workflow. Use a truthful conventional commit. Semantic-release owns version stamping and changelog generation; do not edit versions by hand or manufacture a release-triggering change.

## Publish and merge

1. Commit the accepted files if needed, push the current topic branch, and create or update its PR against main. Describe the actual change and verification. With `gh`, pass multiline descriptions through `--body-file`.
2. Confirm the remote branch SHA equals the local candidate. Merge only after every required check on that exact PR head has passed; failed, pending, or unavailable checks block merging. Resolve applicable review feedback and verify there are no unresolved review threads or blocking reviews.
3. Recheck the PR head and mergeability immediately before merging. Use `gh pr merge <number> --merge --match-head-commit <sha>` when merge commits remain supported. Do not bypass branch protection or force-push to make a merge succeed. If the candidate changes, repeat the affected review and checks.

## Wait for the release

- Record the merge commit. Track the main-branch CI run associated with it, including the release job. Poll in bounded intervals and keep the user informed.
- After success, fetch tags and verify the published GitHub release and tag contain the merged change. Check the tag's package, marketplace, and plugin manifest versions agree. A green PR or a pre-existing latest release is not release evidence.
- If semantic-release produces no release, inspect its result and explain why. Do not silently refresh an older version as if this change shipped. If a run fails, inspect the failure before retrying; stop dependent refresh work until a valid release exists.

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

Report the PR, release tag, checks, and verified versions for each host. Tell the user to restart Claude and start a fresh Codex thread to load the updated plugins. Do not close active sessions for them. If either host cannot update, report its actual state and the remaining action without claiming the whole release is complete.
