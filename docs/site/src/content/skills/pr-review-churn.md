---
related: [review, technical-writing]
---

## What it does

Human review threads provide the evidence: the agent groups comments that
object to the same engineering behavior, counts how many PRs each pattern
spans, and preserves examples. Proposed guidance comes from repeated
objections rather than one isolated comment.

## When to use it

Install the skill with the command above. You also need Python 3.9 or later
and an authenticated GitHub CLI, `gh`.

Name the repositories and lookback period in your request. The agent selects
the skill for review-churn analysis. For example:

> Analyze review churn on acme/web and acme/api for the last 90 days.

Neither repositories nor lookback has a default. If either is missing, the
agent asks and waits before collecting PRs. It uses your GitHub login as the
author unless you name someone else.

Use the report to find recurring review objections and choose where team
guidance might prevent them.

## How it works

A bundled collector fetches review threads with file locations and resolved
or outdated status. Its cohort is PRs created on or after the cutoff date.
Reviews submitted during that period on older PRs are excluded; the report
states that limit.

The agent filters bot-only comments, resolved typo nits, and author comments
that do not clarify another reviewer's point. Useful human feedback stays
even when a thread is resolved or outdated. Comments join a pattern only when
they object to the same behavior.

A failed repository does not stop the others. The report identifies failed
or partial coverage rather than treating a successful collector exit as proof
of completeness.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/pr-review-churn/SKILL.md)
has the collector and report contract.

## What you get

- A Markdown report with coverage limits, pattern counts, PR links, and short examples.
- Proposed guidance changes aimed at existing files, such as `AGENTS.md` or
  a review checklist, and recommended next actions.
- A distinction between fully covered, partial, and inaccessible repositories.

The analysis is read-only: it posts no comments and changes no repository,
skill, or guidance file. Request a follow-up implementation to apply proposals;
[technical-writing](../technical-writing/) can help write the guidance.
