---
related: [full-stop, sol-loop, babysit-pr, council]
---

## What it does

Sol (currently OpenAI's
`gpt-6.1-sol`) reviews the code and PR description through
[sol-loop](../sol-loop/). The agent opens or updates the PR, handles CI and
bot findings, and makes routine decisions while you are away. Add a council
threshold, such as `council 9.5`, and a [council](../council/) of models
reviews the PR in place of Sol until every member scores it at or above the
threshold.

## When to use it

Use it to finish a local change or an existing PR, including the merge when
the checks allow it. To keep the merge decision yourself, use
[full-stop](../full-stop/).

Your agent must be able to run Sol; see [sol-loop](../sol-loop/). The install
command above also installs `sol-loop`, `babysit-pr`, and `council`, and
full send stops if one it needs is missing.

Run `/full-send` in Claude or `$full-send` in Codex, with a goal or PR link:

> /full-send fix the flaky login test

> /full-send fix the flaky login test $council 9.5

This authorizes commits and pushes to the PR's branch, `--force-with-lease`
after a rebase of that branch, and the merge, each only when its mode below
applies.

## How it works

At the start and before it finishes, the agent picks two modes:

| Mode | Applies when | Otherwise |
| --- | --- | --- |
| Fix | You authored the PR, or it does not exist yet, and you can push to its head repository | Review only: reports findings without pushing |
| Merge | Fix mode applies, you can push to the base repository, and the review decision permits it | Verdict: returns PASS or FAIL without merging |

Proof must come from what the agent observes in the session: a failing then
passing reproduction, repository CI, or the running app, with screenshots of
changed UI and a recording of a changed flow when the host can record. Mocked
tests alone do not prove the user experience.

With a council threshold, the full council (Astra, Sol, Opus, and Fable)
scores the PR's merge readiness once checks are green. The agent fixes their
findings and runs another round, for at most three rounds. It stops early
when scores stop improving or the diff grows past its scope. Below the
threshold, it never merges and asks you what to do. The scores go in a
collapsed section of the PR description.

The agent fixes routine problems itself. It asks you about public contracts,
migrations, data, security, dependencies, removing a test no other test is
proven to cover, missing proof, an unclear goal, or a step beyond your grant.
Without an answer, it leaves the PR open and unmerged.

The merge needs proof for the whole diff, Sol approval or a passed council
gate, green required checks, finished bot reviews, no human
change request, and an up-to-date, mergeable branch. It never bypasses these
with `--admin` or another override.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/full-send/SKILL.md)
defines the grant, the modes, proof, and the full merge gate.

## What you get

- `Merged: <merge commit>`, `PASS: ready for human review`, or `FAIL: <main
  reason>`.
- The PR link, proof, Sol rounds or council scores, and fixed and declined
  findings with reasons.
- Decisions made for you, and anything you still need to do.
