# Pillar 3: Test gates with signal

Source keys refer to the Sources list in [SKILL.md](../SKILL.md).

**Why.** Tests are the main red-or-green check [A1]. Agents tend to mark a
feature complete after unit tests or a `curl` call, and they catch more bugs
when they test end to end as a user would [A3]. The current `/verify` skill makes the same point: confirm against the running app, not tests alone [A5]. The same post keeps the
agent's feature list in JSON, starts every item as failing, and forbids the
agent from removing or editing items to reach done [A3]; the principle carries
to test suites, but the post itself is about the feature list. A review against the spec checks that
each listed edge case has a test [A1]. **[practitioner]** The layer boundaries
and the removal of low-signal tests are field practice, not vendor guidance.
The vendor-side reason they matter: the agent runs and trusts every test, so a
test that cannot fail gives a false green.

**Good looks like.**

- Each layer owns a different risk:
  - **Unit**: pure logic.
  - **Component**: one unit's contract through its public interface.
  - **Integration or contract**: boundaries with real dependencies.
  - **End to end**: a few user journeys.
- Each contract has one primary test at the strongest boundary that reaches it. Another layer adds a test only for a risk the owner cannot reach.
- A regression test fails on the code before the fix.
- A single test file runs with one command. Tests are fast and deterministic.
- Coverage is measured on changed lines. Mutation testing on critical modules (Stryker, mutmut, cargo-mutants) proves the tests can fail.
- Review flags deleted tests and weakened assertions.

Example in this repository: the `test-audit` skill's authoring gate.

**Audit check.**

- The single-file command exists and is in the instruction file.
- Record the flake rate over the last twenty runs of each test workflow. A flake is a test failure on a commit that passes on retry of the same commit with no change. Cancelled runs and failures on different commits are not flakes; report them separately.
- Run a mutation sample on one critical module.
- Sample twenty test declarations (a table-driven test counts once), spread across the layers. Map each to one contract and one credible regression. Mark tests that restate the source, duplicate another layer, or need a test-only production export.

**Anti-patterns.** The same scenario at every layer. Snapshot tests of
implementation detail. Production exports that exist only for tests. Coverage
targets that reward tests with no assertions.
