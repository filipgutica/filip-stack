# Simplification Playbook

Use this when the user wants behavior-preserving simplification or maintainability analysis.

Simplification should reduce cognitive load, remove unnecessary complexity, and improve maintainability without silently changing public behavior, contracts, meaningful side effects, or intended test coverage.

## Scope Rules

- If the prompt names a function, file, diff, route, module, or path, treat it as targeted analysis.
- If the prompt names a subsystem, directory, service area, or repo surface, treat it as broad analysis.
- If the scope is ambiguous, restate the assumed boundary before continuing.
- Distinguish real simplification work from stylistic churn. Prefer changes that remove actual maintenance cost, ambiguity, brittleness, or duplication.

## Heuristic Checklist

Inspect the target for these categories and call out which ones actually apply:

- ambiguity or hard-to-follow control flow
- duplicated or weakly-varied code and logic
- dead, unused, or obsolete code paths
- unnecessary, layered, leaky, or overly-complex abstractions
- brittle, non-extendable, or hard-to-follow structure
- poor organization or weak separation of concerns
- dead, redundant, or low-value tests
- tests that do not assert meaningful behavior

Do not force every category into the findings. Explicitly say when a category does not appear to be a real problem.

## Workflow

1. Inspect the target code first and identify the main complexity sources.
2. Start with focused local reads when a small number of files can establish scope cheaply.
3. Use explorer delegation only when there are real unknowns or distinct surfaces that materially benefit from delegated discovery.
4. Use parallel explorers only when the questions are independent and materially different; do not duplicate a local read that already established scope.
5. For broad analysis, start with an inventory pass over the relevant surface rather than reading every source file.
6. Ignore dependency, build, generated, vendored, declaration, minified, and coverage outputs unless the user explicitly asks for them.
7. Synthesize the findings in the main thread.
8. Produce a bounded simplification plan with clear assumptions, tradeoffs, risks, and validation.
9. Stop after analysis unless the user explicitly asks for implementation.

Use the `explorer` template from [subagent-templates.md](subagent-templates.md) for analysis. If the user later wants the simplification implemented, switch to the `worker` template and keep the write scope bounded.

## Findings Rules

- Group findings by hotspot or category rather than listing disconnected nits.
- For each finding, state:
  - what is wrong
  - why it matters
  - the smallest safe simplification direction
  - validation concern or regression risk
- Include confidence based on the evidence in hand. Call out assumptions or missing context explicitly.
- Prefer “not worth changing” over speculative cleanup when the code is unusual but functionally justified.
- Recommend test removal or consolidation only when the test is clearly dead, redundant, or not asserting useful behavior.
- Treat style-only cleanup as low priority unless it materially affects readability, correctness, or maintainability.

## Plan Rules

- Separate safe cleanup candidates from risky or assumption-heavy simplifications.
- Keep the plan bounded around the highest-value changes rather than every possible cleanup.
- If architecture or organization is brittle, propose the smallest restructuring that improves extensibility or separation of concerns without turning the work into a rewrite.

## Output

- `Summary`
- `Prioritized Findings` grouped by hotspot or category
- `Simplification Plan`
- `Tradeoffs`
- `Risks`
- `Validation`
- `Open Questions`
