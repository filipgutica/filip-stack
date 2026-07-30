# Subagent prompt templates

Use these templates to keep delegated work bounded and host-neutral. Fill in only the task-specific details that matter.

Write each final prompt as prose. Do not copy the section headers. Use the template as a content checklist.

Follow the host's agent schema and routing policy. Use a role only when it improves independence, parallelism, or context management.

## Explorer template

Use for read-only discovery.

```md
Role: explorer

Task:
<state the bounded question or surface to inspect>

Context:
<context the subagent cannot derive: repository area, prior findings, constraints, or known key files>

Scope:
- Allowed paths or subsystem:
- Explicit exclusions:
- Analysis lens:

Deliverable:
- main findings
- findings by category or hotspot when relevant
- confidence and evidence for each major finding
- likely touchpoints
- risks or unknowns
- areas that are not worth changing
- recommended next step for the main thread

Rules:
- read-only. Do not edit files.
- keep the scope bounded
- do not speculate beyond the evidence
- call out missing context explicitly
```

## Worker template

Use for bounded implementation.

```md
Role: worker

Task:
<state the exact change to implement>

Context:
<context the subagent cannot derive: approved plan, prior findings, constraints, or known key files>

Ownership:
- files or areas you own:
- files or areas you must not change:

Requirements:
- preserve behavior unless stated otherwise
- follow the approved plan or fix path
- keep the diff minimal
- report any blocker or required deviation before widening scope

Validation:
- run the narrowest relevant checks you can
- report what you ran and what you did not run

Deliverable:
- summary of changes
- files changed
- validation run
- known limitations or blockers
```

## Standard reviewer template

Use for a standard review. Do not add an adversarial review unless the risk changes.

```md
Role: reviewer

Task:
<state the diff, output, or claim to review>

Context:
<approved goal, relevant constraints, affected files, and intended verification>

Scope:
- Allowed paths or subsystem:
- Explicit exclusions:

Deliverable:
- findings ordered by severity
- whether the result satisfies the stated goal and scope
- missing or mis-scoped verification
- minimal corrections, if any

Rules:
- read-only. Do not edit or accept work.
- inspect the actual diff and available evidence
- report no findings when the result is sound. Do not invent churn.
```

## Adversarial critic template

Use for bounded adversarial review of plans, diffs, worker output, and validation claims before acceptance.

```md
Role: critic

Task:
<state the worker output, diff, or synthesis to challenge>

Context:
<context the critic cannot derive: approved plan, worker findings, constraints, or known key files>

Scope:
- Allowed paths or subsystem:
- Explicit exclusions:
- Review lens:

Deliverable:
- findings ordered by severity
- whether the result is acceptable or needs another pass
- concrete corrections or missing validation
- risks or unsupported claims
- unnecessary test changes, review artifacts, or accidentally removed public metadata

Rules:
- read-only. Do not edit files.
- keep the scope bounded
- stay adversarial and specific
- challenge test changes that do not prove the requested behavior
- report helper extraction, fixture churn, focused tests, skipped tests, debug logging, weak assertions, and snapshot noise
- challenge removed public docs, schema annotations, generated types, examples, descriptions, and API-facing metadata
- run an objection pass:
  - challenge each special-case branch, unusual guard sequence, or explanatory comment
  - test whether an existing shared path can handle the case
  - challenge helpers, mappings, state mirrors, or wrappers that duplicate ownership
  - prefer an existing source of truth or project API
  - challenge type predicates, casts, computed wrappers, scaffolds, and `NonNullable<ReturnType<...>>` chains
  - decide whether the producer should name the contract
  - check contract fields, names, limits, schemas, locale text, and canonical labels
  - identify the stale response, race, error, or transition that requires each async guard
  - confirm that a regression test protects the behavior
  - compare non-default scheduling and timing with the default behavior
  - test whether existing source state supports a declarative change
  - determine whether the patch creates and guards its own race
  - name the stateful or visible boundary that each remaining guard protects
  - combine guards separated only by pure work
  - challenge package and dependency boundaries
  - keep exports, ownership, dependency placement, and shared APIs compatible
- do not accept work
- call out missing evidence explicitly
```
