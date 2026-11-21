---
related: [review]
---

## What it does

Run `/walkthrough` (or `$walkthrough` in Codex) and name a change: your last
edit, the working tree, a branch, or a pull request. The agent groups changed
files by behavior and presents one **slice** (a coherent part of the change) at
a time. Each slice shows the decision, evidence, verification, risk, and an
example, then pauses for acceptance. You get a summary of covered files,
decisions, corrections, and open risks, plus an optional log.

## When to use it

Use this manual-only skill to inspect your last change, working tree, branch, or
pull request before approving it.

> /walkthrough this branch

Skip it for an ordinary summary or written findings. Use [review](../review/)
for code review.

## How it works

1. **Confirm the range.** The agent locks onto one source and flags edits
   outside it.
2. **Walk slice by slice.** Files are grouped by behavior. For the main
   behavior, it offers a runnable exercise when useful and available, or walks
   through an example, asks what you expect, and then asks for acceptance on
   each slice.
3. **Record corrections.** It logs corrections without editing code, rebuilds
   slices after an approved fix, and supports a read-only presenter agent.
4. **Finish.** Walkthrough ends after every file is covered and every correction
   is resolved or deferred.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/walkthrough/SKILL.md)
links the presentation patterns and optional log format.

## What you get

- Covered behavior, files, decisions, and corrections.
- Verification evidence, its limits, and open risks.
- An optional Markdown log.

Silence, a passing test, or a finished exercise never counts as approval. Apart
from an authorized log, walkthrough changes no files.
