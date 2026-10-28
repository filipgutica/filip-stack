---
related: [review, test-audit]
---

## What it does

Vue best practices guides component, composable, and test work in Vue
applications and libraries. Composables are functions that organize Vue-aware
state and behavior. The skill keeps ownership and public contracts explicit.

## When to use it

- Build, refactor, or [review](../review/) `.vue` files and supporting TypeScript.
- Work on reactivity, component data flow, slots, events, or two-way models.
- Check Vue Router, Pinia, VueUse, or Nuxt integration.
- Review component examples and behavior tests.

Project instructions and existing public contracts take precedence. The default
is Vue 3, Composition API, and `<script setup lang="ts">` unless nearby code
uses another style.

## How it works

The skill inspects the component, nearby package patterns, and installed Vue
version before applying version-sensitive guidance. It reads only the references
needed for the task.

- Keeps source state minimal. `computed` derives values; `watch` handles
  side effects.
- Keeps pure parsing, formatting, mapping, and validation in utilities.
  Composables own reactive orchestration and lifecycle behavior.
- Gives reactive-state composables readonly inputs and narrow domain actions
  by default. Mutable return values need an explicit UI model contract.
- Uses typed props, events, slots, and models. Ordinary parent-owned updates
  use props and events; true two-way contracts can use `defineModel`.
- Keeps templates declarative and preserves consumer-facing component contracts.
- Checks security-sensitive templates, HTML, URLs, storage, and exposed secrets
  through the relevant reference.

## What you get

- Vue changes or review guidance consistent with the surrounding project.
- Focused verification for affected behavior, types, and component contracts.

User-visible behavior and slot, event, or model changes favor component tests.
Existing tests remain intended behavior unless the contract changes. Use
[test-audit](../test-audit/) alongside this work when coverage value or preservation
needs closer inspection.
