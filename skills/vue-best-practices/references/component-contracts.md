# Component Contracts

## Props, Emits, Slots, Models

- Prefer type-based `defineProps`, `defineEmits`, `defineSlots`, and `defineModel`.
- Use `withDefaults` when defaults are clearer than destructuring.
- As a local style default, prefer overload syntax. Named-tuple emits are also supported in Vue 3.3+; preserve the surrounding convention:

```ts
const emit = defineEmits<{
  (e: 'row:click', row: Row): void
  (e: 'update:config', config: Config): void
}>()
```

- Keep event naming consistent within a component family. If the surface uses colon-style events, continue that pattern.
- Use `defineModel` with `v-model:prop` when the component truly owns a two-way model contract.
- As a local API preference, use named models (`v-model:filter-selection`, `v-model:column-visibility`) for multiple or domain-specific models. An unnamed `modelValue` is also a valid standard contract for a primary value.
- Check the Vue version requirements in `../SKILL.md`. A `defineModel` default can leave the child initialized while the parent value is `undefined`; make initialization ownership explicit.

## Slot Payloads

- Type slots from the consumer's perspective.
- Prefer payloads that expose the meaningful domain object, such as `{ row, column, rowIndex, selected }`.
- Avoid convenience props that hide data flow or encourage narrow examples, such as `rowValue` when `row` is clearer.
- When mixing explicit named slots with dynamic slots, remember that TypeScript index signatures also apply to explicit slot names. Choose an index-signature shape that keeps consumer inference useful.

## Public API Stability

- Preserve public APIs, including unreleased ones, unless the user authorizes the intended contract change.
- If a breaking change is required, update docs, examples, tests, and call sites in the same change.
- For unreleased package work, remove deprecated aliases and compatibility shims when cleanup is requested.
- Do not keep stale names, wrappers, or aliases only because they existed earlier in the spike.

## Type Integrity

- Avoid `any` unless the library boundary truly requires it.
- Prefer generics, narrowing, and `keyof` constraints for row/entity-shaped APIs.
- Avoid unsafe casts when a type guard, contextual typing, or better API shape can express the runtime truth.

## Anti-Patterns and Patterns

Anti-pattern: untyped emits hide the component contract.

```ts
const emit = defineEmits(['rowClick', 'update'])

emit('update', nextConfig)
```

Pattern: type emits with explicit event names and payloads.

```ts
const emit = defineEmits<{
  (e: 'row:click', row: Row): void
  (e: 'update:config', config: Config): void
}>()

emit('update:config', nextConfig)
```

Anti-pattern: slot payload exposes convenience values that hide the data flow.

```ts
defineSlots<{
  cell(props: { value: string }): unknown
}>()
```

Pattern: expose the domain object and useful context.

```ts
defineSlots<{
  cell(props: { row: Row, column: Column, rowIndex: number, selected: boolean }): unknown
}>()
```

Valid standard contract: an unnamed model for a component's primary value.

```ts
const modelValue = defineModel<string[]>()
```

Local preference: a named model makes the domain explicit, particularly with multiple models.

```ts
const filterSelection = defineModel<string[]>('filterSelection')
```

Anti-pattern: casting away an unclear row shape.

```ts
const value = (row as any)[column.key]
```

Pattern: constrain the key to the row type.

```ts
const getValue = <TRow, TKey extends keyof TRow>(row: TRow, key: TKey) => row[key]
```
