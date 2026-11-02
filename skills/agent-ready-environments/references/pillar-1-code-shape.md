# Pillar 1: Code shape

Source keys refer to the Sources list in [SKILL.md](../SKILL.md).

**Why.** Agents learn the conventions by reading the code: the layout, the test
framework, how existing components are built [A1]. They copy what they find,
including patterns the team is moving away from. Anthropic lists "an old
pattern that's everywhere but that new code must not copy" as something to
write down [A1]. OpenAI reports that the team preferred dependencies and
abstractions the agent could fully reason about in the repository, and enforced
its layered architecture mechanically [O1] (unconfirmed for current models). **[practitioner]** With one way to
do each job, the nearest example is the right example.

**Good looks like.**

- Each concept has one owning module. Other modules call it and do not reimplement it.
- Dependency direction is declared and enforced: for example ESLint boundary rules, dependency-cruiser, or Fallow boundaries in TypeScript; import-linter in Python; `internal/` packages in Go; ArchUnit on the JVM.
- Data enters at one validated boundary and flows one way through named layers.
- Legacy areas are marked as "do not copy", and that marking is enforced where possible (a lint rule that bans the old import).

**Audit check.**

- For three recent features, name the one place that makes each decision they touch: a validation rule, a permission check, a state transition. Several modules can take part in one flow (schema, adapter, store); a finding is the same decision made in two places.
- Run a duplication tool and a boundary tool. Report three numbers separately: competing owners found in the feature sample, existing clones, and clones the latest changes introduced.
- Check whether the most common pattern for a job is the current one.

**Anti-patterns.** Two helpers for the same job. A deprecated pattern that is
still the most common. Cross-layer imports that only review catches.
