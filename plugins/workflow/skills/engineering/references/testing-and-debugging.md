# Testing and debugging

Use the path that matches the requested change.

## New or corrected behavior

1. Identify suitable existing coverage for the requested observable behavior and run the narrowest command that executes it, recording the baseline.
2. If coverage observes the contract, use it as the baseline; add a focused regression test only for a specific uncovered path or edge case. If no suitable coverage exists, write one focused test for the requested observable behavior.
3. When a new regression test is needed, confirm that it fails for the expected missing or incorrect behavior before implementation. Do not force a failing test when existing coverage already observes the contract.
4. Fix a test error before implementation.
5. Make the smallest production change that can pass the test.
6. Run the same focused coverage again and compare it with the baseline.
7. Fix the implementation before changing a correct test. Repeat or broaden verification only when the changed code, an observed failure, or an unresolved risk justifies it.

Prefer an observable result to a mock interaction. Use a mock only at a real dependency boundary.

If an automated test is not practical, reproduce the problem before the fix. Repeat the same reproduction after the fix. State why an automated regression test was not credible.

## Behavior-preserving refactor

1. Identify focused coverage for behavior that must not change.
2. Run it and record the passing baseline.
3. Make one structural change.
4. Run the same coverage again.

If credible coverage does not exist, add a characterization test that passes before the refactor. Do not force a failing test for behavior that must stay unchanged.

## Root-cause investigation

Do not patch the first visible symptom.

1. Reproduce the failure with the smallest reliable command.
2. Read the complete error and identify the first relevant failure boundary.
3. Trace the value, state, or control flow backward to its owner.
4. Compare a working path when one exists.
5. Form one evidence-backed hypothesis.
6. Use the smallest experiment that can disprove it.
7. Reuse suitable focused coverage; if the failure lacks coverage, add one focused regression test and confirm the expected failure before making the fix.

When a check fails after the change, classify it before editing:

- expected red evidence
- implementation regression
- stale or incorrect test
- unrelated existing failure
- infrastructure or environment failure

Do not weaken assertions, hide errors, remove edge cases, or update snapshots blindly. Treat existing tests as intended behavior unless live evidence shows that the contract changed or the test is wrong.

## Documentation and generated files

A red test is usually not useful for prose-only guidance, generated output, or mechanical configuration. Use the strongest replacement evidence. Examples include schema validation, a dry run, a focused diff, or a command that exercises the changed configuration.
