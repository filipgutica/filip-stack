---
related: [review, test-audit]
---

## What it does

The guidance helps the agent decide who owns reactive state and what a
component promises its consumers through props, events, slots, and models.
Project rules and established public APIs take precedence over its defaults.

## When to use it

Install the skill with the command above, then ask for Vue work in plain
words. The agent selects it for `.vue` files and supporting TypeScript.
For example:

> Refactor `UserTable.vue` so the sorting logic moves out of the template.

Use it to build, refactor, or [review](../review/) components, composables,
reactivity, and data flow. It also covers component examples, behavior tests,
and integration with Vue Router, Pinia, VueUse, and Nuxt.

## How it works

The agent reads the component, nearby patterns, and installed Vue version
before choosing features. For example, `defineModel` is stable from Vue 3.4.
It loads only the topics needed for the task.

Unless local code uses another style, the defaults are Vue 3, Composition API,
and `<script setup lang="ts">`. Other defaults include:

- Keep source state small, derive values with `computed`, and use `watch` for side effects.
- Keep pure parsing and formatting in plain functions. Use composables when
  logic needs reactivity, side effects, injection, or lifecycle hooks.
- Return read-only state and named actions such as `refresh` or `selectRow`
  from state composables by default. Explicit UI model contracts may expose
  mutable refs; arbitrary changes go through actions, not `setLoading`-style setters.
- Type props, events, slots, and models. Use props and events for ordinary
  parent-owned updates and `defineModel` for true two-way bindings.
- Keep templates declarative and move nontrivial branching and formatting into script.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/vue-best-practices/SKILL.md)
links the detailed conventions and version-sensitive references.

## What you get

- Vue changes or review notes consistent with the surrounding code.
- Focused type, lint, and component checks for affected behavior and contracts.

User-visible changes and slot, event, or model contracts favor component tests.
Existing tests remain intended behavior unless the contract changes on purpose.
Public API changes need your authorization. For a closer test-value check,
use [test-audit](../test-audit/).
