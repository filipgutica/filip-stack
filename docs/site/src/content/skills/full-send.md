---
related: [full-stop, sol-loop, babysit-pr, merge-council]
---

## What it does

You hand off a change and come back to a result. Sol, OpenAI's review model
(currently `gpt-6.1-sol`), reviews the code and PR description through
[sol-loop](../sol-loop/). The agent then opens or updates the PR, handles CI
and bot findings, and makes routine decisions while you are away. It can also
close the open items from a [merge-council](../merge-council/).

## When to use it

Use it to finish a local change or an existing PR, including the merge when
the checks allow it. To keep the merge decision yourself, use
[full-stop](../full-stop/).

Your agent must be able to run Sol; see [sol-loop](../sol-loop/). The install
command above also installs `sol-loop` and `babysit-pr`, and full send stops
if either is missing.

Run `/full-send` in Claude or `$full-send` in Codex, with a goal or PR link:

> /full-send fix the flaky login test

Running it authorizes commits and pushes to the PR's branch,
`--force-with-lease` after a rebase of that branch, and the merge, each only
when its mode below applies.

## How it works

At the start, and again before it finishes, the agent makes two choices.

May it edit the PR?

| Mode | Applies when | Result |
| --- | --- | --- |
| Fix | You authored the PR, or it does not exist yet, and you can push to its head repository | Commits and pushes fixes on its branch |
| Review only | Fix mode does not apply | Reports findings without pushing |

May it merge?

| Mode | Applies when | Result |
| --- | --- | --- |
| Merge | Fix mode applies, you can push to the base repository, and the review decision permits it | Merges after the full gate passes |
| Verdict | Merge mode does not apply | Returns PASS or FAIL without merging |

Proof must come from what the agent observes in the session: a failing then
passing reproduction, repository CI, or the running app for UI and runtime
behavior. Mocked tests alone do not prove the user experience.

The agent fixes routine problems itself. It asks you about public contracts,
migrations, data, security, dependencies, and removing a test without proof
that another test covers it. It also asks when proof is unavailable, the goal
is unclear, or the next step goes beyond what you authorized, such as
deleting data or touching production. Without an answer, it leaves the PR open
and unmerged.

Before it merges, it needs proof for the whole diff, Sol approval, resolved
merge-council items, green required checks, finished bot reviews, no human
change request, and an up-to-date, mergeable branch. It never bypasses these
with `--admin` or another override.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/full-send/SKILL.md)
defines the grant, the modes, proof, and the full merge gate.

## What you get

- `Merged: <merge commit>`, `PASS: ready for human review`, or `FAIL: <main reason>`.
- The PR link, proof, Sol rounds, fixed and declined findings with reasons,
  and how each earlier merge-council item closed.
- Decisions made for you, and anything you still need to do.
