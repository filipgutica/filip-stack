---
name: full-stop
description: Do the full-send work on a change or pull request, but stop with the PR ready for the user to merge, or with a pass or fail verdict. Never merges. Manual only, so invoke it with `/full-stop` or `$full-stop`.
disable-model-invocation: true
---

# Full Stop

Do the same work as `full-send`, but stop with the PR ready for the user to
merge. Never merge it.

Requires the `full-send` skill, and through it `sol-loop` and `babysit-pr`,
plus `council` for a council gate. If any is missing, stop and say so.

`full-send` is manual-only, so hosts do not list it. Read
`../full-send/SKILL.md` from this skill's directory; the skills CLI installs
the two side by side. Follow its modes, starting point, steps, proof,
routine fixes, merge gate, and rules for asking the user. When the request
sets a council threshold, such as `council 9.5`, or a bare `council`, also
follow
`../full-send/references/council-gate.md`. Invoking full stop
grants what full send's grant and testing permission cover, except merging.
The overrides below take precedence.

## No merging

Always use full send's verdict mode, even when merge mode would apply. Never
merge, enable auto-merge, add the PR to a merge queue, push to the default
branch, bypass branch protection, or ask another agent to do any of these.

In fix mode, disable auto-merge and remove the PR from any merge queue before
work begins, and check again before each push. Report these changes. In
review-only mode, do not change them; report them instead. If you cannot stop
the PR from merging without the user, ask before you continue.

## Stop at the gate

Use full send's merge gate as the readiness check, in place of its merge step.
Proof and review, by Sol or the council gate, must cover the final diff, so
recheck behavior changes and meaningful conflict fixes before the handoff. With
a council gate, never report the PR as ready until the gate passes.

Before the handoff, fetch the default branch and check the live PR's head,
base, checks, reviews, and mergeability. Confirm that it is open, not a draft,
and not set to merge without the user. If someone else merged it, report that
instead.

## Report

Lead with one line:

- `PASS: ready to merge` when the merge gate passes.
- `PASS: ready for human review` when only a required human approval remains.
  Confirm that it is the actual blocker.
- `FAIL: <the single main reason>` otherwise.

Then report what full send's report covers, plus the final head SHA and a
statement that the PR is still open and unmerged. In T3 Code, call
`unwatch_pull_request` before the handoff or a question.
