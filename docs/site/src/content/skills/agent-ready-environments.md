---
related: [pr-review-churn, test-audit]
---

## What it does

An agent stops when its work looks done. Whether looking done means being done
depends on the repository: whether the agent can start the app, run the tests,
and get a clear pass or fail. This skill scores how well a repository gives the
agent those things, and lists the fixes in the order that pays off most.

The [Agent-ready environments lesson](../../agent-ready-environments/) explains
the ideas behind it in full.

## When to use it

- You are starting a project and want checks in place from the first commit.
- You want to audit an existing repository.
- You want to audit your agent guidance: instruction files such as
  `AGENTS.md` or `CLAUDE.md`, skills, and review steps.
- A new model has shipped, and you want to check which guidance still helps.

Install it with the command above, then ask for an audit in plain words. An
illustrative request:

> Audit this repository for agent readiness. Read-only, please.

## How it works

The skill looks at eight *pillars*, the areas an agent depends on, such as
static checks, tests, documentation, and a reproducible environment, meaning
the app starts with one command in a fresh checkout, with seed data. It scores
each pillar from 0 to 3:

| Score | Meaning |
| --- | --- |
| 0 | Missing, or no verified evidence |
| 1 | Present, but not yet runnable as a whole |
| 2 | Runnable, and the pillar's audit check passes |
| 3 | Enforced and measured: it blocks the action it guards, such as a merge, and its results are tracked over at least 20 runs or 30 days |

A pillar that does not apply is marked N/A with a reason and left out of the
total. A check the audit could not run cannot raise a score, and it is listed
as unverified.

The skill also sorts guidance into two kinds. Advisory guidance, such as an
`AGENTS.md` line, is something the model may decide does not apply. Enforced
guidance, such as a hook, a deny rule, or a required CI check, runs whatever
the model decides. A rule with no exceptions belongs in the enforced kind.

A read-only audit uses CI results and source reading and lists the local runs
it skipped. Checking required checks, branch rules, and review history needs
read access to your code host's API, for example `gh api`; without it, those
items are marked unverified.

## What you get

- An evidence section, then a table with each pillar's score, evidence, main
  gap, proposed fix, and whether that fix is advisory or enforced.
- Fixes in order: rules that protect secrets, protected paths, and actions you
  cannot undo come first, then the fixes that last longest, then the cheapest.
- The checks it skipped, what running them needs, and where the skill was hard
  to apply.
