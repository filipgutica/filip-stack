---
related: [full-send, sol-loop]
---

## What it does

Give babysit-pr a PR number or URL to monitor CI and bots until ready. Your
agent checks each bot comment against the code before editing, fixes real
in-scope failures, and replies with evidence on false positives. It rebases if
base updates conflict with or touch PR files. You get a ready PR or a concrete
blocker.

## When to use it

Use it after opening a PR while CI and bots run. [Full-send](../full-send/) and
[full-stop](../full-stop/) call it here. For Sol review, use
[sol-loop](../sol-loop/).

Name the PR to babysit, watch, or monitor:

> babysit PR 42

## How it works

1. **Watch without polling.** One watcher owns the PR (`watch_pull_request` in
   T3 Code, `pr-wait` elsewhere). The agent stays quiet when nothing needs
   action.
2. **Verify and fix.** Your agent checks existing and incoming events, acting
   only on checks and comments newer than the latest push after verifying each
   against the code. It tells real failures from flakes, declines out-of-scope
   items, and checks CodeRabbit without waiting on it.
3. **Rebase when base moves.** Before reporting ready, it rebases, pushes, and
   waits for green checks if base commits conflict with or touch PR files.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/babysit-pr/SKILL.md)
has watcher, Macroscope, and rate-limit rules.

## What you get

- Real CI failures and in-scope bot issues fixed, and false positives answered.
- A ready PR, or a concrete blocker.

Merging needs your explicit request. If another PR makes this one obsolete, it
asks before closing unless already authorized.
