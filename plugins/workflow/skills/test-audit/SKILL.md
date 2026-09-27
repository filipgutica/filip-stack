---
name: test-audit
description: "Invoke whenever writing, changing, reviewing, or sweeping tests. Authoring gate for new tests plus audit workflow for low-value, implementation-coupled, or duplicative tests and the test-only production seams they demand."
---

# Test Audit

Three modes, one value bar. Authoring mode gates every new or changed test at
write time. Audit mode runs focused sweeps of tests that re-assert source,
duplicate stronger proof, couple behavior to implementation, or keep test-only
production seams alive. Continue broad audits as separate coherent follow-up
PRs; optimize for confidence, not deletion count. Campaign mode prunes one
whole subsystem's test surface (every test file a plugin or core area owns);
before starting one, read [campaign guidance](references/campaign.md).

## Authoring gate

Before adding any test, answer four questions; a missing answer means do not
add it yet:

1. What observable behavior, invariant, or independent contract does it protect?
2. What credible regression makes it fail?
3. Why does existing coverage not already catch that failure? Each contract has
   one primary test owner at the strongest boundary; another layer needs its
   own distinct risk, such as a transport or lifecycle failure the owner cannot
   reach. Prefer extending a table-driven case or shared fixture over a
   near-duplicate test; consolidate duplicated setup in the same change.
4. Does it need a production seam (export, flag, wrapper, injection hook) that no
   production caller needs? If yes, move the test to the real boundary instead.

Then check the test against every [junk pattern](references/value-criteria.md#junk-patterns); a match fails
the gate unless the [retention bar](references/value-criteria.md#retention-bar) names the contract it
independently guards. A test that would break under behavior-preserving
refactoring is asserting implementation, not behavior; rewrite it at the
owning boundary before landing it.

Bug regression tests must fail on the pre-fix code for the intended reason and
pass after the owner-boundary repair. A regression test that never demonstrably
failed does not establish that it detects the bug. One regression at the owner boundary
covers the bug; do not replay the same scenario at every layer it crosses.

## Value bar

Tests justify their maintenance cost by protecting behavior, a credible
regression, or an independently meaningful contract. In an audit, an existing
test that must change for behavior-preserving source reorganization is suspect,
not automatically deletable; the authoring gate still rejects new ones.

Before judging a candidate, read the complete test and production owner, its
entry point, callers, callees, sibling implementations, overlapping tests, CI
routing, and relevant history. Read root and scoped `AGENTS.md` files first.
When the test claims dependency-backed behavior, inspect the dependency source
or types directly.

## Focused PR gate

Before pushing or merging, audit every added or changed test and affected
test-only production seam in the exact base-to-head range alongside the
existing review gates. Include removed tests when deletion can remove the
only proof of a contract. Read [value criteria](references/value-criteria.md)
and apply the authoring gate, junk patterns, and retention bar to each test.
Trace overlapping coverage to establish the primary owner; keep broader
cleanup outside this gate. For a wider sweep, use
[discovery guidance](references/value-criteria.md#discovery).

Check assertions against the production owner, not just the test name. For
TDD, a red-to-green result must fail for the intended behavior, not a broken
fixture or an unrelated guard. Apply the authoring gate before writing the
red test. Characterization tests for unchanged behavior should pass on the
baseline; they do not need an artificial red result.

Record the audited base and head, findings, regression evidence, and limits.
With no test changes or affected test seams, record “not applicable.” Recheck
the range before merging; repeat affected portions when later changes
invalidate the audit. An unresolved finding or required evidence that could
not be verified leaves the gate incomplete. Passing tests do not replace
this audit, and this audit does not replace required checks.

Read-only audit requests authorize findings, not fixes. Use the
[candidate evidence and edit shape](references/value-criteria.md#candidate-evidence)
before deleting a test, and edit only within existing implementation authority.

## Validation

Wait for test runners in the checkout to finish before editing source or tests.
Use the repository's declared runner, package manager, scoped instructions,
and CI routing; do not assume commands from another project exist.

1. Run the smallest owner and sibling coverage for the affected contract.
2. For removed source greps or plan assertions, run the executable script or
   dry-run that owns the real contract.
3. Run targeted formatting and the repository's diff check.
4. Run the changed-file gate and other mandatory checks required by repository
   policy. Report blocked or unavailable proof as unverified.
5. Inspect the diff statistics; report production/tooling separately from tests
   and test support when an audit changes files.
6. After final audit edits, follow the existing independent review requirements
   in [delegation and review](../engineering/references/delegation-and-review.md).
   Include the focused test audit in that review assignment.

## Landing and continuation

Commit, push, open a PR, or land only when authorized. Use the repository's
landing procedure and the focused PR gate above. Land one coherent PR at a
time; after landing, refresh from current main and rerun read-only discovery
for the next high-confidence batch.

## Handoff

Report the audited range, findings or no findings, retained false positives,
proof actually run, and limits. For edits, also report removed low-value
categories, production owner simplifications, production versus test LOC,
PR and merge state, and named follow-ups.
