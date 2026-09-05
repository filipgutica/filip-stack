---
name: review
description: Use for a read-only review or final verification of an existing exact change range or artifact. Report evidence-backed findings or no findings with limitations. Do not use for fixes, design interviews, or interactive walkthroughs.
---

# Review

Inspect one bounded change or artifact and report what the evidence supports.
This route is read-only. It does not authorize fixes, file edits, commits,
pushes, publication, external comments, or acceptance.

## Select the subject

Confirm one exact subject before inspecting it:

- a working tree relative to `HEAD`
- a branch from its verified merge base to its head
- a pull request from its verified base and head commits
- a commit or commit range
- an artifact path and, when relevant, its version or source

Verify the selected identity, ancestry, or source. Report dirty or unrelated
changes outside the selected range instead of silently including them. If the
subject cannot be bounded, state the limitation and ask for the missing scope
only when it changes the review.

## Review the contract

1. Read the request, acceptance criteria, and declared source of truth.
2. Inspect every changed file in the selected subject and trace affected
   behavior to its current owner. Read relevant tests, types, configuration,
   documentation, and callers when they can change the conclusion.
3. Separate confirmed findings from inferences and unknowns. A finding must
   identify the path and line or command evidence, explain the affected
   contract, and state the practical consequence. Do not report style
   preferences, stale assumptions, or unsupported scope expansion.
4. Run the narrowest appropriate checks once. Repeat a check only when new
   evidence, a scope correction, an environment change, or a newly discovered
   failure gives a reason to do so. A blocked, rejected, timed-out, or
   unavailable check is a limitation, not a pass.

## Finish

State the inspected subject, checks and exact results, and limitations for every review. Return one of:

- findings ordered by impact, each with evidence, consequence, and a precise
  next action for an authorized implementer
- no findings supported by the inspected evidence

State whether the review was independent. Self-review or a review without a
separate reviewer identity is not independent. Corrections use Engineering with implementation authority.
Existing authorization remains valid; do not ask again when the request already
authorizes the fixes.
