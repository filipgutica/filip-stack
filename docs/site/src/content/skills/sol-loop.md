---
related: [full-send, babysit-pr]
---

## What it does

The reviewer is Sol (OpenAI's `gpt-6.1-sol`). Your agent checks each Sol
finding against the code before it acts. It fixes real problems with a
small change and answers disagreements with evidence. Findings outside the
change's purpose become follow-ups instead of growing the diff.

## When to use it

Your agent must be able to run Sol: through the Codex provider in T3 Code,
directly in Codex, or in Claude Code through a custom subagent set up to run
Sol. If it cannot, the skill reports that instead of using another model.

Install the skill, then say "sol loop" and describe the change and its
purpose. For example:

> sol loop on this branch; it only fixes the retry backoff.

Use it before you open a PR, or when a change needs another review.
[Full-send](../full-send/) uses it to review the code and the PR description
together.

## How it works

The agent confirms the change, leaves out unrelated work, and runs the
relevant checks. Then one Sol reviewer reads the diff. Findings have three
levels:

| Severity | Meaning |
| --- | --- |
| blocker | The intended case is wrong |
| should | A real bug callers will hit within the change's intent |
| nit | Other issues, such as rare cases or small speedups |

The agent fixes agreed findings with the smallest change. It answers disputed
findings with evidence. It declines nits and out-of-scope items with a reason
and lists them as follow-ups. After fixes, it reruns checks and trims
unneeded diff growth.

The default is three rounds. Security, permissions, authentication, data
loss, and concurrency work can extend to five while a blocker or should
remains, or when you ask. A round with only nits ends the loop.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/sol-loop/SKILL.md)
has the exact scope, round, and approval rules.

## What you get

- Agreement, when Sol approves and no blocker or should remains. Otherwise,
  both sides of each disagreement for you to decide.
- The rounds, the model that ran, the changes review prompted, the diff size
  before and after, and fixed or declined findings with reasons.

Running out of rounds is not approval. The agent never pushes during the
loop. After agreement, it pushes only if you authorized a push or PR update.
For CI and bot review after that, use [babysit-pr](../babysit-pr/).
