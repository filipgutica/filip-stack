---
related: [review, walkthrough]
---

## What it does

Run checkpoint on the work to record, and ask to save it for a file. Unlike
[catch-up](../catch-up/), which reads only chat, checkpoint inspects your live
repo, branch, commit, uncommitted changes, or tracker. It separates intended,
attempted, implemented, and verified work from current evidence. You get a
handoff summary in chat or a saved Markdown file.

## When to use it

Run `/checkpoint` in Claude or `$checkpoint` in Codex before pausing, handing
off work, or recording check evidence. It runs only when invoked.

To save a file instead of keeping it in chat:

> /checkpoint save it, I'll resume tomorrow

If you ask to save without giving a path, it writes to
`~/.engineering-workflow/<project-or-subject>/checkpoints/`. For a four-line
chat reminder, use [catch-up](../catch-up/).

## How it works

1. **Inspect live state.** Checks repo, branch, `HEAD`, and uncommitted
   changes, keeping unrelated edits intact.
2. **Verify claims.** Compares earlier claims against live evidence, since
   plans are not proof.
3. **Audit checks.** Reuses check results, flags stale ones, and marks unrun
   checks as not run.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/checkpoint/SKILL.md)
has the format and saving rules.

## What you get

- **Source:** work item or document, plus repo, branch, commit, and dirty state
  when code is involved.
- **Completed and Remaining:** confirmed outcomes and open work.
- **Blockers and decisions:** items needed to resume.
- **Verification:** commands, results, covered state, and gaps.
- **Next action:** concrete starting point.

On resume, recheck live sources first. Except for a requested snapshot,
checkpoint changes no files.
