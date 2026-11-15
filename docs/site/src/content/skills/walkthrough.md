---
related: [review]
---

## What it does

Files are grouped by the behavior they serve. For each part, you see the
decision, the evidence, how it was verified, and the remaining risk, with a
concrete example. You accept each part before the walkthrough moves on.

## When to use it

Install the skill, then run `/walkthrough` in Claude or `$walkthrough` in
Codex and name the change:

> /walkthrough this branch

Use it to understand the last change, the working tree, a branch, or a PR
before you approve it. For a written list of findings, use
[review](../review/).

## How it works

The agent maps every changed file into an ordered list of parts and presents
one at a time. For the main behavior, it offers a small exercise, such as
running a command, and asks what you expect to see. Each part ends with one
acceptance question, and the agent waits for your answer.

It records corrections but does not make them without your separate
approval, and revisits affected parts after a fix. The walkthrough ends when
every changed file is covered and every correction is resolved or deferred.
You can ask for a separate read-only presenter agent, whose evidence your
agent checks.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/walkthrough/SKILL.md)
links the presentation patterns and the optional log format.

## What you get

- The behavior and files covered, with your decisions and corrections.
- Verification evidence, its limits, and open risks or questions.
- A walkthrough log, if you ask for one.

Silence, a passing test, or a finished exercise does not count as approval.
Apart from a log you ask for, walkthrough changes no files.
