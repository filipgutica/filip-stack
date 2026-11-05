---
related: [review, walkthrough]
---

## What it does

When you stop work in the middle, the conversation alone can overstate what
is done. Checkpoint compares what was said with what the repository and
checks show now. It labels each outcome as intended, attempted, implemented,
or verified, so whoever resumes knows what still needs proof.

## When to use it

- Pause work and leave a clear starting point for later.
- Hand work to another person or agent, with the decisions they need.
- Record what your checks actually prove before you leave a task.

Checkpoint runs only when you call it: `/workflow:checkpoint` in Claude or
`$workflow:checkpoint` in Codex. It comes with the
[Workflow plugin](../../#install). Add "save it" when you want a file, for
example `/workflow:checkpoint save it, I'll resume tomorrow`.

## How it works

The agent reads the current state first: for a repository, the branch, the
current commit, and any uncommitted changes. Plans and earlier agent claims do
not count as proof that something is done.

For each check, it records the command, the result, and the commit or
working-tree state it covered. It uses results that already exist instead of
rerunning slow checks just for the checkpoint. A result that a later change
made stale is flagged. A required check that never ran is listed as unrun,
never as passed.

The checkpoint stays in the conversation unless you ask to save it. A saved
checkpoint is a new Markdown file, by default under
`~/.engineering-workflow/<project-or-subject>/checkpoints/`, and earlier
checkpoints are kept.

## What you get

A checkpoint with these parts, leaving out any that are empty:

- Source: the work item, repository, branch, and commit.
- Completed, with evidence, and Remaining.
- Blockers and decisions.
- Verification: what passed, what it covered, and what is unverified.
- Next action: a concrete place to start.

When you resume from a checkpoint, the agent rechecks the repository before it
acts, because the checkpoint describes the past. Apart from the saved file,
checkpoint changes nothing and does not commit or publish.
