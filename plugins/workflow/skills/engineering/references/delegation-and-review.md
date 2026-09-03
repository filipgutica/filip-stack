# Delegation and review

Use delegation to reduce context or latency, or to add genuine independence. Do not delegate tightly coupled work that the main thread can complete with less coordination.

## Task boundaries

A delegated task must define:

- one outcome
- owned files or a read-only responsibility
- required inputs and known constraints
- an observable completion signal
- actions that remain unauthorized

Use dependency order. Run tasks in parallel only when neither task needs the other's result and their writes cannot overlap. Keep one writer for an overlapping area. Return compact evidence instead of a transcript.

The main thread owns integration, scope, and acceptance. A worker does not accept its own work.

## Independent review

Use proportional review:

- Tiny mechanical changes can use main-thread diff inspection.
- Meaningful changes use a separate review context when available.
- Broad, ambiguous, security-sensitive, or public-contract changes use an adversarial reviewer.

Give the reviewer:

- the requested outcome and non-goals
- the exact diff, branch range, or changed files
- relevant contract and test evidence
- known limits without coaching it toward acceptance

Ask for action-required findings only. Each finding must name the affected location, concrete evidence, impact, and smallest correction.

Review is independent only when a separate reviewer identity or context inspected the actual change. Self-review, an unscoped approval, or a claim without an artifact does not qualify.

Verify reviewer findings against live code and the task contract. Reject style preferences, stale assumptions, and scope expansion. Apply valid findings only with implementation authority, then rerun affected checks. Reuse the same reviewer for correction verification unless a fresh judgment is necessary.

If separate review is unavailable, perform a careful diff inspection and report that independent review did not run.

## Review feedback from the user

Treat supplied feedback as a hypothesis until it matches the live code and contract.

1. Locate the exact code and current behavior.
2. Check the requested correction against callers, tests, and ownership.
3. Explain whether the concern is valid, invalid, already addressed, out of scope, or blocked by missing evidence.
4. Make a correction only when the user authorized edits.
