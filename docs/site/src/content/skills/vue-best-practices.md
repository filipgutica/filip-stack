---
related: [review, test-audit]
---

## What it does

Ask your agent to build, refactor, or review `.vue` files or supporting
TypeScript. It checks your installed Vue version and nearby patterns, then loads
only the guides your task needs. It keeps state ownership clear and types each
component's props, events, slots, and models, while your project's rules and
public APIs win over defaults. You get code changes or review notes, backed by
applicable project checks.

## When to use it

Use this skill for Vue components, **composables** (reusable functions using Vue
reactivity or lifecycle hooks), data flow, templates, and tests, including Vue
Router, Pinia, VueUse, and Nuxt.

> Refactor `UserTable.vue` so the sorting logic moves out of the template.

Existing rules and public APIs win over defaults. Public API changes need your
approval.

## How it works

1. **Match your project and Vue version.** The agent checks nearby code and the
   installed Vue version before picking features like `defineModel` (3.4+) or
   `useTemplateRef` (3.5+). Unless nearby code uses another style, it defaults
   to Vue 3, the Composition API, and `<script setup lang="ts">`.
2. **Apply ownership and contract defaults.** It keeps source state small,
   derives values with `computed`, and reserves `watch` for side effects. It
   puts pure logic in plain helpers, defaults reactive-state composables to
   read-only state and named actions (`refresh`) except for owned UI models,
   types component contracts, and keeps templates declarative.
3. **Run applicable checks.** For code changes, it runs the project's applicable
   `typecheck`, `lint`, `stylelint`, unit, and component tests without weakening
   existing tests.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/vue-best-practices/SKILL.md)
links the detailed guides and version notes.

## What you get

- Vue changes or review notes matching nearby conventions.
- Applicable type, lint, and component test results for affected behavior.

For test quality, use [test-audit](../test-audit/).
