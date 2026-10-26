# Coding standards

- Preserve public APIs, exported types, and externally visible behavior unless the task requires a contract change. Update consumers and tests when a contract changes.
- Avoid `any`, unsafe casts, and type-error suppression. Make types reflect runtime reality.
- Add dependencies only when existing tools are insufficient, and only to workspaces with a verified need. Check direct usage and transitive ownership first. Use the repository-declared package manager and never edit lockfiles by hand.
- For pnpm package bumps, prefer `pnpm -r up <package>@<version>` to update existing declarations; use filters when the authorized scope is narrower.
- Place stylesheet imports in the consuming component or page. Check whether its dependency already supplies the styles before adding a separate import or package.
- Do not swallow errors or remove error handling to make tests pass. Explain any error that is intentionally ignored.
- Use `rg` for text and content search and `rg --files` for file discovery when available. Use the `ast-grep` CLI (`sg`) for structural or language-aware code queries that plain-text search cannot express reliably.
- Prefer a parameter object for functions with three or more parameters, optional parameters, or configuration-style inputs. Prefer arrow functions with destructured parameters and explicit inline types when that improves clarity.
- In TS/JS repositories with Fallow configured, run `fallow audit` before finishing. Inspect findings against callers and public contracts; fix confirmed in-scope defects at their owner instead of suppressing them.
