---
related: [full-send, babysit-pr]
---

## What it does

Give sol loop local changes or a PR and state what the change should do. Your
agent runs checks, sends the diff to one read-only Sol reviewer, and checks
each reported issue (**finding**) against the code. It fixes real in-scope bugs
with the smallest edit, answers disputes with evidence, and repeats for a few
**rounds** (review passes). You get an approved diff, or both sides of any
dispute, and the agent pushes only after agreement when you explicitly asked to
push, ship, or update the PR.

## When to use it

Use sol loop before opening a PR, or for another bug-hunting pass.
[Full-send](../full-send/) and [full-stop](../full-stop/) use it to review code
and PR text. For CI and bots, use [babysit-pr](../babysit-pr/).

Your host must run Sol via Codex in T3 Code, directly in Codex, or a custom Sol
subagent in Claude Code. Otherwise it reports the blocker.

Say "sol loop" and describe the change's purpose:

> sol loop on this branch; it only fixes the retry backoff.

## How it works

One read-only Sol reviewer (latest Sol unless you name a version) grades each
finding:

| Severity | Meaning |
| --- | --- |
| `blocker` | Intended case is wrong |
| `should` | Real bug callers will hit within intent |
| `nit` | Rare cases, other paths, or small speedups |

1. **Check and review.** Your agent runs checks, excludes unrelated edits, and
   sends the diff to Sol.
2. **Fix or reply.** It fixes agreed blockers and shoulds with the smallest
   edit, answers disputes with evidence, and declines nits and out-of-scope
   items as follow-ups.
3. **Repeat up to the cap.** Default is three rounds, extending to five for
   security, permissions, auth, data loss, or state/concurrency while a blocker
   or should stays open, or when you ask. A nit-only round ends the loop.
   Running out of rounds is not approval.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/sol-loop/SKILL.md)
has the exact scope, round, and approval rules.

## What you get

- Approval when Sol approves the current behavior diff with no open blocker,
  should, or remaining concern from your agent, or both sides of any unresolved
  dispute.
- Round count, model, diff size before and after, fixed and declined findings
  with reasons, and push status.
- When authorized to update the PR, a collapsed Sol review table in its
  description.
