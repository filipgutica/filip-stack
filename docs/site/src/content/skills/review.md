---
related: [test-audit, walkthrough]
---

## What it does

Review gives you a second look at a change before you accept it. It checks
the change against your request and the repository's own rules, such as
`AGENTS.md` or `CLAUDE.md`, and it leaves the files exactly as they were.

## When to use it

Use it to review one of these:

- your working tree, a branch, a pull request, a commit, or a commit range
- a document or other file
- a finished change, as a final check before you accept it

Review only reports. To apply its findings, ask for the fixes and
[engineering](../engineering/) makes them. To have a change explained to you
one part at a time, use [walkthrough](../walkthrough/).

Review comes with the [Workflow plugin](../../#install), and the agent picks
it when your request matches. An illustrative request:

> Review this branch against main before I open the PR.

## How it works

The agent first pins down exactly what it is reviewing, such as a branch from
the commit it shares with `main` to its head. It reports changes outside that
range instead of quietly including them.

It reads every changed file and follows the affected behavior to the code that
owns it, including callers, tests, types, and docs when they could change the
answer. For changed or removed tests, it asks whether the behavior is still
protected, and large coverage changes get a [test-audit](../test-audit/)
pass. It runs the narrowest checks that fit, plus complexity, dead-code, and
duplication analysis when the repository has those tools.

A finding names the file and line or the command output, the behavior it
breaks, and why that matters. Style preferences and scope creep are not
findings. A check that was blocked or could not run is listed as a limit,
never as a pass.

## What you get

- Findings ordered by impact, each with its evidence and a precise next step,
  or a statement that the evidence supports no findings.
- What was reviewed, the exact check results, and the limits of the review.
- Whether the review was independent, meaning an agent that did not write the
  change inspected it.

Review does not edit files, commit, push, publish, or post comments.
