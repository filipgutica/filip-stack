---
related: [full-stop, sol-loop, babysit-pr, merge-council]
---

## What it does

One Sol reviewer checks the code and PR description through
[sol-loop](../sol-loop/). The agent then opens or updates the PR, handles CI
and bot findings, and makes routine decisions while you are away. For three
reviewers, use [merge-council](../merge-council/); full send can also finish
its open items.

## When to use it

Use full send for a local change or existing PR you want finished, including
merging when its mode and checks permit. To keep the merge decision, use
[full-stop](../full-stop/).

Install `full-send`, `sol-loop`, and `babysit-pr` together: replace
`-s full-send` in the command above with `-s full-send sol-loop babysit-pr`.
It stops if either dependency is missing.

Invoke it explicitly with `/full-send` in Claude or `$full-send` in Codex.
Include a goal or PR link, for example `/full-send fix the flaky login test`.

Calling it authorizes commits and pushes to the PR's branch in fix mode,
`--force-with-lease` after a rebase of that branch, and merging in merge mode.

## How it works

The agent selects two modes at the start and checks them again before finishing:

| Mode | Applies when | Result |
| --- | --- | --- |
| Fix | You authored the PR, or it does not exist yet, and you can push to its head repository | Commit and push fixes on its branch |
| Review only | Fix mode does not apply | Report findings without pushing |
| Merge | Fix mode applies, you can push to the base repository, and the review decision permits it | Merge after the full gate passes |
| Verdict | Merge mode does not apply | Return PASS or FAIL without merging |

Proof must come from evidence the agent observes in the session: a failing
then passing reproduction, repository CI checks, or the running app for UI
and runtime behavior. Mocked tests alone do not prove the user experience.

Routine fixes stay in the loop. Public-contract, migration, data, security,
and dependency changes need your decision. So does removing a test without
proof that a named remaining test covers it. The agent also asks when proof
is unavailable, the goal is materially ambiguous, or the next action exceeds
the grant, such as deleting data or touching production. It uses the host's
question tool; without one or an answer, it leaves the PR open and unmerged.

The final gate requires proof for the whole diff, Sol approval, resolved
merge-council items, green required checks, completed bot reviews, no human
changes request, and an up-to-date, mergeable branch. It never bypasses these
checks with `--admin` or another override.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/full-send/SKILL.md)
defines the grant, mode selection, proof, and complete merge gate.

## What you get

- `Merged: <merge commit>`, `PASS: ready for human review`, or `FAIL: <main reason>`.
- The PR link, proof, Sol rounds, fixed and declined findings with reasons,
  and how each earlier merge-council item closed.
- Decisions made on your behalf and anything you still need to do.
