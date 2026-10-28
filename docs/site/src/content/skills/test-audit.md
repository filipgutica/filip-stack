---
related: [review, simplify]
---

## What it does

Test audit checks whether tests justify their maintenance cost. It looks for
credible regression protection, duplicated proof, assertions tied to implementation
details, and production code kept alive only for tests.

## When to use it

- Audit or clean up a selected set of tests.
- Assess substantial coverage changes during [review](../review/).
- Decide whether a new test adds distinct protection.
- Check whether removing a test would lose the last proof of current behavior.

A whole-subsystem campaign needs an explicit request. A read-only audit
produces findings without changing tests or production code.

## How it works

1. Establishes the selected files or exact change range. Authoring mode checks
   new tests; audit mode inspects existing coverage; campaign mode covers a subsystem.
2. Asks what observable behavior a test protects, what regression makes it
   fail, and why existing coverage misses that failure.
3. Reads the complete test, production owner, callers, overlapping tests,
   relevant history, and CI routing before judging removal.
4. Checks for weak assertions, repeated scenarios, source copies, and test-only
   exports or wrappers. Suspicious tests still stay when they independently
   protect a meaningful contract.
5. For authorized edits, keeps proof at the narrowest boundary that can expose
   the failure. It removes obsolete test-only production paths alongside coverage.
6. Runs focused owner and sibling coverage and required repository checks.
   Bug regression tests must fail before the fix and pass afterward.

## What you get

- The audited range, findings, retained false positives, and verification limits.
- For edits, a coverage record naming each added or removed test and its proof.
- Production versus test change counts, owner simplifications, and follow-ups.

The goal is confidence in behavior, not a deletion count. Behavior-preserving
[simplify](../simplify/) work must also preserve meaningful tests.
