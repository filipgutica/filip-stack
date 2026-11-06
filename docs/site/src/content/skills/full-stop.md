---
related: [full-send, sol-loop, babysit-pr]
---

## What it does

Sol reviews the code and PR description, and the agent handles CI and bot
findings through the same process as [full-send](../full-send/). The final
check confirms whether the PR is ready for your merge decision.

## When to use it

Use it to finish a local change or existing PR while you are away and leave
the PR open for you.

Install `full-stop`, `full-send`, `sol-loop`, and `babysit-pr` together: replace
`-s full-stop` in the command above with
`-s full-stop full-send sol-loop babysit-pr`. A missing dependency stops the run.

Invoke it explicitly with `/full-stop` in Claude or `$full-stop` in Codex,
followed by the goal or PR link. For example:
`/full-stop https://github.com/acme/app/pull/42`.

The invocation authorizes commits and pushes to the PR's own branch in fix
mode. It never authorizes merging, auto-merge, a merge queue, or a push to the
default branch.

## How it works

Full stop follows full send's modes, proof requirements, routine fixes, and
rules for asking you. It always returns a verdict instead of merging.

In fix mode, it disables auto-merge and removes the PR from a merge queue
before work begins, then rechecks before each push. In review-only mode, it
reports those settings without changing them. If it cannot prevent a merge
without your help, it asks before proceeding.

Full send's merge gate becomes the readiness check. Proof and Sol review must
cover the final diff. Before handoff, the agent checks the live PR, including
that it is open, not a draft, and not set to merge automatically. If someone
else merged it, the agent reports that instead.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/full-stop/SKILL.md)
has the exact overrides to full send's contract.

## What you get

- `PASS: ready to merge` when the gate passes.
- `PASS: ready for human review` when only required human approval remains.
- `FAIL: <main reason>` otherwise.

The report includes full send's evidence and findings, the final head commit,
and confirmation that the PR remains open and unmerged, unless another actor
merged it.
