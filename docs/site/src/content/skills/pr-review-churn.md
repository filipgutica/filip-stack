---
related: [review, technical-writing]
---

## What it does

Give the agent GitHub repositories, a lookback in days, and optionally an
author. It collects human review threads from pull requests created in that
window and drops bot noise and resolved typo nits. It groups repeated objections
to the same behavior and counts how many pull requests each pattern spans. You
get a read-only Markdown report with examples and proposed guidance updates.

## When to use it

Use this skill to turn recurring review objections into team or agent guidance.
You need Python 3.9+ and an authenticated `gh` CLI.

> Analyze review churn on acme/web and acme/api for the last 90 days.

Repositories and lookback have no defaults, so the agent asks when either is
missing. It defaults to your GitHub login and omits reviews on older PRs.

## How it works

1. **Collect threads.** A bundled script fetches review threads for PRs created
   on or after the cutoff date. Failed repos mark partial coverage while others
   continue.
2. **Filter and group.** Actionable human feedback stays even when resolved or
   outdated. Bot-only comments, resolved typo nits, and author comments that do
   not clarify external feedback drop.
3. **Propose guidance.** The agent drafts updates for files like `AGENTS.md` or
   review checklists only for repeated patterns.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/pr-review-churn/SKILL.md)
has the collector and report rules.

## What you get

- A read-only Markdown report with coverage limits, pattern counts, PR links,
  and short examples.
- Proposed edits to existing guidance and next steps.

Apply proposals in a separate task. [technical-writing](../technical-writing/)
can help refine the wording.
