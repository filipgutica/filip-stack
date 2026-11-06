---
related: [full-send, babysit-pr]
---

## What it does

Your agent checks each Sol finding against the code, fixes the real problems
with a small change, and answers disagreements with evidence. Findings outside
the intended behavior become follow-ups instead of expanding the diff.

## When to use it

Install the skill with the command above, then say "sol loop" and identify
the change and its purpose. The agent selects it for that phrase. For example:

> sol loop on this branch; it only fixes the retry backoff.

Use it before opening a PR or when an existing change needs another review.
Your host must be able to run OpenAI's GPT Sol; the skill reports unavailable
Sol access instead of substituting another model.

[Full-send](../full-send/) uses it to review the code and PR description together.

## How it works

The agent verifies the change range, excludes unrelated work, and runs
covering checks before sending the diff to one Sol reviewer. Findings have
three severities:

| Severity | Meaning |
| --- | --- |
| blocker | The intended case is wrong |
| should | A real bug callers will hit within the change's intent |
| nit | Other issues, such as rare cases or small speedups |

The agent verifies every finding itself. Agreed findings get the smallest
fix; disputed findings get an evidence-based response. Nits and out-of-scope
items are declined with a reason and listed as follow-ups. After fixes, the
agent reruns checks and reduces any unnecessary diff growth.

The default budget is three rounds. It can extend to five for security,
permissions, authentication, data loss, or state and concurrency work while
an evidenced blocker or should remains open, or when you ask. A round with
only nits ends the loop early.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/sol-loop/SKILL.md)
has the exact scope, round, and approval rules.

## What you get

- Agreement when Sol approves the current behavior diff and no blocker or
  should remains, or both sides of a disagreement for you to decide.
- Rounds, the model that ran, changes prompted by review, before-and-after
  diff size, and fixed or declined findings with reasons.

Exhausting the budget is not approval. The agent never pushes during the
loop. After agreement, it pushes only if you authorized a push or PR update.
Use [babysit-pr](../babysit-pr/) for CI and bot review after that.
