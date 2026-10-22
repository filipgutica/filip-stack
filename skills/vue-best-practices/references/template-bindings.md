# Template and Binding Correctness

## Event Handlers

- Both `@click="fn"` and `@click="fn()"` execute when the event fires. A method handler (`fn`) receives the native event automatically; an inline call (`fn()`) receives only explicitly supplied arguments. Use `fn(arg)` or `fn(arg, $event)` when needed.
- Add the modifier the interaction needs: `.prevent` on form submit handlers that must stop navigation/reload, the matching `.key`/`.stop` modifier wherever default behavior would otherwise fire.

## Rendering

- `:class`/`:style` accept a string, array, or object. Passing the wrong shape silently renders nothing useful — match the binding to the value's actual shape.
- Guard data that loads asynchronously (`v-if="data"`) before rendering it; an unguarded template errors on `undefined` while the fetch is in flight.
- Move expensive expressions (method calls, heavy computation) out of the template into a named `computed`; inline expressions re-run every render.
- Use `v-memo` only for measured performance needs. Include every value needed to invalidate the cached subtree, including model values when their changes must update that subtree; `v-model` is not inherently incompatible with `v-memo`.

## `v-for`

- Use a stable, unique key (`:key="row.id"`); never the array index once the list can reorder, insert, or delete — index keys make Vue reuse the wrong DOM node and bleed state (checkbox/input values) across rows. Index keys are fine on a static/append-only list.
- `v-if` and `v-for` on the same element: in Vue 3, `v-if` evaluates first and cannot see the loop variable. Move the condition to a wrapper `<template>`, or pre-filter with a `computed`.

## Attributes

- A multi-root component, or one that sets `inheritAttrs: false`, must forward `$attrs` explicitly (`v-bind="$attrs"`) where fallthrough is intended.
- `useAttrs()` is not reactive to `watch()` — a `watch(() => attrs.foo, ...)` never fires. Use `onUpdated()` for attr-driven side effects, or promote the value to a real typed prop.

## Anti-Patterns and Patterns

Valid event handlers: choose arguments deliberately.

```vue
<button @click="save">Save with native event</button>
<button @click="save()">Save without arguments</button>
<button @click="remove(row.id)">Remove</button>
```

See [Vue event handling](https://vuejs.org/guide/essentials/event-handling.html#calling-methods-in-inline-handlers) and [v-memo](https://vuejs.org/api/built-in-directives.html#v-memo).

Anti-pattern: index key on a reorderable list.

```vue
<li v-for="(todo, i) in todos" :key="i">
  <input v-model="todo.done" />
</li>
```

Pattern: stable id key.

```vue
<li v-for="todo in todos" :key="todo.id">
  <input v-model="todo.done" />
</li>
```

Anti-pattern: `v-if` reading the `v-for` loop variable on the same element.

```vue
<li v-for="user in users" v-if="user.active" :key="user.id">
  {{ user.name }}
</li>
```

Pattern: move the condition to a wrapper, or pre-filter the list.

```vue
<template v-for="user in activeUsers" :key="user.id">
  <li>{{ user.name }}</li>
</template>
```
