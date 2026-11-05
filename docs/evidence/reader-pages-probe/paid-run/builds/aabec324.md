# release-notes

## What it does

Drafts release notes from merged PRs between two tags. It groups PRs by Conventional Commit type, with features, fixes, and breaking changes first, and skips PRs labeled `skip-notes`.

## When to use it

Use it to gather merged PRs and draft release notes for a tag range. Use `technical-writing` to edit the prose.

The skill is manual only:

```text
/release-notes <from-tag> <to-tag>
```

Both tags must exist, and `gh` must be signed in.

## How it works

The skill checks authentication with `gh auth status` and stops if the check fails. It also resolves both tags before drafting. If either tag cannot be resolved, it stops with `TAG_UNRESOLVED`.

It then gathers merged PRs between the tags and groups them by type. For PRs with multiple type labels, grouping counts labels using a strict-majority rule; the code breaks ties by label order.

Every breaking change needs a migration line. If the PR body has none, the draft marks it `TODO: migration`.

## What you get

A `RELEASE_NOTES.md` draft in your working tree, with any missing migration lines marked for completion.

The skill stops after writing the file. It never publishes.
