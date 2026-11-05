---
related: [full-send, babysit-pr]
---

## What it does

A second model catches bugs the first one missed, but an eager reviewer can
also grow a small change into a large one. In sol loop, your agent checks
every finding from Sol, OpenAI's GPT Sol model, against the code before it
acts. It fixes only the real ones, with the smallest change, and pushes back
on scope creep.

## When to use it

- Ask for a sol loop before you open a PR, or when a change needs another
  review.
- Settle review findings without letting the change grow.

Install it with the command above, then say "sol loop", optionally with what
the change is for. [full-send](../full-send/) runs it to review a change and its
PR description together.

## How it works

Your agent first works out exactly which change to review, keeps unrelated
work out of it, and runs the checks that cover it. Then one Sol reviewer reads
the diff and labels each finding by severity:

| Severity | Meaning |
| --- | --- |
| blocker | The intended case is wrong |
| should | A real bug that callers will hit, within what the change is for |
| nit | Anything else, such as rare cases or small speedups |

Your agent checks each finding itself. It fixes the ones it agrees with,
answers the ones it disagrees with using evidence, and declines nits and
out-of-scope items in one line, as follow-ups. It reruns the checks and cuts
the diff back if review made it grow.

The loop runs three rounds by default. It can go to five for security,
permissions, authentication, data loss, or concurrency work while a blocker or
should stays open, or when you ask. It stops early when a round returns only
nits. If no route can run Sol, the agent reports that instead of using a
different model.

## What you get

- Either agreement, meaning Sol approves the current diff with no blocker or
  should open, or both sides of the disagreement in a few lines for you to
  decide.
- The rounds, the model, what Sol changed, the diff size before and after, and
  the findings fixed and declined, with reasons.

Running out of rounds is not approval. Sol loop never pushes during review,
and after agreement it pushes only if you asked it to push or update the PR.
[babysit-pr](../babysit-pr/) handles CI and review bots after that.
