# Subagent Prompt Templates

Use these templates to keep delegated work bounded and host-neutral. Fill in only the task-specific details that matter.

Write each final prompt as prose. Do not copy the section headers. Use the template as a content checklist.

Follow the host's current agent schema and routing policy. Use a role only when it improves independence, parallelism, or context management. Use lighter tiers for bounded or routine work. Use stronger reasoning for synthesis, high-risk review, ambiguous investigation, public contracts, and broad worker output.

## Explorer Template

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

## Worker Template

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

## Standard Reviewer Template

Use for one independent routine review of meaningful work. Do not pair it with an adversarial critic unless a changed risk explicitly requires escalation.

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

## Critic Template

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
- challenge test changes that do not prove the requested behavior, including unrequested helper extraction, broad fixture churn, focused or skipped tests, debug logging, weakened assertions, and snapshot noise
- challenge public docs, DTO/schema annotations, generated types, examples, descriptions, and API-facing metadata that disappear without an explicit reason
- run a reviewer objection pass:
  - challenge each new special-case branch, unusual guard sequence, or explanatory comment. Can an existing shared path handle it? Does the comment explain an unavoidable constraint?
  - challenge each helper, context set, mapping, state mirror, or wrapper that duplicates ownership. Prefer an existing source of truth or project API.
  - challenge each type predicate, cast, computed wrapper, tool-appeasement change, scaffold, or `NonNullable<ReturnType<...>>` chain. Does it simplify the call site? Should the producer name the contract?
  - challenge contract and metadata changes. Check required fields, names, limits, schemas, locale text, and canonical labels against the existing contract.
  - challenge async and failure guards. Identify the stale response, race, error, or state transition that requires each guard. Confirm that a regression test protects the behavior. Test default scheduling, batching, flush, deferral, and timing behavior. Check whether existing source state supports a declarative change. Determine whether the patch creates and then guards its own race. For each remaining guard, name the stateful, visible, unsafe, or expensive boundary it protects. Combine guards separated only by pure work.
  - challenge package and dependency boundaries. Keep exports, ownership, dependency placement, and shared APIs minimal and compatible.
- do not accept work
- call out missing evidence explicitly
```

## Flow Mapping

- Planning: do not delegate implementation. Use read-only exploration only when it improves the artifact. Branch-ledger planning requires an explicit user request and an established branch. It may update only the external ledger. It cannot create or switch branches, edit repository files, commit, push, or publish.
- Investigation: start with focused local reads. Use an explorer only for specific unknowns. Explore, hypothesize, test, validate or revise, then present. Do not implement without separate explicit authority.
- Implementation: use workers only for separate implementation ownership. Select no reviewer for the fast path, one standard reviewer, or one adversarial critic by risk. Do not stack review tiers by default.
- Review-only: use read-only roles only when more evidence is needed. Keep acceptance and final findings in the main thread.
- Review feedback: apply `$superpowers:receiving-code-review` when available, verify the feedback, then choose the fast path or a bounded cycle by risk. Feedback does not authorize publish actions.
- Named-ticket end-to-end: only explicit authority permits branch setup, per-task commits, push, and a draft pull request. Use the ledger and one bounded coordinator cycle per task.
- Final review cycle: after meaningful edits, run `$workflow:review-cycle` as the main-thread acceptance gate. It confirms the completed review or invokes the missing tier. It does not duplicate a review that still covers the current surface and risk.
