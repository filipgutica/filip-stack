---
related: [full-send, sol-loop, babysit-pr]
---

## What it does

Full stop runs [full-send](../full-send/)'s process: Sol (OpenAI's
`gpt-6.1-sol`) reviews the code and PR description, and the agent handles CI
and bot findings. At the end, it checks whether the PR is
ready for your merge decision instead of merging.

## When to use it

Use it to finish a local change or an existing PR while you are away and
leave the PR open for you.

Your agent must be able to run Sol; see [sol-loop](../sol-loop/). The install
command above also installs `full-send`, `sol-loop`, and `babysit-pr`, and
full stop stops if any of them is missing.

Run `/full-stop` in Claude or `$full-stop` in Codex, with a goal or PR link:

> /full-stop https://github.com/acme/app/pull/42

Running it authorizes commits and pushes to the PR's own branch in fix mode.
It never authorizes merging, auto-merge, a merge queue, or a push to the
default branch.

## How it works

Full stop uses full send's modes, proof rules, routine fixes, and rules for
asking you. It always returns a verdict.

In fix mode, it turns off auto-merge and removes the PR from any merge queue
before it starts, and checks again before each push. In review-only mode, it
reports those settings without changing them. If it cannot prevent a merge
on its own, it asks you first.

Full send's merge gate becomes a readiness check. Proof and Sol review must
cover the final diff. Before handoff, the agent checks that the live PR is
open, not a draft, and not set to merge automatically. If someone else merged
it, the agent says so.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/full-stop/SKILL.md)
lists exactly how it differs from full send.

## What you get

- `PASS: ready to merge` when the gate passes.
- `PASS: ready for human review` when only required human approval remains.
- `FAIL: <main reason>` otherwise.

The report includes full send's evidence and findings, the final head commit,
and confirmation that the PR is still open and unmerged, unless someone else
merged it.
