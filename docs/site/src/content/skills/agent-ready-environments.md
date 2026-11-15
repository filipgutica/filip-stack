---
related: [pr-review-churn, test-audit]
---

## What it does

The audit scores eight areas, called pillars: code structure, static checks,
tests, documentation, review, a runnable environment, limits on what the agent
may do, and evaluated guidance. You get a score for each and a list of fixes
in priority order.

The [Agent-ready environments lesson](../../agent-ready-environments/) explains
why each pillar matters.

## When to use it

Install the skill, then ask for the audit. For example:

> Audit this repository for agent readiness. Read-only, please.

Use it when you start a project, audit an existing repository, or review
instruction files such as `AGENTS.md` and `CLAUDE.md`, skills, and review
gates. Run it again after a model release to see what guidance still helps.

A read-only audit uses CI results and the source, and lists the local runs it
skipped. Required checks, branch rules, and review history need read access
to the code host's API, such as `gh api`. Without it, those checks stay
unverified.

## How it works

Each pillar gets the highest score its verified evidence supports:

| Score | Meaning |
| --- | --- |
| 0 | Missing, or no verified evidence |
| 1 | Present, but not runnable as a whole |
| 2 | Runnable, with its observable audit check met |
| 3 | Runnable and enforced at the action it guards, with results tracked over at least 20 runs or 30 days |

A pillar that does not apply is marked N/A and left out of the total. A check
that did not run cannot raise a score.

The audit also tells advisory guidance, which the agent may decide to skip,
from enforced checks such as hooks, deny rules, and required CI. A rule with
no exceptions belongs in enforcement.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/agent-ready-environments/SKILL.md)
has the pillar criteria, audit modes, and evidence rules.

## What you get

- An evidence section, and a table of scores, gaps, fixes, and whether each
  fix is advisory or enforced.
- Fixes ordered first by protection of secrets, protected paths, and
  irreversible actions, then by how long the fix stays useful, then by cost.
- Unverified checks, what running them needs, and gaps in the skill itself.
