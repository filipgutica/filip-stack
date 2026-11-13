---
related: [hill-climb, review]
---

## What it does

The starting point is the user's task: finding information, acting, recovering
from errors, and recognizing success. UX laws, craft guidance, and public
standards such as WCAG 2.2 help the agent assess the screen or flow.

Your repository's design system owns the look. When there is none, the agent
uses the default [design system](../../design-system/) if available. A new screen
does not get an unrelated palette or visual identity.

## When to use it

Install the skill with the command above, then ask to design, build, review,
or check an interface. The agent selects it when the request matches. For example:

> Review the checkout flow in `src/checkout/` and rank what to fix.

Name the screens or journey and the task people need to complete. The skill
works with React, Vue, and plain HTML. For measured improvement rounds, pair
it with [hill-climb](../hill-climb/).

For browser checks, the app must be running. Its project needs `playwright`
or `@playwright/test`; the accessibility script also needs `@axe-core/playwright`.

## How it works

Design work covers hierarchy, flow, interface copy, and loading, empty, error,
and success states. Checks include keyboard and touch, phone and desktop
widths, supported light and dark themes, and reduced motion.

Reviews point to an actual element and the question or rule it fails. User
safety and accessibility come first; problems such as missing focus and low
contrast take priority over taste. The owning design system stays in charge
of appearance.

Two bundled scripts check a running UI: one for accessibility, sideways
scrolling, and off-token values; one for key tasks under reduced motion,
dark mode, 200% text, and grayscale. Unrun checks remain unchecked. Automated
tools cover only part of accessibility: Deque's study reported 57% coverage,
so a clean run does not establish accessibility.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/interface-design/SKILL.md)
links the review questions and exact browser-check instructions.

## What you get

- For design: the hierarchy, flow, reasons, edge states, and riskiest assumption to test.
- For review: findings ranked by user impact, each naming the element, rule,
  proposed fix, and how to verify it helped.
- For checks: commands, results, screenshots, widths and themes covered,
  and what remains unchecked.

Laws and standards guide decisions; they do not prove usability. The agent
does not invent user research, and usability testing remains a separate step.
