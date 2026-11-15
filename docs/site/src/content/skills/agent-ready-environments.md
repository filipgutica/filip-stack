---
related: [pr-review-churn, test-audit]
---

## What it does

The audit scores eight areas, called pillars: code structure, static checks,
tests, documentation, review, a runnable environment, limits on what the agent
may do, and evaluated guidance. You get a score for each and fixes in priority
order. The [Agent-ready environments lesson](../../agent-ready-environments/)
explains why each pillar matters.

## When to use it

Install the skill, then ask for the audit:

> Audit this repository for agent readiness. Read-only, please.

Use it when you start a project, audit a repository, or review instruction
files, skills, and review gates. Run it again after a model release to see
what guidance still helps.

A read-only audit uses CI results and the source, and lists the local runs it
skipped. Required checks, branch rules, and review history need read access
to the code host's API, such as `gh api`. Without it, they stay unverified.

## How it works

Each pillar scores from 0 (missing) to 3 (enforced and tracked over time) on
verified evidence only. The lesson's [score
ladder](../../agent-ready-environments/#scoring) defines each level. A pillar
that does not apply is N/A and left out of the total. The audit also separates
advisory guidance, which the agent may skip, from enforced checks such as
hooks and required CI.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/agent-ready-environments/SKILL.md)
has the pillar criteria, audit modes, and evidence rules.

## What you get

- Evidence, and a table of scores, gaps, fixes, and whether each fix is
  advisory or enforced.
- Fixes ordered by protection of secrets and irreversible actions, then by
  how long the fix stays useful, then by cost.
- Unverified checks, what running them needs, and gaps in the skill itself.
