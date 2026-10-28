---
related: [test-audit, walkthrough]
---

## What it does

Review inspects one exact change range or artifact and reports what the
evidence supports. It checks the requested behavior and relevant project
rules without changing the subject.

## When to use it

- Review a working tree, branch, pull request, commit, or commit range.
- Check a specific document or other artifact.
- Perform final verification of an existing change.

It does not fix findings or accept the change. For an interactive explanation
one slice at a time, call [walkthrough](../walkthrough/).

## How it works

1. Confirms the exact subject and verifies its source or Git ancestry.
   Unrelated and dirty changes stay outside the selected range.
2. Reads the request, acceptance criteria, source evidence, and applicable
   instructions, including relevant `AGENTS.md` or `CLAUDE.md` requirements.
3. Inspects every changed file and traces affected behavior to its owner.
   It reads callers, tests, types, configuration, and documentation when they
   can change the conclusion.
4. Checks whether changed tests protect observable behavior and whether
   removed coverage still has proof. Substantial or uncertain coverage changes
   use [test-audit](../test-audit/) within the same read-only scope.
5. Runs the narrowest appropriate checks, including available complexity,
   dead-code, and duplication analysis. An unavailable check remains a limitation.
6. Separates confirmed findings from inferences and unknowns. Findings need
   evidence, a practical consequence, and a precise next action.

## What you get

- Findings ordered by impact, or no findings supported by the inspected evidence.
- The inspected subject, exact check results, and verification limits.
- A statement of whether a separate reviewer independently inspected the change.

The skill does not edit files, commit, push, publish, or post external comments.
Corrections require implementation authority.
