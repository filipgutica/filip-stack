---
name: review-cycle
description: MUST use after meaningful file edits and before final responses, completion claims, commits, PRs, or broad verification. Performs the main-thread final diff and evidence gate without adding an automatic extra reviewer.
---

# Review Cycle

Use this after meaningful file edits, before claiming work is complete, fixed, ready, or passing. Run it before expensive or broad verification when the diff review may still change code; after fixes, run the narrowest credible verification. Do not use it for read-only exploration, planning-only turns, status updates, or trivial text-only responses.

## Goal

Catch obvious mistakes before final response with a focused main-thread diff and evidence pass:

- Did the diff solve the user's actual request?
- Did the work stay within scope?
- Are public contracts, exports, schemas, and generated types still compatible?
- Can changed contracts and control flow be understood locally without chasing implementation-derived types or relying on comments to justify the structure?
- Are test changes limited to proving the requested behavior without unrequested helper extraction, fixture churn, focused/skipped tests, debug code, weak assertions, snapshot noise, or missing regression coverage for touched failure modes?
- Did public docs, DTO/schema annotations, descriptions, and generated/API-facing metadata preserve existing information unless intentionally changed?
- Did shared paths, source-of-truth ownership, package boundaries, and TypeScript narrowing stay minimal instead of adding special-case branches, duplicate mappings, or appeasement scaffolding?
- Did verification actually run, and does it prove the relevant claim?
- Did the selected review tier fit the change risk, or was a valid fast-path rationale documented?

## Procedure

1. Inspect the current repo state with `git status --short`.
2. Inspect the focused diff for files you changed.
3. Check for scope drift, accidental unrelated edits, debug leftovers, broad refactors, unsafe casts, weakened tests, stale comments, and test artifacts such as unrequested helper extraction, broad fixture churn, focused/skipped tests, temporary logging, or snapshot churn.
4. For TypeScript and async/control-flow changes, make the contract and guard review concrete:
   - If a consumer uses `NonNullable<ReturnType<...>>`, determine whether it clarifies a local incidental shape or reconstructs a domain contract that should instead be named at its producer.
   - Before reviewing guards, challenge whether each new watcher, effect, deferred operation, lifecycle hook, or manual invalidation state is necessary.
   - If a patch creates an async boundary and then guards it, test whether a direct or declarative alternative removes that boundary.
   - Challenge every explicit non-default scheduling, batching, flush, deferral, or timing option: identify the concrete ordering or lifecycle failure it prevents, compare behavior with the default, and retain it only when focused evidence shows the default is insufficient.
   - For every cancellation or freshness check, identify the mutation, side effect, or externally visible boundary it protects and its distinct purpose.
   - When repeated guards are separated only by pure or trivial work, reorder prerequisites and coalesce the guards unless a real boundary requires them to remain separate.
   - Treat comments that explain unusual sequencing as a prompt to simplify first; retain them only for an unavoidable constraint.
5. For public docs, DTOs, schemas, generated types, and API-facing metadata, confirm existing descriptions, annotations, validation decorators, examples, and compatibility details were preserved unless the task intentionally changed them.
6. Map the change to verification evidence:
   - typecheck, lint, stylelint, and applicable tests when relevant
   - smallest causal regression test first for bug fixes or narrow changes
   - Fallow for supported JS/TS/Vue changes when appropriate
   - shared-package typecheck/build and a consumer check when a shared export changes and a consumer is available
   - schema/validation and a dry-run when supported for config or workflow changes
   - configured docs validation, or focused diff review for docs-only work
   - explicit "not applicable" notes only when a check genuinely does not fit, including replacement evidence for a meaningful unavailable check
7. Run missing narrow verification when feasible.
8. Confirm the coordinator selected and completed the appropriate review tier: no independent reviewer only for a valid tiny fast path, one standard reviewer for routine meaningful work, or one adversarial critic for high-risk, ambiguous, security, contract, concurrency, or broad work. This gate does not add a third reviewer or rerun the selected review unless a revision materially changed the reviewed surface or risk.
9. Fix issues found by the review cycle before final response, or report the blocker clearly.

## Review-Tier Evidence

The coordinator chooses one proportionate review tier before this gate:

- no independent reviewer for a tiny mechanical fast path with clear scope and strong targeted checks;
- one standard reviewer for routine meaningful work;
- one adversarial critic for high-risk, ambiguous, security, contract, concurrency, or broad work.

Do not stack a standard reviewer and critic by default. If the host cannot provide the selected independent role, document the limitation and strengthen the main-thread evidence instead. Review-cycle evaluates that decision and the current diff; it is not a substitute for the chosen review.

## Output Guidance

Do not add a separate review report to the final response unless it is useful. The normal final response should summarize what changed, what was verified, and any residual risk.
