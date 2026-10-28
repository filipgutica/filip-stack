---
related: [planning, review]
---

## What it does

Jira work links builds the smallest accurate map of issues and their code
references. It distinguishes hierarchy, context, implementation, validation,
and release rather than treating them all as dependencies.

## When to use it

- Create, correct, or review Jira blockers and other issue links.
- Check parent, child, or Epic relationships during [planning](../planning/).
- Find pull requests and commits for an issue.
- Verify that Jira's Development section reflects the relevant implementation.

A simple issue summary does not need this skill. Reading issues and source
evidence does not authorize tracker changes or publication.

## How it works

1. Reads every named issue, including type, status, parent, description, links,
   and Development references.
2. Checks linked repositories, PR states, merge commits, commits, and builds.
   If references are missing, it searches the source host for the exact
   issue key, then relevant product and source terms.
3. Traces the artifact each issue produces or consumes and draws the intended
   relationship map before changing links.
4. Uses `blocks` only for an unfinished artifact another issue needs. Context,
   parallel work, and merged implementation normally use `relates to`.
5. Applies only authorized changes. After a write, it refetches both issues
   and checks that each side renders the intended relationship direction.

Parent and child relationships describe scope, not dependency. Matching an
issue key alone does not prove a PR meets the issue's acceptance criteria.
A merged PR proves implementation exists, not that validation or release is complete.

## What you get

- A verified relationship map explained in plain language.
- Code references with confirmed repositories and PR states.
- Named unfinished artifacts for blockers and remaining validation or release work.

Use [review](../review/) alongside this work when the implementation itself
needs a bounded read-only check.
