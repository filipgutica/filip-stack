# Pillar 7: Bounded autonomy

Source keys refer to the Sources list in [SKILL.md](../SKILL.md).

**Why.** Before a run goes unattended, answer five questions [A1]:

1. Does it know what done looks like?
2. Can it check its own work?
3. What may it touch?
4. What stops it?
5. Where does the result go, and who signs off?

Rules that must never be broken belong in deny rules, hooks, or the sandbox.
A model-based safety classifier is a judgment call and can be wrong [A1].

**Good looks like.** Deny rules for secrets and protected paths. Worktree or
container isolation. Least-privilege tokens. Turn or spend caps on unattended
runs. A human approves merges, deploys, and anything irreversible.

**Audit check.** List every "never" rule in the guidance and confirm each is
enforced. Confirm that unattended runs have caps and a sign-off step.
