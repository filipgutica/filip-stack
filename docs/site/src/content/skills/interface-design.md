---
related: [hill-climb, review]
---

## What it does

Interface design is your agent's guide to screens and flows that people can
use. It brings three kinds of knowledge to the work:

- UX laws, such as Hick's law: more choices make a decision slower.
- Craft rules for emphasis, structure, motion, and the words on the screen.
- Public standards, such as WCAG 2.2 for accessibility, turned into
  yes-or-no review questions.

The look stays with your design system, or with the
[design language](../../design-language/) when the project has none, so the
skill does not invent a new palette for each page.

## When to use it

- Design or build a screen, form, or flow.
- Review a screen or a user journey, with the problems ranked by their effect
  on users.
- Check a running app for accessibility and layout problems before it ships.

Install it with the command above, then ask in plain words. An illustrative
request:

> Review the checkout flow in `src/checkout/` and rank what to fix.

It works the same in React, Vue, or plain HTML projects. To improve an
interface in measured rounds, pair it with [hill-climb](../hill-climb/): the
climb can use this skill's questions as the judges' criteria.

## How it works

Reviews are concrete. Each finding points at a real element on the screen and
the rule it breaks, so you can see the problem and check the fix, rather
than read a list of general advice. Problems that block people, such as
missing focus or low contrast, come before matters of taste.

Your design system stays in charge of how things look. The skill does not
restyle a project to match a generic idea of good design.

Automated tools find only part of the problem. Deque's study found its
automated testing covered 57% of accessibility issues, so a check tells you
what it could not test instead of calling the screen accessible.

## What you get

- For a design: the hierarchy and flow, the rules that shaped them, the edge
  states, and the riskiest assumption to test.
- For a review: findings ranked by their effect on users. Each names the
  element, the rule it breaks, the change to make, and how to check the change
  helped.
- For a check: each check's result at each width and theme, and what is still
  unchecked.

A law or standard guides a decision but does not prove a design works. The
skill does not invent user research, so usability testing stays a separate
step.
