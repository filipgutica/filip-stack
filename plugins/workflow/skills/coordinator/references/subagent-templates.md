# Subagent Prompt Templates

Use these templates to keep delegated work bounded and host-neutral. Fill in only the task-specific details that matter.

When filling these templates, write the final prompt as prose rather than reproducing the section headers verbatim. The structure below is a checklist of what to cover, not a format to copy literally.

Follow the host's current agent schema and routing policy. Use a role only when it materially improves independence, parallelism, or context management. Match a lighter tier to bounded exploration and routine work; reserve stronger reasoning for synthesis, high-risk review, ambiguous investigation, public contracts, and broad worker output.

## Explorer Template

Use for read-only discovery.

```md
Role: explorer

Task:
<state the bounded question or surface to inspect>

Context:
<what the subagent needs to know that it cannot derive from the task alone — repo area, prior findings, relevant constraints, or key files already identified>

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
- read-only; do not edit files
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
<what the subagent needs to know that it cannot derive from the task alone — approved plan, prior explorer findings, relevant constraints, or key files already identified>

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
- read-only; do not edit or accept work
- inspect the actual diff and available evidence
- report no findings when the result is sound; do not invent churn
```

## Critic Template

Use for bounded adversarial review of plans, diffs, worker output, and validation claims before acceptance.

```md
Role: critic

Task:
<state the worker output, diff, or synthesis to challenge>

Context:
<what the critic needs to know that it cannot derive from the task alone — approved plan, worker findings, relevant constraints, or key files already identified>

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
- read-only; do not edit files
- keep the scope bounded
- stay adversarial and specific
- challenge test changes that do not prove the requested behavior, including unrequested helper extraction, broad fixture churn, focused/skipped tests, debug logging, weakened assertions, and snapshot noise
- challenge public docs, DTO/schema annotations, generated types, examples, descriptions, and API-facing metadata that disappear without an explicit reason
- run a reviewer objection pass:
  - challenge every new special-case branch, unusually sequenced guard, or comment explaining one: can an existing shared path handle it now, or is this duplicating behavior that should stay unified? Is a comment explaining an unavoidable constraint, or rationalizing structure that should be simplified?
  - challenge every new helper, context set, mapping, store mirror, or wrapper that duplicates derivation or ownership: is there an existing source of truth, injectable, composable, utility, or package-owned API that should be reused instead?
  - challenge every type predicate, `as` cast, computed wrapper, lint appeasement, single-purpose scaffold, and `NonNullable<ReturnType<...>>` chain: does it materially narrow or simplify the immediate call site, or is it ceremony? Does an inferred type chain clarify a local incidental shape, or is it indirectly reconstructing a domain contract that should be named at its producer?
  - challenge contract and metadata changes when touched: did required fields, naming, limits, generated schemas, locale copy, and canonical labels stay aligned with the existing contract?
  - challenge async and failure guardrails when touched: what stale-response, race, or error state reaches this path, and does a regression test protect the intended behavior? What real state transition requires each watcher, deferred tick, reset counter, or freshness guard? Could existing source state drive a declarative identity or ordering change? Did the patch create a race and then add guards for its own race? Is there focused evidence that the simpler approach fails? What concrete ordering or lifecycle failure requires each non-default scheduling, batching, flush, deferral, or timing option, and what happens under the default? For remaining guards, what stateful, externally visible, unsafe, or meaningfully expensive boundary does each protect, and can ordering prerequisites coalesce guards separated only by pure work?
  - challenge package and dependency boundaries when touched: are exports, workspace ownership, dependency placement, and shared-package APIs still minimal and compatible?
- do not accept work
- call out missing evidence explicitly
```

## Flow Mapping

- Plan Mode: do not delegate implementation. Use written planning or bounded read-only exploration only when it improves the resulting artifact.
- Bounded coordinator cycle: start with focused local reads; use explorers only for real unknowns and workers only for disjoint implementation ownership. Select no independent reviewer for the fast path, one standard reviewer for routine meaningful work, or one adversarial critic for high-risk, ambiguous, security, contract, concurrency, or broad work. Do not stack the latter two automatically.
- Review-only: use read-only roles only when additional evidence is needed; keep acceptance and final findings in the main thread.
- Investigation: start with focused local reads; use an explorer only when real unknowns remain, then begin an authorized bounded cycle once the fix path is concrete.
- Review feedback: apply `$superpowers:receiving-code-review` when available, verify the feedback, then choose the fast path or a bounded cycle by risk. Feedback does not authorize publish actions.
- Final review cycle: after meaningful edits, run `$workflow:review-cycle` as the main-thread diff and evidence gate. It is not a third reviewer and does not rerun selected independent review unless a revision materially changed the reviewed surface or risk.
