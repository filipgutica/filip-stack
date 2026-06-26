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
- Are test changes limited to proving the requested behavior without unrequested helper extraction, fixture churn, focused/skipped tests, debug code, weak assertions, or snapshot noise?
- Did public docs, DTO/schema annotations, descriptions, and generated/API-facing metadata preserve existing information unless intentionally changed?
- Did verification actually run, and does it prove the relevant claim?
- Did a separate read-only critic review meaningful edits before acceptance, or was a narrow skip reason documented?

## Procedure

1. Inspect the current repo state with `git status --short`.
2. Inspect the focused diff for files you changed.
3. Check for scope drift, accidental unrelated edits, debug leftovers, broad refactors, unsafe casts, weakened tests, stale comments, and test artifacts such as unrequested helper extraction, broad fixture churn, focused/skipped tests, temporary logging, or snapshot churn.
4. For public docs, DTOs, schemas, generated types, and API-facing metadata, confirm existing descriptions, annotations, validation decorators, examples, and compatibility details were preserved unless the task intentionally changed them.
5. Map the change to verification evidence:
   - typecheck, lint, stylelint, and applicable tests when relevant
   - targeted tests first for bug fixes or narrow changes
   - Fallow for supported JS/TS/Vue changes when appropriate
   - explicit "not applicable" notes only when a check genuinely does not fit
6. Run missing narrow verification when feasible.
7. Confirm the latest meaningful diff was reviewed by a `critic` subagent or equivalent separate read-only review pass before acceptance. Run or rerun that pass if no critic has reviewed the current diff. The critic should challenge scope, correctness, validation claims, public surface impact, test hygiene, metadata preservation, and unsupported assumptions.
8. Fix issues found by the review cycle before final response, or report the blocker clearly.

## Critic Pass Default

Run a critic pass for meaningful edits, especially:

- public API, exported type, schema, MCP/tool input, or package export changes
- risky refactors or cross-module behavior changes
- user-facing behavior changes without strong focused tests
- broad worker/subagent output
- incomplete or unavailable verification
- test changes that refactor helpers, fixtures, snapshots, assertions, or execution controls beyond what the requested behavior needs
- public docs, DTO/schema, generated type, or API-facing metadata changes that could accidentally remove existing descriptions or annotations

Skip a critic pass only for:

- tiny mechanical edits with clear scope and strong checks
- documentation-only edits where the diff directly matches the request and does not change workflow, policy, public contract/API docs, or user-facing behavior
- read-only or planning-only turns
- hosts where no separate reviewer is available, after stating the limitation

## Output Guidance

Do not add a separate review report to the final response unless it is useful. The normal final response should summarize what changed, what was verified, and any residual risk.
