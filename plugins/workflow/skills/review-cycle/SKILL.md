---
name: review-cycle
description: MUST use after any meaningful file edit and before final responses, completion claims, commits, PRs, or broad verification. Performs final diff triage and confirms separate critic coverage for scope drift, slop, mistakes, overcomplication, test artifacts, debug leftovers, weak tests, and missing verification.
---

# Review Cycle

Use this after meaningful file edits, before claiming work is complete, fixed, ready, or passing. Run it before expensive or broad verification when the diff review may still change code; after fixes, run the narrowest credible verification. Do not use it for read-only exploration, planning-only turns, status updates, or trivial text-only responses.

## Goal

Catch obvious mistakes before final response without relying on same-thread acceptance alone:

- Did the diff solve the user's actual request?
- Did the work stay within scope?
- Are public contracts, exports, schemas, and generated types still compatible?
- Can changed contracts and control flow be understood locally without chasing implementation-derived types or relying on comments to justify the structure?
- Are test changes limited to proving the requested behavior without unrequested helper extraction, fixture churn, focused/skipped tests, debug code, weak assertions, snapshot noise, or missing regression coverage for touched failure modes?
- Did public docs, DTO/schema annotations, descriptions, and generated/API-facing metadata preserve existing information unless intentionally changed?
- Did shared paths, source-of-truth ownership, package boundaries, and TypeScript narrowing stay minimal instead of adding special-case branches, duplicate mappings, or appeasement scaffolding?
- Did verification actually run, and does it prove the relevant claim?
- Did a separate read-only critic review meaningful edits before acceptance, or was a narrow skip reason documented?

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
   - explicit "not applicable" notes only when a check genuinely does not fit
7. Run missing narrow verification when feasible.
8. Confirm the latest meaningful diff was reviewed by a `critic` subagent or equivalent separate read-only review pass before acceptance. Run or rerun that pass if no critic has reviewed the current diff. The critic should challenge scope, correctness, validation claims, public surface impact, test hygiene, metadata preservation, unsupported assumptions, and the reviewer objection pass in its template.
9. Fix issues found by the review cycle before final response, or report the blocker clearly.

## Critic Pass Default

Run a critic pass for meaningful edits, especially:

- public API, exported type, schema, MCP/tool input, or package export changes
- risky refactors or cross-module behavior changes
- user-facing behavior changes without strong focused tests
- broad worker/subagent output
- incomplete or unavailable verification
- test changes that refactor helpers, fixtures, snapshots, assertions, or execution controls beyond what the requested behavior needs
- public docs, DTO/schema, generated type, or API-facing metadata changes that could accidentally remove existing descriptions or annotations
- new special-case branches, duplicate mappings or helpers, type predicates, `as` casts, wrapper helpers, negative or edge tests, schema/metadata divergences that may be ceremony after a contract change, or package boundary changes that may duplicate existing ownership

Skip a critic pass only for:

- tiny mechanical edits with clear scope and strong checks
- documentation-only edits where the diff directly matches the request and does not change workflow, policy, public contract/API docs, or user-facing behavior
- read-only or planning-only turns
- hosts where no separate reviewer is available, after stating the limitation

## Output Guidance

Do not add a separate review report to the final response unless it is useful. The normal final response should summarize what changed, what was verified, and any residual risk.
