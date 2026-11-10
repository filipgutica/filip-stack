| Role | In T3 Code | Outside T3 Code |
| --- | --- | --- |
| Critic for plans, specifications, and architecture | `claudeAgent` / `{{model:claude.frontier.id}}`, `effort: high` | `critic` ({{model:claude.frontier.label}} high) |
| Critic for diffs, worker output, and validation claims | `codex` / `{{model:codex.frontier.id}}`, `reasoningEffort: high`, `serviceTier: default` | `critic` ({{model:claude.frontier.label}} high) |
| Advisor | Built-in advisor tool | Built-in advisor tool |
| Reviewer | `codex` / `{{model:codex.workhorse.id}}`, `reasoningEffort: high`, `serviceTier: default` | `reviewer` ({{model:claude.workhorse.label}} high) |
| Routine implementer | `codex` / `{{model:codex.workhorse.id}}`, `reasoningEffort: high`, `serviceTier: default` | `worker-high` ({{model:claude.workhorse.label}} high) |
| Consequential implementer | `worker-high` ({{model:claude.workhorse.label}} high) | `worker-high` |
| Visual design, UX direction, mockups, new design-system components, or other taste-driven work (overrides the implementer rows) | This thread when it runs on {{model:claude.workhorse.label}}, otherwise `worker-high` | Same |
| Implementing an approved design that has mockups or a spec | Routine implementer, then an Opus visual review against the design | Same |
| Mechanical edits and summaries (Implementer section) | `claudeAgent` / `{{model:claude.balanced.id}}`, `effort: high` | This thread |
| Explorer | `explorer` ({{model:claude.fast.label}} high) | `explorer` |
