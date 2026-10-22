---
name: vue-best-practices
description: Build, refactor, or review Vue components, composables, component contracts, and tests, including Vue Router, Pinia, VueUse, and Nuxt integration. Use for .vue files and TypeScript that supports Vue components. Default to Vue 3, Composition API, and script setup with TypeScript unless the project uses another style.
---

# Vue Best Practices

Use this skill for Vue applications and component libraries. Project instructions and established public contracts take precedence over this skill's style defaults.

## Core Defaults

- Use Vue 3, Composition API, and `<script setup lang="ts">` unless nearby code clearly uses another style.
- This skill's style default is `<script>` (including `<script setup lang="ts">`), then `<template>`, then `<style>`. This is a maintained preference, not a Vue requirement; follow explicit project or user instructions when they differ.
- Follow nearby component, package, and test conventions before introducing a new pattern.
- Check the installed Vue version: reactive props destructuring is enabled by default in 3.5+, `defineModel` is stable in 3.4+, and getter-based `toRef`, `defineSlots`, and named-tuple emits require 3.3+.
- In Vue 3.5+, prefer `useTemplateRef('name')` for static template refs matching `ref="name"`; add a generic when type inference needs help. Keep `ref` and `shallowRef` for reactive state or older Vue versions.
- In Vue 3.5+, prefer reactive prop destructuring in `<script setup>` when it matches local style; pass `toRef(() => prop)` to composables expecting a ref. In earlier versions, retain `props.foo` or use a compatible prop ref.
- Prefer `v-model:prop` plus `defineModel` for true two-way component contracts; use props plus emits for ordinary parent-owned updates.
- Keep source state minimal, derive with `computed`, and use `watch` for side effects.
- Prefer typed `defineProps`, `defineEmits`, `defineSlots`, and `defineModel`.
- Keep components focused. Extract pure logic into utilities/helpers; extract local composables when Vue reactivity, side effects, lifecycle hooks, or orchestration make a component hard to scan.

## Utilities vs Composables

- Prefer reusable utilities/helpers for pure logic such as parsing, formatting, mapping, validation, and other deterministic transformations that do not need Vue APIs.
- Use composables when extracted logic depends on reactive state, shared/reusable reactive state, watchers, computed refs, side effects tied to reactivity, dependency injection, or Vue lifecycle hooks.
- Do not wrap pure logic in a composable just because it is used from a component; keep composables focused on Vue-aware orchestration.

## Local Composable Defaults

These ownership conventions are project defaults, not Vue requirements. The examples in `references/composables.md` illustrate these defaults; preserve established contracts when a different shape is intentional.

- Prefer these shapes for feature/project composables:
  - API-style composables expose domain functions as the primary return surface, like `useDashboardApi`. They may keep local mutable refs internally and may expose owned readonly/computed coordination signals only when needed.
  - Reactive-state composables accept `Readonly<Ref<T>>` or `ComputedRef<T>` inputs, own every ref, computed value, and local variable they create, and return readonly refs/computed values plus narrow domain actions by default.
- Reactive-state composables may return owned mutable refs only when those refs are explicitly UI model state for child component `v-model`/`v-bind` binding. Arbitrary caller mutation should still go through named actions unless the mutable ref is part of that UI model contract.
- Do not mix ownership. Do not mutate caller-owned refs, return mutable refs as a general escape hatch, or combine externally mutable inputs with unrelated internally mutable outputs.
- Prefer narrow behavior methods over setter-style APIs when a composable must expose actions. Expose domain actions such as `refresh`, `open`, or `selectRow`; avoid leaking internal state management through methods like `setLoading`, `setError`, or `setRows`.

## Reference Guide

Read only the references needed for the task:

- [Reactivity](references/reactivity.md) - refs, computed values, watchers, prop destructuring, async setup, and effect cleanup.
- [Composables](references/composables.md) - extraction, ownership, readonly inputs, return surfaces, and instance vs shared state.
- [Component data flow](references/component-data-flow.md) - props/events, models, injection, persistence, fetching, and navigation guards.
- [Component contracts](references/component-contracts.md) - typed props/emits/slots/models, slot payloads, and public API stability.
- [Component libraries and testing](references/component-libraries-and-testing.md) - examples, i18n, behavioral assertions, negative paths, and mock cleanup.
- [Template bindings](references/template-bindings.md) - event handlers, list keys, directive ordering, attrs, and expensive expressions.
- [Security](references/security.md) - templates, HTML, URLs, styles, auth storage, and secret exposure.

## Sources

Use the installed package version and current official docs for version-sensitive Vue/Nuxt/Pinia/VueUse questions. Context7 can help locate documentation; verify its version matches the project.

- Vue Guide and API: <https://vuejs.org/guide/> and <https://vuejs.org/api/>

- Vue Style Guide priority A/B/C: <https://vuejs.org/style-guide/>
- Nuxt docs: <https://nuxt.com/docs>
- VueUse docs: <https://vueuse.org/>
- Pinia docs: <https://pinia.vuejs.org/>

## Working Rules

- Before editing Vue code, inspect the current component and nearby package patterns.
- Keep templates declarative; move non-trivial branching, formatting, and derived data into script-level helpers or computed values.
- Prefer clear consumer-facing slot payloads. For row/table slots, prefer `{ row, column, rowIndex, selected }` over convenience values that hide data flow.
- As a local style default, prefer overload-style emits. Vue 3.3+ also supports named tuples; preserve the surrounding convention:

```ts
const emit = defineEmits<{
  (e: 'row:click', row: Row): void
}>()
```

- As a local API default, prefer explicit `Readonly<Ref<T>>` inputs for internal composables. Getter inputs and `MaybeRefOrGetter` are also valid when the intended caller contract benefits from them; normalize inside the reactive effect so dependencies are tracked.
- Preserve public APIs unless the user authorizes the intended contract change, including in unreleased packages.
- Do not add compatibility shims for unreleased APIs when the user asks for cleanup.

## Verification

- For Vue behavior changes, prefer component tests when user-visible behavior or slot/emit/model contracts are affected.
- Run the package or app's focused `typecheck`, `lint`, `stylelint`, unit, and component test commands as applicable.
- Treat existing tests as intended behavior by default. Update tests when the intended contract changes; do not weaken tests to fit an implementation.
