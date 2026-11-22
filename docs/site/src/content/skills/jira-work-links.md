---
related: [planning, review]
---

## What it does

Give the agent Jira issue keys and say whether you want a report or edits. It
reads each issue and checks Jira's Development section and your source host for
pull requests, branches, and commits. Using that code evidence, it separates
real blockers from scope hierarchy, context, and merged work. You get a verified
link map and pull request summary, with Jira edits made only when you authorize
them.

## When to use it

Use this skill to create, fix, or audit Jira links, blockers, parent or Epic
relationships, and the pull requests behind an issue. Your agent needs access to
Jira and your authenticated source host.

> Check the links on PROJ-120 to PROJ-128 and fix any blockers that are wrong.

Skip it for a plain Jira summary. To draft tickets from a spec, use
[planning](../planning/).

## How it works

1. **Read issues and code.** The agent reads each issue and its Development
   section, then searches your source host if code links are missing.
2. **Map relationships from evidence.** `blocks` requires named unfinished work
   that another issue needs. Use `relates to` for Epics, context, parallel work,
   and merged references that do not block the target, while parent and child
   links show hierarchy only. A merged pull request proves code exists, never
   validation or release.
3. **Verify edits.** After changing an authorized link, the agent reloads both
   issues to confirm direction and fixes reversed links.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/jira-work-links/SKILL.md)
has the exact link and evidence rules.

## What you get

- A plain-language relationship map of the named issues.
- Verified pull request references with repository and state.
- The unfinished work behind each blocker and any remaining validation or
  release work.
