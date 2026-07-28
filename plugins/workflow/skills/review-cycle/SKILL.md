---
name: review-cycle
description: Use after meaningful file edits and before final responses, completion claims, commits, pull requests, or broad verification.
---

# Review Cycle

Use this after meaningful file edits and before completion claims. Review the diff and ensure that the work receives one proportionate independent review tier before broad verification. After fixes, run the narrowest credible checks. Do not use it for read-only work, planning, status updates, or trivial text responses.

## Goal

Catch mistakes before final response with a focused main-thread diff, one proportionate independent review tier, and current verification evidence:

- Did the diff solve the user's actual request?
- Did the work stay within scope?
- Are public contracts, exports, schemas, and generated types still compatible?
- Can changed contracts and control flow be understood locally without chasing implementation-derived types or relying on comments to justify the structure?
- Do test changes prove only the requested behavior and its touched failure modes? Are they free of unrelated churn and weak assertions?
- Did public docs, DTOs, schemas, generated types, and API-facing metadata preserve existing information unless the task changed it?
- Did shared paths, source-of-truth ownership, package boundaries, and TypeScript narrowing stay minimal? Did the change avoid special-case branches, duplicate mappings, and tool-appeasement code?
- Did verification actually run, and does it prove the relevant claim?
- Did the selected review tier fit the change risk, or was a valid fast-path rationale documented?

## Procedure

1. Inspect the current repo state with `git status --short`.
2. Inspect the focused diff for files you changed.
3. Check for scope drift, unrelated edits, debug code, broad refactors, unsafe casts, weakened tests, and stale comments. Check for unrequested helper extraction, fixture churn, focused or skipped tests, temporary logging, and snapshot churn.
4. For TypeScript and async/control-flow changes, make the contract and guard review concrete:
   - If a consumer uses `NonNullable<ReturnType<...>>`, decide whether it clarifies a local shape. Name stable domain contracts at their producer.
   - Before reviewing guards, challenge whether each new watcher, effect, deferred operation, lifecycle hook, or manual invalidation state is necessary.
   - If a patch creates and guards an async boundary, test whether a direct or declarative alternative removes it.
   - Challenge every explicit non-default scheduling, batching, flush, deferral, or timing option. Identify the failure it prevents. Compare it with the default behavior. Keep the option only when focused evidence shows that the default is insufficient.
   - For each cancellation or freshness check, identify its protected mutation, side effect, or externally visible boundary and distinct purpose.
   - When only pure or trivial work separates repeated guards, reorder prerequisites and combine the guards. Keep separate guards only at a real boundary.
   - Treat comments about unusual sequencing as a reason to simplify first. Keep them only for unavoidable constraints.
5. For public docs, DTOs, schemas, generated types, and API-facing metadata, confirm that the change preserves existing information. Check descriptions, annotations, decorators, examples, and compatibility details unless the task changes them.
6. Select or confirm one review tier before broad verification:
   - Use no independent reviewer only for a tiny mechanical, low-risk, non-behavioral fast path with clear scope and strong targeted checks.
   - For routine meaningful work, prefer the runtime's native or default code-review capability when it can inspect the actual diff and evidence and return a review result. Otherwise, use one read-only standard reviewer with the coordinator's standard reviewer template.
   - For high-risk, ambiguous, security, contract, concurrency, or broad work, use one read-only adversarial critic with the coordinator's critic template.
   - If the selected review already covered the current diff and risk, do not add another reviewer.
7. Run the selected review when it is missing, then apply valid findings. Repeat that review only when a revision materially changes the reviewed surface or risk. If the risk increases, select the stronger tier before acceptance.
8. Map the accepted change to verification evidence:
   - type checks, lint, style checks, and applicable tests when relevant
   - smallest causal regression test first for bug fixes or narrow changes
   - Fallow for supported JS/TS/Vue changes when appropriate
   - shared-package typecheck/build and a consumer check when a shared export changes and a consumer is available
   - schema/validation and a dry-run when supported for config or workflow changes
   - configured docs validation, or focused diff review for docs-only work
   - explicit "not applicable" notes only when a check genuinely does not fit, including replacement evidence for a meaningful unavailable check
9. Run missing narrow verification when feasible. Re-run checks affected by review corrections.
10. Fix issues found by the review cycle before final response, or report the blocker clearly.

## Review-Tier Evidence

The review cycle ensures that the current diff receives one proportionate review tier. The coordinator can complete that review before this gate. If it did not, this skill invokes the missing tier:

- no independent reviewer for a tiny mechanical, low-risk, non-behavioral fast path with clear scope and strong targeted checks
- one runtime-native review or read-only standard reviewer for routine meaningful work
- one adversarial critic for high-risk, ambiguous, security, contract, concurrency, or broad work.

A runtime-native review satisfies the standard tier only when it independently inspects the actual diff and evidence and returns findings or an explicit no-finding result. If it cannot, treat it as unavailable and use the standard reviewer template. Do not stack a standard reviewer and critic by default. Escalate to the critic only when the risk changes or the standard review exposes a higher-risk concern. If the host lacks the selected capability or role, document the limit and strengthen the main-thread evidence.

## Output Guidance

Do not add a separate review report to the final response unless it is useful. The normal final response should summarize what changed, what was verified, and any residual risk.
