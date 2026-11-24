---
related: [pr-review-churn, test-audit]
---

## What it does

Give the skill a repository, a new project, or your agent instructions, skills,
and review gates. The agent checks eight **pillars**: code structure, static
checks, tests, documentation, review, a runnable environment, agent limits, and
evaluated guidance. It scores each pillar on verified evidence and ranks the
fixes. You get a score table, prioritized fixes, and a list of unverified
checks. The
[Agent-ready environments lesson](../../agent-ready-environments/) explains why
each pillar matters.

## When to use it

Install the skill, then ask for an audit or setup:

> Audit this repository for agent readiness. Read-only, please.

Use it when starting a project, auditing a repository, or reviewing
instructions, skills, and review gates. Run it again after a model release to
see what guidance still helps.

Required checks, branch rules, and review history need code-host API access,
such as `gh api`. Without it, they stay unverified.

## How it works

Each pillar scores from 0 (absent or no verified evidence) to 3 (enforced and
tracked over at least 20 runs or 30 days) on verified evidence only. The
lesson's [score ladder](../../agent-ready-environments/#scoring) defines each
level, and inapplicable pillars are `N/A`.

A read-only audit uses CI results and source inspection and lists skipped local
runs. It separates **advisory** guidance (rules a model may skip) from
**enforced** checks (hooks, deny rules, and required CI).

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/agent-ready-environments/SKILL.md)
has the criteria, audit modes, and evidence rules.

## What you get

- Evidence and a table of scores, gaps, fixes, advisory or enforced
  channels, and whether an agent or a person owns each fix.
- What an agent can do unattended today, where a person still steps in, and
  the fix that unlocks the next step.
- Fixes ordered by blast radius (secrets and irreversible actions), durability,
  then cost.
- Unverified checks, what they need, and where the skill was hard to apply.
