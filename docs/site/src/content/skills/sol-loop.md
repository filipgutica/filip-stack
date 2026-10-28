---
related: [full-send, babysit-pr]
---

## What it does

Sol loop reviews a change with OpenAI's GPT Sol, checks each finding against
the code, and repeats when needed. It aims for agreement on the smallest
correct change. Adapted from [tstack](https://github.com/t3dotgg/tstack).

## When to use it

- Ask for a sol loop before filing a PR or after a change needs another review.
- Resolve consequential review findings without growing the change unnecessarily.
- Review code and its PR description as part of [full-send](../full-send/).

The default budget is three rounds. Security, permissions, authentication,
data loss, or state and concurrency work can extend to five under the skill's
conditions. You can also request an extension.

## How it works

1. Checks Git state, establishes a verified base, and bounds the changed paths,
   including relevant untracked files. Unrelated changes stay untouched.
2. Runs covering checks and gives one Sol reviewer the intent, exclusions,
   exact diff, and known verification limits. The reviewer cannot delegate.
3. Checks each finding and severity. Agreed findings get the smallest fix;
   disagreements need evidence; unrelated items and minor suggestions can be declined.
4. Tracks stable finding IDs, outcomes, and any reported usage in a ledger.
   It reruns checks after fixes and cuts unnecessary diff growth.
5. Uses later rounds for changed code and open findings. It stops early for
   minor suggestions alone. Comment, documentation, or formatting-only fixes
   do not need another round.
6. Finishes with approval of the current behavior diff and no open blocker
   or in-scope bug, or reports the unresolved disagreement or exhausted budget.

## What you get

- Rounds, model, fixes, declined findings, and diff size before and after.
- Reported usage when available, plus whether anything was pushed.

Budget exhaustion is not approval. The skill does not push during review;
after agreement, pushing still requires authorization. [Babysit PR](../babysit-pr/)
handles subsequent CI and review-bot monitoring.
