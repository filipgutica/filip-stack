# Global Engineering Principles

Apply these rules unless the user gives a direct instruction that conflicts with them.

## Critical Rules
- Preserve behavior unless the user asks to change it.
- Assume failing tests are correct first; fix implementation before changing tests.
- Keep diffs minimal and focused; avoid unrelated refactors.
- Maintain public API and exported type compatibility unless the user asks for a change or the fix requires one.
- Prefer deterministic, correct fixes; do not hide failures or weaken checks to get green tests.
- Preserve unrelated comments, code, and configuration; only change them when the task requires it or they become inaccurate.

## Assumption Management
- Do not guess when requirements, behavior, or data shape are unclear.
- State important assumptions explicitly and verify them against code, tests, or docs before acting.
- Surface confusion, inconsistencies, and missing context early instead of pushing through them.
- Present material tradeoffs and push back on brittle, bloated, or inconsistent approaches.
- For non-trivial work that does not need full plan mode, give a short inline plan before editing: intent, approach, and main risk or assumption.

## Workflow Orchestration
- Plan first for any non-trivial task.
- If scope changes, assumptions break, or the work starts going sideways, stop and re-plan before continuing.
- Break complex tasks into smaller pieces that can be reasoned about and iterated on without overloading context.
- Track progress explicitly as work advances; keep the active plan or checklist current rather than relying on memory.
- Use subagents for bounded research, exploration, and parallelizable subtasks when that reduces context load.
- Keep the main thread responsible for coordination, review, and final acceptance.
- Do not mark work complete until the result has been verified.

## Verification Before Done
- Before marking work complete, run `typecheck`, `lint`, `stylelint`, and applicable tests, or clearly explain why a step does not apply.
- Verify behavior before claiming success.
- When relevant, compare current behavior against the intended behavior rather than assuming the change is correct.
- When debugging a failing test, use the narrowest targeted execution available, such as a single test, file, spec, or filter.
- Do not repeatedly rerun an entire suite for a single failing case unless the fix could affect broader behavior.
- If a framework lacks a clean selector, use a temporary local focus mechanism only for debugging, remove it before finishing, and do not leave it in committed code.
- If the test appears unnecessary or redundant, stop and explain that instead of looping on reruns.
- When running Cypress from Codex, prefer running it outside the sandboxed environment. In sandboxed Codex sessions, Cypress may fail at startup even when the command and spec are valid. If that is not possible, call out the sandbox limitation and use the best available alternative.

## Change Quality
- Make the smallest correct change.
- Prefer the simplest readable implementation that is well-organized, modular, and easy to follow.
- Favor the correct fix over the expedient fix.
- Avoid hacky fixes, spaghetti code, and temporary-looking patches.
- Prefer reuse of existing code and patterns when they fit cleanly.
- Prefer the simplest end-to-end fix; favor deletion or reuse over new abstraction when both solve the problem.
- Do not over-engineer or introduce abstraction before it is justified.
- Separate refactors from behavior changes when practical.
- Remove dead code made obsolete by the change, but do not expand the task into unrelated cleanup.

## Test Integrity
- Treat existing tests as intended behavior by default.
- Do not change tests only to make them pass.
- Modify tests only when behavior or contracts change, when mocks or fixtures must change to reflect real behavior, or when a test is demonstrably wrong.
- If you change a test, explain why the test was wrong or outdated and why implementation changes would be inappropriate.
- Do not weaken assertions, remove edge cases, or blindly update snapshots.

## Regression Protection
- For bug fixes, add or adjust a deterministic test that would catch the issue when one is feasible.
- Prefer deterministic fixes over timeout increases or timing hacks.

## Agent Delegation
- When a task can be split into bounded subtasks, prefer using subagents without asking for additional permission each time.
- Do not use a subagent when the immediate next step depends on work that must stay local or tightly coupled.
- Use a faster, more efficient model for bounded subagent tasks when the work is well defined and does not need the main thread's full reasoning budget.

## Type Integrity
- Avoid `any` unless explicitly required.
- Avoid unsafe casts and type-error suppression.
- Prefer narrowing, type guards, generics, and correct inference.
- Make types reflect runtime reality.
- Avoid local type shims or compatibility alias types that mask third-party package or version mismatches. If local debugging points to an external dependency, do not paper over it locally; identify the broken package, version conflict, or upstream typing issue and report that it needs to be fixed at the source.

## Public Contract Stability
- Do not change public APIs, exported types, or externally visible behavior without instruction.
- If a contract change is required to fix the issue: update call sites, update tests, and explain migration impact.
- Prefer backward compatibility when possible.

## Dependencies
- Do not add dependencies unless clearly necessary.
- If adding one, explain why existing tools are insufficient and prefer small, maintained libraries.

## Error Handling
- Do not swallow errors silently.
- Do not remove error handling to make tests pass.
- If intentionally ignoring an error, explain why.

## Style Preferences
- Prefer parameter objects for functions with 3+ parameters, optional parameters, or config-style inputs.
- Prefer arrow functions with destructured parameters and explicit inline typing when it improves clarity.

Example:

```ts
const createUser = (
  { name, role, isActive }: {
    name: string
    role: string
    isActive: boolean
  }
) => {
  ...
}
```
