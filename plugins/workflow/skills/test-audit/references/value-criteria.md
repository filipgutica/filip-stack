# Test value criteria

Use this checklist for every new or changed test and every audit candidate.

## Layer selection

A contract's primary owner is the narrowest boundary that can credibly expose its failure. That is the "strongest boundary" in the [authoring gate](../SKILL.md#authoring-gate). Other layers cover only their distinct wiring, lifecycle, transport, or user-visible risks. When an owner suite iterates a shared registry, such as a field list, operator table, or fixture map, the new registry entry is the test; a bespoke per-entry test needs a risk the loop cannot reach. Neither a coverage percentage nor a test count establishes sufficiency.

## Junk patterns

The shared checklist for both modes: the authoring gate rejects a new test that
matches one, and audits hunt for existing tests that do.

- assertion-free coverage probes;
- self-comparisons and identity copiers;
- copied fixtures, inventories, manifests, or export lists;
- exact source, import, or string greps;
- private predicate or call-shape tests duplicated at real boundaries;
- repeated scenarios or assertions that add no distinct failure detection;
- provider-, field-, or entity-local replays of shared helpers or validation,
  such as a per-field accept and reject matrix for a generic filter class;
- tests whose only purpose is preserving test-only exports, globals, or wrappers;
- dead production code whose only callers are tests;
- expected values produced by the helper or renderer under test;
- mocks that implement the asserted behavior, or one identical mock standing in
  for different APIs;
- fixtures that supply the receipt, admission, or callback ordering the owner
  should produce, or persistence asserted against a store the path never writes;
- capability tests that restate declared flags instead of exercising the
  delivery or acknowledgement the flag promises;
- negative controls that pass for an unrelated reason, such as a denial from a
  different guard or a rejection the production path never reaches;
- names or fixtures that promise more than the input exercises, such as a
  "retires the window" test asserting the window was not cleared;
- misdirected guards: a test named for one feature whose real contract is an
  unrelated cross-cutting change, such as a schema-wide `oneOf` to `anyOf`
  switch; name and scope it to that contract, or move it with the change.

## Retention bar

Keep a test when it independently enforces a public API, plugin SDK, protocol,
config, migration, storage, security, platform, default, prompt-byte, generated
cross-language, package, release, or architecture contract. Also keep:

- call ordering when order is observable behavior;
- regressions with a credible failure mode;
- source inspection when it is the cheapest independent guard: it fails when
  the contract changes (the user-facing key, byte, or path) and survives an
  identifier-only refactor;
- a retained test that fails on the baseline: treat it as a possible product
  bug, reproduce it, and repair the owner rather than deleting it;
- the last proof of a current behavior or acceptance criterion: a test whose
  removal leaves no remaining test that fails when that behavior breaks.

Static or slow is not a deletion reason. A test that resembles implementation
may still be the independent contract; prove otherwise before removing it.

## Candidate evidence

Record every field below before editing. A missing field means the candidate is
not ready for deletion:

- exact test name and location;
- what failure it can actually detect;
- non-test callers of the covered production or support seam;
- its [coverage record](#coverage-record) entry, or why its contract is obsolete;
- relevant history and the reason the test or seam exists;
- production or test-support deletion unlocked;
- risk and the focused validation command.

## Coverage record

Write one entry per added or removed test in the handoff, judged against the
final diff. Each entry names concrete tests as `file:test name`:

- added test: the regression it catches and the existing test that misses it;
- removed test: one remaining test that runs the removed case's inputs and
  fails when that behavior breaks, confirmed by reading its inputs and
  assertions; or, when the contract itself is obsolete, the change or decision
  that retired it.

## Edit shape

Choose one coherent owner-boundary batch. Delete obsolete test-only exports,
globals, wrappers, and dead production paths instead of preserving aliases.
Move retained regressions to their canonical owners. Consolidate repeated
package or dependency assertions into one generic contract.

Prefer net-negative production LOC. Do not add replacement tests that restate
the same implementation, and do not convert uncertain candidates into cleanup
to increase deletion counts.


## Discovery

Keep discovery read-only and report evidence before editing. For broad scope,
run parallel discovery lanes when available:

- core and packages (`src/`, `packages/`);
- plugins (`extensions/`);
- UI, apps, scripts, and tooling;
- a cross-cutting pattern sweep.

Outside campaign mode, prefer a few high-confidence candidates over a large
speculative inventory. Hunt for the [junk patterns](#junk-patterns).
