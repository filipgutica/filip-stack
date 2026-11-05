---
related: [review, technical-writing]
---

## What it does

If reviewers keep raising the same objection on your PRs, such as missing
tests or a pattern the team avoids, a guideline could catch it before review.
PR review churn reads the review threads on PRs you wrote and groups the human
comments that object to the same engineering behavior, with examples from the
real threads.

## When to use it

- Find the decisions that reviewers challenge again and again.
- Measure review churn for the repositories and period you choose.
- Base new team guidance on review history instead of a single comment.

It needs Python 3.9 or later and the GitHub CLI, `gh`, signed in. Install the
skill with the command above, then name the repositories and how far back to
look. The skill has no defaults for either and asks for any you leave out. An
illustrative request:

> Analyze review churn on acme/web and acme/api for the last 90 days.

## How it works

The skill uses your GitHub login as the author unless you name another. A
bundled script collects the review threads, including file locations and
whether each thread was resolved or outdated. It selects PRs *created* on or
after the start date, so reviews left during the period on older PRs are not
included, and the report says so.

The agent drops bot-only comments, resolved typo nits, and the PR author's own
comments unless they clarify another reviewer's point. It keeps useful human
feedback even when the thread is resolved or outdated. It groups comments
only when the reviewers objected to the same behavior, and counts how many PRs
each pattern spans. A repository that fails to load is reported as partial
coverage instead of stopping the whole run.

## What you get

- A Markdown report with counts, PR links, and short examples for each
  pattern.
- Proposed guidance changes, marked as proposals, each aimed at an existing
  file such as `AGENTS.md` or a review checklist, plus next steps.
- Which repositories were fully covered and which were not.

The analysis is read-only. It does not post comments or edit repositories,
skills, or guidance files. To write the proposed guidance, follow up with
[technical-writing](../technical-writing/).
