# Testing and debugging

Use the path that matches the requested change.

## New or corrected behavior

Follow [Engineering](../SKILL.md)'s baseline, focused regression, production change, and verification sequence. Fix a test error before implementation.

Prefer an observable result to a mock interaction. Use mocks or dependency injection at real boundaries when they make failure paths or timing deterministic.

If an automated test is not practical, reproduce the problem before the fix. Repeat the same reproduction after the fix. State why an automated regression test was not credible.

## Behavior-preserving refactor

1. Identify focused coverage for behavior that must not change.
2. Run it and record the passing baseline.
3. Make one structural change.
4. Run the same coverage again.

If credible coverage does not exist and the refactor risks observable behavior, add characterization coverage that passes before the refactor. For a low-impact structural change, focused inspection and repository checks may suffice. Do not force a failing test for behavior that must stay unchanged.

## Root-cause investigation

Do not patch the first visible symptom.

1. Reproduce the failure with the smallest reliable command.
2. Read the complete error and identify the first relevant failure boundary.
3. Trace the value, state, or control flow backward to its owner.
4. Compare a working path when one exists.
5. Form one evidence-backed hypothesis.
6. Use the smallest experiment that can disprove it.
7. Reuse suitable focused coverage or add a regression test for a credible uncovered failure. Confirm the expected failure before making the fix.

When a check fails after the change, classify it before editing:

- expected red evidence
- implementation regression
- stale or incorrect test
- unrelated existing failure
- infrastructure or environment failure

Do not weaken assertions, hide errors, remove edge cases, or update snapshots blindly. Treat existing tests as intended behavior unless live evidence shows that the contract changed or the test is wrong.

## Documentation and generated files

A red test is usually not useful for prose-only guidance, generated output, or mechanical configuration. Use the strongest replacement evidence. Examples include schema validation, a dry run, a focused diff, or a command that exercises the changed configuration.
