---
related: [planning, review]
---

## What it does

Jira boards collect links that mean different things: an Epic that holds the
work, a ticket that gives context, a ticket that really cannot start yet.
When all of them look like blockers, nobody can tell what is waiting on what.
This skill gives each link the one meaning it should have.

## When to use it

- Create, correct, or review blockers and other issue links.
- Check parent, child, or Epic relationships while you plan work.
- Find the pull requests and commits behind an issue.
- Check that an issue's Development section, the Jira panel that lists linked
  branches, commits, and PRs, shows the right work.

A plain summary of an issue does not need this skill. The agent needs access
to your Jira site and to the code host, such as GitHub. Install the skill with
the command above, then ask in plain words. An illustrative request:

> Check the links on PROJ-120 to PROJ-128 and fix any blockers that are wrong.

## How it works

The agent reads every issue you name first: its type, status, parent, links,
and Development section. When an issue lists no code, it searches the code
host for the issue key in PR titles, descriptions, branch names, and commits,
then for the product terms the issue uses. It sketches the intended links
before it changes any.

It follows a few rules:

- An issue *blocks* another only when it has an unfinished piece of work that
  the other issue needs, and the agent names that piece of work.
- Epics, specifications, context, parallel work, and code that already merged
  use *relates to*, unless that issue produces the unfinished work another
  issue needs.
- Parent and child links describe scope, not order.
- A merged PR shows the code exists. It does not show the issue is validated,
  released, or meets every acceptance criterion.

The agent changes only what you allowed. After each change, it reloads both
issues and checks that each side shows the link the right way round, for
example "blocks PROJ-124" on one issue and "is blocked by PROJ-120" on the
other. A link that shows the wrong way is removed and created again.

## What you get

- The link map, explained in plain words.
- Each PR reference with its repository and state checked.
- For each blocker, the unfinished work it names, and any validation or release
  work that remains.

Reading issues does not give the agent permission to edit them. It changes
links or status only when you ask.
