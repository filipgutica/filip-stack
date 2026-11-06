---
related: [pr-review-churn, test-audit]
---

## What it does

The audit scores eight areas an agent needs to finish work with evidence:
code structure, static checks, tests, documentation, review, a runnable
environment, bounded autonomy, and evaluated guidance. You get a fix order
based on the gaps it finds.

For the reasoning behind the audit, read the
[Agent-ready environments lesson](../../agent-ready-environments/).

## When to use it

Install the skill with the command above. Then ask for the audit you need;
the agent selects it when your request matches. For example:

> Audit this repository for agent readiness. Read-only, please.

Use it when starting a project, auditing an existing repository, or reviewing
instruction files such as `AGENTS.md` and `CLAUDE.md`, skills, and review gates.
Revisit guidance after a model release to check what still helps.

For a read-only audit, the agent uses CI results and source inspection and
lists skipped local runs. Required checks, branch rules, and review history
need read access to the code host's API, such as `gh api`. Without access,
those checks stay unverified.

## How it works

Each area, called a pillar, gets the highest score its verified evidence supports:

| Score | Meaning |
| --- | --- |
| 0 | Missing, or no verified evidence |
| 1 | Present, but not runnable as a whole |
| 2 | Runnable, with its observable audit check met |
| 3 | Runnable and enforced at the action it guards, with results tracked over at least 20 runs or 30 days |

A fresh checkout must reach a seeded, healthy app with one command for the
environment pillar's runnable check. Pillars that do not apply are marked
N/A and excluded from totals. Skipped checks cannot raise a score.

The audit also distinguishes advisory guidance, which the model may decide
does not apply, from enforced checks such as hooks, deny rules, and required
CI. Rules with no exceptions belong in enforcement.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/agent-ready-environments/SKILL.md)
has the pillar criteria, audit modes, and evidence rules.

## What you get

- An evidence section and a table of scores, gaps, proposed fixes, and whether
  each fix is advisory or enforced.
- Fixes ordered first by protection of secrets, protected paths, and irreversible
  actions, then by durability and cost.
- Unverified checks, what running them needs, and gaps in the skill itself.
