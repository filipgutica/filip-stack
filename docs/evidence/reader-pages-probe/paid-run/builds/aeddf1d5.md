# Flaky tests and agents

## 1. A flaky gate teaches the wrong response

A flaky test fails sometimes without any code change. That matters when an agent works from test results: an agent that sees a red test tries to fix the code, even when the test is flaky.

The failure gives the agent something to act on, but it does not establish that the code changed. Keep those two statements separate when reading a test result. “The test failed” describes the result. “The code needs fixing” is the response an agent may take, including when the test itself is flaky.

Agents tend to respond to flaky failures by rerunning until green or weakening the assertion. Neither response is the same as fixing the flaky test. A green rerun can follow a failure without any code change; weakening the assertion changes what the test requires.

The lesson also applies to people. A required gate that sometimes fails teaches agents and people to ignore it. The gate remains required, while its failures become something to rerun past or weaken away. A flaky test therefore needs an explicit response beyond reaching a green run.

## 2. Measure flakiness and use quarantine explicitly

To measure flakiness, rerun each test 20 times on the same commit and count the failures. Keep the commit the same throughout the measurement: the question is how often the test fails without a code change.

Use the audit script:

```sh
scripts/flake-scan.mjs --runs 20 --json
```

Count failures across the 20 runs. Do not replace that count with the result of the last run. Rerunning until green and measuring failures ask different questions: one stops at a passing result; the other counts failures across the specified runs.

For a known-flaky test, quarantine means moving it out of the required gate while it is fixed, with an owner and a date. Include all of those elements when describing quarantine. Moving the test is only part of the definition; fixing it, naming an owner, and setting a date belong to it too.

This lesson uses the author’s own rubric, not a vendor’s. Its terms are concrete: measure failures on the same commit, and give known-flaky tests an explicit quarantine with an owner and a date.
