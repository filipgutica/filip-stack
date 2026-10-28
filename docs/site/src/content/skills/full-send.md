---
related: [sol-loop, babysit-pr, merge-council]
---

## What it does

Full send takes a local change or pull request through proof, review, and CI
to a merge or a readiness verdict. It can also finish open items from an
earlier merge council. Adapted from [tstack](https://github.com/t3dotgg/tstack).

## When to use it

- Finish a change while you are not watching the thread.
- Take an existing PR to merge when the skill's permission checks allow it.
- Get a `PASS` or `FAIL` verdict for human review.

It runs only when you call it by name, with `/full-send` or `$full-send`.
It requires [sol-loop](../sol-loop/) and [babysit-pr](../babysit-pr/) and stops
if either is missing. For a full three-member review, use
[merge-council](../merge-council/).

## How it works

1. Determines whether it can fix and push, and whether it can merge or must
   return a verdict. Those modes are checked again before finishing.
2. Gets direct proof for each change. It runs the app for UI or runtime
   behavior rather than relying only on mocked tests.
3. Writes or reads the PR title and description, then sends both with the
   code to Sol for review.
4. Opens a non-draft PR if needed and babysits CI and review bots. In fix
   mode, it proves routine corrections before pushing them.
5. Resolves earlier council items through accepted fixes or your explicit
   decisions. Contract, security, dependency, and data changes need your decision.
6. Checks proof, Sol approval, council items, required checks, reviews, branch
   freshness, and mergeability on the latest commit. It never bypasses the gate.

## What you get

- `Merged: <merge commit>`, `PASS: ready for human review`, or `FAIL` with the main reason.
- The PR, proof, review outcomes, decisions, and any action you must take.

Invocation grants branch commits and pushes in fix mode and merging in merge
mode. Review-only mode reports findings without pushing.
