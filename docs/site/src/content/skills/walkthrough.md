---
related: [review]
---

## What it does

Files are grouped by the behavior they serve. For each part of the change,
you see the decision, decisive evidence, verification, and remaining risk,
with a concrete example. You decide whether to accept each part before the
walkthrough continues.

## When to use it

Install the [Workflow plugin](../../#install). Invoke walkthrough explicitly:
`/workflow:walkthrough` in Claude or `$workflow:walkthrough` in Codex.
Name the change, for example `/workflow:walkthrough this branch`.

Use it to understand the last completed change, working tree, branch, or PR
before approval. For a written list of findings, use [review](../review/).

## How it works

The agent verifies the selected change and reports working-tree changes
outside it. It builds an ordered map accounting for every changed file,
then presents one part at a time.

For the main behavior, it offers a small exercise, such as running a command
or opening a page, and asks what you expect to see. You may skip the exercise.
Each part ends with one acceptance question and waits for your answer.

Corrections are recorded without being implemented. A fix needs separate
authorization. After a fix changes the code, the agent revisits the affected
parts. The walkthrough ends when every changed file is covered and every
correction is resolved or explicitly deferred.

You can request a separate read-only presenter agent. Your agent checks the
evidence that presenter supplies.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/walkthrough/SKILL.md)
links the presentation patterns and optional log format.

## What you get

- The behavior and files covered, with your decisions and corrections.
- Verification evidence, its limits, and unresolved risks or questions.
- A walkthrough log, if requested.

Silence, a passing test, or completing an exercise does not count as approval.
Apart from an authorized log, walkthrough changes no files and does not
commit, push, or publish.
