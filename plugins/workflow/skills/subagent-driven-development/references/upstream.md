# Upstream provenance

- Source: `https://github.com/obra/superpowers/tree/v6.2.0/skills/subagent-driven-development`
- Pin: `6.2.0`
- License: MIT. See `../../../THIRD_PARTY_NOTICES.md`.

## Retained ideas

- Give each task a fresh bounded implementation context when useful.
- Keep durable task state across compaction.
- Require implementation self-review and independent review.
- Execute tasks sequentially when they share branch state.
- Continue without routine confirmation after execution authority exists.

## Local changes

- Use the workflow coordinator as the only execution controller.
- Use the external branch ledger instead of `.superpowers/sdd` state.
- Use one risk-based independent review tier.
- Keep commits, publishing, worktrees, and cleanup behind explicit authority.
- Remove Superpowers scripts, model rules, fix-loop caps, and finish routing.

## Update policy

Review upstream changes manually. Do not merge upstream text automatically.
