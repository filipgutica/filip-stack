---
related: [full-send, babysit-pr]
---

## What it does

Your agent checks each finding
against the code, fixes real problems with a small change, and answers
disagreements with evidence. Findings outside the change's purpose become
follow-ups instead of growing the diff. It uses the latest Sol unless you
name a version.

## When to use it

Your agent must be able to run Sol: through the Codex provider in T3 Code,
directly in Codex, or in Claude Code through a custom subagent that runs Sol.
If it cannot, the skill says so instead of using another model.

Install the skill, then say "sol loop" and describe the change and its
purpose:

> sol loop on this branch; it only fixes the retry backoff.

Use it before you open a PR, or when a change needs another review.
[Full-send](../full-send/) uses it to review the code and PR description.

## How it works

The agent runs the relevant checks, then one Sol reviewer reads the diff:

| Severity | Meaning |
| --- | --- |
| blocker | The intended case is wrong |
| should | A real bug callers will hit within the change's intent |
| nit | Other issues, such as rare cases or small speedups |

The agent fixes agreed findings with the smallest change and answers
disputed ones with evidence. Nits and out-of-scope items become follow-ups.

The default is three rounds. Security, permissions, authentication, data
loss, and concurrency work can extend to five while a blocker or should
remains, or when you ask. A round with only nits ends the loop.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/sol-loop/SKILL.md)
has the exact scope, round, and approval rules.

## What you get

- Agreement, when Sol approves and no blocker or should remains. Otherwise,
  both sides of each disagreement for you to decide.
- The rounds, the model that ran, the diff size before and after, and fixed
  or declined findings with reasons.
- When you authorized a PR update, a collapsed Sol review section at the end
  of the PR description, with each round's findings.

Running out of rounds is not approval. The agent never pushes during the
loop, and afterwards pushes only if you authorized it. For CI and bot review,
use [babysit-pr](../babysit-pr/).
