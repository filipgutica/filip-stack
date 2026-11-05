---
related: [review]
---

## What it does

Walkthrough helps you understand a change well enough to accept it. Instead
of a summary or a file-by-file dump, the agent splits the change into parts by
the behavior each part serves. For each part it shows the decision behind it,
the evidence, how it was verified, and the remaining risk, with a concrete
example.

## When to use it

- Understand the last change the agent made, or your working tree.
- Go through a branch or pull request before you approve it.
- Learn how a change ties behavior, code, tests, and docs together.

Walkthrough runs only when you call it: `/workflow:walkthrough` in Claude or
`$workflow:walkthrough` in Codex. It comes with the
[Workflow plugin](../../#install). Name what to walk through, for example
`/workflow:walkthrough this branch`. If you want a written list of findings
instead, use [review](../review/).

## How it works

The agent first pins down exactly which change it is explaining, and it tells
you about working-tree changes outside it instead of quietly including them.
It then builds an ordered map that covers every changed file.

For the part that carries the main behavior, it offers a small exercise you
can run yourself, such as a command or a page to open, and asks what you
expect to see first. You can skip it. Each part ends with one question that
asks whether you accept it.

If you correct something, the agent records the correction but does not fix
it. Fixing needs a separate request. After an approved fix changes the code,
it redoes the parts that the fix affected. The walkthrough ends when every
changed file is covered and each correction is resolved or deferred.

You can ask for a separate, read-only agent to present the walkthrough
instead. Your agent then checks the evidence it presents.

## What you get

- An explanation of the behavior and files covered.
- Your decisions and corrections, the verification and its limits, and any
  open risks or questions.
- A walkthrough log, if you ask for one.

Silence, a passing test, or a finished exercise does not count as your
approval. Apart from the log, walkthrough changes no files and does not
commit, push, or publish.
