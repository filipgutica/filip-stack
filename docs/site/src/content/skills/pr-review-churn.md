---
related: [review, technical-writing]
---

## What it does

PR review churn analyzes recurring human review feedback across authored
GitHub pull requests. It groups repeated objections and proposes small
workflow improvements backed by representative examples.

## When to use it

- Find engineering decisions reviewers repeatedly challenge.
- Analyze review churn for chosen repositories and a chosen lookback.
- Propose guidance based on review history rather than isolated comments.

Repositories and lookback have no defaults. The skill asks for missing scope
before collecting data. It infers your authenticated GitHub login only when
you do not specify an author.

## How it works

1. Confirms repositories, author, and lookback. It checks for Python 3.9+
   and an authenticated GitHub CLI, `gh`.
2. Collects review threads with the bundled collector and keeps raw evidence
   available while writing. Threads retain context such as file anchors and
   resolved or outdated state.
3. Filters bot-only noise and typo nits. It retains actionable human feedback
   even when the thread is resolved or outdated.
4. Groups objections only when they concern the same engineering behavior.
   It counts distinct threads and shows how many PRs each pattern spans.
5. Reports examples, coverage limits, proposed guidance, and focused next actions.
   Trends require evidence from a previous run.

The collector selects PRs created on or after a UTC cutoff date. It does
not claim to collect only reviews submitted during that period. Failed or
partial repositories remain explicit limitations, even if collection exits successfully.

## What you get

- A Markdown report with counts, PR links, and concise examples.
- Proposed durable workflow updates and recommended next actions.
- Clear distinctions between verified coverage and missing evidence.

The analysis stays read-only. A later [review](../review/) or
[technical-writing](../technical-writing/) task can assess or draft proposed guidance;
this skill does not edit repositories, skills, or policy files.
