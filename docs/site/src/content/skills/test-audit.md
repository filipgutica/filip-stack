---
related: [review, simplify-pass]
---

## What it does

Name tests, a change, or a subsystem, and say whether edits are authorized or
read-only. The agent reads each test with its code and flags low-value tests,
removing them only when authorized. It keeps doubtful tests guarding real
behavior alone, and removes test-only hooks when authorized edits move tests to
real boundaries. You get findings, kept tests, and edit summaries.

## When to use it

Install [Workflow](../../#install) and name what to audit.
[Engineering](../engineering/) and [review](../review/) invoke it for explicit
audits, substantial coverage changes, or uncertain test value or preservation
(routine edits stay in Engineering). Say read-only for no edits:

> Audit the tests in `src/billing/` for duplicates and implementation-coupled
> assertions. Read-only, please.

## How it works

- **Authoring:** new or changed tests as written.
- **Audit:** existing tests in the named scope.
- **Campaign:** one subsystem (explicit request only).

1. It checks the guarded behavior, what bug breaks it, and why other tests miss
   it.
2. When authorized, tests needing test-only exports move to real boundaries and
   weak new tests fail.
3. Before deleting a test, it names remaining proof or the retired contract.
4. After edits, it reruns affected tests. Before landing removal batches, it
   runs available unused file, export, and dependency checks.

**Campaign mode:** On request, it baselines a subsystem and plans suite changes,
ending there with findings for read-only runs. Authorized campaigns apply edits
and have independent reviewers verify no behavior lost its last guard
([campaign.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/test-audit/references/campaign.md)).

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/test-audit/SKILL.md)
and
[value-criteria.md](https://github.com/filipgutica/filip-stack/blob/main/plugins/workflow/skills/test-audit/references/value-criteria.md)
have the criteria.

## What you get

- Audited range, findings, kept tests with reasons, and limits.
- For edits, proof per added or removed test and production versus test line
  counts.

Commits, pushes, and PRs require authorization.
