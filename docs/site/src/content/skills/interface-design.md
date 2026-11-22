---
related: [hill-climb, review]
---

## What it does

Give interface-design a screen, user flow, or running URL to design, build,
review, or check, along with the user's task. The agent follows your
repository's design system, falling back to the
[design system](../../design-system/) plugin when the repository has none and
the plugin is installed, plus UX laws, craft rules, and WCAG 2.2 AA. Without a
design system, it uses no house style and notes once that the plugin is
missing. Depending on the request, it designs or builds a UI, reviews screens,
or runs browser checks on a live app. You get a design plan, impact-ranked
findings, or check results with screenshots and gaps.

## When to use it

Install the skill, then ask to design, build, review, or check an interface
with the screens and user task:

> Review the checkout flow in `src/checkout/` and rank what to fix.

For measured improvement rounds, pair it with [hill-climb](../hill-climb/).

Browser checks need the app running and `playwright` or `@playwright/test` in
the target project. The target project also needs `@axe-core/playwright` for
the accessibility script. Both drive a real browser, so they work with any web
framework.

## How it works

Every route starts from the user's task and covers loading, empty, error, and
success states across keyboard, touch, 320px, 375px, desktop widths, light and
dark themes where supported, and reduced motion. Safety and accessibility
outrank visual taste.

**Design or build.** The agent sketches the layout in the design system's
tokens when available and revises generic or templated parts. When asked to
build, it implements the UI and reviews screenshots at 375px and desktop widths
in supported light and dark themes.

**Review.** Each finding names a real element and the failed rule (such as WCAG
2.2 AA or Nielsen's heuristics), and flags templated patterns like all-caps
labels or a big-number hero unless they serve the content, brief, or design
system. Taste calls stay separate.

**Check.** Two bundled scripts inspect a running UI:

- `ui-check.mjs` runs axe-core (WCAG 2.0 to 2.2 A and AA), checks sideways
  scrolling, saves screenshots, optionally checks tokens (`--tokens`), and with
  `--count` counts visible words, boxes, and controls without screen-reader-only
  text. Counts never fail a run.
- `ui-modes.mjs` checks 375px layouts under reduced motion, dark mode, 200%
  text, and grayscale, and runs Playwright tasks when supplied via `--tasks`.

Automated tools catch only part of accessibility issues (57% in Deque's 2021
study), so a clean run is not proof and `ui-check.mjs` prints what it did not
check.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/interface-design/SKILL.md)
links the review questions and browser-check steps.

## What you get

- **Design or build:** hierarchy, flow, edge states, and the riskiest
  assumption to test.
- **Review:** impact-ranked findings with element, failed rule, fix, and
  verification step.
- **Check:** commands, results, screenshots, covered widths and themes, and
  unchecked items.

Laws and standards guide decisions without proving usability, and an unrun
check never counts as a pass. The agent does not invent user research.
