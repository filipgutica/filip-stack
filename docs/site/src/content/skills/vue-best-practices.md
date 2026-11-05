---
related: [review, test-audit]
---

## What it does

Vue gives you several ways to do the same thing, and a codebase gets harder to
follow when every component picks a different one. This skill settles who
owns each piece of state and what a component promises its parents. Your
project's own rules and existing public APIs always come first.

## When to use it

- Build, refactor, or [review](../review/) `.vue` files and the TypeScript
  around them.
- Work on reactivity, data flow between components, slots, events, or
  two-way bindings.
- Check how a component uses Vue Router, Pinia, VueUse, or Nuxt.
- Review component examples and behavior tests.

Install it with the command above. The agent picks it when you work on Vue
code, so ask in plain words. An illustrative request:

> Refactor `UserTable.vue` so the sorting logic moves out of the template.

## How it works

The agent first reads the component, the patterns nearby, and the installed
Vue version, because some features need a recent version: for example,
`defineModel` is stable from Vue 3.4. It then reads only the guidance topics
the task needs, such as reactivity, composables, component contracts, or
security.

Unless nearby code clearly uses another style, it writes Vue 3 with the
Composition API and `<script setup lang="ts">`. A few of its defaults:

- Keep stored state small. Derive values with `computed`, and use `watch` only
  for side effects.
- Put pure logic, such as parsing or formatting, in plain functions. Use a
  *composable*, a function that holds Vue state and behavior, only when the
  logic needs Vue itself: reactive state, watchers, side effects, dependency
  injection, or lifecycle hooks.
- A composable returns read-only state and named actions, such as `refresh`
  or `selectRow`, instead of setters like `setLoading`.
- Type every prop, event, slot, and model. Use props and events for ordinary
  updates from a parent, and `defineModel` only for true two-way bindings.
- Keep templates simple, and move branching and formatting into the script.

## What you get

- Vue changes, or review notes, that match the code around them.
- Focused checks, such as type checks, lint, and component tests, for the
  behavior and contracts the change touches.

Changes to what users see, or to a component's slots, events, or models, get
component tests. Existing tests count as intended behavior unless the contract
is meant to change. The agent keeps public APIs as they are unless you approve
the change. For a closer look at test value, use [test-audit](../test-audit/).
