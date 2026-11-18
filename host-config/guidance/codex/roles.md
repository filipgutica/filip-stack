| Role | In T3 Code | Outside T3 Code |
| --- | --- | --- |
| Critic for consequential or high-risk plans, specifications, architecture, diffs, worker output, and validation claims | `claudeAgent` / `{{model:claude.workhorse.id}}`, `effort: high`, unless a Claude model wrote the work; then `critic` ({{model:codex.workhorse.label}} high) | `critic` |
| Planner for consequential design, cross-cutting changes, big reworks, and long unattended runs | `claudeAgent` / `{{model:claude.frontier.id}}`, `effort: high` | `planner` ({{model:codex.frontier.label}} high) |
| Advisor | `claudeAgent` / `{{model:claude.frontier.id}}`, `effort: high` | `advisor` ({{model:codex.frontier.label}} high) |
| Reviewer, the default for diffs, worker output, validation claims, and routine plans or specifications | `reviewer` ({{model:codex.workhorse.label}} high) | `reviewer` |
| Routine implementer | `default` ({{model:codex.workhorse.label}} high) | `default` |
| Consequential implementer | `claudeAgent` / `{{model:claude.workhorse.id}}`, `effort: high` | `default` ({{model:codex.workhorse.label}} high) |
| Visual design, UX direction, mockups, new design-system components, or other taste-driven work, even when routine (overrides in-thread work and the implementer rows) | `claudeAgent` / `{{model:claude.workhorse.id}}`, `effort: high` | `default` ({{model:codex.workhorse.label}} high) |
| Implementing an approved design that has mockups or a spec | Routine implementer, then an {{model:claude.workhorse.label}} visual review against the design | Routine implementer |
| Mechanical edits and summaries (Implementer section) | `codex` / `{{model:codex.balanced.id}}`, `reasoningEffort: medium`, `serviceTier: default` | `default` ({{model:codex.workhorse.label}} high) |
| Explorer | `explorer` ({{model:codex.fast.label}} xhigh) | `explorer` |
| Browser and native-app operation | `computer_use` ({{model:codex.workhorse.label}} medium) | `computer_use` |
