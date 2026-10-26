| Role | In T3 Code | Outside T3 Code |
| --- | --- | --- |
| Critic | `codex` / `gpt-6-astra`, `reasoningEffort: high` | `critic` (Opus 5.5 high) |
| Advisor | Built-in advisor tool | Built-in advisor tool |
| Reviewer | `codex` / `gpt-6.1-sol`, `reasoningEffort: high` | `reviewer` (Opus 5.5 high) |
| Routine implementer | `codex` / `gpt-6.1-sol`, `reasoningEffort: high` | `worker-high` (Opus 5.5 high) |
| Consequential implementer | `worker-high` (Opus 5.5 high) | `worker-high` |
| Frontend, visual design, UX, or other taste-driven work (overrides the implementer rows) | This thread when it runs on Opus 5.5, otherwise `worker-high` | Same |
| Explorer | `explorer` (Haiku 5.5 high) | `explorer` |
