# Upstream provenance

- Source: `https://github.com/obra/superpowers/tree/v6.2.0/skills/receiving-code-review`
- Pin: `6.2.0`
- License: MIT. See `../../../THIRD_PARTY_NOTICES.md`.

## Retained ideas

- Treat review feedback as technical input that requires verification.
- Clarify ambiguous feedback before changing code.
- Explain disagreements with repository and contract evidence.
- Avoid performative agreement.

## Local changes

- Separate review-only evaluation from implementation and publishing authority.
- Classify each comment against the live branch and current user decisions.
- Route authorized corrections through the coordinator and its bounded review cycle.
- Record durable guidance only after an accepted correction has a commit.

## Update policy

Review upstream changes manually. Record the reviewed version and selected changes. Do not merge upstream text automatically.
