---
related: [review, test-audit]
---

## What it does

The guidance helps the agent decide who owns each piece of reactive state,
and what a component promises through its props, events, slots, and models.
Your project's rules and existing public APIs win over its defaults.

## When to use it

Install the skill, then ask for Vue work in plain words. The agent picks it
for `.vue` files and the TypeScript that supports them:

> Refactor `UserTable.vue` so the sorting logic moves out of the template.

Use it to build, refactor, or [review](../review/) components, composables,
reactivity, data flow, and tests, including Vue Router, Pinia, VueUse, and
Nuxt.

## How it works

The agent reads the component, nearby patterns, and the installed Vue version
before it picks features; for example, `defineModel` is stable from Vue 3.4.
Unless your code uses another style, it defaults to Vue 3, the Composition
API, and `<script setup lang="ts">`. Other defaults:

- Keep source state small. Derive values with `computed`, and use `watch` for
  side effects.
- Use a composable only for reactivity, side effects, injection, or
  lifecycle hooks, not pure parsing or formatting.
- State composables return read-only state and named actions, such as
  `refresh`, not setters like `setLoading`.
- Type props, events, slots, and models. Use `defineModel` only for true
  two-way bindings.
- Keep templates declarative.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/vue-best-practices/SKILL.md)
links the detailed conventions and version notes.

## What you get

- Vue changes or review notes that match the surrounding code.
- Focused type, lint, and component checks for the affected behavior.

User-visible changes and slot, event, or model contracts get component tests.
Public API changes need your approval. For a closer look at test value, use
[test-audit](../test-audit/).
