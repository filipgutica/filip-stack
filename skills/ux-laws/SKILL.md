---
name: ux-laws
description: Design or review digital interfaces, user flows, navigation, forms, and interaction states using established UX laws. Use when creating a UX direction, critiquing an interface, or explaining interaction and hierarchy decisions; do not use for purely visual branding work.
---

# UX Laws

Use UX laws as design heuristics, not as proof that a design works.

## Method

1. Identify the primary user, task, context, and constraints. State bounded assumptions when evidence is missing.
2. Read [references/laws.md](references/laws.md) and select only the laws that materially affect the task. Do not force all 21 into a design.
3. Design or review the complete path, including loading, empty, error, success, keyboard, touch, and responsive states when relevant.
4. Resolve conflicts in this order: user safety and accessibility, user intent and evidence, domain conventions, then UX-law heuristics.
5. Recommend the smallest change that improves the task. Explain the expected benefit and what usability evidence would confirm it.

## Guardrails

- Do not invent user research or present a law as validation.
- Do not use fake urgency, forced progress, concealed choices, or other dark patterns.
- Do not rely on color alone for meaning or emphasis. Preserve contrast, focus visibility, target size, reduced-motion preferences, and assistive-technology semantics.
- Familiar patterns can still be poor patterns. Simplicity must not remove necessary control, information, consent, or recovery.
- When laws conflict, name the tradeoff instead of pretending every heuristic can be satisfied.

## Output

For a design request, provide the proposed hierarchy and interaction flow, the few laws that shaped it, edge states, and the riskiest assumption to test.

For a review, prioritize findings by user impact. For each finding, give the observed issue, relevant law, recommended change, and a concrete way to verify improvement. Do not produce an unranked checklist.
