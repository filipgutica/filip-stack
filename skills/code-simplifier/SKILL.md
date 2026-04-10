---
name: code-simplifier
description: Analyze code for behavior-preserving simplification opportunities in targeted files, diffs, subsystems, or broader codebase areas. Use when you need complexity hotspot analysis, prioritized findings, or a $planner-style simplification plan without implementing changes.
---

# Code Simplifier

Analyze code for unnecessary complexity and return a bounded simplification plan.

This skill is for analysis only.

## Prompt Shaping

- For targeted analysis, name the exact function, file, diff, route, module, or path to inspect.
- For broad analysis, name the subsystem, directory, service area, or repo surface and ask for prioritized findings plus a phased plan.

## Scope

- Treat a prompt that names a function, file, diff, route, module, or path as targeted analysis.
- Treat a prompt that names a subsystem, directory, service area, or repo-wide surface as broad analysis.
- If the scope is ambiguous, restate the assumed boundary before continuing.
- For targeted analysis, stay on the named surface unless the evidence shows a required dependency outside it.
- For broad analysis, start with an inventory pass over the relevant repo surface, then split the work into bounded slices and prioritize the highest-value simplification opportunities.

## Subagent Workflow

- Use two parallel exploration passes by default unless the target is obviously tiny (one short snippet, one isolated helper, or one small function)
- Give each pass a distinct bounded lens so the work does not duplicate itself
- Synthesize findings in the main thread

### Host-specific subagent notes

- **Claude Code**: Use the `Agent` tool. Pass `model: "sonnet"` for subagent work. Subagent prompts must be self-contained — subagents have no access to the parent conversation context, so include all file paths, prior findings, and instructions explicitly.
- **Codex**: Subagent delegation is handled by the host runtime.

## Workflow

1. Inspect the target code first and identify the main complexity sources.
2. Launch the parallel exploration passes described above, unless the target is obviously tiny.
3. For broad analysis, begin with a parallel inventory pass to identify the languages, entrypoints, subsystems, and likely complexity hotspots that actually exist.
4. Ignore dependency, build, coverage, generated, declaration, minified, and vendored outputs unless the user explicitly asks to inspect them.
5. Do not read every source file by default. Read broadly enough to identify patterns, then deepen only on the bounded areas that show the highest-value simplification opportunities.
6. Synthesize the findings in the main thread.
7. Format the simplification plan using bounded phases with clear assumptions, tradeoffs, risks, and validation — following the `planner` output format. Do not invoke the `planner` skill; produce the plan directly.
8. Return findings and a simplification plan only.
9. If the user wants code changes made, hand off to `$implementer`.

## Output

- Summary of the target and scope
- Prioritized findings
- `$planner`-style simplification plan
- Tradeoffs
- Risks
- Validation
- Open questions

## Rules

- Preserve behavior unless the user explicitly asks for a behavior change.
- Prefer the smallest simplification that removes real complexity.
- Do not implement edits in this skill.
- Keep host-specific details out of the workflow so the skill stays usable in both Codex and Claude.
