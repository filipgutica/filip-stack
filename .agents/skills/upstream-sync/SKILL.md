---
name: upstream-sync
description: Compare filip-stack's adapted skills with their upstream sources since the recorded baseline commits and propose which changes to adopt.
disable-model-invocation: true
---

# Upstream sync

Run only when the user invokes this skill. Review is read-only; edits need separate authorization.

`plugins/workflow/THIRD_PARTY_NOTICES.md` lists each upstream source, any tracked path, and the baseline commit the adaptation was last reviewed against.

## Compare

For each source, or the one the user names:

1. Read the baseline and the local files that adapt it. The notice says what was adopted and what was deliberately left out.
2. List upstream commits from the baseline to the default branch head, limited to the tracked path when one is recorded, for example `gh api "repos/<owner>/<repo>/compare/<baseline>...HEAD"`.
3. Read the diffs of the changed guidance files. Skip formatting, release, and changes to skills Workflow does not adapt.

## Classify

Put each meaningful upstream change in one group:

- **Adopt:** it fixes a failure mode or adds a rule that fits Workflow's scope, authority boundaries, and host-neutral wording. Name the local file and the smallest edit.
- **Skip:** it conflicts with a documented local adaptation, duplicates existing guidance, or adds procedure without a failure it prevents. Give the reason.
- **Unsure:** it needs an eval or a user decision.

Report each source with its baseline, upstream head, and grouped changes with commit links.

## Apply

When the user authorizes edits, change only the adopted guidance, then run `pnpm check`. Advance a source's baseline to the reviewed upstream head only when every change in that range is adopted, skipped, or explicitly deferred. Ship through `release-and-refresh` when publication is authorized.
