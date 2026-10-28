---
related: [full-send, sol-loop, babysit-pr]
---

## What it does

Full stop does the same work as [full-send](../full-send/): proof, Sol review
of the code and PR description, and CI and review-bot babysitting. It stops
with the PR ready for you to merge and never merges it. Adapted from
[tstack](https://github.com/t3dotgg/tstack).

## When to use it

- Finish a change while you are not watching the thread, but keep the merge
  for yourself.
- Get an existing PR to a readiness verdict without the risk of a merge.

It runs only when you call it by name, with `/full-stop` or `$full-stop`.
It requires [full-send](../full-send/), [sol-loop](../sol-loop/), and
[babysit-pr](../babysit-pr/), and stops if any is missing.

## How it works

1. Follows full send's modes, proof, review, babysitting, and rules for asking
   you, but always uses verdict mode.
2. In fix mode, turns off auto-merge and takes the PR out of any merge queue
   before work begins, and checks again before each push. On someone else's
   PR, it reports those settings instead of changing them.
3. Uses full send's merge gate as the readiness check. Proof and review must
   cover the final diff.
4. Checks the live PR before the handoff: open, not a draft, and not set to
   merge without you.

## What you get

- `PASS: ready to merge`, `PASS: ready for human review`, or `FAIL` with the
  main reason.
- The PR and final head, proof, review outcomes, decisions, and confirmation
  that the PR is still open and unmerged.

Invocation grants branch commits and pushes in fix mode, but never merging,
auto-merge, a merge queue, or a push to the default branch.
