---
related: [review, full-send]
---

## What it does

A merge council is the heavy review for a pull request that matters. Your
agent does not take part. It starts a *chair*, a separate agent that runs the
council: it freezes the PR at its current commits, so the verdict applies to
exactly those commits, and applies fixed rules to the reviewers' findings. A
finding counts as agreed only when all three reviewers agree on the problem,
the fix, and whether it blocks the merge.

## When to use it

Ask for a merge council by name when you want this depth of review. A plain
"review this PR" goes to a lighter review, such as [review](../review/).

The council needs a *roster*, the list of models that act as chair and
reviewers. The first run sets one up for you, and `/merge-council setup` in
Claude or `$merge-council setup` in Codex changes it later. Setup proposes a
model for each role and asks you to confirm or change each one. Call the
council with a PR, for example
`/merge-council https://github.com/acme/app/pull/42`, or with no argument for
the current branch's PR. The host must let an agent start its own helper
agents; if it cannot, the council cannot run there.

## How it works

Each reviewer reads the whole PR and digs deeper into one area:

| Reviewer | Digs into |
| --- | --- |
| Contract and guidance | Correctness, project guidance and patterns, scope |
| Risk | Blast radius, rollback, compatibility, migrations, security, performance |
| Simplicity and evidence | Complexity, reuse, dead code, tests, coverage |

On your own open PR, when you can push to it, the council runs in fix mode.
Findings that all three reviewers agree on and mark as safe to fix go to one
fixer agent, and each pushed fix starts a new full review. A run pushes at most
two fixes. On any other PR, the council only reports.

A PR that changes instruction files such as `AGENTS.md` or `CLAUDE.md` always
ends in `NEEDS_HUMAN`, because those files could steer the reviewers. The
review still runs. A run that exceeds 120 minutes stops as incomplete.

## What you get

- A verdict for the reviewed commits: `APPROVE`, `CHANGES_REQUESTED`, or
  `NEEDS_HUMAN`.
- A short report whose first line says whether the PR can merge, with the items
  to handle before merging and non-blocking findings worth a look.
- A detailed `record.json`. Run the council again after you address the items,
  and it continues from that record.

Before your agent acts on `APPROVE`, it checks that the PR's commits still
match the reviewed ones and that CI passes. It merges only where the repository
allows merging on council approval; otherwise it reports the PR as ready.
[full-send](../full-send/) can finish the open items from a council.
