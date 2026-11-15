---
related: [hill-climb, review]
---

## What it does

The agent starts from what the user needs to do: find information, act,
recover from errors, and see that they succeeded. It uses UX laws, craft
guidance, and public standards such as WCAG 2.2 to judge the screen or flow.

Your repository's design system owns the look. If there is none, the agent
uses the default [design system](../../design-system/) when it is installed.
A new screen does not get its own palette or visual identity.

## When to use it

Install the skill, then ask to design, build, review, or check an interface.
For example:

> Review the checkout flow in `src/checkout/` and rank what to fix.

Name the screens or journey and the task people need to complete. It works
with React, Vue, and plain HTML. For measured improvement rounds, pair it
with [hill-climb](../hill-climb/).

Browser checks need the app running and `playwright` or `@playwright/test` in
the project. The accessibility script also needs `@axe-core/playwright`.

## How it works

Design work covers hierarchy, flow, interface copy, and loading, empty,
error, and success states. Checks cover keyboard and touch, phone and desktop
widths, light and dark themes, and reduced motion.

Each review finding points to a real element and the question or rule it
fails. Safety and accessibility come first: missing focus or low contrast
outranks taste.

Two bundled scripts check a running UI. One checks accessibility, sideways
scrolling, and values that bypass the design tokens. The other runs key tasks
under reduced motion, dark mode, 200% text, and grayscale. Automated tools
catch only part of accessibility problems; Deque's study reported 57%. A clean
run does not prove the UI is accessible.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/interface-design/SKILL.md)
links the review questions and browser-check steps.

## What you get

- For design: the hierarchy, flow, reasons, edge states, and the riskiest
  assumption to test.
- For review: findings ranked by user impact, each with the element, rule,
  fix, and how to check it helped.
- For checks: commands, results, screenshots, the widths and themes covered,
  and what was not checked.

Laws and standards guide decisions but do not prove usability. The agent
does not invent user research; usability testing is a separate step.
