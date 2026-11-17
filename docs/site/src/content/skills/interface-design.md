---
related: [hill-climb, review]
---

## What it does

The agent starts from what the user needs to do: find information, act,
recover from errors, and see that they succeeded. It judges the screen or
flow with UX laws, craft guidance, and standards such as WCAG 2.2.

Your repository's design system owns the look. If there is none, the agent
uses the [design system](../../design-system/) plugin when it is installed, and
otherwise uses no house style and says once that the plugin is missing. A new
screen does not get its own palette or visual identity.

## When to use it

Install the skill, then ask to design, build, review, or check an interface:

> Review the checkout flow in `src/checkout/` and rank what to fix.

Name the screens or journey and the task people need to complete. It works
with React, Vue, and plain HTML. For measured improvement rounds, pair it
with [hill-climb](../hill-climb/).

Browser checks need the app running and `playwright` or `@playwright/test` in
the project. The accessibility script also needs `@axe-core/playwright`.

## How it works

Each review finding names a real element and the rule it fails. Safety and
accessibility come first: missing focus or low contrast outranks taste.

Before it builds a new page or screen, the agent sketches it in the design
system's tokens and checks the sketch against what it would build for any
similar brief. It keeps what the design system prescribes and revises the
generic parts. Reviews flag signs of a templated interface, such as all-caps
labels or a big-number hero, unless they serve the content or the design
system or brief chooses them.

Two bundled scripts check a running UI for accessibility, sideways
scrolling, and token use, and run key tasks under reduced motion, dark mode,
200% text, and grayscale. Automated tools catch only part of accessibility
problems (57% in Deque's study), so a clean run is not proof.

With `--count`, the accessibility script also counts the visible words,
boxes, and controls on each page, so you can show that a simpler version is
simpler. Screen-reader-only text is not counted, and counts never fail a run.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/interface-design/SKILL.md)
links the review questions and browser-check steps.

## What you get

- For design: the hierarchy, flow, loading, empty, error, and success
  states, and the riskiest assumption to test.
- For review: findings ranked by user impact, each with the element, rule,
  fix, and how to check it helped.
- For checks: commands, results, screenshots, the keyboard, widths, and
  themes covered, and what was not checked.

Laws and standards guide decisions but do not prove usability. The agent
does not invent user research.
