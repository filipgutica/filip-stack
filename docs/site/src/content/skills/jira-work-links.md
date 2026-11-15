---
related: [planning, review]
---

## What it does

An Epic describes scope. A related issue gives context. A blocker must
produce unfinished work that another issue needs. The agent tells these apart
using the issues and the code.

## When to use it

Install the skill. The agent needs access to your Jira site and your code
host, such as GitHub. Name the issues and what you want done:

> Check the links on PROJ-120 to PROJ-128 and fix any blockers that are wrong.

Use it to create or check issue links, dependency order, parent or Epic
relationships, and the PRs and commits behind an issue, including Jira's
Development section. A plain issue summary does not need it.

Say whether you want a report or edits. Reading issues does not authorize
changes; the agent changes only what you ask for.

## How it works

The agent reads each issue's type, status, parent, description, links, and
Development section. If code references are missing, it searches the code
host for the issue key in PR titles, descriptions, branches, and commits. It
sketches the relationships before it writes any.

The link rules keep scope apart from order:

- `blocks` needs a named unfinished artifact that the other issue needs.
- `relates to` covers Epics, specifications, context, parallel work, and
  merged work that produces no such artifact.
- Parent and child links show hierarchy, not order.
- A merged PR proves the code exists. It does not prove validation, release,
  or every acceptance criterion.

After a change, the agent reloads both issues to confirm the direction, for
example "blocks PROJ-124" on one and "is blocked by PROJ-120" on the other. A
wrong link is removed and recreated.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/jira-work-links/SKILL.md)
has the exact link and evidence rules.

## What you get

- The final relationship map in plain words.
- PR references, each with its repository and state verified.
- The unfinished artifact behind each blocker, and the validation or release
  work that remains.
