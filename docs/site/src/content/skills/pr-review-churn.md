---
related: [review, technical-writing]
---

## What it does

The evidence is human review threads. The agent groups comments that object
to the same behavior, counts how many PRs each pattern spans, and keeps
examples. It proposes guidance only for repeated objections.

## When to use it

Install the skill. You also need Python 3.9 or later and an authenticated
GitHub CLI, `gh`. Name the repositories and the time period:

> Analyze review churn on acme/web and acme/api for the last 90 days.

Neither has a default, so the agent asks before it collects anything. It
analyzes your own PRs unless you name another author.

## How it works

A bundled collector fetches review threads for PRs created on or after the
start date, with file locations and resolved or outdated state. The report
notes that reviews of older PRs are left out.

The agent drops bot-only comments, resolved typo nits, and author comments
that do not clarify a reviewer's point. Useful human feedback stays even when
resolved or outdated. If one repository fails, the others continue, and the
report marks partial coverage.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/pr-review-churn/SKILL.md)
has the collector and report rules.

## What you get

- A Markdown report with coverage limits, pattern counts, PR links, and short
  examples.
- Proposed changes to existing guidance, such as `AGENTS.md` or a review
  checklist, and next steps.
- Which repositories were fully covered, partly covered, or inaccessible.

The analysis is read-only. To apply a proposal, ask for it as a separate
task; [technical-writing](../technical-writing/) can help word the guidance.
