---
related: [review, walkthrough]
---

## What it does

A checkpoint separates what was intended, attempted, built, and verified, so
whoever resumes can see what still needs proof.

## When to use it

Install the skill, then run `/checkpoint` in Claude or `$checkpoint` in Codex
before you pause, hand off work, or record what your checks prove. It runs
only when you call it.

The result stays in the conversation unless you ask to save it:

> /checkpoint save it, I'll resume tomorrow

Without a destination, it saves a new Markdown snapshot under
`~/.engineering-workflow/<project-or-subject>/checkpoints/`.

## How it works

The agent checks the repository, branch, commit, and uncommitted changes.
Plans and earlier claims do not count as proof.

Each verification result names the command, its result, and the state it
covered. The agent reuses existing evidence and flags results that later
changes made stale. A check that never ran is
reported as not run.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/checkpoint/SKILL.md)
has the snapshot format and saving rules.

## What you get

A checkpoint with the parts that apply:

- Source: work item, repository, branch, commit, and uncommitted state.
- Completed outcomes with evidence, and remaining work.
- Blockers and decisions needed to resume.
- Verification: what passed, what it covered, and what is unverified.
- Next action: a concrete place to start.

On resume, the agent rechecks live sources first, because the checkpoint is
history. Apart from a snapshot you ask for, checkpoint changes no files.
