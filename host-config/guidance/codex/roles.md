| Role | In T3 Code | Outside T3 Code |
| --- | --- | --- |
| Critic for plans, specifications, and architecture | `claudeAgent` / `claude-fable-5-2`, `effort: high` | `critic` (Astra high) |
| Critic for diffs, worker output, and validation claims | `critic` (Astra high) | `critic` |
| Advisor | `claudeAgent` / `claude-fable-5-2`, `effort: high` | `advisor` (Astra high) |
| Reviewer | `reviewer` (Sol high) | `reviewer` |
| Routine implementer | `default` (Sol high) | `default` |
| Consequential implementer | `claudeAgent` / `claude-opus-5-5`, `effort: high` | `default` (Sol high) |
| Visual design, UX direction, mockups, new design-system components, or other taste-driven work, even when routine (overrides in-thread work and the implementer rows) | `claudeAgent` / `claude-opus-5-5`, `effort: high` | `default` (Sol high) |
| Implementing an approved design that has mockups or a spec | Routine implementer, then an Opus visual review against the design | Routine implementer |
| Explorer | `explorer` (Luna xhigh) | `explorer` |
| Browser and native-app operation | `computer_use` (Astra medium) | `computer_use` |
