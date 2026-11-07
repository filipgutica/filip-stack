---
related: [full-send, babysit-pr]
---

## What it does

Your agent checks each Sol finding against code, fixes real problems with
small changes, and answers disagreements with evidence. Findings outside the
intended behavior become follow-ups.

## When to use it

Install with the command above, then say "sol loop" to select it. Identify the
change and purpose, for example:

> sol loop on this branch; it only fixes the retry backoff.

Use it before opening a PR or for another review of existing changes. Your
host must run OpenAI's GPT Sol; unavailable access is reported without model
substitution.

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

The agent verifies every finding, makes the smallest agreed fixes, and answers
disputes with evidence. It declines nits and out-of-scope items with reasons
and lists them as follow-ups. After fixes, it reruns checks and trims
unnecessary diff growth.

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

Exhausting the budget is not approval; you decide open disagreements with both
sides presented. No pushes occur during the loop. After agreement, pushes
require your authorization or PR-update request.
Use [babysit-pr](../babysit-pr/) for CI and bot review after that.
