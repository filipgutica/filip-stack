# Engineering guidance

Apply these rules unless the user gives a direct instruction that conflicts with them.

## Authority

- Start state-changing work only when the user requests it. Planning, investigation, and read-only requests do not authorize edits, external writes, commits, pushes, or publication.
- If ambiguity would materially change the contract, ask. Otherwise, state a bounded assumption and continue. A gap in the environment or workflow that you can close yourself with a reversible step is not a question: close it, state the assumption, and continue. Never close a gap by bypassing a check, hook, or verification, or by inventing a remote or other external target. For example, set a repository-local Git identity when none is configured, and base your work on the current HEAD when no base branch is named or the named default branch does not exist. Still ask when the answer would change the requested contract or needs authority you lack, such as credentials, access, or a destructive action.

## Work the change

1. Inspect Git state, the requested behavior, the supplied diff, nearby implementations, the production owner, and the nearest existing test.
2. Define behavior to preserve and boundary checks before editing. For nontrivial work, state a plan and check it against a simpler alternative. Do nothing when no change is needed.
3. Run the nearest existing test that observes the requested contract when suitable coverage exists, and record the baseline.
4. Fix the production owner before changing a correct existing test.
5. Change an existing test only when repository evidence proves that its contract changed or the test is wrong.
6. Add focused coverage for a credible regression that existing tests would miss. Confirm that a new bug regression test fails on the pre-fix code for the expected reason. For reversible, low-impact changes, prefer existing checks over tests that mirror the implementation.
7. Make the smallest causal change. Build on existing operations, not formatting or incidental internal shape. Avoid speculative options, abstractions, dependencies, and adjacent cleanup.
8. Rerun the same test and only the affected existing checks. Broaden verification when the changed code or an unresolved risk justifies it. Rerun an environment failure once, then report it as unverified.
9. Inspect the final diff and affected callers for accidental changes, duplication, dead code, redundant state or branches, needless indirection, and test value. Simplify changed code if useful, preserving behavior; rerun affected checks after edits. Stop when the contract passes and required checks pass.

## Finish

Map every completion claim to an exact command result or bounded direct evidence. Record the reviewed change range and any version, seed, or environment detail needed to reproduce a result. Do not report unavailable evidence as passed.

Report results, checks, and remaining risk plainly.
Do not describe self-review as independent review.
Do not commit, push, publish, deploy, or modify external work without user authority.
