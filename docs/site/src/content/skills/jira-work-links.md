---
related: [planning, review]
---

## What it does

An Epic describes scope, a related issue can supply context, and a blocker
must supply unfinished work another issue needs. The agent distinguishes
those relationships using issue details and source-repository evidence.

## When to use it

Install the skill with the command above. The agent needs access to your Jira
site and code host, such as GitHub. Ask for the issue keys and the action you
want; the agent selects the skill when the request matches. For example:

> Check the links on PROJ-120 to PROJ-128 and fix any blockers that are wrong.

Use it to create or check issue links, dependency order, parent or Epic
relationships, and the PRs and commits behind an issue. It also checks Jira's
Development section, which shows associated code. A plain issue summary
does not need this skill.

State whether you want a report or edits. Reading issues and code does not
authorize link or status changes; the agent changes only what you request.

## How it works

The agent reads every named issue's type, status, parent, description, links,
and Development section. If code references are missing, it searches the code
host for issue keys in PR titles, descriptions, branches, and commits, then
for relevant product terms. It sketches the intended relationships before writing.

The link rules keep scope separate from order:

- `blocks` requires a named unfinished artifact that the other issue needs.
- `relates to` covers Epics, specifications, context, parallel work, and merged
  implementation unless they produce that unfinished artifact.
- Parent and child relationships describe hierarchy, not dependency order.
- A merged PR proves implementation exists. It does not prove validation,
  release, or every acceptance criterion is complete.

After an authorized write, the agent reloads both issues to verify direction:
for example, "blocks PROJ-124" on one and "is blocked by PROJ-120" on the other.
An incorrect link is removed and recreated.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/jira-work-links/SKILL.md)
has the exact link rules and Development-evidence requirements.

## What you get

- The final relationship map in plain words.
- PR references with their repository and state verified.
- The unfinished artifact behind each blocker and remaining validation or
  release work.
