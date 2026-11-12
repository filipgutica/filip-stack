---
related: [review, walkthrough]
---

## What it does

A checkpoint distinguishes intended, attempted, implemented, and verified
outcomes. It compares conversation claims with current repository and check
evidence, so the person resuming can see what still needs proof.

## When to use it

Install the skill with the command above. Checkpoint runs only when you
invoke it: `/checkpoint` in Claude or `$checkpoint` in Codex.
Use it before pausing work, handing it off, or recording what your checks prove.

The default result stays in conversation. Add a save request for a file, for
example `/checkpoint save it, I'll resume tomorrow`. You can supply
a destination; otherwise a new Markdown snapshot goes under
`~/.engineering-workflow/<project-or-subject>/checkpoints/`. Earlier snapshots
stay intact.

## How it works

The agent checks the repository, branch, current commit, and uncommitted
changes. Plans and earlier agent claims do not prove completion.

Each verification result names the command, result, and commit or working-tree
state it covered. The agent reuses available evidence instead of rerunning
expensive checks just for the checkpoint. It flags results made stale by later
changes. A required check that never ran remains unrun, never passed.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/checkpoint/SKILL.md)
has the snapshot format and saving rules.

## What you get

A checkpoint with the applicable parts:

- Source: work item, repository, branch, commit, and relevant dirty state.
- Completed outcomes with evidence, and remaining work.
- Blockers and decisions needed to resume.
- Verification: what passed, what it covered, and what remains unverified.
- Next action: a concrete starting point.

On resume, the agent rechecks live sources before acting; the checkpoint is
historical. Apart from a requested snapshot, checkpoint changes no files and
does not commit or publish.
