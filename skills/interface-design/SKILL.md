---
name: interface-design
description: Design, build, review, or check user interfaces and flows, covering hierarchy, interaction, states, interface copy, and accessibility. Uses UX laws, public standards, and the design language. Use when shaping or reshaping a UI or UX direction, critiquing a screen or flow, or checking a running UI before it ships.
---

# Interface Design

Help people finish their task with the interface. The look comes from the
owning design system: the repository's own, else
`~/design-language/DESIGN.md` when it exists. Use its tokens and components.
This skill owns hierarchy, interaction, states, interface copy, and
accessibility.

## Ground the work

1. Name the primary user, their task, the context, and the constraints. State
   a bounded assumption where evidence is missing.
2. Find the owning design system and read it before you design or judge the
   look. Keep its palette, type, and layout concepts; a new brief does not
   earn a new visual identity.
3. Cover the whole path: loading, empty, error, and success states; keyboard
   and touch; 320px for reflow, 375px, and desktop widths; light and dark
   themes where supported; reduced motion.

## Routes

- **Design or build.** Read [references/laws.md](references/laws.md) and
  [references/craft.md](references/craft.md). Pick only the laws and craft
  rules that change this design.
- **Review.** Read [references/standards.md](references/standards.md) and
  answer each question that applies to the screens in scope. Read
  `laws.md` when a finding needs a law to explain it.
- **Check.** Run the repository's own accessibility, lint, and visual checks
  on the running UI. Then run this skill's scripts as
  [references/checks.md](references/checks.md) describes, at the widths and
  themes above. Name each check that could not run; an unrun check is not a
  pass.

## Resolve conflicts

In this order: user safety and accessibility; the user's intent and evidence;
the owning design system and domain conventions; then laws and craft rules.
When two rules pull apart, name the tradeoff.

## Guardrails

- A law or standard guides a decision; it does not prove that a design works.
  Do not invent user research.
- No dark patterns: fake urgency, forced progress, concealed choices, or
  confirmshaming.
- Color is never the only signal. Keep contrast, visible focus, target size,
  reduced motion, and assistive-technology semantics at or above the
  thresholds in `standards.md`.
- Simpler must still keep the controls, information, consent, and recovery
  paths people need.
- Taste beyond the owning design system is a judgment call. Report it
  separately from findings that a rule or standard supports.

## Output

- **Design or build:** the hierarchy and flow, the few laws and craft rules
  that shaped them, the edge states, and the riskiest assumption to test.
  After building, review your own screenshots at both widths and themes
  before you report.
- **Review:** findings ranked by user impact. Each names the element or region
  (quoted text, selector, or screenshot area), the question or rule it fails,
  the change to make, and how to verify the change helped. Do not produce an
  unranked checklist.
- **Check:** each check's command, result, and the widths and themes it
  covered, then what remains unchecked.
