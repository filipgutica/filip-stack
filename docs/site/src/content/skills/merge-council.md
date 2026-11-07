---
related: [review, full-send]
---

## What it does

An independent chair runs the council separately from your agent. Three
reviewers inspect the whole PR from different angles. All three must agree on
a finding's problem, remedy, and merge-blocking status. Verdicts apply only to
reviewed commits.

## When to use it

Install the skill with the command above, then explicitly ask for a merge
council. A general "review this PR" uses a lighter route such as
[review](../review/).

Invoke `/merge-council` in Claude or `$merge-council` in Codex with a PR URL,
for example `/merge-council https://github.com/acme/app/pull/42`. With no
argument, it uses the current branch's PR.

The host must let the chair launch its own helper agents. A roster names the
chair and three reviewers for that host. The first run sets it up if missing;
use `/merge-council setup` in Claude or `$merge-council setup` in Codex to
change it. Setup proposes each role's model and asks you to confirm or change it.

## How it works

Each reviewer covers the whole PR with an additional focus:

| Reviewer | Focus |
| --- | --- |
| Contract and guidance | Correctness, project rules, patterns, and scope |
| Risk | Blast radius, rollback, compatibility, migrations, security, and performance |
| Simplicity and evidence | Complexity, reuse, dead code, tests, and coverage |

On your own open PR with push access, fix mode applies agreed findings marked
safe to fix. A fixer commits and pushes; reviewers recheck the whole PR. At
most two fix pushes are allowed. Other PRs get reports without fixes.

Changes to instruction files such as `AGENTS.md` or `CLAUDE.md` always force
`NEEDS_HUMAN`; the review still runs. The council stops as incomplete at its
120-minute limit.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/merge-council/SKILL.md)
links the roster setup, chair procedure, and verdict rules.

## What you get

- `APPROVE`, `CHANGES_REQUESTED`, or `NEEDS_HUMAN` for the reviewed commits.
- A short report: merge readiness, prerequisites, and non-blocking findings.
- A detailed `record.json`; another run continues from the record after you
  address its open items.

Before acting on approval, your agent verifies that PR head and base still
match the reviewed commits and CI passes. It merges only if repository
guidance permits merging on council approval; otherwise it reports readiness.
[Full-send](../full-send/) can finish open council items.
