---
name: engineering
description: Use for an authorized code change, bug fix, refactor, failing test, CI failure, or review correction that needs the smallest correct implementation and focused verification. Do not use for explanation-only requests or planning without edits.
---

# Engineering

Deliver the smallest authorized change and prove the requested contract.

## Work the change

1. Inspect Git state, the requested behavior, the supplied diff, the production owner, and the nearest existing test.
2. State the smallest plan, including the owner, boundary, and verification signal. Do nothing when no change is needed.
3. Run the nearest existing test that observes the requested contract.
4. Fix the production owner before changing a correct existing test.
5. Change an existing test only when repository evidence proves that its contract changed or the test is wrong.
6. If new behavior lacks suitable coverage, add one focused observable test and confirm that it fails for the expected reason.
7. Make the smallest causal change. Reuse local code before adding code. Avoid speculative options, abstractions, dependencies, and adjacent cleanup.
8. Rerun the same test and only the affected existing checks.
9. Inspect the final diff for accidental changes. Stop when the contract passes.

## Keep the design small

Use the first option that meets the contract: no change, existing local code, the standard library, a native platform or framework feature, an installed dependency, then the smallest new code.

Keep one clear owner per responsibility. Fix behavior at that owner, preserve established boundaries and separation of concerns, and extend existing seams. Add or widen an abstraction only when current behavior proves that direct code or local reuse is insufficient.

Minimality must not remove correctness, data integrity, type safety, runtime validation, error handling, security, accessibility, or meaningful tests.

Surface a material ambiguity before it changes the solution.
Stop when the work needs new authority or a material user decision.

## Load only what the route needs

Read [testing and debugging](references/testing-and-debugging.md) for new or corrected behavior, a behavior-preserving refactor, or an unexplained failure. Do not load it for a mechanical or prose-only change with credible repository checks.

Read [verification tools](references/verification-tools.md) only when repository checks cannot cover the affected contract.

Read [delegation and review](references/delegation-and-review.md) when work divides into independent owned units or after meaningful edits. Meaningful changes use a separate reviewer when available. Tiny mechanical edits may use final diff inspection. Use an adversarial reviewer for broad, ambiguous, security-sensitive, public-contract, concurrency, or ownership risk.

Do not use review as a substitute for a blocked or failed test.

## Finish

Map every completion claim to an exact command result or bounded direct evidence. Record the reviewed change range and any version, seed, or environment detail needed to reproduce a result. Do not report unavailable evidence as passed.

Report the result, the checks that ran, and the remaining risk.
Do not describe self-review as independent review.
Do not commit, push, publish, deploy, or modify external work without user authority.
