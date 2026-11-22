---
related: [review, test-audit]
---

## What it does

Run `/simplify-pass` (or `$simplify-pass` in Codex) on a file, function, or
change range, or let it target your current edits. Before editing, the agent
maps behavior to keep and runs three independent read-only reviews for
duplication, complexity, and refactor risks. It applies only clear,
behavior-preserving simplifications and runs focused checks. You get simpler
code, check results, and a list of skipped proposals.

## When to use it

Use this manual-only skill after code works to remove duplication, nesting, or
unneeded layers without changing behavior. Your host must support subagents.

> /simplify-pass src/cart/totals.ts

Without a target, it uses current task changes, then uncommitted changes, and
asks if none are clear.

## How it works

1. **Set a baseline.** The agent reads the target, callers, project guidance,
   and nearest tests, records behavior to keep, and runs an existing check when
   it gives a useful baseline.
2. **Run three read-only reviews.** Independent reviewers check reuse and
   ownership, direct simplification, and the behavior contract before any edit.
   If a review still fails after one retry, or delegation is unavailable, the
   agent stops without editing.
3. **Apply and verify.** The agent applies only clear simplifications, skips
   uncertain proposals, preserves useful tests and error handling, and checks
   the final diff (with an independent reviewer for substantive diffs).

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/simplify-pass/SKILL.md)
has the exact review and verification rules.

## What you get

- Focused simplifications and checks showing behavior stayed intact.
- Skipped proposals with reasons.

A failed check or doubt about kept behavior leaves the result incomplete.
