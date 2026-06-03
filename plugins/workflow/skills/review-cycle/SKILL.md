---
name: review-cycle
description: MUST use after any meaningful file edit and before final responses, completion claims, commits, PRs, or broad verification. Performs a focused diff/self-review for scope drift, slop, mistakes, overcomplication, debug leftovers, weak tests, missing verification, and whether a critic pass is needed.
---

# Review Cycle

Use this after meaningful file edits, before claiming work is complete, fixed, ready, or passing. Run it before expensive or broad verification when the diff review may still change code; after fixes, run the narrowest credible verification. Do not use it for read-only exploration, planning-only turns, status updates, or trivial text-only responses.

## Goal

Catch obvious mistakes before final response:

- Did the diff solve the user's actual request?
- Did the work stay within scope?
- Are public contracts, exports, schemas, and generated types still compatible?
- Did verification actually run, and does it prove the relevant claim?
- Is the change risky enough to need a separate critic pass?

## Procedure

1. Inspect the current repo state with `git status --short`.
2. Inspect the focused diff for files you changed.
3. Check for scope drift, accidental unrelated edits, debug leftovers, broad refactors, unsafe casts, weakened tests, and stale comments.
4. Map the change to verification evidence:
   - typecheck, lint, stylelint, and applicable tests when relevant
   - targeted tests first for bug fixes or narrow changes
   - Fallow for supported JS/TS/Vue changes when appropriate
   - explicit "not applicable" notes only when a check genuinely does not fit
5. Run missing narrow verification when feasible.
6. Use a `critic` subagent or equivalent review pass when the change is non-trivial, behavior-changing, public-contract touching, broad, weakly verified, or produced by a worker/subagent.
7. Fix issues found by the review cycle before final response, or report the blocker clearly.

## Critic Pass Trigger

Run a critic pass for:

- public API, exported type, schema, MCP/tool input, or package export changes
- risky refactors or cross-module behavior changes
- user-facing behavior changes without strong focused tests
- broad worker/subagent output
- incomplete or unavailable verification

Skip a critic pass for:

- tiny mechanical edits with clear scope and strong checks
- documentation-only edits where the diff directly matches the request
- read-only or planning-only turns

## Output Guidance

Do not add a separate review report to the final response unless it is useful. The normal final response should summarize what changed, what was verified, and any residual risk.
