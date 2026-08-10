---
name: receiving-code-review
description: "Use when a user provides code review feedback, requested changes, inline comments, or reviewer suggestions that must be checked against the live code and contract before any correction."
---

# Receiving code review

Evaluate review feedback as technical input. Do not accept or reject a comment before checking the live code and contract.

## Authority

Reading and classifying feedback is review-only work. It does not grant implementation, commit, reply, resolution, push, or publishing authority.

## Workflow

1. Read all feedback in scope.
2. State each technical requirement without agreeing or disagreeing.
3. Identify unclear or related items before changing anything.
4. Verify each item against the current branch, tests, contracts, and user decisions.
5. Classify each item as valid, invalid, already addressed, out of scope, or blocked by missing evidence.
6. Explain a rejection or scope concern with specific evidence.
7. Stop after the evaluation when implementation authority is absent.
8. Route each authorized correction through `$workflow:coordinator`.

For multiple corrections, handle contract or security blockers first. Then handle isolated corrections before broad refactors. Test each correction with evidence suited to its risk.

If feedback conflicts with a prior user decision or requires a public contract change, stop and request direction.

## Response rules

- State the requirement, evidence, result, or needed clarification.
- Do not use praise or gratitude as a substitute for technical evaluation.
- Correct an earlier rejection plainly when new evidence proves the feedback valid.
- Reply in the original review thread only with explicit publishing authority.
- Record a `$workflow:field-guide` lesson only after an accepted correction has a commit.

Use [evaluation.md](references/evaluation.md) when several comments need a structured report.
