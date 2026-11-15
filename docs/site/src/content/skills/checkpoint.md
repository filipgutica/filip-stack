---
related: [review, walkthrough]
---

## What it does

A checkpoint separates what was intended, attempted, built, and verified. It
compares claims in the conversation with the repository and check results, so
whoever resumes can see what still needs proof.

## When to use it

Install the skill, then run `/checkpoint` in Claude or `$checkpoint` in Codex
before you pause, hand off work, or record what your checks prove. It runs
only when you call it.

The result stays in the conversation. To save it, say so:

> /checkpoint save it, I'll resume tomorrow

You can name a destination. Otherwise it saves a new Markdown snapshot under
`~/.engineering-workflow/<project-or-subject>/checkpoints/`. Earlier snapshots
stay as they are.

## How it works

The agent checks the repository, branch, current commit, and uncommitted
changes. Plans and earlier claims do not count as proof.

Each verification result names the command, its result, and the commit or
working-tree state it covered. The agent reuses existing evidence instead of
rerunning slow checks, and flags results that later changes made stale. A
check that never ran is reported as not run, never as passed.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/checkpoint/SKILL.md)
has the snapshot format and saving rules.

## What you get

A checkpoint with the parts that apply:

- Source: work item, repository, branch, commit, and relevant uncommitted
  state.
- Completed outcomes with evidence, and remaining work.
- Blockers and decisions needed to resume.
- Verification: what passed, what it covered, and what is unverified.
- Next action: a concrete place to start.

On resume, the agent rechecks live sources before it acts, because the
checkpoint is history. Apart from a snapshot you ask for, checkpoint changes
no files and does not commit or publish.
