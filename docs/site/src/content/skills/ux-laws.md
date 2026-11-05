---
related: [planning, review]
---

## What it does

UX laws are well-known rules of thumb about how people use interfaces. For
example, Hick's law says that more choices make a decision slower, and Fitts's
law says that small, distant targets are harder to hit. This skill picks the
few laws out of 21 that matter for your screen or flow, applies them, and
names the tradeoff when two of them pull in different directions.

## When to use it

- Design navigation, forms, interaction flows, or interface states.
- Review a user journey and rank the problems by their effect on users.
- Explain hierarchy and interaction choices while you plan a feature.

It does not cover visual branding. Install it with the command above, then
ask in plain words. An illustrative request:

> Review the checkout flow in `src/checkout/` with UX laws.

## How it works

The agent first names the main user, their task, the context, and the
constraints. Where evidence is missing, it states an assumption with clear
limits. It covers the whole path, including loading, empty, error, and success
states, and keyboard, touch, and small-screen use when they apply.

When laws conflict, the agent resolves them in this order: user safety and
accessibility first, then what the user is trying to do and the evidence, then
the conventions of the domain, and the laws last. It recommends the smallest
change that helps.

The skill keeps contrast, visible focus, usable target sizes, reduced-motion
settings, and screen-reader meaning, and it never uses color as the only signal.
A simpler design must still keep the controls, information, consent, and
undo paths people need. It does not use dark patterns, such as fake urgency or
hidden choices.

## What you get

- For a design: the hierarchy and flow, the laws that shaped them, the edge
  states, and the riskiest assumption to test.
- For a review: findings ranked by their effect on users, each with the
  problem, the law behind it, the change to make, and how to check that the
  change helped.

A law guides a decision but does not prove that a design works. The skill does
not invent user research, so usability testing stays a separate step.
