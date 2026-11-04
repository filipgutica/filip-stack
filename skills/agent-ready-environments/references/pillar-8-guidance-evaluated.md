# Pillar 8: Guidance is evaluated

Source keys refer to the Sources list in [SKILL.md](../SKILL.md).

**Why.** Build evaluations before writing extensive guidance: measure the agent
without the guidance, write the minimum that closes the observed gaps, and
iterate against the baseline [A4]. Start minimal and add instructions in
response to observed failures [A2; O3 says the same: add a rule after a repeated mistake]. Test with every model the guidance targets,
because what one model needs another finds redundant [A4]. Advice that
compensated for older models becomes overhead and should be removed [A1].

**Good looks like.**

- Each instruction file or skill has evaluation evidence against a no-guidance baseline on matched tasks, model, and harness.
- Routing evaluations check that skill descriptions trigger when they should.
- A periodic pruning pass removes no-ops: lines the current model already follows by default.

Example in this repository: the PluginBench rule in `AGENTS.md`.

**Audit check.** For each piece of guidance, ask what evidence shows it changes
behavior. Guidance without evidence scores at most 1. Check when the guidance
last had a line deleted.
Level 2 needs runnable evidence against a no-guidance baseline for each applicable artifact; level 3 also blocks guidance changes on that check and tracks results over at least 20 runs or 30 days.
